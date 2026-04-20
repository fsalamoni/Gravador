import { createSupabaseServer } from '@/lib/supabase-server';
import { formatDurationMs } from '@gravador/core';
import Link from 'next/link';
import { RecordingsPageClient } from './recordings-client';

export default async function RecordingsListPage() {
  const supabase = await createSupabaseServer();
  const { data: recordings } = await supabase
    .from('recordings')
    .select('id,title,duration_ms,status,captured_at')
    .is('deleted_at', null)
    .order('captured_at', { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-semibold">Gravações</h1>
        <RecordingsPageClient />
      </div>
      <div className="card divide-y divide-border">
        {(recordings ?? []).map((r) => (
          <Link
            key={r.id}
            href={`/workspace/recordings/${r.id}`}
            className="flex items-center justify-between p-4 hover:bg-surfaceAlt"
          >
            <div>
              <div className="font-medium">
                {r.title ?? new Date(r.captured_at).toLocaleString()}
              </div>
              <div className="text-mute text-sm mt-0.5">{r.status}</div>
            </div>
            <div className="text-mute text-sm font-mono">{formatDurationMs(r.duration_ms)}</div>
          </Link>
        ))}
        {(!recordings || recordings.length === 0) && (
          <p className="p-8 text-mute text-center">Nenhuma gravação ainda.</p>
        )}
      </div>
    </div>
  );
}
