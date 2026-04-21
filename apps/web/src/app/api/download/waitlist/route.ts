import { getServerDb } from '@/lib/firebase-server';
import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type WaitlistBody = {
  email?: string;
  name?: string;
  platform?: 'ios' | 'android';
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function buildDocId(platform: string, email: string) {
  const compactEmail = email.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const suffix = compactEmail.slice(0, 120) || 'unknown';
  return `${platform}_${suffix}`;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as WaitlistBody;
  const email = normalizeEmail(body.email ?? '');
  const name = body.name?.trim() || null;
  const platform = body.platform === 'android' ? 'android' : 'ios';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
  }

  const docId = buildDocId(platform, email);
  const userAgent = req.headers.get('user-agent') ?? null;
  const db = getServerDb();
  await db.collection('download_waitlist').doc(docId).set(
    {
      email,
      name,
      platform,
      source: 'download-page',
      userAgent,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return NextResponse.json({ status: 'ok' });
}
