'use client';

import { CommandPalette } from '@/components/command-palette';
import { useGlobalShortcuts } from '@/hooks/use-global-shortcuts';
import { AudioWaveform, LayoutDashboard, LogOut, Search, Settings, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

type WorkspaceShellProps = {
  children: React.ReactNode;
  email?: string | null;
  uid: string;
};

const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? '').split(',').filter(Boolean);

const NAV_ITEMS = [
  { href: '/workspace/recordings', labelKey: 'recordings', icon: AudioWaveform },
  { href: '/workspace/search', labelKey: 'search', icon: Search },
  { href: '/workspace/integrations', labelKey: 'integrations', icon: Sparkles },
  { href: '/workspace/settings', labelKey: 'settings', icon: Settings },
] as const;

function getInitials(email: string | null | undefined, uid: string) {
  const source = email?.trim() || uid;
  return source.slice(0, 2).toUpperCase();
}

export function WorkspaceShell({ children, email, uid }: WorkspaceShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  useGlobalShortcuts();
  const tNav = useTranslations('nav');

  const isAdmin = !!(email && ADMIN_EMAILS.includes(email));

  const navLabels: Record<string, string> = {
    '/workspace/recordings': tNav('recordings'),
    '/workspace/search': tNav('search'),
    '/workspace/integrations': tNav('integrations'),
    '/workspace/settings': tNav('settings'),
    '/workspace/admin': 'Dashboard',
  };

  return (
    <div className="relative min-h-screen bg-bg">
      {/* ── Top navbar ── */}
      <header className="sticky top-0 z-40 border-b border-border bg-surface/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
          {/* Logo */}
          <Link href="/workspace/recordings" className="flex shrink-0 items-center gap-2.5">
            <Image src="/logo.png" alt="Nexus" width={32} height={32} className="rounded-lg" />
            <span className="display-title text-lg text-text">Nexus</span>
          </Link>

          {/* Nav links */}
          <nav className="ml-4 flex items-center gap-1 overflow-x-auto" aria-label="Main">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    active
                      ? 'bg-accent/12 text-accent'
                      : 'text-mute hover:bg-surfaceAlt hover:text-text'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{navLabels[item.href]}</span>
                </Link>
              );
            })}
            {isAdmin && (
              <Link
                href="/workspace/admin"
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  pathname.startsWith('/workspace/admin')
                    ? 'bg-accent/12 text-accent'
                    : 'text-mute hover:bg-surfaceAlt hover:text-text'
                }`}
              >
                <LayoutDashboard className="h-4 w-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </Link>
            )}
          </nav>

          {/* Right section */}
          <div className="ml-auto flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-bold text-onAccent">
              {getInitials(email, uid)}
            </div>
            <button
              type="button"
              onClick={async () => {
                await fetch('/api/auth/session', { method: 'DELETE' });
                router.push('/');
                router.refresh();
              }}
              className="rounded-lg p-1.5 text-mute transition hover:bg-danger/10 hover:text-danger"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>

      <CommandPalette />
    </div>
  );
}
