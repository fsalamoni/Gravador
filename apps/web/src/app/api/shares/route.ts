import { getServerDb, getSessionUser } from '@/lib/firebase-server';
import { shortId } from '@gravador/core';
import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';

/** Create a public share link for a recording. */
export async function POST(req: Request) {
  const { recordingId, expiresInDays, password, permissions } = (await req.json()) as {
    recordingId: string;
    expiresInDays?: number;
    password?: string;
    permissions?: { viewTranscript: boolean; viewSummary: boolean; viewChat: boolean };
  };

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const db = getServerDb();
  const recDoc = await db.collection('recordings').doc(recordingId).get();
  if (!recDoc.exists) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const rec = recDoc.data() as { workspaceId: string; createdBy: string };

  // Verify user owns this recording or is a workspace member
  if (rec.createdBy !== user.uid) {
    const memberDoc = await db
      .collection('workspaces')
      .doc(rec.workspaceId)
      .collection('members')
      .doc(user.uid)
      .get();
    if (!memberDoc.exists) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let passwordHash: string | null = null;
  if (password) {
    const hashBuf = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(`${recordingId}:${password}`),
    );
    passwordHash = Array.from(new Uint8Array(hashBuf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  const token = shortId(24);
  const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 86400 * 1000) : null;

  const shareData = {
    recordingId,
    workspaceId: rec.workspaceId,
    createdBy: user.uid,
    token,
    passwordHash,
    expiresAt,
    permissions: permissions ?? {
      viewTranscript: true,
      viewSummary: true,
      viewChat: false,
    },
    revokedAt: null,
    createdAt: FieldValue.serverTimestamp(),
  };

  const shareRef = await db.collection('shares').add(shareData);

  const origin = req.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL;
  return NextResponse.json({
    url: `${origin}/share/${token}`,
    share: { id: shareRef.id, ...shareData },
  });
}
