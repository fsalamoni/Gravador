import { formatDurationMs } from '@gravador/core';
import type { Firestore } from 'firebase-admin/firestore';

type RecordingDoc = {
  title?: string;
  durationMs: number;
  createdBy: string;
  workspaceId: string;
  capturedAt?: { toDate?: () => Date } | Date | string | null;
};

export class RecordingExportError extends Error {
  constructor(
    message: string,
    public readonly code: 'not_found' | 'forbidden',
  ) {
    super(message);
  }
}

export interface RecordingExportBundle {
  recording: {
    id: string;
    title: string;
    durationMs: number;
    workspaceId: string;
    createdBy: string;
  };
  transcript: string | null;
  segments: Record<string, unknown>[];
  outputs: Record<string, unknown>;
  actionItems: Record<string, unknown>[];
  exportedAt: string;
}

export async function getRecordingExportBundle(
  db: Firestore,
  recordingId: string,
  userId: string,
): Promise<RecordingExportBundle> {
  const recDoc = await db.collection('recordings').doc(recordingId).get();
  if (!recDoc.exists) {
    throw new RecordingExportError('Recording not found.', 'not_found');
  }

  const rec = recDoc.data() as RecordingDoc;
  const canAccess = await canAccessRecording(db, rec, userId);
  if (!canAccess) {
    throw new RecordingExportError('User cannot access this recording.', 'forbidden');
  }

  const [transcriptSnap, segmentsSnap, outputsSnap, actionsSnap] = await Promise.all([
    db.collection('recordings').doc(recordingId).collection('transcripts').limit(1).get(),
    db
      .collection('recordings')
      .doc(recordingId)
      .collection('transcript_segments')
      .orderBy('startMs')
      .get(),
    db.collection('recordings').doc(recordingId).collection('ai_outputs').get(),
    db.collection('recordings').doc(recordingId).collection('action_items').get(),
  ]);

  const transcript = transcriptSnap.empty ? null : transcriptSnap.docs[0]!.data();
  const segments = segmentsSnap.docs.map((doc) => doc.data());
  const outputs = Object.fromEntries(
    outputsSnap.docs.map((doc) => [doc.data().kind as string, doc.data().payload]),
  );
  const actionItems = actionsSnap.docs.map((doc) => doc.data());
  const title =
    rec.title ??
    coerceCapturedAt(rec.capturedAt)?.toISOString?.() ??
    `recording-${recordingId.slice(0, 8)}`;

  return {
    recording: {
      id: recordingId,
      title,
      durationMs: rec.durationMs,
      workspaceId: rec.workspaceId,
      createdBy: rec.createdBy,
    },
    transcript:
      (transcript as { fullText?: string; full_text?: string } | null)?.fullText ??
      (transcript as { full_text?: string } | null)?.full_text ??
      null,
    segments,
    outputs,
    actionItems,
    exportedAt: new Date().toISOString(),
  };
}

export function buildRecordingMarkdown(bundle: RecordingExportBundle): string {
  const { recording, transcript, segments, outputs, actionItems } = bundle;
  const lines: string[] = [];
  lines.push(`# ${recording.title}`);
  lines.push(`\n**Duration:** ${formatDurationMs(recording.durationMs)}\n`);

  const summary = outputs.summary as
    | { tldr?: string; bullets?: string[]; longform?: string }
    | undefined;
  if (summary) {
    lines.push('## Summary\n');
    if (summary.tldr) lines.push(`**TL;DR:** ${summary.tldr}\n`);
    if (summary.bullets?.length) {
      lines.push('### Key Points\n');
      for (const bullet of summary.bullets) lines.push(`- ${bullet}`);
      lines.push('');
    }
    if (summary.longform) lines.push(`${summary.longform}\n`);
  }

  if (actionItems.length > 0) {
    lines.push('## Action Items\n');
    for (const item of actionItems) {
      const done = (item as { done?: boolean }).done ? 'x' : ' ';
      const text = (item as { text?: string }).text ?? 'Sem descrição';
      const assignee = (item as { assignee?: string | null }).assignee;
      lines.push(`- [${done}] ${text}${assignee ? ` (@${assignee})` : ''}`);
    }
    lines.push('');
  }

  const chapters = outputs.chapters as
    | Array<{ title: string; startMs: number; endMs: number; summary: string }>
    | undefined;
  if (chapters?.length) {
    lines.push('## Chapters\n');
    for (const chapter of chapters) {
      lines.push(
        `### ${chapter.title} (${formatDurationMs(chapter.startMs)} – ${formatDurationMs(chapter.endMs)})`,
      );
      lines.push(`${chapter.summary}\n`);
    }
  }

  if (segments.length > 0) {
    lines.push('## Transcript\n');
    for (const segment of segments) {
      const entry = segment as { startMs?: number; speakerId?: string | null; text?: string };
      const speaker = entry.speakerId ? `**${entry.speakerId}** ` : '';
      lines.push(`[${formatDurationMs(entry.startMs ?? 0)}] ${speaker}${entry.text ?? ''}\n`);
    }
  } else if (transcript) {
    lines.push('## Transcript\n');
    lines.push(`${transcript}\n`);
  }

  const quotes = outputs.quotes as Array<{ text: string; reason: string }> | undefined;
  if (quotes?.length) {
    lines.push('## Notable Quotes\n');
    for (const quote of quotes) {
      lines.push(`> ${quote.text}`);
      lines.push(`> *${quote.reason}*\n`);
    }
  }

  const cards = outputs.flashcards as Array<{ q: string; a: string }> | undefined;
  if (cards?.length) {
    lines.push('## Flashcards\n');
    for (const card of cards) {
      lines.push(`**Q:** ${card.q}`);
      lines.push(`**A:** ${card.a}\n`);
    }
  }

  return lines.join('\n');
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '_').slice(0, 100);
}

async function canAccessRecording(db: Firestore, rec: RecordingDoc, userId: string) {
  if (rec.createdBy === userId) return true;
  const memberDoc = await db
    .collection('workspaces')
    .doc(rec.workspaceId)
    .collection('members')
    .doc(userId)
    .get();
  return memberDoc.exists;
}

function coerceCapturedAt(input: RecordingDoc['capturedAt']): Date | null {
  if (!input) return null;
  if (input instanceof Date) return input;
  if (typeof input === 'string') {
    const parsed = new Date(input);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof input === 'object' && typeof input.toDate === 'function') {
    return input.toDate();
  }
  return null;
}
