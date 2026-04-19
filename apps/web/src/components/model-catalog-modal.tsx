'use client';

import { Check, ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import {
  type ModelSpec,
  avgRating,
  formatCost,
  formatTokens,
  getModelsForProvider,
} from '@/lib/model-registry';

type SortKey = 'name' | 'extraction' | 'synthesis' | 'reasoning' | 'writing' | 'avg' | 'context' | 'input' | 'output';
type SortDir = 'asc' | 'desc';

interface Props {
  provider: string;
  providerLabel: string;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onClose: () => void;
}

export function ModelCatalogModal({ provider, providerLabel, selectedIds, onToggle, onClose }: Props) {
  const allModels = useMemo(() => getModelsForProvider(provider), [provider]);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('avg');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const toggleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      else { setSortKey(key); setSortDir(key === 'name' ? 'asc' : 'desc'); }
    },
    [sortKey],
  );

  const filtered = useMemo(() => {
    let list = allModels;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (m) => m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q) || m.description.toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      switch (sortKey) {
        case 'name': return dir * a.name.localeCompare(b.name);
        case 'extraction': return dir * (a.ratings.extraction - b.ratings.extraction);
        case 'synthesis': return dir * (a.ratings.synthesis - b.ratings.synthesis);
        case 'reasoning': return dir * (a.ratings.reasoning - b.ratings.reasoning);
        case 'writing': return dir * (a.ratings.writing - b.ratings.writing);
        case 'avg': return dir * (avgRating(a) - avgRating(b));
        case 'context': return dir * (a.contextTokens - b.contextTokens);
        case 'input': return dir * (a.pricing.input - b.pricing.input);
        case 'output': return dir * (a.pricing.output - b.pricing.output);
        default: return 0;
      }
    });
  }, [allModels, search, sortKey, sortDir]);

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ChevronDown className="ml-0.5 inline h-3 w-3 opacity-30" />;
    return sortDir === 'asc'
      ? <ChevronUp className="ml-0.5 inline h-3 w-3 text-accent" />
      : <ChevronDown className="ml-0.5 inline h-3 w-3 text-accent" />;
  };

  const thCls = 'cursor-pointer select-none whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-mute hover:text-text transition';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative mx-4 flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-border bg-bg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-text">Catálogo de Modelos — {providerLabel}</h2>
            <p className="mt-1 text-sm text-mute">
              Selecione os modelos que farão parte do seu catálogo pessoal.
              <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">
                {selectedIds.size} selecionados
              </span>
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-mute hover:bg-surfaceAlt hover:text-text transition" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        <div className="border-b border-border px-6 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mute" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar modelos…"
              className="w-full rounded-[16px] border border-border bg-surfaceAlt/50 py-2 pl-9 pr-4 text-sm text-text placeholder:text-mute/50 focus:border-accent focus:outline-none"
            />
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-bg/95 backdrop-blur-sm">
              <tr className="border-b border-border">
                <th className="w-10 px-3 py-2.5" />
                <th className={thCls} onClick={() => toggleSort('name')}>Modelo <SortIcon col="name" /></th>
                <th className={`${thCls} hidden sm:table-cell`} onClick={() => toggleSort('avg')}>Média <SortIcon col="avg" /></th>
                <th className={`${thCls} hidden md:table-cell`} onClick={() => toggleSort('extraction')}>Extração <SortIcon col="extraction" /></th>
                <th className={`${thCls} hidden md:table-cell`} onClick={() => toggleSort('synthesis')}>Síntese <SortIcon col="synthesis" /></th>
                <th className={`${thCls} hidden lg:table-cell`} onClick={() => toggleSort('reasoning')}>Raciocínio <SortIcon col="reasoning" /></th>
                <th className={`${thCls} hidden lg:table-cell`} onClick={() => toggleSort('writing')}>Redação <SortIcon col="writing" /></th>
                <th className={thCls} onClick={() => toggleSort('context')}>Contexto <SortIcon col="context" /></th>
                <th className={thCls} onClick={() => toggleSort('input')}>$/M in <SortIcon col="input" /></th>
                <th className={`${thCls} hidden sm:table-cell`} onClick={() => toggleSort('output')}>$/M out <SortIcon col="output" /></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => {
                const selected = selectedIds.has(m.id);
                return (
                  <tr
                    key={m.id}
                    onClick={() => onToggle(m.id)}
                    className={`cursor-pointer border-b border-border/50 transition ${
                      selected ? 'bg-accent/8 hover:bg-accent/12' : 'hover:bg-surfaceAlt/50'
                    }`}
                  >
                    <td className="px-3 py-2.5 text-center">
                      <div className={`flex h-5 w-5 items-center justify-center rounded-md border transition ${
                        selected ? 'border-accent bg-accent' : 'border-border'
                      }`}>
                        {selected && <Check className="h-3 w-3 text-onAccent" />}
                      </div>
                    </td>
                    <td className="max-w-[200px] px-3 py-2.5">
                      <div className="font-medium text-text">{m.name}</div>
                      <div className="mt-0.5 truncate text-xs text-mute">{m.description}</div>
                    </td>
                    <td className="hidden px-3 py-2.5 sm:table-cell">
                      <RatingBadge value={avgRating(m)} />
                    </td>
                    <td className="hidden px-3 py-2.5 md:table-cell"><RatingBadge value={m.ratings.extraction} /></td>
                    <td className="hidden px-3 py-2.5 md:table-cell"><RatingBadge value={m.ratings.synthesis} /></td>
                    <td className="hidden px-3 py-2.5 lg:table-cell"><RatingBadge value={m.ratings.reasoning} /></td>
                    <td className="hidden px-3 py-2.5 lg:table-cell"><RatingBadge value={m.ratings.writing} /></td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-mute">{formatTokens(m.contextTokens)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-mute">{formatCost(m.pricing.input)}</td>
                    <td className="hidden whitespace-nowrap px-3 py-2.5 font-mono text-xs text-mute sm:table-cell">{formatCost(m.pricing.output)}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-mute">Nenhum modelo encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <p className="text-sm text-mute">{filtered.length} modelos • {selectedIds.size} no catálogo pessoal</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[18px] bg-accent px-6 py-2.5 text-sm font-semibold text-onAccent transition hover:bg-accentSoft"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

function RatingBadge({ value }: { value: number }) {
  let color = 'text-mute border-border';
  if (value >= 90) color = 'text-ok border-ok/30 bg-ok/8';
  else if (value >= 80) color = 'text-accent border-accent/30 bg-accent/8';
  else if (value >= 70) color = 'text-text border-border';

  return (
    <span className={`inline-flex min-w-[36px] items-center justify-center rounded-md border px-1.5 py-0.5 text-xs font-bold ${color}`}>
      {value}
    </span>
  );
}
