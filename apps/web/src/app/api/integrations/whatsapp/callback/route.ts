import { createSupabaseServer } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import { type NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');

  if (!code || !state) {
    return NextResponse.json({ error: 'Missing code or state' }, { status: 400 });
  }

  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    return NextResponse.json({ error: 'WhatsApp OAuth not configured' }, { status: 503 });
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/integrations/whatsapp/callback`;

  const tokenRes = await fetch('https://graph.facebook.com/v21.0/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: appId,
      client_secret: appSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    return NextResponse.json({ error: `Token exchange failed: ${err}` }, { status: 500 });
  }

  const tokens = (await tokenRes.json()) as {
    access_token: string;
    expires_in?: number;
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
      provider: 'whatsapp' as string,
      access_token_encrypted: tokens.access_token,
      refresh_token_encrypted: null,
      expires_at: tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
        : null,
      metadata: {},
    },
    { onConflict: 'user_id,provider,workspace_id' },
  );

  redirect('/workspace/integrations?connected=whatsapp');
}
