import { createSupabaseServer } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const appId = process.env.META_APP_ID;
  if (!appId) {
    return NextResponse.json(
      { error: 'WhatsApp integration not configured. Set META_APP_ID.' },
      { status: 503 },
    );
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/integrations/whatsapp/callback`;

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'whatsapp_business_management,whatsapp_business_messaging',
    state: user.id,
  });

  return NextResponse.json({
    url: `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`,
  });
}
