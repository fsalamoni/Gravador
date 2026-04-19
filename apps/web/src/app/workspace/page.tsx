import { getSessionUser } from '@/lib/firebase-server';
import { listUserRecordings } from '@/lib/server-recordings';
import { formatDurationMs } from '@gravador/core';
import { ArrowUpRight, Clock3, Mic, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function WorkspaceHome() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  const recordings = (await listUserRecordings(user.uid, 12)) as Array<{
    id: string;
    title?: string;
    durationMs: number;
    status: string;
    capturedAt: { toDate: () => Date };
  }>;
  const totalMinutes = Math.round(
    recordings.reduce((sum, recording) => sum + recording.durationMs, 0) / 60000,
  );
  const completedCount = recordings.filter((recording) => recording.status === 'ready').length;

  return (
    <div className="space-y-5">
      <section className="card overflow-hidden px-6 py-7 sm:px-7">
        <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr] xl:items-end">
          <div>
            <span className="eyebrow">Visão geral</span>
            <h1 className="display-title mt-5 text-5xl leading-[0.96]">
              Seu estúdio operacional para transformar fala em trabalho útil.
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-8 text-mute">
              O Gravador agora se comporta como um workspace: entrada segura, pipeline de IA e
              biblioteca pronta para revisão, busca e compartilhamento.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[24px] border border-border bg-bg/55 p-4">
              <Mic className="h-5 w-5 text-accent" />
              <div className="mt-4 text-3xl font-semibold text-text">{recordings.length}</div>
              <div className="mt-1 text-sm text-mute">Itens recentes</div>
            </div>
            <div className="rounded-[24px] border border-border bg-bg/55 p-4">
              <Clock3 className="h-5 w-5 text-accentSoft" />
              <div className="mt-4 text-3xl font-semibold text-text">{totalMinutes}m</div>
              <div className="mt-1 text-sm text-mute">Áudio nesta janela</div>
            </div>
            <div className="rounded-[24px] border border-border bg-bg/55 p-4">
              <Sparkles className="h-5 w-5 text-ok" />
              <div className="mt-4 text-3xl font-semibold text-text">{completedCount}</div>
              <div className="mt-1 text-sm text-mute">Prontas para IA</div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="card p-6 sm:p-7">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-mute">
                Gravações recentes
              </div>
              <h2 className="mt-2 text-3xl font-semibold text-text">
                Continue do ponto onde a captura terminou.
              </h2>
            </div>
            <Link
              href="/workspace/recordings"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-surfaceAlt/70 px-4 py-2 text-sm font-semibold transition hover:text-text"
            >
              Ver todas
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {recordings.map((recording) => (
              <Link
                key={recording.id}
                href={`/workspace/recordings/${recording.id}`}
                className="rounded-[24px] border border-border bg-bg/55 p-5 transition hover:border-accent/70 hover:-translate-y-0.5"
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="rounded-full border border-border px-3 py-1 text-xs uppercase tracking-[0.2em] text-mute">
                    {recording.status}
                  </span>
                  <span className="text-xs text-mute">
                    {formatDurationMs(recording.durationMs)}
                  </span>
                </div>
                <div className="mt-4 text-lg font-semibold text-text">
                  {recording.title ?? recording.capturedAt.toDate().toLocaleString()}
                </div>
                <div className="mt-5 flex h-16 items-end gap-1.5">
                  {[
                    ['bar-1', 18],
                    ['bar-2', 30],
                    ['bar-3', 46],
                    ['bar-4', 24],
                    ['bar-5', 52],
                    ['bar-6', 42],
                    ['bar-7', 60],
                    ['bar-8', 38],
                    ['bar-9', 20],
                    ['bar-10', 28],
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
              <div className="col-span-full rounded-[24px] border border-dashed border-border bg-bg/45 px-6 py-10 text-center text-mute">
                Sem gravações ainda. Abra o app no celular, capture algo e o workspace entra em
                ação.
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-6">
            <div className="text-xs uppercase tracking-[0.24em] text-mute">Pipeline visível</div>
            <div className="mt-4 space-y-3 text-sm text-mute">
              <div className="rounded-[20px] border border-border bg-surfaceAlt/70 px-4 py-3 text-text">
                1. Capture no mobile
              </div>
              <div className="rounded-[20px] border border-border bg-surfaceAlt/70 px-4 py-3">
                2. Fila e upload
              </div>
              <div className="rounded-[20px] border border-border bg-surfaceAlt/70 px-4 py-3">
                3. Transcript e outputs
              </div>
              <div className="rounded-[20px] border border-border bg-surfaceAlt/70 px-4 py-3">
                4. Busca, ações e revisão
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="text-xs uppercase tracking-[0.24em] text-mute">Sessão</div>
            <h3 className="mt-3 text-2xl font-semibold text-text">
              Entrada limpa, saída utilizável.
            </h3>
            <p className="mt-3 leading-7 text-mute">
              A camada web agora prioriza clareza: acesso, gravações, IA e documentos de release
              estão organizados como partes de um mesmo produto.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
