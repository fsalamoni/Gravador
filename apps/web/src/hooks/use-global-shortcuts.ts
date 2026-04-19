'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Global keyboard shortcuts:
 * - Cmd/Ctrl+K → /workspace/search
 * - Escape → close (fires custom event)
 */
export function useGlobalShortcuts() {
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Cmd/Ctrl + K → search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        router.push('/workspace/search');
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router]);
}
