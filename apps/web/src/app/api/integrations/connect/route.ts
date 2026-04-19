import { getServerDb, getSessionUser } from '@/lib/firebase-server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const SUPPORTED_INTEGRATIONS = new Set([
  'google-drive',
  'google-calendar',
  'onedrive',
  'dropbox',
  'whatsapp',
]);

/** POST /api/integrations/connect — initiate OAuth or webhook connection */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await req.json()) as { integrationId?: string };
  const integrationId = body.integrationId;

  if (!integrationId || !SUPPORTED_INTEGRATIONS.has(integrationId)) {
    return NextResponse.json(
      { error: 'invalid_integration', message: 'Integração não suportada.' },
      { status: 400 },
    );
  }

  // For now, return a message that OAuth setup is pending.
  // In production, this would redirect to the provider's OAuth consent screen.
  // The OAuth client IDs/secrets would be stored as environment variables.
  const oauthProviders: Record<string, string> = {
    'google-drive': 'https://accounts.google.com/o/oauth2/v2/auth',
    'google-calendar': 'https://accounts.google.com/o/oauth2/v2/auth',
    'onedrive': 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    'dropbox': 'https://www.dropbox.com/oauth2/authorize',
  };

  // WhatsApp uses webhook-based connection
  if (integrationId === 'whatsapp') {
    const db = getServerDb();
    await db
      .collection('users')
      .doc(user.uid)
      .collection('integrations')
      .doc(integrationId)
      .set(
        {
          status: 'connected',
          type: 'webhook',
          connectedAt: new Date().toISOString(),
        },
        { merge: true },
      );
    return NextResponse.json({ status: 'connected' });
  }

  // OAuth-based integrations
  const authBase = oauthProviders[integrationId];
  if (!authBase) {
    return NextResponse.json(
      { error: 'not_implemented', message: 'Integração em fase de implementação.' },
      { status: 501 },
    );
  }

  // Check if OAuth credentials are configured
  const clientIdEnv = `${integrationId.toUpperCase().replace(/-/g, '_')}_CLIENT_ID`;
  const clientId = process.env[clientIdEnv];

  if (!clientId) {
    return NextResponse.json(
      {
        error: 'not_configured',
        message: `Integração com ${integrationId} ainda não configurada. Configure as credenciais OAuth no ambiente de produção.`,
      },
      { status: 501 },
    );
  }

  // Build OAuth redirect URL
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/callback`;
  const state = Buffer.from(
    JSON.stringify({ uid: user.uid, integrationId }),
  ).toString('base64url');

  const scopes: Record<string, string> = {
    'google-drive': 'https://www.googleapis.com/auth/drive.file',
    'google-calendar': 'https://www.googleapis.com/auth/calendar.events',
    'onedrive': 'Files.ReadWrite.All offline_access',
    'dropbox': '',
  };

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes[integrationId] ?? '',
    state,
    access_type: 'offline',
    prompt: 'consent',
  });

  return NextResponse.json({ redirectUrl: `${authBase}?${params.toString()}` });
}
