import { createSupabaseServer } from '@/lib/supabase-server';

export default async function SettingsPage() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-semibold mb-6">Configurações</h1>
      <div className="card p-6 space-y-4">
        <Field label="E-mail" value={user?.email ?? '-'} />
        <Field label="User ID" value={user?.id ?? '-'} />
      </div>

      <h2 className="text-xl font-medium mt-10 mb-3">Provedores de IA (BYOK)</h2>
      <p className="text-mute text-sm mb-4">
        Traga suas próprias chaves para usar modelos cloud sem compartilhar custos com o Gravador.
        Chaves são cifradas em repouso e usadas somente para suas gravações.
      </p>
      <div className="card p-6 text-mute text-sm">Em breve — configuração via UI.</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-mute text-xs uppercase tracking-widest">{label}</div>
      <div className="mt-1 font-mono text-sm break-all">{value}</div>
    </div>
  );
}
