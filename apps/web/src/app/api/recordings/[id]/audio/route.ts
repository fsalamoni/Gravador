import { Readable } from 'node:stream';
import { getApiSessionUser } from '@/lib/api-session';
import { getServerDb, getServerStorage } from '@/lib/firebase-server';
import { getAccessibleRecording } from '@/lib/recording-access';
import { getRecordingLifecycleState } from '@/lib/recording-lifecycle';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type ByteRange = {
  start: number;
  end: number;
  length: number;
};

function normalizeBucketName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized || normalized.toLowerCase() === 'default') return null;
  return normalized;
}

function parseRangeHeader(rangeHeader: string | null, size: number): ByteRange | 'invalid' | null {
  if (!rangeHeader) return null;
  if (!rangeHeader.startsWith('bytes=')) return 'invalid';

  const parts = rangeHeader.slice('bytes='.length).split('-', 2);
  const rawStart = parts[0] ?? '';
  const rawEnd = parts[1] ?? '';
  if (!rawStart && !rawEnd) return 'invalid';

  if (!rawStart && rawEnd) {
    const suffixLength = Number.parseInt(rawEnd, 10);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return 'invalid';

    const length = Math.min(size, suffixLength);
    const start = Math.max(0, size - length);
    const end = size - 1;
    return {
      start,
      end,
      length: end - start + 1,
    };
  }

  const start = Number.parseInt(rawStart, 10);
  const requestedEnd = rawEnd ? Number.parseInt(rawEnd, 10) : size - 1;
  if (!Number.isFinite(start) || start < 0) return 'invalid';
  if (!Number.isFinite(requestedEnd) || requestedEnd < 0) return 'invalid';
  if (start >= size) return 'invalid';

  const end = Math.min(requestedEnd, size - 1);
  if (end < start) return 'invalid';

  return {
    start,
    end,
    length: end - start + 1,
  };
}

async function resolvePlaybackSource(params: {
  recordingRef: FirebaseFirestore.DocumentReference;
  recordingData: Record<string, unknown>;
}) {
  const lifecycle = getRecordingLifecycleState(params.recordingData.lifecycle);

  if (lifecycle.activeAudioVersionId) {
    const activeVersionSnap = await params.recordingRef
      .collection('audio_versions')
      .doc(lifecycle.activeAudioVersionId)
      .get();

    if (activeVersionSnap.exists) {
      const activeVersion = activeVersionSnap.data() as {
        status?: 'ready' | 'queued' | 'failed';
        storagePath?: string | null;
        storageBucket?: string | null;
      };

      const versionStoragePath =
        typeof activeVersion.storagePath === 'string' ? activeVersion.storagePath.trim() : '';

      if (activeVersion.status === 'ready' && versionStoragePath) {
        return {
          storagePath: versionStoragePath,
          storageBucket:
            normalizeBucketName(activeVersion.storageBucket) ??
            normalizeBucketName(params.recordingData.storageBucket),
        };
      }
    }
  }

  const fallbackPath =
    typeof params.recordingData.storagePath === 'string'
      ? params.recordingData.storagePath.trim()
      : '';

  if (!fallbackPath) return null;

  return {
    storagePath: fallbackPath,
    storageBucket: normalizeBucketName(params.recordingData.storageBucket),
  };
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiSessionUser(req);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id: recordingId } = await params;
  const db = getServerDb();
  const access = await getAccessibleRecording(db, recordingId, user.uid);
  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.error === 'not_found' ? 404 : 403 },
    );
  }

  const source = await resolvePlaybackSource({
    recordingRef: access.ref,
    recordingData: access.data as Record<string, unknown>,
  });

  if (!source) {
    return NextResponse.json({ error: 'audio_unavailable' }, { status: 404 });
  }

  const storage = getServerStorage();
  const bucket = source.storageBucket ? storage.bucket(source.storageBucket) : storage.bucket();
  const file = bucket.file(source.storagePath);

  const [exists] = await file.exists();
  if (!exists) {
    return NextResponse.json({ error: 'audio_not_found' }, { status: 404 });
  }

  const [metadata] = await file.getMetadata();
  const size = Number.parseInt(String(metadata.size ?? '0'), 10);
  if (!Number.isFinite(size) || size <= 0) {
    return NextResponse.json({ error: 'audio_not_found' }, { status: 404 });
  }

  const contentType =
    typeof metadata.contentType === 'string' && metadata.contentType.trim()
      ? metadata.contentType
      : 'audio/mp4';

  const range = parseRangeHeader(req.headers.get('range'), size);
  if (range === 'invalid') {
    return new NextResponse(null, {
      status: 416,
      headers: {
        'Accept-Ranges': 'bytes',
        'Content-Range': `bytes */${size}`,
      },
    });
  }

  if (range) {
    const partialStream = file.createReadStream({ start: range.start, end: range.end });
    return new NextResponse(Readable.toWeb(partialStream) as ReadableStream<Uint8Array>, {
      status: 206,
      headers: {
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, max-age=300',
        'Content-Disposition': 'inline',
        'Content-Length': String(range.length),
        'Content-Range': `bytes ${range.start}-${range.end}/${size}`,
        'Content-Type': contentType,
      },
    });
  }

  const stream = file.createReadStream();
  return new NextResponse(Readable.toWeb(stream) as ReadableStream<Uint8Array>, {
    headers: {
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=300',
      'Content-Disposition': 'inline',
      'Content-Length': String(size),
      'Content-Type': contentType,
    },
  });
}
