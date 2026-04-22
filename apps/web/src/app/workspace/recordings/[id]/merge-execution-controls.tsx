'use client';

import { GitMerge } from 'lucide-react';
import { useCallback, useState } from 'react';

interface MergeExecutionControlsProps {
  primaryRecordingId: string;
  secondaryRecordingId: string;
}

export function MergeExecutionControls({
  primaryRecordingId,
  secondaryRecordingId,
}: MergeExecutionControlsProps) {
  const [executing, setExecuting] = useState(false);

  const executeMerge = useCallback(async () => {
    if (executing) return;

    const shouldExecute = window.confirm(
      'Executar merge side-by-side agora? O merge nao sobrescreve artefatos existentes e copia somente artefatos ausentes.',
    );
    if (!shouldExecute) return;

    setExecuting(true);
    try {
      const response = await fetch('/api/recordings/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schemaVersion: 1,
          operation: 'merge',
          mode: 'execute',
          primaryRecordingId,
          secondaryRecordingId,
          preserveArtifacts: 'side_by_side',
        }),
      });

      if (!response.ok) {
        let errorCode = 'unknown_error';
        try {
          const data = (await response.json()) as { error?: string };
          errorCode = data.error ?? errorCode;
        } catch {
          // keep default error code
        }
        alert(`Erro ao executar merge (${errorCode})`);
        return;
      }

      const data = (await response.json()) as {
        redirectUrl?: string;
        copied?: number;
      };

      const copied = typeof data.copied === 'number' ? data.copied : 0;
      alert(`Merge executado com sucesso. Artefatos copiados: ${copied}.`);

      const fallbackUrl = `/workspace/recordings/${primaryRecordingId}`;
      window.location.href = data.redirectUrl ?? fallbackUrl;
    } catch {
      alert('Erro ao executar merge');
    } finally {
      setExecuting(false);
    }
  }, [executing, primaryRecordingId, secondaryRecordingId]);

  return (
    <button
      type="button"
      onClick={executeMerge}
      disabled={executing}
      className="inline-flex items-center gap-2 rounded-full border border-accent/45 bg-accent/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent transition hover:border-accent/65 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <GitMerge className="h-4 w-4" />
      {executing ? 'Executando merge...' : 'Executar merge side-by-side'}
    </button>
  );
}
