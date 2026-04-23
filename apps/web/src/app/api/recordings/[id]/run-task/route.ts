import { getApiSessionUser } from '@/lib/api-session';
import { getServerDb, getServerStorage } from '@/lib/firebase-server';
import { getAccessibleRecording } from '@/lib/recording-access';
import {
  RECORDING_LIFECYCLE_SCHEMA_VERSION,
  getRecordingLifecycleState,
} from '@/lib/recording-lifecycle';
import {
  type GenerationProvider,
  chunkAndEmbed,
  runAgentTaskWithFallback,
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
  const user = await getApiSessionUser(req);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id: recordingId } = await params;
  const body = (await req.json()) as { task: TaskKind };
  const { task } = body;

  const db = getServerDb();
  const access = await getAccessibleRecording(db, recordingId, user.uid);
  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.error === 'not_found' ? 404 : 403 },
    );
  }

  const recording = access.data;
  const recordingLifecycle = getRecordingLifecycleState(recording.lifecycle);

  const workspaceAI = await loadWorkspaceAI(db, recording.workspaceId as string);

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
    context: { locale: Locale; fullText: string; segments: TranscriptSegment[] },
  ) => {
    const resolved = resolveChat(task);
    return runAgentTaskWithFallback({
      task,
      preferredProvider: resolved.provider as GenerationProvider,
      preferredModel: resolved.model,
      keys: workspaceAI.keys,
      locale: context.locale,
      fullText: context.fullText,
      segments: context.segments,
    });
  };
  const sourceRecordingVersion = recordingLifecycle.recordingVersion;

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
        'lifecycle.schemaVersion': RECORDING_LIFECYCLE_SCHEMA_VERSION,
        'lifecycle.lastEvent': 'pipeline_updated',
        'lifecycle.lastEventAt': FieldValue.serverTimestamp(),
        'lifecycle.lastEventBy': user.uid,
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
        {
          error: 'no_transcript',
          message: 'Transcrição não encontrada. Execute a transcrição primeiro.',
        },
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
        speakerId: (data.speakerId as string | null) ?? null,
        confidence: (data.confidence as number | null) ?? null,
      };
    });

    const chatContext = { locale, fullText, segments };

    const outputsCollection = db.collection('recordings').doc(recordingId).collection('ai_outputs');

    if (task === 'summary') {
      const result = await runChatTask('summary', chatContext);
      await insertOutput(outputsCollection, recordingId, 'summary', result, locale, {
        actorId: user.uid,
        sourceRecordingVersion,
      });
    } else if (task === 'actionItems') {
      const result = await runChatTask('actionItems', chatContext);
      await insertOutput(outputsCollection, recordingId, 'action_items', result, locale, {
        actorId: user.uid,
        sourceRecordingVersion,
      });

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
      const result = await runChatTask('mindmap', chatContext);
      await insertOutput(outputsCollection, recordingId, 'mindmap', result, locale, {
        actorId: user.uid,
        sourceRecordingVersion,
      });
    } else if (task === 'chapters') {
      const result = await runChatTask('chapters', chatContext);
      await insertOutput(outputsCollection, recordingId, 'chapters', result, locale, {
        actorId: user.uid,
        sourceRecordingVersion,
      });
    } else if (task === 'quotes') {
      const result = await runChatTask('quotes', chatContext);
      await insertOutput(outputsCollection, recordingId, 'quotes', result, locale, {
        actorId: user.uid,
        sourceRecordingVersion,
      });
    } else if (task === 'sentiment') {
      const result = await runChatTask('sentiment', chatContext);
      await insertOutput(outputsCollection, recordingId, 'sentiment', result, locale, {
        actorId: user.uid,
        sourceRecordingVersion,
      });
    } else if (task === 'flashcards') {
      const result = await runChatTask('flashcards', chatContext);
      await insertOutput(outputsCollection, recordingId, 'flashcards', result, locale, {
        actorId: user.uid,
        sourceRecordingVersion,
      });
    } else if (task === 'embed') {
      const embedding = resolveEmbedding('embed');
      const chunks = await chunkAndEmbed(segments, {
        provider: embedding.provider,
        model: embedding.model,
        keys: workspaceAI.keys,
      });

      if (chunks.length) {
        const embCollection = db.collection('recordings').doc(recordingId).collection('embeddings');

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
              model:
                embedding.model ??
                (embedding.provider === 'ollama' ? 'nomic-embed-text' : 'text-embedding-3-small'),
              createdAt: FieldValue.serverTimestamp(),
            });
          }
          await batch.commit();
        }
      }
    } else {
      return NextResponse.json({ error: 'unknown_task' }, { status: 400 });
    }

    await db
      .collection('recordings')
      .doc(recordingId)
      .update({
        [`pipelineResults.${resultKey}`]: 'ok',
        'lifecycle.schemaVersion': RECORDING_LIFECYCLE_SCHEMA_VERSION,
        'lifecycle.lastEvent': 'artifact_updated',
        'lifecycle.lastEventAt': FieldValue.serverTimestamp(),
        'lifecycle.lastEventBy': user.uid,
        updatedAt: FieldValue.serverTimestamp(),
      });

    return NextResponse.json({ ok: true });
  } catch (err) {
    await db
      .collection('recordings')
      .doc(recordingId)
      .update({
        [`pipelineResults.${resultKey}`]: 'failed',
        'lifecycle.schemaVersion': RECORDING_LIFECYCLE_SCHEMA_VERSION,
        'lifecycle.lastEvent': 'pipeline_updated',
        'lifecycle.lastEventAt': FieldValue.serverTimestamp(),
        'lifecycle.lastEventBy': user.uid,
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
      speakerId: string | null;
      confidence: number | null;
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
  options: {
    actorId: string;
    sourceRecordingVersion: number;
  },
) {
  const ref = col.doc(kind);

  await col.firestore.runTransaction(async (tx) => {
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
