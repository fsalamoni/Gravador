import { createSupabaseServer } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import { type NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');

  if (!code || !state) {
    return NextResponse.json({ error: 'Missing code or state' }, { status: 400 });
  }

  const clientId = process.env.NOTION_CLIENT_ID;
  const clientSecret = process.env.NOTION_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'Notion OAuth not configured' }, { status: 503 });
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/integrations/notion/callback`;

  const tokenRes = await fetch('https://api.notion.com/v1/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    return NextResponse.json({ error: `Token exchange failed: ${err}` }, { status: 500 });
  }

  const data = (await tokenRes.json()) as {
    access_token: string;
    workspace_name?: string;
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
      provider: 'notion',
      access_token_encrypted: data.access_token,
      refresh_token_encrypted: null,
      expires_at: null,
      metadata: { workspace_name: data.workspace_name ?? null },
    },
    { onConflict: 'user_id,provider,workspace_id' },
  );

  redirect('/workspace/integrations?connected=notion');
}
