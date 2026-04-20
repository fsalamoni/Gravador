import { getServerDb } from '@/lib/firebase-server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    await getServerDb()
      .collection('recordings')
      .where('createdBy', '==', '__healthcheck__')
      .where('deletedAt', '==', null)
      .orderBy('capturedAt', 'desc')
      .limit(1)
      .get();

    return NextResponse.json({
      ok: true,
      service: 'gravador-web',
      checks: {
        firestoreRecordingsQuery: 'ok',
      },
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        service: 'gravador-web',
        error: 'firestore_recordings_query_failed',
        checks: {
          firestoreRecordingsQuery: 'failed',
        },
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
