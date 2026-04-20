'use client';

import { useRouter } from 'next/navigation';
import { WebRecorder } from './web-recorder';

export function RecordingsPageClient() {
  const router = useRouter();
  return <WebRecorder onRecorded={() => router.refresh()} />;
}
