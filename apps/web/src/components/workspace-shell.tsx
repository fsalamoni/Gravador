'use client';

import {
  AudioWaveform,
  ChevronRight,
  FolderKanban,
  Home,
  LogOut,
  Search,
  Settings,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

type WorkspaceShellProps = {
  children: React.ReactNode;
  email?: string | null;
  uid: string;
};

const navItems = [
  { href: '/workspace', label: 'Visão geral', icon: Home },
  { href: '/workspace/recordings', label: 'Gravações', icon: AudioWaveform },
  { href: '/workspace/search', label: 'Busca', icon: Search },
  { href: '/workspace/integrations', label: 'Integrações', icon: Sparkles },
  { href: '/workspace/settings', label: 'Configurações', icon: Settings },
] as const;

function getInitials(email: string | null | undefined, uid: string) {
  const source = email?.trim() || uid;
  return source.slice(0, 2).toUpperCase();
}

export function WorkspaceShell({ children, email, uid }: WorkspaceShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-4 sm:px-6 lg:px-8">
      <div className="soft-orb -left-10 top-8 h-40 w-40 bg-accent/25" />
      <div className="soft-orb right-10 top-32 h-52 w-52 bg-[#60d4c7]/10" />

      <div className="mx-auto flex max-w-[1600px] flex-col gap-4 lg:flex-row">
        <aside className="ambient-shell card flex shrink-0 flex-col gap-6 p-5 lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:w-[320px] lg:p-6">
          <div className="flex items-center gap-4 rounded-[24px] border border-border bg-surfaceAlt/70 px-4 py-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-onAccent shadow-[0_10px_30px_var(--accent-shadow)]">
              <AudioWaveform className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-mute">Studio Workspace</p>
              <h1 className="display-title text-2xl">Gravador</h1>
            </div>
          </div>

          <div className="lg:hidden">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`inline-flex min-w-fit items-center gap-2 rounded-full border px-4 py-2 text-sm transition ${
                      isActive
                        ? 'border-accent bg-accent text-onAccent'
                        : 'border-border bg-surfaceAlt/50 text-mute hover:text-text'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>

          <nav className="hidden flex-1 flex-col gap-2 lg:flex">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group flex items-center gap-3 rounded-[22px] border px-4 py-3 transition ${
                    isActive
                      ? 'border-accent bg-accent text-onAccent shadow-[0_16px_40px_-22px_var(--accent-shadow)]'
                      : 'border-transparent bg-transparent text-mute hover:border-border hover:bg-surfaceAlt/60 hover:text-text'
                  }`}
                >
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
                      isActive ? 'bg-onAccent/10' : 'bg-surfaceAlt text-accent'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{item.label}</div>
                    <div className={`text-xs ${isActive ? 'text-onAccent/70' : 'text-mute'}`}>
                      {item.href === '/workspace'
                        ? 'Painel, status e atividade'
                        : item.href === '/workspace/recordings'
                          ? 'Biblioteca e detalhe do material'
                          : item.href === '/workspace/search'
                            ? 'Busca semântica e histórico'
                            : item.href === '/workspace/integrations'
                              ? 'Conexões e automações'
                              : 'Conta, idioma e preferências'}
                    </div>
                  </div>
                  <ChevronRight
                    className={`h-4 w-4 ${isActive ? 'opacity-70' : 'opacity-0 transition group-hover:opacity-100'}`}
                  />
                </Link>
              );
            })}
          </nav>

          <div className="space-y-4">
            <div className="rounded-[24px] border border-border bg-surfaceAlt/65 p-4">
              <div className="flex items-center justify-between text-xs uppercase tracking-[0.24em] text-mute">
                <span>Pipeline</span>
                <Sparkles className="h-4 w-4 text-accent" />
              </div>
              <div className="mt-4 space-y-3 text-sm text-mute">
                <div className="flex items-center justify-between rounded-2xl bg-bg/50 px-3 py-2 text-text">
                  <span>Capture no mobile</span>
                  <span className="rounded-full bg-accent/15 px-2 py-1 text-xs text-accent">
                    Live
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-bg/50 px-3 py-2">
                  <span>Processamento IA</span>
                  <span className="text-ok">Ready</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-bg/50 px-3 py-2">
                  <span>Entrega no workspace</span>
                  <span className="text-accentSoft">Stable</span>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-border bg-bg/60 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-sm font-bold text-onAccent">
                  {getInitials(email, uid)}
                </div>
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.24em] text-mute">Sessão ativa</p>
                  <p className="truncate font-medium text-text">{email ?? uid}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-3 rounded-2xl border border-border px-3 py-3 text-sm text-mute">
                <FolderKanban className="h-4 w-4 text-accent" />
                <span>Google-only auth, deploy estável e saúde do Firestore monitorada.</span>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await fetch('/api/auth/session', { method: 'DELETE' });
                  router.push('/');
                  router.refresh();
                }}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-danger/40 bg-danger/10 px-3 py-3 text-sm font-medium text-danger transition hover:bg-danger/20"
              >
                <LogOut className="h-4 w-4" />
                Sair
              </button>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <header className="ambient-shell card flex flex-col gap-4 p-5 sm:p-6 md:flex-row md:items-end md:justify-between">
            <div>
              <span className="eyebrow">Audio workspace</span>
              <h2 className="display-title mt-4 text-4xl sm:text-5xl">
                Do bolso para a mesa de trabalho.
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-mute sm:text-base">
                Grave no app, processe com IA e trate transcript, resumo, ações e busca como um
                produto, não como uma lista de documentos soltos.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm sm:min-w-[320px]">
              <div className="rounded-[24px] border border-border bg-surfaceAlt/65 p-4">
                <div className="text-xs uppercase tracking-[0.24em] text-mute">Auth</div>
                <div className="mt-2 text-2xl font-semibold text-text">Google</div>
                <div className="mt-1 text-mute">Sessão segura</div>
              </div>
              <div className="rounded-[24px] border border-border bg-surfaceAlt/65 p-4">
                <div className="text-xs uppercase tracking-[0.24em] text-mute">Infra</div>
                <div className="mt-2 text-2xl font-semibold text-text">anotes</div>
                <div className="mt-1 text-mute">Banco dedicado</div>
              </div>
            </div>
          </header>

          <main className="min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
