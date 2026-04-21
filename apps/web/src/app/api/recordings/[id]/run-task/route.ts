import { getServerDb, getServerStorage, getSessionUser } from '@/lib/firebase-server';
import {
  chunkAndEmbed,
  runActionItems,
  runChapters,
  runFlashcards,
  runMindmap,
  runQuotes,
  runSentiment,
  runSummary,
  transcribe,
} from '@gravador/ai';
import type { Locale, TranscriptSegment } from '@gravador/core';
import { shortId } from '@gravador/core';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 300;

type TaskKind =
  | 'transcribe'
  | 'summary'
  | 'actionItems'
  | 'mindmap'
  | 'chapters'
  | 'quotes'
  | 'sentiment'
  | 'flashcards'
  | 'embed';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id: recordingId } = await params;
  const body = (await req.json()) as { task: TaskKind };
  const { task } = body;

  const db = getServerDb();
  const recDoc = await db.collection('recordings').doc(recordingId).get();
  if (!recDoc.exists) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const recording = recDoc.data()!;

  if (recording.createdBy !== user.uid) {
    const memberDoc = await db
      .collection('workspaces')
      .doc(recording.workspaceId as string)
      .collection('members')
      .doc(user.uid)
      .get();
    if (!memberDoc.exists) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const workspaceAI = await loadWorkspaceAI(db, recording.workspaceId as string);

  const resolve = (agent: string) => ({
    provider: (workspaceAI.agentModels[agent]?.provider ??
      workspaceAI.chatProvider) as 'anthropic' | 'openai' | 'google' | 'ollama' | 'openrouter',
    model: workspaceAI.agentModels[agent]?.model ?? workspaceAI.chatModel,
  });

  // Map task → pipelineResults key
  const resultKey = task === 'actionItems' ? 'action_items' : task;

  try {
    if (task === 'transcribe') {
      await db.collection('recordings').doc(recordingId).update({
        status: 'transcribing',
        updatedAt: FieldValue.serverTimestamp(),
      });

      const storage = getServerStorage();
      const bucket = storage.bucket();
      const [audioUrl] = await bucket.file(recording.storagePath as string).getSignedUrl({
        action: 'read',
        expires: Date.now() + 3600 * 1000,
      });

      const tx = await transcribe({
        audioUrl,
        locale: (recording.locale as Locale | undefined) ?? 'auto',
        provider: workspaceAI.transcribeProvider,
        model: workspaceAI.transcribeModel,
        keys: {
          groq: workspaceAI.keys.groq,
          openai: workspaceAI.keys.openai,
          localBaseUrl: process.env.LOCAL_WHISPER_URL,
        },
      });

      await persistTranscript(db, recordingId, tx);

      await db.collection('recordings').doc(recordingId).update({
        status: 'uploaded',
        'pipelineResults.transcribe': 'ok',
        updatedAt: FieldValue.serverTimestamp(),
      });

      return NextResponse.json({ ok: true });
    }

    // All other tasks require a transcript
    const [transcriptSnap, segmentsSnap] = await Promise.all([
      db.collection('recordings').doc(recordingId).collection('transcripts').limit(1).get(),
      db
        .collection('recordings')
        .doc(recordingId)
        .collection('transcript_segments')
        .orderBy('startMs')
        .get(),
    ]);

    if (transcriptSnap.empty) {
      return NextResponse.json(
        { error: 'no_transcript', message: 'Transcrição não encontrada. Execute a transcrição primeiro.' },
        { status: 400 },
      );
    }

    const transcriptData = transcriptSnap.docs[0]!.data();
    const fullText = transcriptData.fullText as string;
    const locale = (transcriptData.detectedLocale ??
      (recording.locale as string | undefined) ??
      'pt-BR') as Locale;

    const segments: TranscriptSegment[] = segmentsSnap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        startMs: data.startMs as number,
        endMs: data.endMs as number,
        text: data.text as string,
        speakerId: (data.speakerId as string | undefined) ?? undefined,
        confidence: (data.confidence as number | undefined) ?? undefined,
      };
    });

    const outputsCollection = db
      .collection('recordings')
      .doc(recordingId)
      .collection('ai_outputs');

    if (task === 'summary') {
      const result = await runSummary({
        segments,
        fullText,
        locale,
        provider: resolve('summarize').provider,
        model: resolve('summarize').model,
        keys: workspaceAI.keys,
      });
      await insertOutput(outputsCollection, recordingId, 'summary', result, locale);
    } else if (task === 'actionItems') {
      const result = await runActionItems({
        segments,
        locale,
        provider: resolve('actionItems').provider,
        model: resolve('actionItems').model,
        keys: workspaceAI.keys,
      });
      await insertOutput(outputsCollection, recordingId, 'action_items', result, locale);

      // Refresh the action_items subcollection
      const actionItemsCollection = db
        .collection('recordings')
        .doc(recordingId)
        .collection('action_items');
      const existing = await actionItemsCollection.get();
      if (!existing.empty) {
        const deleteBatch = db.batch();
        for (const doc of existing.docs) deleteBatch.delete(doc.ref);
        await deleteBatch.commit();
      }
      const items = result.payload as Array<{
        text: string;
        assignee?: string;
        dueDate?: string;
        sourceSegmentIds?: string[];
      }>;
      if (items.length) {
        const insertBatch = db.batch();
        for (const item of items) {
          insertBatch.set(actionItemsCollection.doc(), {
            recordingId,
            text: item.text,
            assignee: item.assignee ?? null,
            dueDate: item.dueDate ?? null,
            done: false,
            sourceSegmentIds: item.sourceSegmentIds ?? [],
            createdAt: FieldValue.serverTimestamp(),
          });
        }
        await insertBatch.commit();
      }
    } else if (task === 'mindmap') {
      const result = await runMindmap({
        fullText,
        locale,
        provider: resolve('mindmap').provider,
        model: resolve('mindmap').model,
        keys: workspaceAI.keys,
      });
      await insertOutput(outputsCollection, recordingId, 'mindmap', result, locale);
    } else if (task === 'chapters') {
      const result = await runChapters({
        segments,
        locale,
        provider: resolve('chapters').provider,
        model: resolve('chapters').model,
        keys: workspaceAI.keys,
      });
      await insertOutput(outputsCollection, recordingId, 'chapters', result, locale);
    } else if (task === 'quotes') {
      const result = await runQuotes({
        segments,
        locale,
        provider: resolve('quotes').provider,
        model: resolve('quotes').model,
        keys: workspaceAI.keys,
      });
      await insertOutput(outputsCollection, recordingId, 'quotes', result, locale);
    } else if (task === 'sentiment') {
      const result = await runSentiment({
        fullText,
        locale,
        provider: resolve('sentiment').provider,
        model: resolve('sentiment').model,
        keys: workspaceAI.keys,
      });
      await insertOutput(outputsCollection, recordingId, 'sentiment', result, locale);
    } else if (task === 'flashcards') {
      const result = await runFlashcards({
        fullText,
        locale,
        provider: resolve('flashcards').provider,
        model: resolve('flashcards').model,
        keys: workspaceAI.keys,
      });
      await insertOutput(outputsCollection, recordingId, 'flashcards', result, locale);
    } else if (task === 'embed') {
      const chunks = await chunkAndEmbed(segments, {
        provider: workspaceAI.embeddingProvider,
        model: workspaceAI.embeddingModel,
        keys: workspaceAI.keys,
      });

      if (chunks.length) {
        const embCollection = db
          .collection('recordings')
          .doc(recordingId)
          .collection('embeddings');

        const oldEmbs = await embCollection.get();
        if (!oldEmbs.empty) {
          const BATCH_LIMIT = 490;
          for (let i = 0; i < oldEmbs.docs.length; i += BATCH_LIMIT) {
            const batch = db.batch();
            for (const doc of oldEmbs.docs.slice(i, i + BATCH_LIMIT)) batch.delete(doc.ref);
            await batch.commit();
          }
        }

        const BATCH_LIMIT = 490;
        for (let i = 0; i < chunks.length; i += BATCH_LIMIT) {
          const batch = db.batch();
          for (const [j, c] of chunks.slice(i, i + BATCH_LIMIT).entries()) {
            batch.set(embCollection.doc(), {
              recordingId,
              workspaceId: recording.workspaceId,
              chunkIndex: i + j,
              startSegmentId: c.startSegmentId ?? null,
              endSegmentId: c.endSegmentId ?? null,
              startMs: c.startMs,
              endMs: c.endMs,
              content: c.content,
              embedding: FieldValue.vector(c.embedding),
              model: workspaceAI.embeddingModel ?? 'text-embedding-3-small',
              createdAt: FieldValue.serverTimestamp(),
            });
          }
          await batch.commit();
        }
      }
    } else {
      return NextResponse.json({ error: 'unknown_task' }, { status: 400 });
    }

    await db.collection('recordings').doc(recordingId).update({
      [`pipelineResults.${resultKey}`]: 'ok',
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    await db
      .collection('recordings')
      .doc(recordingId)
      .update({
        [`pipelineResults.${resultKey}`]: 'failed',
        updatedAt: FieldValue.serverTimestamp(),
      })
      .catch(() => {});

    const message = err instanceof Error ? err.message : 'Erro inesperado';
    return NextResponse.json({ error: 'pipeline_failed', message }, { status: 500 });
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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

async function persistTranscript(
  db: Firestore,
  recordingId: string,
  tx: {
    fullText: string;
    detectedLocale?: string | null;
    provider: string;
    model: string;
    segments: Array<{
      startMs: number;
      endMs: number;
      text: string;
      speakerId?: string;
      confidence?: number;
    }>;
  },
) {
  const transcriptsRef = db.collection('recordings').doc(recordingId).collection('transcripts');
  const existing = await transcriptsRef.limit(1).get();
  if (!existing.empty) await existing.docs[0]!.ref.delete();

  const transcriptRef = await transcriptsRef.add({
    recordingId,
    provider: tx.provider,
    model: tx.model,
    detectedLocale: tx.detectedLocale ?? null,
    fullText: tx.fullText,
    createdAt: FieldValue.serverTimestamp(),
  });

  const segCollection = db
    .collection('recordings')
    .doc(recordingId)
    .collection('transcript_segments');

  const oldSegs = await segCollection.get();
  if (!oldSegs.empty) {
    const BATCH_LIMIT = 490;
    for (let i = 0; i < oldSegs.docs.length; i += BATCH_LIMIT) {
      const batch = db.batch();
      for (const doc of oldSegs.docs.slice(i, i + BATCH_LIMIT)) batch.delete(doc.ref);
      await batch.commit();
    }
  }

  const BATCH_LIMIT = 490;
  for (let i = 0; i < tx.segments.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    for (const s of tx.segments.slice(i, i + BATCH_LIMIT)) {
      const id = shortId(24);
      batch.set(segCollection.doc(id), {
        transcriptId: transcriptRef.id,
        recordingId,
        speakerId: s.speakerId ?? null,
        startMs: s.startMs,
        endMs: s.endMs,
        text: s.text,
        confidence: s.confidence ?? null,
      });
    }
    await batch.commit();
  }
}

async function insertOutput(
  col: FirebaseFirestore.CollectionReference,
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
  await col.doc(kind).set({
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
