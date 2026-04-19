import { getServerDb, getSessionUser } from '@/lib/firebase-server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/** POST /api/integrations/disconnect — remove integration connection */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await req.json()) as { integrationId?: string };
  const integrationId = body.integrationId;

  if (!integrationId) {
    return NextResponse.json({ error: 'missing_integration_id' }, { status: 400 });
  }

  const db = getServerDb();
  await db
    .collection('users')
    .doc(user.uid)
    .collection('integrations')
    .doc(integrationId)
    .delete();

  return NextResponse.json({ status: 'disconnected' });
}
