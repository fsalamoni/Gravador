import { createSupabaseServer } from '@/lib/supabase-server';
import { formatDurationMs } from '@gravador/core';
import { notFound } from 'next/navigation';

export default async function PublicSharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createSupabaseServer();

  const { data: share } = await supabase
    .from('shares')
    .select('*, recordings(id,title,duration_ms,status,captured_at,storage_path,storage_bucket)')
    .eq('token', token)
    .maybeSingle();

  if (!share) notFound();
  if (share.revoked_at || (share.expires_at && new Date(share.expires_at) < new Date())) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <p className="text-mute">Este link expirou ou foi revogado.</p>
      </main>
    );
  }

  const rec = share.recordings as {
    id: string;
    title: string | null;
    duration_ms: number;
    status: string;
    captured_at: string;
  };

  return (
    <main className="min-h-screen p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold">
        {rec.title ?? new Date(rec.captured_at).toLocaleString()}
      </h1>
      <div className="text-mute mt-1">{formatDurationMs(rec.duration_ms)}</div>
      <p className="text-mute mt-8">
        Compartilhamento público — conteúdo é restrito pelas permissões configuradas pelo dono.
      </p>
    </main>
  );
}
