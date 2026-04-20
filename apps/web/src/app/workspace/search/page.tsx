'use client';

import { formatDurationMs } from '@gravador/core';
import { Filter, Search as SearchIcon, Sparkles, X } from 'lucide-react';
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

type StatusFilter = 'all' | 'completed' | 'processing' | 'pending';

export default function SearchPage() {
  const [q, setQ] = useState('');
  const [semantic, setSemantic] = useState<Hit[]>([]);
  const [keyword, setKeyword] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const go = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    setLoading(true);
    setHasSearched(true);
    const res = await fetch('/api/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ q, status: statusFilter !== 'all' ? statusFilter : undefined }),
    });
    const json = await res.json();
    setSemantic(json.semantic ?? []);
    setKeyword(json.keyword ?? []);
    setLoading(false);
  };

  const totalResults = semantic.length + keyword.length;

  return (
    <div className="space-y-5">
      <section className="card px-6 py-7 sm:px-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="eyebrow">Search layer</span>
            <h1 className="display-title mt-5 text-5xl leading-[0.96]">
              Buscar no acervo como quem opera um sistema, não como quem caça linha por linha.
            </h1>
            <p className="mt-4 max-w-3xl leading-8 text-mute">
              Busca semântica e palavras-chave agora entram na mesma linguagem do workspace e servem
              para saltar direto ao trecho útil.
            </p>
          </div>
          <div className="rounded-[24px] border border-border bg-bg/55 px-5 py-4 text-sm text-mute">
            Use linguagem natural para achar contexto, não só texto literal.
          </div>
        </div>

        <form onSubmit={go} className="mt-6 flex flex-col gap-3 sm:flex-row">
          <div className="flex flex-1 items-center gap-3 rounded-[26px] border border-border bg-surfaceAlt/70 px-4 py-4">
            <SearchIcon className="h-5 w-5 text-accent" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Pergunte em linguagem natural…"
              aria-label="Search recordings"
              className="w-full bg-transparent text-text outline-none placeholder:text-mute"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center justify-center gap-2 rounded-[26px] border px-4 py-4 text-sm transition ${
              showFilters || statusFilter !== 'all'
                ? 'border-accent/50 bg-accent/10 text-accent'
                : 'border-border text-mute hover:text-text'
            }`}
          >
            <Filter className="h-4 w-4" />
            Filtros
          </button>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-[26px] bg-accent px-6 py-4 font-semibold text-onAccent transition hover:bg-accentSoft disabled:opacity-60"
            disabled={loading}
          >
            <Sparkles className="h-4 w-4" />
            Buscar
          </button>
        </form>

        {/* Filters panel */}
        {showFilters && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-[20px] border border-border bg-surfaceAlt/40 px-5 py-4">
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-mute">
              Status:
            </span>
            {(['all', 'completed', 'processing', 'pending'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`rounded-full border px-3 py-1.5 text-xs transition ${
                  statusFilter === s
                    ? 'border-accent/50 bg-accent/10 text-accent'
                    : 'border-border text-mute hover:text-text'
                }`}
              >
                {s === 'all' ? 'Todos' : s}
              </button>
            ))}
            {statusFilter !== 'all' && (
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className="ml-1 text-mute hover:text-text"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </section>

      {/* Results count */}
      {hasSearched && !loading && (
        <div className="px-1 text-sm text-mute">
          {totalResults} resultado(s) — {semantic.length} semântico(s), {keyword.length} por
          palavra-chave
        </div>
      )}

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm uppercase tracking-[0.28em] text-mute">Semântica</h2>
            {hasSearched && (
              <span className="text-xs text-mute">{semantic.length} resultado(s)</span>
            )}
          </div>
          <div className="mt-5">
            <ResultList items={semantic} />
          </div>
        </div>
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm uppercase tracking-[0.28em] text-mute">Palavras-chave</h2>
            {hasSearched && (
              <span className="text-xs text-mute">{keyword.length} resultado(s)</span>
            )}
          </div>
          <div className="mt-5">
            <ResultList items={keyword} />
          </div>
        </div>
      </section>
    </div>
  );
}

function ResultList({ items }: { items: Hit[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-[24px] border border-dashed border-border bg-bg/45 px-5 py-10 text-center text-sm text-mute">
        Nenhum resultado.
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((h, i) => (
        <li
          key={`${h.recording_id}-${i}`}
          className="rounded-[24px] border border-border bg-bg/55 p-5"
        >
          <Link
            href={`/workspace/recordings/${h.recording_id}?t=${h.start_ms}`}
            className="block transition hover:text-accentSoft"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-xs text-mute">
                {formatDurationMs(h.start_ms)} – {formatDurationMs(h.end_ms)}
              </span>
              {h.similarity != null && (
                <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
                  {(h.similarity * 100).toFixed(0)}% match
                </span>
              )}
            </div>
            <div className="line-clamp-3 leading-7 text-text">{h.content ?? h.text}</div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
