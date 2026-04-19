import {
  type TranscribeResult,
  chunkAndEmbed,
  runActionItems,
  runChapters,
  runMindmap,
  runSummary,
  transcribe,
} from '@gravador/ai';
import type { Locale, TranscriptSegment } from '@gravador/core';
import { shortId } from '@gravador/core';
import { getAdminStorage, getDb } from '@gravador/db';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';

/**
 * Orchestrates the full AI pipeline for a single recording:
 *   1. Transcribe (Whisper v3 via Groq by default)
 *   2. Persist transcript + segments
 *   3. Fan-out: summary, action items, mindmap, chapters
 *   4. Embed chunks into Firestore vector fields for RAG
 *
 * Can be invoked from a Cloud Function (Firestore onCreate trigger on `jobs`)
 * or called directly.
 */
export async function processRecording(payload: { recordingId: string; locale?: Locale }) {
  const db = getDb();
  const { recordingId } = payload;

  const recDoc = await db.collection('recordings').doc(recordingId).get();
  if (!recDoc.exists) throw new Error(`recording ${recordingId} not found`);
  const recording = recDoc.data()!;

  // Idempotency guard: skip if already processed
  if (recording.status === 'ready') {
    console.log('[pipeline] recording already processed, skipping');
    return { recordingId, segments: 0, chunks: 0 };
  }

  const workspaceAI = await loadWorkspaceAI(db, recording.workspaceId);

  try {
    await setStatus(db, recordingId, 'transcribing');

    // Get a signed URL for the audio file
    const storage = getAdminStorage();
    const bucket = storage.bucket();
    const [audioUrl] = await bucket.file(recording.storagePath).getSignedUrl({
      action: 'read',
      expires: Date.now() + 3600 * 1000,
    });
    if (!audioUrl) throw new Error('failed to sign audio URL');

    const tx = await transcribe({
      audioUrl,
      locale: payload.locale ?? recording.locale ?? 'auto',
      provider: workspaceAI.transcribeProvider,
    });
    const segments = await persistTranscript(db, recordingId, tx);
    console.log('[pipeline] transcribed', { segments: segments.length });

    const locale: Locale = tx.detectedLocale ?? payload.locale ?? recording.locale ?? 'pt-BR';

    await setStatus(db, recordingId, 'summarizing');
    const resolve = (agent: string) => ({
      provider: (workspaceAI.agentModels[agent]?.provider ?? workspaceAI.chatProvider) as
        | 'anthropic'
        | 'openai'
        | 'google'
        | 'ollama'
        | 'openrouter',
      model: workspaceAI.agentModels[agent]?.model ?? workspaceAI.chatModel,
    });

    const [summary, actions, mindmap, chapters] = await Promise.allSettled([
      runSummary({
        segments,
        fullText: tx.fullText,
        locale,
        provider: resolve('summarize').provider,
        model: resolve('summarize').model,
        keys: workspaceAI.keys,
      }),
      runActionItems({
        segments,
        locale,
        provider: resolve('actionItems').provider,
        model: resolve('actionItems').model,
        keys: workspaceAI.keys,
      }),
      runMindmap({
        fullText: tx.fullText,
        locale,
        provider: resolve('mindmap').provider,
        model: resolve('mindmap').model,
        keys: workspaceAI.keys,
      }),
      runChapters({
        segments,
        locale,
        provider: resolve('chapters').provider,
        model: resolve('chapters').model,
        keys: workspaceAI.keys,
      }),
    ]);

    const outputsCollection = db.collection('recordings').doc(recordingId).collection('ai_outputs');

    if (summary.status === 'fulfilled')
      await insertOutput(outputsCollection, recordingId, 'summary', summary.value, locale);
    if (actions.status === 'fulfilled')
      await insertOutput(outputsCollection, recordingId, 'action_items', actions.value, locale);
    if (mindmap.status === 'fulfilled')
      await insertOutput(outputsCollection, recordingId, 'mindmap', mindmap.value, locale);
    if (chapters.status === 'fulfilled')
      await insertOutput(outputsCollection, recordingId, 'chapters', chapters.value, locale);

    if (actions.status === 'fulfilled') {
      const actionItemsCollection = db
        .collection('recordings')
        .doc(recordingId)
        .collection('action_items');
      await commitInBatches(
        db,
        (
          actions.value.payload as Array<{
            text: string;
            assignee?: string;
            dueDate?: string;
            sourceSegmentIds?: string[];
          }>
        ).map((a) => ({
          ref: actionItemsCollection.doc(),
          data: {
            recordingId,
            text: a.text,
            assignee: a.assignee ?? null,
            dueDate: a.dueDate ?? null,
            done: false,
            sourceSegmentIds: a.sourceSegmentIds ?? [],
            createdAt: FieldValue.serverTimestamp(),
          },
        })),
      );
    }

    await setStatus(db, recordingId, 'embedding');
    const chunks = await chunkAndEmbed(segments, {
      provider: workspaceAI.embeddingProvider,
      model: workspaceAI.embeddingModel,
      keys: workspaceAI.keys,
    });
    if (chunks.length) {
      const embCollection = db.collection('recordings').doc(recordingId).collection('embeddings');
      await commitInBatches(
        db,
        chunks.map((c, i) => ({
          ref: embCollection.doc(),
          data: {
            recordingId,
            workspaceId: recording.workspaceId,
            chunkIndex: i,
            startSegmentId: c.startSegmentId ?? null,
            endSegmentId: c.endSegmentId ?? null,
            startMs: c.startMs,
            endMs: c.endMs,
            content: c.content,
            embedding: FieldValue.vector(c.embedding),
            model: workspaceAI.embeddingModel ?? 'text-embedding-3-small',
            createdAt: FieldValue.serverTimestamp(),
          },
        })),
      );
    }

    await setStatus(db, recordingId, 'ready');
    return { recordingId, segments: segments.length, chunks: chunks.length };
  } catch (err) {
    // Mark recording as failed so it doesn't stay stuck
    await setStatus(db, recordingId, 'failed').catch(() => {});
    throw err;
  }
}

async function setStatus(db: Firestore, id: string, status: string) {
  await db.collection('recordings').doc(id).update({
    status,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

async function persistTranscript(
  db: Firestore,
  recordingId: string,
  tx: TranscribeResult,
): Promise<TranscriptSegment[]> {
  const transcriptsRef = db.collection('recordings').doc(recordingId).collection('transcripts');

  // Upsert: delete existing then create
  const existing = await transcriptsRef.limit(1).get();
  if (!existing.empty) {
    await existing.docs[0]!.ref.delete();
  }

  const transcriptRef = await transcriptsRef.add({
    recordingId,
    provider: tx.provider,
    model: tx.model,
    detectedLocale: tx.detectedLocale ?? null,
    fullText: tx.fullText,
    createdAt: FieldValue.serverTimestamp(),
  });

  // Delete existing segments
  const segCollection = db
    .collection('recordings')
    .doc(recordingId)
    .collection('transcript_segments');
  const oldSegs = await segCollection.get();
  if (!oldSegs.empty) {
    await commitInBatches(
      db,
      oldSegs.docs.map((doc) => ({ ref: doc.ref, delete: true })),
    );
  }

  // Insert new segments (chunked to stay under 500-operation batch limit)
  const rows: TranscriptSegment[] = [];
  const ops: BatchOp[] = [];
  for (const s of tx.segments) {
    const id = shortId(24);
    const ref = segCollection.doc(id);
    ops.push({
      ref,
      data: {
        transcriptId: transcriptRef.id,
        recordingId,
        speakerId: s.speakerId ?? null,
        startMs: s.startMs,
        endMs: s.endMs,
        text: s.text,
        confidence: s.confidence ?? null,
      },
    });
    rows.push({
      id,
      startMs: s.startMs,
      endMs: s.endMs,
      speakerId: s.speakerId,
      text: s.text,
      confidence: s.confidence,
    });
  }
  await commitInBatches(db, ops);

  return rows;
}

async function insertOutput(
  collection: FirebaseFirestore.CollectionReference,
  recordingId: string,
  kind: string,
  result: {
    payload: unknown;
    provider: string;
    model: string;
    promptVersion: string;
    latencyMs: number;
  },
  locale: Locale,
) {
  // Upsert by kind: use kind as doc ID
  await collection.doc(kind).set({
    recordingId,
    kind,
    payload: result.payload,
    provider: result.provider,
    model: result.model,
    promptVersion: result.promptVersion,
    latencyMs: result.latencyMs,
    locale,
    costCents: 0,
    createdAt: FieldValue.serverTimestamp(),
  });
}

async function loadWorkspaceAI(db: Firestore, workspaceId: string) {
  const wsDoc = await db.collection('workspaces').doc(workspaceId).get();
  const s = (wsDoc.data()?.aiSettings ?? {}) as {
    transcribeProvider?: 'groq' | 'openai' | 'local-faster-whisper';
    chatProvider?: 'anthropic' | 'openai' | 'google' | 'ollama' | 'openrouter';
    chatModel?: string;
    embeddingProvider?: 'openai' | 'ollama';
    embeddingModel?: string;
    byokKeys?: Record<string, string>;
    agentModels?: Record<string, { provider?: string; model?: string }>;
  };
  return {
    transcribeProvider: s.transcribeProvider,
    chatProvider: s.chatProvider ?? ('anthropic' as const),
    chatModel: s.chatModel,
    embeddingProvider: s.embeddingProvider,
    embeddingModel: s.embeddingModel,
    keys: s.byokKeys ?? {},
    agentModels: s.agentModels ?? {},
  };
}

// ── Batch helper: commits in chunks of 490 to stay under Firestore's 500-op limit ──

interface BatchOp {
  ref: FirebaseFirestore.DocumentReference;
  data?: Record<string, unknown>;
  delete?: boolean;
}

const BATCH_LIMIT = 490;

async function commitInBatches(db: Firestore, ops: BatchOp[]) {
  for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
    const chunk = ops.slice(i, i + BATCH_LIMIT);
    const batch = db.batch();
    for (const op of chunk) {
      if (op.delete) {
        batch.delete(op.ref);
      } else {
        batch.set(op.ref, op.data!);
      }
    }
    await batch.commit();
  }
}
