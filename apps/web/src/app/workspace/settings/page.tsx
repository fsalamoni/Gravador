import { SettingsTabs } from '@/components/settings-tabs';
import { getServerAuth, getSessionUser } from '@/lib/firebase-server';

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

  return <SettingsTabs email={email} uid={uid} />;
}
