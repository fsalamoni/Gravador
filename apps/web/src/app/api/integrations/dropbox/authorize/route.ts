import { createSupabaseServer } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const clientId = process.env.DROPBOX_APP_KEY;
  if (!clientId) {
    return NextResponse.json(
      { error: 'Dropbox integration not configured. Set DROPBOX_APP_KEY.' },
      { status: 503 },
    );
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/integrations/dropbox/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    token_access_type: 'offline',
    state: user.id,
  });

  return NextResponse.json({
    url: `https://www.dropbox.com/oauth2/authorize?${params.toString()}`,
  });
}
