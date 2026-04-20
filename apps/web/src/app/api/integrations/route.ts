import { getServerDb, getSessionUser } from '@/lib/firebase-server';
import { type IntegrationId, sanitizeIntegrationForClient } from '@/lib/integration-sync';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const INTEGRATIONS: IntegrationId[] = [
  'google-drive',
  'google-calendar',
  'onedrive',
  'dropbox',
  'whatsapp',
];

/** GET /api/integrations — returns user's integration connection statuses */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const db = getServerDb();
  const snap = await db.collection('users').doc(user.uid).collection('integrations').get();
  const byId = new Map(snap.docs.map((doc) => [doc.id, doc.data()]));
  const appBaseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, '') ?? new URL(req.url).origin;
  const integrations = INTEGRATIONS.map((id) =>
    sanitizeIntegrationForClient(
      id,
      byId.get(id) as Record<string, unknown> | undefined,
      appBaseUrl,
    ),
  );

  return NextResponse.json({ integrations });
}
