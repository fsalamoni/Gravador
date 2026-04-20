import { getServerDb, getSessionUser } from '@/lib/firebase-server';
import { getDefaultTargetFolder } from '@/lib/integration-sync';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type IntegrationId = 'google-drive' | 'google-calendar' | 'onedrive' | 'dropbox';

type OAuthConfig = {
  tokenUrl: string;
  env: {
    clientId: string;
    clientSecret: string;
  };
};

const OAUTH_CONFIG: Record<IntegrationId, OAuthConfig> = {
  'google-drive': {
    tokenUrl: 'https://oauth2.googleapis.com/token',
    env: {
      clientId: 'GOOGLE_OAUTH_CLIENT_ID',
      clientSecret: 'GOOGLE_OAUTH_CLIENT_SECRET',
    },
  },
  'google-calendar': {
    tokenUrl: 'https://oauth2.googleapis.com/token',
    env: {
      clientId: 'GOOGLE_OAUTH_CLIENT_ID',
      clientSecret: 'GOOGLE_OAUTH_CLIENT_SECRET',
    },
  },
  onedrive: {
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    env: {
      clientId: 'MICROSOFT_OAUTH_CLIENT_ID',
      clientSecret: 'MICROSOFT_OAUTH_CLIENT_SECRET',
    },
  },
  dropbox: {
    tokenUrl: 'https://api.dropboxapi.com/oauth2/token',
    env: {
      clientId: 'DROPBOX_OAUTH_CLIENT_ID',
      clientSecret: 'DROPBOX_OAUTH_CLIENT_SECRET',
    },
  },
};

function getAppBaseUrl(req: Request): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  return new URL(req.url).origin;
}

function redirectToIntegrations(req: Request, params: Record<string, string>) {
  const appBaseUrl = getAppBaseUrl(req);
  const sp = new URLSearchParams(params);
  return NextResponse.redirect(`${appBaseUrl}/workspace/integrations?${sp.toString()}`);
}

async function fetchConnectedEmail(integrationId: IntegrationId, accessToken: string) {
  if (integrationId === 'google-drive' || integrationId === 'google-calendar') {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { email?: string };
    return data.email ?? null;
  }

  if (integrationId === 'onedrive') {
    const res = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { userPrincipalName?: string; mail?: string };
    return data.mail ?? data.userPrincipalName ?? null;
  }

  const res = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { email?: string };
  return data.email ?? null;
}

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return redirectToIntegrations(req, { error: 'unauthorized' });

  const url = new URL(req.url);
  const oauthError = url.searchParams.get('error');
  if (oauthError) {
    return redirectToIntegrations(req, { error: oauthError });
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) {
    return redirectToIntegrations(req, { error: 'missing_code_or_state' });
  }

  let stateData: { uid: string; integrationId: IntegrationId; ts?: number };
  try {
    stateData = JSON.parse(Buffer.from(state, 'base64url').toString('utf8')) as {
      uid: string;
      integrationId: IntegrationId;
      ts?: number;
    };
  } catch {
    return redirectToIntegrations(req, { error: 'invalid_state' });
  }

  if (stateData.uid !== user.uid) {
    return redirectToIntegrations(req, { error: 'state_uid_mismatch' });
  }

  if (typeof stateData.ts === 'number' && Date.now() - stateData.ts > 15 * 60 * 1000) {
    return redirectToIntegrations(req, { error: 'state_expired' });
  }

  const config = OAUTH_CONFIG[stateData.integrationId];
  if (!config) {
    return redirectToIntegrations(req, { error: 'unsupported_provider' });
  }

  const clientId = process.env[config.env.clientId];
  const clientSecret = process.env[config.env.clientSecret];
  if (!clientId || !clientSecret) {
    return redirectToIntegrations(req, { error: 'oauth_not_configured' });
  }

  const redirectUri = `${getAppBaseUrl(req)}/api/integrations/callback`;

  const tokenParams = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  });

  const tokenRes = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: tokenParams.toString(),
  });

  if (!tokenRes.ok) {
    return redirectToIntegrations(req, { error: `token_exchange_${tokenRes.status}` });
  }

  const token = (await tokenRes.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
  };

  if (!token.access_token) {
    return redirectToIntegrations(req, { error: 'missing_access_token' });
  }

  const connectedEmail = await fetchConnectedEmail(
    stateData.integrationId,
    token.access_token,
  ).catch(() => null);

  const db = getServerDb();
  await db
    .collection('users')
    .doc(user.uid)
    .collection('integrations')
    .doc(stateData.integrationId)
    .set(
      {
        status: 'connected',
        type: 'oauth',
        provider: stateData.integrationId,
        connectedAt: new Date().toISOString(),
        connectedEmail: connectedEmail ?? null,
        tokenType: token.token_type ?? 'Bearer',
        accessToken: token.access_token,
        refreshToken: token.refresh_token ?? null,
        expiresIn: token.expires_in ?? null,
        tokenObtainedAt: new Date().toISOString(),
        scope: token.scope ?? null,
        targetFolder:
          stateData.integrationId === 'google-drive' ||
          stateData.integrationId === 'onedrive' ||
          stateData.integrationId === 'dropbox'
            ? getDefaultTargetFolder(stateData.integrationId)
            : null,
      },
      { merge: true },
    );

  return redirectToIntegrations(req, { connected: stateData.integrationId });
}
