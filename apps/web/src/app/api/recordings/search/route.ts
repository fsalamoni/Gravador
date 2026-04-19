import { getServerDb, getSessionUser } from '@/lib/firebase-server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * GET /api/recordings/search?q=...
 * Quick title/status search for the command palette.
 */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') ?? '').trim().toLowerCase();
  if (!q || q.length < 2) return NextResponse.json({ recordings: [] });

  const db = getServerDb();
  const snap = await db
    .collection('recordings')
    .where('createdBy', '==', user.uid)
    .orderBy('capturedAt', 'desc')
    .limit(200)
    .get();

  const hits = snap.docs
    .filter((doc) => {
      const d = doc.data();
      if (d.deletedAt) return false;
      const title = (d.title ?? '').toLowerCase();
      const status = (d.status ?? '').toLowerCase();
      const tags = (d.tags ?? []) as string[];
      return (
        title.includes(q) ||
        status.includes(q) ||
        tags.some((t: string) => t.toLowerCase().includes(q))
      );
    })
    .slice(0, 20)
    .map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        title: d.title ?? null,
        status: d.status,
        capturedAt: d.capturedAt?.toDate?.()?.toISOString() ?? null,
        durationMs: d.durationMs ?? 0,
      };
    });

  return NextResponse.json({ recordings: hits });
}
