import { getServerDb, getSessionUser } from '@/lib/firebase-server';
import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';

/** GET: Load chat history for a recording. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const recordingId = searchParams.get('recordingId');
  if (!recordingId) return NextResponse.json({ error: 'missing_recording_id' }, { status: 400 });

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const db = getServerDb();
  const messagesSnap = await db
    .collection('recordings')
    .doc(recordingId)
    .collection('chat_messages')
    .where('userId', '==', user.uid)
    .orderBy('createdAt', 'asc')
    .limit(200)
    .get();

  const messages = messagesSnap.docs.map((doc) => ({
    id: doc.id,
    role: doc.data().role as string,
    content: doc.data().content as string,
  }));

  return NextResponse.json({ messages });
}

/** POST: Persist a chat message pair (user + assistant). */
export async function POST(req: Request) {
  const { recordingId, messages } = (await req.json()) as {
    recordingId: string;
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  };
  if (!recordingId || !messages?.length) {
    return NextResponse.json({ error: 'missing_input' }, { status: 400 });
  }

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const db = getServerDb();
  const collection = db.collection('recordings').doc(recordingId).collection('chat_messages');

  const batch = db.batch();
  for (const msg of messages) {
    const ref = collection.doc();
    batch.set(ref, {
      recordingId,
      userId: user.uid,
      role: msg.role,
      content: msg.content,
      createdAt: FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();

  return NextResponse.json({ success: true });
}

/** DELETE: Clear chat history for a recording. */
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const recordingId = searchParams.get('recordingId');
  if (!recordingId) return NextResponse.json({ error: 'missing_recording_id' }, { status: 400 });

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const db = getServerDb();
  const messagesSnap = await db
    .collection('recordings')
    .doc(recordingId)
    .collection('chat_messages')
    .where('userId', '==', user.uid)
    .get();

  if (messagesSnap.empty) return NextResponse.json({ success: true });

  const batch = db.batch();
  for (const doc of messagesSnap.docs) {
    batch.delete(doc.ref);
  }
  await batch.commit();

  return NextResponse.json({ success: true });
}
