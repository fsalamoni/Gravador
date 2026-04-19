import { getSessionUser } from '@/lib/firebase-server';
import { listUserRecordings } from '@/lib/server-recordings';
import { formatDurationMs } from '@gravador/core';
import { ArrowLeft, ArrowUpRight, Clock3, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function RecordingsListPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  const recordings = (await listUserRecordings(user.uid)) as Array<{
    id: string;
    title?: string;
    durationMs: number;
    status: string;
    capturedAt: { toDate: () => Date };
  }>;
  const totalHours = (
    recordings.reduce((sum, recording) => sum + recording.durationMs, 0) / 3600000
  ).toFixed(1);

  return (
    <div className="space-y-5">
      <section className="card px-6 py-7 sm:px-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link
              href="/workspace"
              className="inline-flex items-center gap-2 text-sm text-mute transition hover:text-text"
            >
              <ArrowLeft className="h-4 w-4" />
              Visão geral
            </Link>
            <h1 className="display-title mt-5 text-5xl leading-[0.96]">Biblioteca de gravações</h1>
            <p className="mt-4 max-w-3xl leading-8 text-mute">
              Navegue por sessões recentes, revise o material bruto e entre direto no detalhe quando
              a reunião já pede decisão.
            </p>
            <Link
              href="/workspace/recordings/trash"
              className="mt-3 inline-flex items-center gap-2 text-sm text-mute transition hover:text-danger"
            >
              <Trash2 className="h-4 w-4" />
              Lixeira
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[24px] border border-border bg-bg/55 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-mute">Itens</div>
              <div className="mt-2 text-3xl font-semibold text-text">{recordings.length}</div>
              <div className="mt-1 text-sm text-mute">Na biblioteca atual</div>
            </div>
            <div className="rounded-[24px] border border-border bg-bg/55 p-4">
              <Clock3 className="h-5 w-5 text-accent" />
              <div className="mt-3 text-3xl font-semibold text-text">{totalHours}h</div>
              <div className="mt-1 text-sm text-mute">De áudio acumulado</div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {recordings.map((recording) => (
          <Link
            key={recording.id}
            href={`/workspace/recordings/${recording.id}`}
            className="card group p-6 transition hover:border-accent/70"
          >
            <div className="flex items-center justify-between gap-4">
              <span className="rounded-full border border-border px-3 py-1 text-xs uppercase tracking-[0.2em] text-mute">
                {recording.status}
              </span>
              <ArrowUpRight className="h-4 w-4 text-mute transition group-hover:text-accent" />
            </div>
            <h2 className="mt-5 text-2xl font-semibold text-text">
              {recording.title ?? recording.capturedAt.toDate().toLocaleString()}
            </h2>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-mute">
              <span className="rounded-full border border-border px-3 py-1">
                {formatDurationMs(recording.durationMs)}
              </span>
              <span className="rounded-full border border-border px-3 py-1">
                {recording.capturedAt.toDate().toLocaleString()}
              </span>
            </div>
            <div className="mt-6 flex h-20 items-end gap-1.5">
              {[
                ['bar-1', 16],
                ['bar-2', 24],
                ['bar-3', 42],
                ['bar-4', 64],
                ['bar-5', 58],
                ['bar-6', 36],
                ['bar-7', 44],
                ['bar-8', 62],
                ['bar-9', 30],
                ['bar-10', 18],
                ['bar-11', 34],
                ['bar-12', 26],
              ].map(([barId, height]) => (
                <span
                  key={`${recording.id}-${barId}`}
                  className="flex-1 rounded-full bg-accent/70"
                  style={{ height }}
                />
              ))}
            </div>
          </Link>
        ))}

        {recordings.length === 0 ? (
          <div className="card px-6 py-12 text-center text-mute">Nenhuma gravação ainda.</div>
        ) : null}
      </section>
    </div>
  );
}
