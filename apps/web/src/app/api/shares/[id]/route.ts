import { getServerDb, getSessionUser } from '@/lib/firebase-server';
import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';

/** Revoke a share link. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const db = getServerDb();
  const shareRef = db.collection('shares').doc(id);
  const shareDoc = await shareRef.get();

  if (!shareDoc.exists) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const share = shareDoc.data() as { createdBy: string; workspaceId: string };

  // Only the creator or workspace member can revoke
  if (share.createdBy !== user.uid) {
    const memberDoc = await db
      .collection('workspaces')
      .doc(share.workspaceId)
      .collection('members')
      .doc(user.uid)
      .get();
    if (!memberDoc.exists) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  await shareRef.update({ revokedAt: FieldValue.serverTimestamp() });

  return NextResponse.json({ success: true });
}

/** List shares for a recording. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: recordingId } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const db = getServerDb();

  const sharesSnap = await db
    .collection('shares')
    .where('recordingId', '==', recordingId)
    .where('revokedAt', '==', null)
    .orderBy('createdAt', 'desc')
    .limit(20)
    .get();

  const shares = sharesSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate?.()?.toISOString() ?? null,
    expiresAt: doc.data().expiresAt?.toDate?.()?.toISOString() ?? null,
  }));

  return NextResponse.json({ shares });
}
