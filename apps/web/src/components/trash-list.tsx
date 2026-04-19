'use client';

import { formatDurationMs } from '@gravador/core';
import { ArrowLeft, Loader2, RotateCcw, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface TrashedRecording {
  id: string;
  title: string | null;
  durationMs: number;
  status: string;
  deletedAt: string | null;
  capturedAt: string | null;
}

export function TrashList() {
  const [items, setItems] = useState<TrashedRecording[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/recordings/trash')
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function restore(id: string) {
    setActing(id);
    await fetch('/api/recordings/trash', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recordingId: id }),
    });
    setItems((prev) => prev.filter((i) => i.id !== id));
    setActing(null);
  }

  async function permanentDelete(id: string) {
    if (!confirm('Excluir permanentemente? Esta ação não pode ser desfeita.')) return;
    setActing(id);
    await fetch('/api/recordings/trash', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recordingId: id }),
    });
    setItems((prev) => prev.filter((i) => i.id !== id));
    setActing(null);
  }

  return (
    <div className="space-y-5">
      <section className="card px-6 py-7 sm:px-7">
        <Link
          href="/workspace/recordings"
          className="inline-flex items-center gap-2 text-sm text-mute transition hover:text-text"
        >
          <ArrowLeft className="h-4 w-4" />
          Gravações
        </Link>
        <h1 className="display-title mt-5 text-5xl leading-[0.96]">Lixeira</h1>
        <p className="mt-4 max-w-3xl leading-8 text-mute">
          Gravações removidas ficam aqui. Restaure ou exclua permanentemente.
        </p>
      </section>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-accent" />
        </div>
      ) : items.length === 0 ? (
        <div className="card p-10 text-center text-mute">
          <Trash2 className="mx-auto h-10 w-10 opacity-30" />
          <p className="mt-4 text-lg">A lixeira está vazia.</p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {items.map((item) => (
            <div key={item.id} className="card p-6">
              <div className="flex items-center justify-between gap-4">
                <span className="rounded-full border border-border px-3 py-1 text-xs uppercase tracking-[0.2em] text-danger">
                  Excluída
                </span>
                <span className="text-xs text-mute">
                  {item.deletedAt ? new Date(item.deletedAt).toLocaleDateString('pt-BR') : ''}
                </span>
              </div>
              <h2 className="mt-4 text-xl font-semibold text-text">
                {item.title ??
                  (item.capturedAt ? new Date(item.capturedAt).toLocaleString() : item.id)}
              </h2>
              <div className="mt-3 flex gap-2 text-xs text-mute">
                <span className="rounded-full border border-border px-3 py-1">
                  {formatDurationMs(item.durationMs)}
                </span>
                {item.capturedAt && (
                  <span className="rounded-full border border-border px-3 py-1">
                    {new Date(item.capturedAt).toLocaleDateString('pt-BR')}
                  </span>
                )}
              </div>
              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={() => restore(item.id)}
                  disabled={acting === item.id}
                  className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-onAccent transition hover:opacity-90 disabled:opacity-50"
                >
                  {acting === item.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4" />
                  )}
                  Restaurar
                </button>
                <button
                  type="button"
                  onClick={() => permanentDelete(item.id)}
                  disabled={acting === item.id}
                  className="inline-flex items-center gap-2 rounded-full border border-danger/30 px-4 py-2 text-sm font-semibold text-danger transition hover:bg-danger/10 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
