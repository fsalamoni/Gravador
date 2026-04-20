import { getServerDb, getSessionUser } from '@/lib/firebase-server';
import {
  type RecordingExportBundle,
  RecordingExportError,
  buildRecordingMarkdown,
  getRecordingExportBundle,
  sanitizeFilename,
} from '@/lib/recording-export';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/** Export recording data as JSON or Markdown. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const recordingId = searchParams.get('recordingId');
  const format = searchParams.get('format') ?? 'json';

  if (!recordingId) return NextResponse.json({ error: 'missing_recording_id' }, { status: 400 });

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const db = getServerDb();
  let bundle: RecordingExportBundle;
  try {
    bundle = await getRecordingExportBundle(db, recordingId, user.uid);
  } catch (error) {
    if (error instanceof RecordingExportError) {
      return NextResponse.json(
        { error: error.code },
        { status: error.code === 'not_found' ? 404 : 403 },
      );
    }
    throw error;
  }

  const title = bundle.recording.title;

  if (format === 'markdown' || format === 'md') {
    const md = buildRecordingMarkdown(bundle);
    return new Response(md, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${sanitizeFilename(title)}.md"`,
      },
    });
  }

  // JSON export
  return new Response(JSON.stringify(bundle, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${sanitizeFilename(title)}.json"`,
    },
  });
}
