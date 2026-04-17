import { createSupabaseServer } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

/** Supabase Storage webhook: fires when a new audio file lands. Kicks off the AI job. */
export async function POST(req: Request) {
  const signature = req.headers.get('x-gravador-signature');
  if (signature !== process.env.INTERNAL_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const body = (await req.json()) as {
    recording_id: string;
    workspace_id: string;
  };

  const supabase = await createSupabaseServer();
  const { error } = await supabase.from('jobs').insert({
    recording_id: body.recording_id,
    workspace_id: body.workspace_id,
    kind: 'full-pipeline',
    status: 'queued',
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fire-and-forget to Trigger.dev (see workers/ai-pipeline)
  if (process.env.TRIGGER_API_URL && process.env.TRIGGER_SECRET_KEY) {
    fetch(`${process.env.TRIGGER_API_URL}/v1/tasks/process-recording/trigger`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.TRIGGER_SECRET_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ payload: { recordingId: body.recording_id } }),
    }).catch((err) => console.warn('[webhook] trigger dispatch failed', err));
  }

  return NextResponse.json({ ok: true });
}
