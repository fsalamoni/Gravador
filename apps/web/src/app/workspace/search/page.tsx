'use client';

import { formatDurationMs } from '@gravador/core';
import Link from 'next/link';
import { useState } from 'react';

interface Hit {
  recording_id: string;
  content?: string;
  text?: string;
  start_ms: number;
  end_ms: number;
  similarity?: number;
  rank?: number;
}

export default function SearchPage() {
  const [q, setQ] = useState('');
  const [semantic, setSemantic] = useState<Hit[]>([]);
  const [keyword, setKeyword] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);

  const go = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    setLoading(true);
    const res = await fetch('/api/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ q }),
    });
    const json = await res.json();
    setSemantic(json.semantic ?? []);
    setKeyword(json.keyword ?? []);
    setLoading(false);
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-semibold mb-6">Buscar</h1>
      <form onSubmit={go} className="flex gap-2 mb-8">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Pergunte em linguagem natural…"
          className="flex-1 bg-surfaceAlt border border-border rounded-lg px-4 py-3 outline-none focus:border-accent"
        />
        <button type="submit" className="bg-accent text-white px-5 rounded-lg" disabled={loading}>
          Buscar
        </button>
      </form>

      <section className="mb-10">
        <h2 className="text-mute text-sm uppercase tracking-widest mb-3">Semântica</h2>
        <ResultList items={semantic} />
      </section>
      <section>
        <h2 className="text-mute text-sm uppercase tracking-widest mb-3">Palavras-chave</h2>
        <ResultList items={keyword} />
      </section>
    </div>
  );
}

function ResultList({ items }: { items: Hit[] }) {
  if (items.length === 0) return <p className="text-mute text-sm">Nenhum resultado.</p>;
  return (
    <ul className="space-y-3">
      {items.map((h, i) => (
        <li key={`${h.recording_id}-${i}`} className="card p-4">
          <Link
            href={`/workspace/recordings/${h.recording_id}?t=${h.start_ms}`}
            className="block hover:text-accentSoft"
          >
            <div className="text-xs text-mute mb-1 font-mono">
              {formatDurationMs(h.start_ms)} – {formatDurationMs(h.end_ms)}
            </div>
            <div className="line-clamp-3">{h.content ?? h.text}</div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
