import { getServerDb, getSessionUser } from '@/lib/firebase-server';
import { formatDurationMs } from '@gravador/core';
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
  const recDoc = await db.collection('recordings').doc(recordingId).get();
  if (!recDoc.exists) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const rec = recDoc.data()! as {
    title?: string;
    durationMs: number;
    createdBy: string;
    workspaceId: string;
    capturedAt: { toDate: () => Date };
  };

  // Auth check
  if (rec.createdBy !== user.uid) {
    const memberDoc = await db
      .collection('workspaces')
      .doc(rec.workspaceId)
      .collection('members')
      .doc(user.uid)
      .get();
    if (!memberDoc.exists) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // Fetch all data in parallel
  const [transcriptSnap, segmentsSnap, outputsSnap, actionsSnap] = await Promise.all([
    db.collection('recordings').doc(recordingId).collection('transcripts').limit(1).get(),
    db.collection('recordings').doc(recordingId).collection('transcript_segments').orderBy('startMs').get(),
    db.collection('recordings').doc(recordingId).collection('ai_outputs').get(),
    db.collection('recordings').doc(recordingId).collection('action_items').get(),
  ]);

  const transcript = transcriptSnap.empty ? null : transcriptSnap.docs[0]!.data();
  const segments = segmentsSnap.docs.map((d) => d.data());
  const outputs = Object.fromEntries(outputsSnap.docs.map((d) => [d.data().kind, d.data().payload]));
  const actionItems = actionsSnap.docs.map((d) => d.data());

  const title = rec.title ?? rec.capturedAt?.toDate?.()?.toISOString?.() ?? recordingId;

  if (format === 'markdown' || format === 'md') {
    const md = buildMarkdown(title, rec.durationMs, transcript, segments, outputs, actionItems);
    return new Response(md, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${sanitizeFilename(title)}.md"`,
      },
    });
  }

  // JSON export
  const data = {
    recording: { id: recordingId, title, durationMs: rec.durationMs },
    transcript: transcript?.full_text ?? null,
    segments,
    outputs,
    actionItems,
    exportedAt: new Date().toISOString(),
  };

  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${sanitizeFilename(title)}.json"`,
    },
  });
}

function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '_').slice(0, 100);
}

function buildMarkdown(
  title: string,
  durationMs: number,
  transcript: Record<string, unknown> | null,
  segments: Record<string, unknown>[],
  outputs: Record<string, unknown>,
  actionItems: Record<string, unknown>[],
): string {
  const lines: string[] = [];
  lines.push(`# ${title}`);
  lines.push(`\n**Duration:** ${formatDurationMs(durationMs)}\n`);

  // Summary
  const summary = outputs.summary as { tldr?: string; bullets?: string[]; longform?: string } | undefined;
  if (summary) {
    lines.push(`## Summary\n`);
    if (summary.tldr) lines.push(`**TL;DR:** ${summary.tldr}\n`);
    if (summary.bullets?.length) {
      lines.push(`### Key Points\n`);
      for (const b of summary.bullets) lines.push(`- ${b}`);
      lines.push('');
    }
    if (summary.longform) lines.push(`${summary.longform}\n`);
  }

  // Action Items
  if (actionItems.length > 0) {
    lines.push(`## Action Items\n`);
    for (const a of actionItems) {
      const done = (a as { done?: boolean }).done ? 'x' : ' ';
      const text = (a as { text: string }).text;
      const assignee = (a as { assignee?: string }).assignee;
      lines.push(`- [${done}] ${text}${assignee ? ` (@${assignee})` : ''}`);
    }
    lines.push('');
  }

  // Chapters
  const chapters = outputs.chapters as Array<{ title: string; startMs: number; endMs: number; summary: string }> | undefined;
  if (chapters?.length) {
    lines.push(`## Chapters\n`);
    for (const c of chapters) {
      lines.push(`### ${c.title} (${formatDurationMs(c.startMs)} – ${formatDurationMs(c.endMs)})`);
      lines.push(`${c.summary}\n`);
    }
  }

  // Transcript
  if (segments.length > 0) {
    lines.push(`## Transcript\n`);
    for (const s of segments) {
      const seg = s as { startMs: number; speakerId?: string; text: string };
      const speaker = seg.speakerId ? `**${seg.speakerId}**` : '';
      lines.push(`[${formatDurationMs(seg.startMs)}] ${speaker} ${seg.text}\n`);
    }
  } else if (transcript) {
    lines.push(`## Transcript\n`);
    lines.push(`${(transcript as { full_text: string }).full_text}\n`);
  }

  // Quotes
  const quotes = outputs.quotes as Array<{ text: string; reason: string }> | undefined;
  if (quotes?.length) {
    lines.push(`## Notable Quotes\n`);
    for (const q of quotes) {
      lines.push(`> ${q.text}`);
      lines.push(`> *${q.reason}*\n`);
    }
  }

  // Flashcards
  const cards = outputs.flashcards as Array<{ q: string; a: string }> | undefined;
  if (cards?.length) {
    lines.push(`## Flashcards\n`);
    for (const c of cards) {
      lines.push(`**Q:** ${c.q}`);
      lines.push(`**A:** ${c.a}\n`);
    }
  }

  return lines.join('\n');
}
