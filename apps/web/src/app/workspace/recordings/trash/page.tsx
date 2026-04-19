import { TrashList } from '@/components/trash-list';
import { getSessionUser } from '@/lib/firebase-server';
import { redirect } from 'next/navigation';

export default async function TrashPage() {
  const session = await getSessionUser();
  if (!session) redirect('/login');

  return <TrashList />;
}
