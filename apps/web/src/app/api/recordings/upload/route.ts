import { createSupabaseServer } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get user's workspace
  const { data: member } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .limit(1)
    .single();

  if (!member) {
    return NextResponse.json({ error: 'No workspace found' }, { status: 400 });
  }

  const workspaceId = member.workspace_id;
  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const durationMs = Number(formData.get('durationMs') ?? 0);
  const mimeType = (formData.get('mimeType') as string) ?? 'audio/webm';
  const capturedAt = (formData.get('capturedAt') as string) ?? new Date().toISOString();

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const sizeBytes = arrayBuffer.byteLength;
  const fileName = `${workspaceId}/${crypto.randomUUID()}.webm`;

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from('audio-raw')
    .upload(fileName, arrayBuffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: `Storage upload failed: ${uploadError.message}` },
      { status: 500 },
    );
  }

  // Insert recording row
  const { data: recording, error: insertError } = await supabase
    .from('recordings')
    .insert({
      workspace_id: workspaceId,
      created_by: user.id,
      title: `Gravação Web — ${new Date(capturedAt).toLocaleString('pt-BR')}`,
      status: 'queued',
      duration_ms: durationMs,
      size_bytes: sizeBytes,
      mime_type: mimeType,
      storage_path: fileName,
      storage_bucket: 'audio-raw',
      captured_at: capturedAt,
      captured_from_device: 'web',
    })
    .select('id')
    .single();

  if (insertError) {
    return NextResponse.json({ error: `Insert failed: ${insertError.message}` }, { status: 500 });
  }

  return NextResponse.json({ id: recording.id }, { status: 201 });
}
