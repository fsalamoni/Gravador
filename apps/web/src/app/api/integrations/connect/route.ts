import { getApiSessionUser } from '@/lib/api-session';
import { getServerDb } from '@/lib/firebase-server';
import { buildWhatsAppReceiveUrl, normalizePhoneNumber } from '@/lib/integration-sync';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const SUPPORTED_INTEGRATIONS = new Set([
  'google-drive',
  'google-calendar',
  'onedrive',
  'dropbox',
  'whatsapp',
]);

type IntegrationId = 'google-drive' | 'google-calendar' | 'onedrive' | 'dropbox' | 'whatsapp';

type OAuthConfig = {
  authBase: string;
  tokenAccessType?: 'offline';
  extraParams?: Record<string, string>;
  scopes: string;
  env: {
    clientId: string;
    clientSecret: string;
  };
};

const OAUTH_CONFIG: Record<Exclude<IntegrationId, 'whatsapp'>, OAuthConfig> = {
  'google-drive': {
    authBase: 'https://accounts.google.com/o/oauth2/v2/auth',
    scopes:
      'openid email profile https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.metadata.readonly',
    env: {
      clientId: 'GOOGLE_OAUTH_CLIENT_ID',
      clientSecret: 'GOOGLE_OAUTH_CLIENT_SECRET',
    },
    extraParams: {
      include_granted_scopes: 'true',
      access_type: 'offline',
      prompt: 'consent',
    },
  },
  'google-calendar': {
    authBase: 'https://accounts.google.com/o/oauth2/v2/auth',
    scopes:
      'openid email profile https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly',
    env: {
      clientId: 'GOOGLE_OAUTH_CLIENT_ID',
      clientSecret: 'GOOGLE_OAUTH_CLIENT_SECRET',
    },
    extraParams: {
      include_granted_scopes: 'true',
      access_type: 'offline',
      prompt: 'consent',
    },
  },
  onedrive: {
    authBase: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    scopes: 'offline_access User.Read Files.ReadWrite.All',
    env: {
      clientId: 'MICROSOFT_OAUTH_CLIENT_ID',
      clientSecret: 'MICROSOFT_OAUTH_CLIENT_SECRET',
    },
  },
  dropbox: {
    authBase: 'https://www.dropbox.com/oauth2/authorize',
    scopes: 'account_info.read files.content.write files.metadata.read',
    env: {
      clientId: 'DROPBOX_OAUTH_CLIENT_ID',
      clientSecret: 'DROPBOX_OAUTH_CLIENT_SECRET',
    },
    tokenAccessType: 'offline',
  },
};

function getAppBaseUrl(req: Request): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  return new URL(req.url).origin;
}

/** POST /api/integrations/connect — initiate OAuth or webhook connection */
export async function POST(req: Request) {
  const user = await getApiSessionUser(req);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const db = getServerDb();

  const body = (await req.json()) as {
    integrationId?: IntegrationId;
    webhookUrl?: string;
    phoneNumber?: string;
  };
  const integrationId = body.integrationId;

  if (!integrationId || !SUPPORTED_INTEGRATIONS.has(integrationId)) {
    return NextResponse.json(
      { error: 'invalid_integration', message: 'Integração não suportada.' },
      { status: 400 },
    );
  }

  // WhatsApp supports Meta Cloud API by default and optional webhook fallback.
  if (integrationId === 'whatsapp') {
    const webhookUrl = body.webhookUrl?.trim() ?? '';
    const hasWebhook = Boolean(webhookUrl);
    const phoneNumberNormalized = normalizePhoneNumber(body.phoneNumber);
    const hasMetaCloudConfig = Boolean(
      process.env.WHATSAPP_CLOUD_ACCESS_TOKEN?.trim() &&
        process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID?.trim(),
    );

    if (!phoneNumberNormalized) {
      return NextResponse.json(
        {
          error: 'missing_phone_number',
          message: 'Informe o número de destino do WhatsApp em formato internacional.',
        },
        { status: 400 },
      );
    }

    if (!hasWebhook && !hasMetaCloudConfig) {
      return NextResponse.json(
        {
          error: 'not_configured',
          message:
            'Configure WHATSAPP_CLOUD_ACCESS_TOKEN e WHATSAPP_CLOUD_PHONE_NUMBER_ID ou informe um webhook.',
        },
        { status: 501 },
      );
    }

    let parsedUrl: URL | null = null;
    if (hasWebhook) {
      try {
        parsedUrl = new URL(webhookUrl);
      } catch {
        return NextResponse.json(
          { error: 'invalid_webhook_url', message: 'URL de webhook inválida.' },
          { status: 400 },
        );
      }
    }

    const inboundToken = crypto.randomUUID().replace(/-/g, '');
    const deliveryMode = parsedUrl ? 'webhook' : 'meta-cloud';

    await db
      .collection('users')
      .doc(user.uid)
      .collection('integrations')
      .doc(integrationId)
      .set(
        {
          status: 'connected',
          type: 'webhook',
          deliveryMode,
          webhookUrl: parsedUrl?.toString() ?? null,
          phoneNumber: phoneNumberNormalized,
          phoneNumberNormalized,
          inboundToken,
          connectedAt: new Date().toISOString(),
        },
        { merge: true },
      );
    return NextResponse.json({
      status: 'connected',
      deliveryMode,
      receiveUrl: buildWhatsAppReceiveUrl(getAppBaseUrl(req)),
      inboundToken,
    });
  }

  const providerConfig = OAUTH_CONFIG[integrationId as Exclude<IntegrationId, 'whatsapp'>];
  if (!providerConfig) {
    return NextResponse.json(
      { error: 'not_implemented', message: 'Integração em fase de implementação.' },
      { status: 501 },
    );
  }

  const clientId = process.env[providerConfig.env.clientId];
  const clientSecret = process.env[providerConfig.env.clientSecret];

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      {
        error: 'not_configured',
        message: `Integração com ${integrationId} ainda não configurada no ambiente.`,
      },
      { status: 501 },
    );
  }

  const appBaseUrl = getAppBaseUrl(req);
  const redirectUri = `${appBaseUrl}/api/integrations/callback`;
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const now = Date.now();
  await db
    .collection('users')
    .doc(user.uid)
    .collection('integration_oauth_state')
    .doc(nonce)
    .set({
      uid: user.uid,
      integrationId,
      nonce,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 15 * 60 * 1000).toISOString(),
    });

  const state = Buffer.from(
    JSON.stringify({ uid: user.uid, integrationId, ts: now, nonce }),
  ).toString('base64url');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: providerConfig.scopes,
    state,
  });

  if (providerConfig.tokenAccessType) {
    params.set('token_access_type', providerConfig.tokenAccessType);
  }
  for (const [k, v] of Object.entries(providerConfig.extraParams ?? {})) {
    params.set(k, v);
  }

  return NextResponse.json({ redirectUrl: `${providerConfig.authBase}?${params.toString()}` });
}
