import { createSupabaseServer } from '@/lib/supabase-server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 border-r border-border bg-surface p-6 flex flex-col gap-2">
        <Link href="/workspace" className="text-lg font-semibold tracking-tight mb-6">
          Gravador
        </Link>
        <NavItem href="/workspace">Início</NavItem>
        <NavItem href="/workspace/recordings">Gravações</NavItem>
        <NavItem href="/workspace/search">Buscar</NavItem>
        <NavItem href="/workspace/integrations">Integrações</NavItem>
        <NavItem href="/workspace/settings">Configurações</NavItem>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}

function NavItem({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-3 py-2 rounded-lg text-mute hover:bg-surfaceAlt hover:text-text transition"
    >
      {children}
    </Link>
  );
}
