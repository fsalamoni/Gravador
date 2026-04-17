import { createSupabaseServer } from '@/lib/supabase-server';
import { shortId } from '@gravador/core';
import { NextResponse } from 'next/server';

/** Create a public share link for a recording. */
export async function POST(req: Request) {
  const { recordingId, expiresInDays, password, permissions } = (await req.json()) as {
    recordingId: string;
    expiresInDays?: number;
    password?: string;
    permissions?: { viewTranscript: boolean; viewSummary: boolean; viewChat: boolean };
  };
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: rec } = await supabase
    .from('recordings')
    .select('workspace_id')
    .eq('id', recordingId)
    .single();
  if (!rec) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  let passwordHash: string | null = null;
  if (password) {
    const hashBuf = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(`${recordingId}:${password}`),
    );
    passwordHash = Array.from(new Uint8Array(hashBuf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  const token = shortId(24);
  const expires = expiresInDays
    ? new Date(Date.now() + expiresInDays * 86400 * 1000).toISOString()
    : null;

  const { data, error } = await supabase
    .from('shares')
    .insert({
      recording_id: recordingId,
      workspace_id: rec.workspace_id,
      created_by: user.id,
      token,
      password_hash: passwordHash,
      expires_at: expires,
      permissions: permissions ?? {
        viewTranscript: true,
        viewSummary: true,
        viewChat: false,
      },
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const origin = req.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL;
  return NextResponse.json({ url: `${origin}/share/${token}`, share: data });
}
