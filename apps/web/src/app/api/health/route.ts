import { getServerDb } from '@/lib/firebase-server';
import { NextResponse } from 'next/server';

const COMMIT_SHA = process.env.NEXT_PUBLIC_COMMIT_SHA ?? 'unknown';
const BUILD_TIME = process.env.NEXT_PUBLIC_BUILD_TIME ?? 'unknown';

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
      commitSha: COMMIT_SHA,
      buildTime: BUILD_TIME,
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
        commitSha: COMMIT_SHA,
        buildTime: BUILD_TIME,
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
