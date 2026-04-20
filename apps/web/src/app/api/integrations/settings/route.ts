import { getServerDb, getSessionUser } from '@/lib/firebase-server';
import {
  type IntegrationClientView,
  type IntegrationId,
  normalizeTargetFolder,
} from '@/lib/integration-sync';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type SettingsBody = {
  integrationId?: IntegrationId;
  targetFolder?: string;
  phoneNumber?: string;
};

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await req.json()) as SettingsBody;
  if (!body.integrationId) {
    return NextResponse.json({ error: 'missing_integration_id' }, { status: 400 });
  }

  const db = getServerDb();
  const ref = db
    .collection('users')
    .doc(user.uid)
    .collection('integrations')
    .doc(body.integrationId);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ error: 'integration_not_found' }, { status: 404 });
  }

  const updates: Partial<IntegrationClientView> & Record<string, unknown> = {};
  if (
    body.integrationId === 'google-drive' ||
    body.integrationId === 'onedrive' ||
    body.integrationId === 'dropbox'
  ) {
    updates.targetFolder = normalizeTargetFolder(body.targetFolder, body.integrationId);
  }

  if (body.integrationId === 'whatsapp' && typeof body.phoneNumber === 'string') {
    updates.phoneNumber = body.phoneNumber.trim() || null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'nothing_to_update' }, { status: 400 });
  }

  await ref.set(updates, { merge: true });
  return NextResponse.json({ status: 'saved' });
}
