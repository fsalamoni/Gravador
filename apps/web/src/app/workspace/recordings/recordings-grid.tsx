'use client';

import { formatDurationMs } from '@gravador/core';
import {
  ArrowDownAZ,
  ArrowUpDown,
  ArrowUpRight,
  Calendar,
  CheckSquare,
  Clock3,
  RefreshCw,
  Square,
  Tag,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';

export interface SerializedRecording {
  id: string;
  title: string | null;
  durationMs: number;
  status: string;
  capturedAt: string;
  tags: string[];
}

type SortField = 'date' | 'title' | 'duration' | 'status';
type SortDir = 'asc' | 'desc';

const WAVEFORM_BARS = [16, 24, 42, 64, 58, 36, 44, 62, 30, 18, 34, 26];

export function RecordingsGrid({ recordings }: { recordings: SerializedRecording[] }) {
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [tagging, setTagging] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);

  // Collect all unique tags
  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const r of recordings) for (const t of r.tags) set.add(t);
    return [...set].sort();
  }, [recordings]);

  // Filter + sort
  const sorted = useMemo(() => {
    const list = filterTag ? recordings.filter((r) => r.tags.includes(filterTag)) : [...recordings];
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'date':
          cmp = new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime();
          break;
        case 'title':
          cmp = (a.title ?? '').localeCompare(b.title ?? '');
          break;
        case 'duration':
          cmp = a.durationMs - b.durationMs;
          break;
        case 'status':
          cmp = a.status.localeCompare(b.status);
          break;
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return list;
  }, [recordings, sortField, sortDir, filterTag]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === sorted.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(sorted.map((r) => r.id)));
  };

  const bulkAddTag = useCallback(async () => {
    const tag = tagInput.trim().toLowerCase();
    if (!tag || selectedIds.size === 0) return;
    setTagging(true);
    try {
      await fetch('/api/recordings/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordingIds: [...selectedIds], tags: [tag] }),
      });
      window.location.reload();
    } catch {
      alert('Erro ao adicionar tag');
    } finally {
      setTagging(false);
    }
  }, [tagInput, selectedIds]);

  const bulkReprocess = useCallback(async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Reprocessar ${selectedIds.size} gravação(ões)?`)) return;
    setReprocessing(true);
    try {
      await fetch('/api/recordings/reprocess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordingIds: [...selectedIds] }),
      });
      alert('Reprocessamento enfileirado!');
    } catch {
      alert('Erro ao reprocessar');
    } finally {
      setReprocessing(false);
    }
  }, [selectedIds]);

  return (
    <>
      {/* Controls bar */}
      <section className="card flex flex-wrap items-center gap-3 px-5 py-4">
        {/* Sort buttons */}
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-mute">Ordenar:</span>
        {(
          [
            ['date', 'Data', Calendar],
            ['title', 'Título', ArrowDownAZ],
            ['duration', 'Duração', Clock3],
            ['status', 'Status', ArrowUpDown],
          ] as const
        ).map(([field, label, Icon]) => (
          <button
            key={field}
            type="button"
            onClick={() => toggleSort(field)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition ${
              sortField === field
                ? 'border-accent/50 bg-accent/10 text-accent'
                : 'border-border text-mute hover:text-text'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
            {sortField === field && <span>{sortDir === 'asc' ? '↑' : '↓'}</span>}
          </button>
        ))}

        {/* Tag filter */}
        {allTags.length > 0 && (
          <>
            <span className="ml-2 text-xs font-medium uppercase tracking-[0.2em] text-mute">
              Tag:
            </span>
            {allTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setFilterTag(filterTag === tag ? null : tag)}
                className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs transition ${
                  filterTag === tag
                    ? 'border-accent/50 bg-accent/10 text-accent'
                    : 'border-border text-mute hover:text-text'
                }`}
              >
                <Tag className="h-3 w-3" />
                {tag}
                {filterTag === tag && <X className="ml-1 h-3 w-3" />}
              </button>
            ))}
          </>
        )}
      </section>

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <section className="card flex flex-wrap items-center gap-3 border-accent/40 px-5 py-4">
          <span className="text-sm font-medium text-accent">{selectedIds.size} selecionada(s)</span>
          <div className="flex items-center gap-2">
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="Nova tag…"
              className="rounded-full border border-border bg-bg/70 px-3 py-1.5 text-xs text-text outline-none placeholder:text-mute/50 focus:border-accent/50"
              onKeyDown={(e) => e.key === 'Enter' && bulkAddTag()}
            />
            <button
              type="button"
              onClick={bulkAddTag}
              disabled={tagging || !tagInput.trim()}
              className="rounded-full bg-accent/15 px-3 py-1.5 text-xs font-medium text-accent transition hover:bg-accent/25 disabled:opacity-50"
            >
              <Tag className="mr-1 inline h-3 w-3" />
              {tagging ? '…' : 'Adicionar tag'}
            </button>
          </div>
          <button
            type="button"
            onClick={bulkReprocess}
            disabled={reprocessing}
            className="rounded-full bg-accent/15 px-3 py-1.5 text-xs font-medium text-accent transition hover:bg-accent/25 disabled:opacity-50"
          >
            <RefreshCw className={`mr-1 inline h-3 w-3 ${reprocessing ? 'animate-spin' : ''}`} />
            {reprocessing ? 'Enfileirando…' : 'Reprocessar IA'}
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="rounded-full border border-border px-3 py-1.5 text-xs text-mute hover:text-text"
          >
            Limpar seleção
          </button>
        </section>
      )}

      {/* Grid */}
      <section>
        {sorted.length > 0 && (
          <div className="mb-3 flex items-center gap-2 px-1">
            <button type="button" onClick={toggleAll} className="text-mute hover:text-text">
              {selectedIds.size === sorted.length ? (
                <CheckSquare className="h-4 w-4 text-accent" />
              ) : (
                <Square className="h-4 w-4" />
              )}
            </button>
            <span className="text-xs text-mute">
              {sorted.length} gravação(ões){filterTag ? ` com tag "${filterTag}"` : ''}
            </span>
          </div>
        )}
        <div className="grid gap-4 xl:grid-cols-2">
          {sorted.map((recording) => {
            const isSelected = selectedIds.has(recording.id);
            return (
              <div
                key={recording.id}
                className={`card group relative p-6 transition ${
                  isSelected ? 'border-accent/70 ring-1 ring-accent/30' : 'hover:border-accent/70'
                }`}
              >
                {/* Checkbox */}
                <button
                  type="button"
                  onClick={() => toggleSelect(recording.id)}
                  className="absolute left-3 top-3 z-10 text-mute hover:text-accent"
                >
                  {isSelected ? (
                    <CheckSquare className="h-4 w-4 text-accent" />
                  ) : (
                    <Square className="h-4 w-4 opacity-0 transition group-hover:opacity-100" />
                  )}
                </button>

                <Link href={`/workspace/recordings/${recording.id}`} className="block">
                  <div className="flex items-center justify-between gap-4">
                    <span className="rounded-full border border-border px-3 py-1 text-xs uppercase tracking-[0.2em] text-mute">
                      {recording.status}
                    </span>
                    <ArrowUpRight className="h-4 w-4 text-mute transition group-hover:text-accent" />
                  </div>
                  <h2 className="mt-5 text-2xl font-semibold text-text">
                    {recording.title ?? new Date(recording.capturedAt).toLocaleString()}
                  </h2>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-mute">
                    <span className="rounded-full border border-border px-3 py-1">
                      {formatDurationMs(recording.durationMs)}
                    </span>
                    <span className="rounded-full border border-border px-3 py-1">
                      {new Date(recording.capturedAt).toLocaleString()}
                    </span>
                    {recording.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-accent"
                      >
                        <Tag className="mr-1 inline h-3 w-3" />
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="mt-6 flex h-20 items-end gap-1.5">
                    {WAVEFORM_BARS.map((height, i) => (
                      <span
                        key={`${recording.id}-bar-${i}`}
                        className="flex-1 rounded-full bg-accent/70"
                        style={{ height }}
                      />
                    ))}
                  </div>
                </Link>
              </div>
            );
          })}

          {sorted.length === 0 ? (
            <div className="card px-6 py-12 text-center text-mute xl:col-span-2">
              {filterTag ? `Nenhuma gravação com a tag "${filterTag}".` : 'Nenhuma gravação ainda.'}
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}
