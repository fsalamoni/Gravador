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
import { createServiceClient } from '@gravador/db';
import { logger, task } from '@trigger.dev/sdk/v3';

/**
 * Orchestrates the full AI pipeline for a single recording:
 *   1. Transcribe (Whisper v3 via Groq by default)
 *   2. Persist transcript + segments
 *   3. Fan-out: summary, action items, mindmap, chapters
 *   4. Embed chunks into pgvector for RAG
 *
 * Idempotent: safe to re-trigger. Writes are upserted or deduped by unique indexes.
 */
export const processRecording = task({
  id: 'process-recording',
  maxDuration: 900,
  retry: { maxAttempts: 3 },
  run: async (payload: { recordingId: string; locale?: Locale }) => {
    const supabase = createServiceClient();
    const { recordingId } = payload;

    const { data: recording, error: recErr } = await supabase
      .from('recordings')
      .select('*')
      .eq('id', recordingId)
      .single();
    if (recErr || !recording) throw new Error(`recording ${recordingId} not found`);

    const workspaceAI = await loadWorkspaceAI(supabase, recording.workspace_id);

    await setStatus(supabase, recordingId, 'transcribing');
    const { data: audioUrl } = await supabase.storage
      .from(recording.storage_bucket)
      .createSignedUrl(recording.storage_path, 3600);
    if (!audioUrl?.signedUrl) throw new Error('failed to sign audio URL');

    const tx = await transcribe({
      audioUrl: audioUrl.signedUrl,
      locale: payload.locale ?? recording.locale ?? 'auto',
      provider: workspaceAI.transcribeProvider,
    });
    const segments = await persistTranscript(supabase, recordingId, tx);
    logger.log('transcribed', { segments: segments.length });

    const locale: Locale = tx.detectedLocale ?? payload.locale ?? recording.locale ?? 'pt-BR';

    await setStatus(supabase, recordingId, 'summarizing');
    const [summary, actions, mindmap, chapters] = await Promise.allSettled([
      runSummary({
        segments,
        fullText: tx.fullText,
        locale,
        provider: workspaceAI.chatProvider,
        model: workspaceAI.chatModel,
        keys: workspaceAI.keys,
      }),
      runActionItems({
        segments,
        locale,
        provider: workspaceAI.chatProvider,
        model: workspaceAI.chatModel,
        keys: workspaceAI.keys,
      }),
      runMindmap({
        fullText: tx.fullText,
        locale,
        provider: workspaceAI.chatProvider,
        model: workspaceAI.chatModel,
        keys: workspaceAI.keys,
      }),
      runChapters({
        segments,
        locale,
        provider: workspaceAI.chatProvider,
        model: workspaceAI.chatModel,
        keys: workspaceAI.keys,
      }),
    ]);

    if (summary.status === 'fulfilled')
      await insertOutput(supabase, recordingId, 'summary', summary.value, locale);
    if (actions.status === 'fulfilled')
      await insertOutput(supabase, recordingId, 'action_items', actions.value, locale);
    if (mindmap.status === 'fulfilled')
      await insertOutput(supabase, recordingId, 'mindmap', mindmap.value, locale);
    if (chapters.status === 'fulfilled')
      await insertOutput(supabase, recordingId, 'chapters', chapters.value, locale);

    if (actions.status === 'fulfilled') {
      const rows = actions.value.payload.map((a) => ({
        recording_id: recordingId,
        text: a.text,
        assignee: a.assignee,
        due_date: a.dueDate,
        source_segment_ids: a.sourceSegmentIds,
      }));
      if (rows.length) await supabase.from('action_items').insert(rows);
    }

    await setStatus(supabase, recordingId, 'embedding');
    const chunks = await chunkAndEmbed(segments, {
      provider: workspaceAI.embeddingProvider,
      model: workspaceAI.embeddingModel,
      keys: workspaceAI.keys,
    });
    if (chunks.length) {
      await supabase.from('embeddings').insert(
        chunks.map((c, i) => ({
          recording_id: recordingId,
          workspace_id: recording.workspace_id,
          chunk_index: i,
          start_segment_id: c.startSegmentId,
          end_segment_id: c.endSegmentId,
          start_ms: c.startMs,
          end_ms: c.endMs,
          content: c.content,
          embedding: c.embedding,
          model: workspaceAI.embeddingModel ?? 'text-embedding-3-small',
        })),
      );
    }

    await setStatus(supabase, recordingId, 'ready');
    return { recordingId, segments: segments.length, chunks: chunks.length };
  },
});

async function setStatus(
  supabase: ReturnType<typeof createServiceClient>,
  id: string,
  status: string,
) {
  await supabase.from('recordings').update({ status }).eq('id', id);
}

async function persistTranscript(
  supabase: ReturnType<typeof createServiceClient>,
  recordingId: string,
  tx: TranscribeResult,
): Promise<TranscriptSegment[]> {
  const { data: transcript, error } = await supabase
    .from('transcripts')
    .upsert(
      {
        recording_id: recordingId,
        provider: tx.provider,
        model: tx.model,
        detected_locale: tx.detectedLocale,
        full_text: tx.fullText,
      },
      { onConflict: 'recording_id' },
    )
    .select()
    .single();
  if (error || !transcript) throw error ?? new Error('failed to persist transcript');

  await supabase.from('transcript_segments').delete().eq('transcript_id', transcript.id);

  const rows = tx.segments.map((s) => ({
    id: shortId(24),
    transcript_id: transcript.id,
    recording_id: recordingId,
    speaker_id: s.speakerId,
    start_ms: s.startMs,
    end_ms: s.endMs,
    text: s.text,
    confidence: s.confidence,
  }));
  if (rows.length) {
    const { error: insErr } = await supabase.from('transcript_segments').insert(rows);
    if (insErr) throw insErr;
  }

  return rows.map((r) => ({
    id: r.id,
    startMs: r.start_ms,
    endMs: r.end_ms,
    speakerId: r.speaker_id,
    text: r.text,
    confidence: r.confidence,
  }));
}

async function insertOutput(
  supabase: ReturnType<typeof createServiceClient>,
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
  await supabase.from('ai_outputs').upsert(
    {
      recording_id: recordingId,
      kind,
      payload: result.payload,
      provider: result.provider,
      model: result.model,
      prompt_version: result.promptVersion,
      latency_ms: result.latencyMs,
      locale,
    },
    { onConflict: 'recording_id,kind' },
  );
}

async function loadWorkspaceAI(
  supabase: ReturnType<typeof createServiceClient>,
  workspaceId: string,
) {
  const { data } = await supabase
    .from('workspaces')
    .select('ai_settings')
    .eq('id', workspaceId)
    .single();
  const s = (data?.ai_settings ?? {}) as {
    transcribeProvider?: 'groq' | 'openai' | 'local-faster-whisper';
    chatProvider?: 'anthropic' | 'openai' | 'google' | 'ollama';
    chatModel?: string;
    embeddingProvider?: 'openai' | 'ollama';
    embeddingModel?: string;
    byokKeys?: Record<string, string>;
  };
  return {
    transcribeProvider: s.transcribeProvider,
    chatProvider: s.chatProvider ?? ('anthropic' as const),
    chatModel: s.chatModel,
    embeddingProvider: s.embeddingProvider,
    embeddingModel: s.embeddingModel,
    keys: s.byokKeys ?? {},
  };
}
