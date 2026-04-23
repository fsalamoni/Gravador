import { getApiSessionUser } from '@/lib/api-session';
import { getServerDb } from '@/lib/firebase-server';
import { getAccessibleRecording } from '@/lib/recording-access';
import { RECORDING_LIFECYCLE_SCHEMA_VERSION } from '@/lib/recording-lifecycle';
import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type Params = { id: string };

type PatchBody = {
  fullText?: string;
};

async function getTranscriptContext(req: Request, params: Promise<Params>) {
  const user = await getApiSessionUser(req);
  if (!user) return { error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) };

  const { id: recordingId } = await params;
  const db = getServerDb();
  const access = await getAccessibleRecording(db, recordingId, user.uid);
  if (!access.ok) {
    return {
      error: NextResponse.json(
        { error: access.error },
        { status: access.error === 'not_found' ? 404 : 403 },
      ),
    };
  }

  return { user, access, recordingId };
}

export async function GET(req: Request, { params }: { params: Promise<Params> }) {
  const context = await getTranscriptContext(req, params);
  if ('error' in context) return context.error;

  const [transcriptSnap, revisionsSnap] = await Promise.all([
    context.access.ref.collection('transcripts').limit(1).get(),
    context.access.ref
      .collection('transcript_revisions')
      .orderBy('toVersion', 'desc')
      .limit(20)
      .get(),
  ]);

  if (transcriptSnap.empty) {
    return NextResponse.json(
      { error: 'not_found', message: 'Transcrição não encontrada.' },
      { status: 404 },
    );
  }

  const transcriptDoc = transcriptSnap.docs[0]!;
  const transcriptData = transcriptDoc.data();

  return NextResponse.json({
    ok: true,
    transcript: {
      id: transcriptDoc.id,
      fullText: transcriptData.fullText as string,
      detectedLocale: (transcriptData.detectedLocale as string | null | undefined) ?? null,
      transcriptVersion:
        typeof transcriptData.transcriptVersion === 'number' ? transcriptData.transcriptVersion : 1,
      updatedBy: (transcriptData.updatedBy as string | null | undefined) ?? null,
      updatedAt:
        typeof transcriptData.updatedAt?.toDate === 'function'
          ? transcriptData.updatedAt.toDate().toISOString()
          : null,
    },
    revisions: revisionsSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        fromVersion: typeof data.fromVersion === 'number' ? data.fromVersion : 1,
        toVersion: typeof data.toVersion === 'number' ? data.toVersion : 1,
        previousFullText: typeof data.previousFullText === 'string' ? data.previousFullText : '',
        nextFullText: typeof data.nextFullText === 'string' ? data.nextFullText : '',
        editedBy: typeof data.editedBy === 'string' ? data.editedBy : null,
        source: data.source === 'retranscribe' ? 'retranscribe' : 'manual_edit',
        createdAt:
          typeof data.createdAt?.toDate === 'function'
            ? data.createdAt.toDate().toISOString()
            : null,
      };
    }),
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<Params> }) {
  const context = await getTranscriptContext(req, params);
  if ('error' in context) return context.error;

  const body = (await req.json()) as PatchBody;
  const fullText = typeof body.fullText === 'string' ? body.fullText.trim() : '';
  if (!fullText) {
    return NextResponse.json(
      { error: 'invalid_payload', message: 'fullText é obrigatório.' },
      { status: 400 },
    );
  }

  let noChanges = false;

  try {
    await context.access.ref.firestore.runTransaction(async (tx) => {
      const transcriptQuery = context.access.ref.collection('transcripts').limit(1);
      const transcriptSnap = await tx.get(transcriptQuery);

      if (transcriptSnap.empty) {
        throw new Error('transcript_not_found');
      }

      const transcriptDoc = transcriptSnap.docs[0]!;
      const transcriptData = transcriptDoc.data() ?? {};
      const previousFullText =
        typeof transcriptData.fullText === 'string' ? transcriptData.fullText : '';
      const currentVersion =
        typeof transcriptData.transcriptVersion === 'number' ? transcriptData.transcriptVersion : 1;

      if (previousFullText.trim() === fullText) {
        noChanges = true;
        return;
      }

      const nextVersion = currentVersion + 1;
      const revisionRef = context.access.ref.collection('transcript_revisions').doc();

      tx.set(
        revisionRef,
        {
          recordingId: context.recordingId,
          transcriptId: transcriptDoc.id,
          fromVersion: currentVersion,
          toVersion: nextVersion,
          previousFullText,
          nextFullText: fullText,
          editedBy: context.user.uid,
          source: 'manual_edit',
          createdAt: FieldValue.serverTimestamp(),
        },
        { merge: false },
      );

      tx.set(
        transcriptDoc.ref,
        {
          fullText,
          transcriptVersion: nextVersion,
          updatedBy: context.user.uid,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      tx.set(
        context.access.ref,
        {
          updatedAt: FieldValue.serverTimestamp(),
          lifecycle: {
            schemaVersion: RECORDING_LIFECYCLE_SCHEMA_VERSION,
            lastEvent: 'pipeline_updated',
            lastEventAt: FieldValue.serverTimestamp(),
            lastEventBy: context.user.uid,
          },
        },
        { merge: true },
      );
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'transcript_not_found') {
      return NextResponse.json(
        { error: 'not_found', message: 'Transcrição não encontrada.' },
        { status: 404 },
      );
    }
    throw error;
  }

  if (noChanges) {
    return NextResponse.json({ ok: true, noChanges: true });
  }

  const [transcriptSnap, revisionsSnap] = await Promise.all([
    context.access.ref.collection('transcripts').limit(1).get(),
    context.access.ref
      .collection('transcript_revisions')
      .orderBy('toVersion', 'desc')
      .limit(20)
      .get(),
  ]);

  if (transcriptSnap.empty) {
    return NextResponse.json({ ok: true });
  }

  const transcriptDoc = transcriptSnap.docs[0]!;
  const transcriptData = transcriptDoc.data();

  return NextResponse.json({
    ok: true,
    transcript: {
      id: transcriptDoc.id,
      fullText: transcriptData.fullText as string,
      detectedLocale: (transcriptData.detectedLocale as string | null | undefined) ?? null,
      transcriptVersion:
        typeof transcriptData.transcriptVersion === 'number' ? transcriptData.transcriptVersion : 1,
      updatedBy: (transcriptData.updatedBy as string | null | undefined) ?? null,
      updatedAt:
        typeof transcriptData.updatedAt?.toDate === 'function'
          ? transcriptData.updatedAt.toDate().toISOString()
          : null,
    },
    revisions: revisionsSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        fromVersion: typeof data.fromVersion === 'number' ? data.fromVersion : 1,
        toVersion: typeof data.toVersion === 'number' ? data.toVersion : 1,
        previousFullText: typeof data.previousFullText === 'string' ? data.previousFullText : '',
        nextFullText: typeof data.nextFullText === 'string' ? data.nextFullText : '',
        editedBy: typeof data.editedBy === 'string' ? data.editedBy : null,
        source: data.source === 'retranscribe' ? 'retranscribe' : 'manual_edit',
        createdAt:
          typeof data.createdAt?.toDate === 'function'
            ? data.createdAt.toDate().toISOString()
            : null,
      };
    }),
  });
}
