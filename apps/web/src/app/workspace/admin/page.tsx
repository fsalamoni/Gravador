import { AdminDashboard } from '@/components/admin-dashboard';
import { getSessionUser } from '@/lib/firebase-server';
import { redirect } from 'next/navigation';

export default async function AdminPage() {
  const session = await getSessionUser();
  if (!session) redirect('/login');

  return <AdminDashboard />;
}
