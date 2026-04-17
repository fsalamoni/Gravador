import { createSupabaseServer } from '@/lib/supabase-server';
import { notFound } from 'next/navigation';
import { Player } from './player';
import { RecordingTabs } from './tabs';

export default async function RecordingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServer();

  const { data: recording } = await supabase.from('recordings').select('*').eq('id', id).single();
  if (!recording) notFound();

  const [{ data: transcript }, { data: segments }, { data: outputs }] = await Promise.all([
    supabase.from('transcripts').select('*').eq('recording_id', id).maybeSingle(),
    supabase.from('transcript_segments').select('*').eq('recording_id', id).order('start_ms'),
    supabase.from('ai_outputs').select('*').eq('recording_id', id),
  ]);

  const { data: audio } = await supabase.storage
    .from(recording.storage_bucket)
    .createSignedUrl(recording.storage_path, 3600);

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-semibold">
        {recording.title ?? new Date(recording.captured_at).toLocaleString()}
      </h1>
      <div className="text-mute mt-1">
        {recording.status} · {Math.round(recording.duration_ms / 1000)}s
      </div>

      <div className="mt-6 card p-4">
        <Player src={audio?.signedUrl ?? ''} />
      </div>

      <div className="mt-6">
        <RecordingTabs
          recordingId={id}
          transcript={transcript ?? null}
          segments={segments ?? []}
          outputs={outputs ?? []}
        />
      </div>
    </div>
  );
}
