import { getServerDb, getSessionUser } from '@/lib/firebase-server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/** GET /api/integrations — returns user's integration connection statuses */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const db = getServerDb();
  const snap = await db
    .collection('users')
    .doc(user.uid)
    .collection('integrations')
    .get();

  const integrations = snap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  return NextResponse.json({ integrations });
}
