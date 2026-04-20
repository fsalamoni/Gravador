import { createSupabaseServer } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const clientId = process.env.MICROSOFT_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: 'OneDrive integration not configured. Set MICROSOFT_CLIENT_ID.' },
      { status: 503 },
    );
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/integrations/onedrive/callback`;
  const scope = 'Files.ReadWrite.All offline_access';

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope,
    state: user.id,
  });

  return NextResponse.json({
    url: `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`,
  });
}
