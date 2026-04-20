import { WorkspaceShell } from '@/components/workspace-shell';
import { getSessionUser } from '@/lib/firebase-server';
import { redirect } from 'next/navigation';

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  return (
    <WorkspaceShell email={user.email ?? null} uid={user.uid}>
      {children}
    </WorkspaceShell>
  );
}
