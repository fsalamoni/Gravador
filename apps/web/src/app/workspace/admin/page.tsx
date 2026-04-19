import { AdminDashboard } from '@/components/admin-dashboard';
import { getSessionUser } from '@/lib/firebase-server';
import { redirect } from 'next/navigation';

const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? '').split(',').filter(Boolean);

export default async function AdminPage() {
  const session = await getSessionUser();
  if (!session) redirect('/login');
  if (!session.email || !ADMIN_EMAILS.includes(session.email)) redirect('/workspace/recordings');

  return <AdminDashboard />;
}
