import { createSupabaseServer } from '@/lib/supabase-server';
import { formatDurationMs } from '@gravador/core';
import Link from 'next/link';

export default async function WorkspaceHome() {
  const supabase = await createSupabaseServer();
  const { data: recordings } = await supabase
    .from('recordings')
    .select('id,title,duration_ms,status,captured_at')
    .is('deleted_at', null)
    .order('captured_at', { ascending: false })
    .limit(12);

  return (
    <div>
      <h1 className="text-3xl font-semibold mb-6">Início</h1>

      <section className="mb-10">
        <h2 className="text-lg text-mute mb-3">Gravações recentes</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {(recordings ?? []).map((r) => (
            <Link
              key={r.id}
              href={`/workspace/recordings/${r.id}`}
              className="card p-5 hover:border-accent transition block"
            >
              <div className="font-medium truncate">
                {r.title ?? new Date(r.captured_at).toLocaleString()}
              </div>
              <div className="text-mute text-sm mt-2 flex justify-between">
                <span>{formatDurationMs(r.duration_ms)}</span>
                <span>{r.status}</span>
              </div>
            </Link>
          ))}
          {(!recordings || recordings.length === 0) && (
            <div className="text-mute col-span-full">
              Sem gravações ainda. Abra o app no celular e grave algo.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
