import { getServerAuth, getSessionUser } from '@/lib/firebase-server';
import { ShieldCheck, Sparkles, UserRound } from 'lucide-react';

export default async function SettingsPage() {
  const session = await getSessionUser();
  let email = '-';
  let uid = '-';
  if (session) {
    uid = session.uid;
    const auth = getServerAuth();
    try {
      const userRecord = await auth.getUser(session.uid);
      email = userRecord.email ?? '-';
    } catch {
      // User may not exist in auth
    }
  }

  return (
    <div className="space-y-5">
      <section className="card px-6 py-7 sm:px-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="eyebrow">Conta e preferências</span>
            <h1 className="display-title mt-5 text-5xl leading-[0.96]">
              Configurações do workspace
            </h1>
            <p className="mt-4 max-w-3xl leading-8 text-mute">
              O painel de conta já organiza acesso, sessão e o ponto de entrada para futuras
              preferências de IA e distribuição.
            </p>
          </div>
          <div className="rounded-[24px] border border-border bg-[#100c09]/55 px-5 py-4 text-sm text-mute">
            Google-only auth, sessão ativa e estrutura pronta para chaves BYOK.
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="card p-6 sm:p-7">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-accent text-[#120d0a]">
              <UserRound className="h-7 w-7" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-mute">Conta</div>
              <div className="mt-2 text-2xl font-semibold text-text">Perfil conectado</div>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <Field label="E-mail" value={email} />
            <Field label="User ID" value={uid} />
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-6">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-accent" />
              <h2 className="text-2xl font-semibold text-text">Provedores de IA (BYOK)</h2>
            </div>
            <p className="mt-4 leading-7 text-mute">
              Traga suas próprias chaves para usar modelos cloud sem compartilhar custos com o
              Gravador. As credenciais devem entrar por UI e permanecer cifradas em repouso.
            </p>
            <div className="mt-5 rounded-[22px] border border-border bg-[#100c09]/55 px-4 py-4 text-sm text-mute">
              Em breve: seleção de provider, chave por workspace e status operacional por pipeline.
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-ok" />
              <h2 className="text-2xl font-semibold text-text">Segurança</h2>
            </div>
            <ul className="mt-4 space-y-3 text-sm leading-7 text-mute">
              <li className="rounded-[20px] border border-border bg-[#100c09]/55 px-4 py-3">
                Autenticação exclusiva via Google.
              </li>
              <li className="rounded-[20px] border border-border bg-[#100c09]/55 px-4 py-3">
                Sessão do servidor separada do token do cliente.
              </li>
              <li className="rounded-[20px] border border-border bg-[#100c09]/55 px-4 py-3">
                Infra de produção já validada com health check real.
              </li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-border bg-[#100c09]/55 px-4 py-4">
      <div className="text-xs uppercase tracking-[0.24em] text-mute">{label}</div>
      <div className="mt-2 break-all font-mono text-sm text-text">{value}</div>
    </div>
  );
}
