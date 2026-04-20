import { createSupabaseServer } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import { type NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');

  if (!code || !state) {
    return NextResponse.json({ error: 'Missing code or state' }, { status: 400 });
  }

  const appKey = process.env.DROPBOX_APP_KEY;
  const appSecret = process.env.DROPBOX_APP_SECRET;
  if (!appKey || !appSecret) {
    return NextResponse.json({ error: 'Dropbox OAuth not configured' }, { status: 503 });
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/integrations/dropbox/callback`;

  const tokenRes = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      client_id: appKey,
      client_secret: appSecret,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    return NextResponse.json({ error: `Token exchange failed: ${err}` }, { status: 500 });
  }

  const tokens = (await tokenRes.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  const supabase = await createSupabaseServer();
  const userId = state;

  const { data: member } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId)
    .limit(1)
    .single();

  if (!member) {
    return NextResponse.json({ error: 'No workspace' }, { status: 400 });
  }

  await supabase.from('integrations').upsert(
    {
      workspace_id: member.workspace_id,
      user_id: userId,
      provider: 'dropbox',
      access_token_encrypted: tokens.access_token,
      refresh_token_encrypted: tokens.refresh_token ?? null,
      expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      metadata: {},
    },
    { onConflict: 'user_id,provider,workspace_id' },
  );

  redirect('/workspace/integrations?connected=dropbox');
}
