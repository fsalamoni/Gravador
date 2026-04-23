import {
  type GenerationProvider,
  type TranscribeResult,
  chunkAndEmbed,
  runAgentTaskWithFallback,
  transcribe,
} from '@gravador/ai';
import type { Locale, TranscriptSegment } from '@gravador/core';
import { shortId } from '@gravador/core';
import { getAdminStorage, getDb } from '@gravador/db';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';

// ── Retry helper with exponential backoff ──

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1_000;
const RECORDING_LIFECYCLE_SCHEMA_VERSION = 1;

async function withRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * 2 ** attempt + Math.random() * 500;
        console.warn(
          `[retry] ${label} attempt ${attempt + 1} failed, retrying in ${Math.round(delay)}ms`,
          err,
        );
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

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
  const sourceRecordingVersion =
    typeof (recording.lifecycle as { recordingVersion?: number } | undefined)?.recordingVersion ===
    'number'
      ? (recording.lifecycle as { recordingVersion: number }).recordingVersion
      : 1;

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

    const tx = await withRetry('transcribe', () =>
      transcribe({
        audioUrl,
        locale: payload.locale ?? recording.locale ?? 'auto',
        provider: workspaceAI.transcribeProvider,
        model: workspaceAI.transcribeModel,
        keys: {
          groq: workspaceAI.keys.groq,
          openai: workspaceAI.keys.openai,
          localBaseUrl: process.env.LOCAL_WHISPER_URL,
        },
      }),
    );
    const segments = await persistTranscript(db, recordingId, tx, 'system');
    console.log('[pipeline] transcribed', { segments: segments.length });

    const locale: Locale = tx.detectedLocale ?? payload.locale ?? recording.locale ?? 'pt-BR';

    await setStatus(db, recordingId, 'summarizing');
    const resolveChat = (agent: string) => ({
      provider: (workspaceAI.agentModels[agent]?.provider ?? workspaceAI.chatProvider) as
        | 'anthropic'
        | 'openai'
        | 'google'
        | 'ollama'
        | 'openrouter',
      model: workspaceAI.agentModels[agent]?.model ?? workspaceAI.chatModel,
    });

    const resolveEmbedding = (agent: string) => ({
      provider: (workspaceAI.agentModels[agent]?.provider ?? workspaceAI.embeddingProvider) as
        | 'openai'
        | 'ollama'
        | undefined,
      model: workspaceAI.agentModels[agent]?.model ?? workspaceAI.embeddingModel,
    });

    const runChatTask = (
      task:
        | 'summary'
        | 'actionItems'
        | 'mindmap'
        | 'chapters'
        | 'quotes'
        | 'sentiment'
        | 'flashcards',
    ) => {
      const resolved = resolveChat(task);
      return runAgentTaskWithFallback({
        task,
        preferredProvider: resolved.provider as GenerationProvider,
        preferredModel: resolved.model,
        keys: workspaceAI.keys,
        locale,
        fullText: tx.fullText,
        segments,
      });
    };

    const [summary, actions, mindmap, chapters, quotes, sentiment, flashcards] =
      await Promise.allSettled([
        withRetry('summary', () => runChatTask('summary')),
        withRetry('actionItems', () => runChatTask('actionItems')),
        withRetry('mindmap', () => runChatTask('mindmap')),
        withRetry('chapters', () => runChatTask('chapters')),
        withRetry('quotes', () => runChatTask('quotes')),
        withRetry('sentiment', () => runChatTask('sentiment')),
        withRetry('flashcards', () => runChatTask('flashcards')),
      ]);

    const outputsCollection = db.collection('recordings').doc(recordingId).collection('ai_outputs');

    // Track per-pipeline status
    const pipelineResults: Record<string, 'ok' | 'failed'> = {};
    const pipelineEntries: Array<[string, PromiseSettledResult<unknown>]> = [
      ['summary', summary],
      ['action_items', actions],
      ['mindmap', mindmap],
      ['chapters', chapters],
      ['quotes', quotes],
      ['sentiment', sentiment],
      ['flashcards', flashcards],
    ];

    for (const [kind, result] of pipelineEntries) {
      if (result.status === 'fulfilled') {
        pipelineResults[kind] = 'ok';
      } else {
        pipelineResults[kind] = 'failed';
        console.error(`[pipeline] ${kind} failed after retries:`, result.reason);
      }
    }

    if (summary.status === 'fulfilled')
      await insertOutput(outputsCollection, recordingId, 'summary', summary.value, locale, {
        actorId: 'system',
        sourceRecordingVersion,
      });
    if (actions.status === 'fulfilled')
      await insertOutput(outputsCollection, recordingId, 'action_items', actions.value, locale, {
        actorId: 'system',
        sourceRecordingVersion,
      });
    if (mindmap.status === 'fulfilled')
      await insertOutput(outputsCollection, recordingId, 'mindmap', mindmap.value, locale, {
        actorId: 'system',
        sourceRecordingVersion,
      });
    if (chapters.status === 'fulfilled')
      await insertOutput(outputsCollection, recordingId, 'chapters', chapters.value, locale, {
        actorId: 'system',
        sourceRecordingVersion,
      });
    if (quotes.status === 'fulfilled')
      await insertOutput(outputsCollection, recordingId, 'quotes', quotes.value, locale, {
        actorId: 'system',
        sourceRecordingVersion,
      });
    if (sentiment.status === 'fulfilled')
      await insertOutput(outputsCollection, recordingId, 'sentiment', sentiment.value, locale, {
        actorId: 'system',
        sourceRecordingVersion,
      });
    if (flashcards.status === 'fulfilled')
      await insertOutput(outputsCollection, recordingId, 'flashcards', flashcards.value, locale, {
        actorId: 'system',
        sourceRecordingVersion,
      });

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
    const embedding = resolveEmbedding('embed');
    const chunks = await withRetry('embedding', () =>
      chunkAndEmbed(segments, {
        provider: embedding.provider,
        model: embedding.model,
        keys: workspaceAI.keys,
      }),
    );
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
            model:
              embedding.model ??
              (embedding.provider === 'ollama' ? 'nomic-embed-text' : 'text-embedding-3-small'),
            createdAt: FieldValue.serverTimestamp(),
          },
        })),
      );
    }

    await db.collection('recordings').doc(recordingId).update({
      status: 'ready',
      pipelineResults,
      'lifecycle.schemaVersion': RECORDING_LIFECYCLE_SCHEMA_VERSION,
      'lifecycle.lastEvent': 'pipeline_updated',
      'lifecycle.lastEventAt': FieldValue.serverTimestamp(),
      'lifecycle.lastEventBy': 'system',
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { recordingId, segments: segments.length, chunks: chunks.length, pipelineResults };
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
  actorId: string,
): Promise<TranscriptSegment[]> {
  const transcriptsRef = db.collection('recordings').doc(recordingId).collection('transcripts');

  let nextVersion = 1;
  const existing = await transcriptsRef.limit(1).get();
  if (!existing.empty) {
    const previous = existing.docs[0]!;
    const previousData = previous.data();
    const currentVersion =
      typeof previousData.transcriptVersion === 'number' ? previousData.transcriptVersion : 1;
    nextVersion = currentVersion + 1;

    await db
      .collection('recordings')
      .doc(recordingId)
      .collection('transcript_revisions')
      .add({
        recordingId,
        transcriptId: previous.id,
        fromVersion: currentVersion,
        toVersion: nextVersion,
        previousFullText: typeof previousData.fullText === 'string' ? previousData.fullText : '',
        nextFullText: tx.fullText,
        editedBy: actorId,
        source: 'retranscribe',
        createdAt: FieldValue.serverTimestamp(),
      });

    await previous.ref.delete();
  }

  const transcriptRef = await transcriptsRef.add({
    recordingId,
    provider: tx.provider,
    model: tx.model,
    detectedLocale: tx.detectedLocale ?? null,
    fullText: tx.fullText,
    transcriptVersion: nextVersion,
    updatedBy: actorId,
    updatedAt: FieldValue.serverTimestamp(),
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
  options: {
    actorId: string;
    sourceRecordingVersion: number;
  },
) {
  const ref = collection.doc(kind);

  await collection.firestore.runTransaction(async (tx) => {
    const current = await tx.get(ref);
    const currentData = current.data() ?? {};
    const nextVersion =
      typeof currentData.artifactVersion === 'number' ? currentData.artifactVersion + 1 : 1;

    tx.set(
      ref,
      {
        recordingId,
        kind,
        payload: result.payload,
        provider: result.provider,
        model: result.model,
        promptVersion: result.promptVersion,
        latencyMs: result.latencyMs,
        locale,
        costCents: 0,
        artifactStatus: 'active',
        artifactVersion: nextVersion,
        sourceRecordingVersion: options.sourceRecordingVersion,
        deletedAt: null,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: options.actorId,
        createdAt: currentData.createdAt ?? FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });
}

async function loadWorkspaceAI(db: Firestore, workspaceId: string) {
  const wsDoc = await db.collection('workspaces').doc(workspaceId).get();
  const s = (wsDoc.data()?.aiSettings ?? {}) as {
    transcribeProvider?: 'groq' | 'openai' | 'local-faster-whisper';
    transcribeModel?: string;
    chatProvider?: 'anthropic' | 'openai' | 'google' | 'ollama' | 'openrouter';
    chatModel?: string;
    embeddingProvider?: 'openai' | 'ollama';
    embeddingModel?: string;
    byokKeys?: Record<string, string>;
    ollamaUrl?: string;
    agentModels?: Record<string, { provider?: string; model?: string }>;
  };
  const keys = { ...(s.byokKeys ?? {}) };
  if (s.ollamaUrl) keys.ollamaBaseUrl = s.ollamaUrl;
  return {
    transcribeProvider: s.transcribeProvider,
    transcribeModel: s.transcribeModel,
    chatProvider: s.chatProvider ?? ('anthropic' as const),
    chatModel: s.chatModel,
    embeddingProvider: s.embeddingProvider,
    embeddingModel: s.embeddingModel,
    keys,
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
