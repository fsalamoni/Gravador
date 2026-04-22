'use client';

import { featureFlags } from '@/lib/feature-flags';
import { formatDurationMs } from '@gravador/core';
import {
  AudioWaveform,
  Bot,
  Download,
  Home,
  LayoutDashboard,
  Loader2,
  Search,
  Settings,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface RecordingHit {
  id: string;
  title?: string;
  status: string;
  capturedAt: string;
  durationMs: number;
}

interface CommandItem {
  id: string;
  group: string;
  label: string;
  sublabel?: string;
  icon: React.ElementType;
  action: () => void;
}

const STATIC_COMMANDS: Omit<CommandItem, 'action'>[] = [
  { id: 'nav-home', group: 'Navegação', label: 'Visão Geral', icon: Home },
  {
    id: 'nav-recordings',
    group: 'Navegação',
    label: 'Gravações',
    sublabel: 'Biblioteca de gravações',
    icon: AudioWaveform,
  },
  {
    id: 'nav-search',
    group: 'Navegação',
    label: 'Busca Semântica',
    sublabel: 'Buscar no acervo',
    icon: Search,
  },
  { id: 'nav-integrations', group: 'Navegação', label: 'Integrações', icon: Sparkles },
  {
    id: 'nav-settings',
    group: 'Navegação',
    label: 'Configurações',
    sublabel: 'Provedores, modelos, agentes',
    icon: Settings,
  },
  ...(featureFlags.workspaceDownloads
    ? [
        {
          id: 'nav-downloads',
          group: 'Navegação',
          label: 'Downloads',
          sublabel: 'Baixar APK e acompanhar iOS',
          icon: Download,
        } as const,
      ]
    : []),
  { id: 'nav-admin', group: 'Navegação', label: 'Dashboard Admin', icon: LayoutDashboard },
  { id: 'nav-trash', group: 'Navegação', label: 'Lixeira', icon: Trash2 },
  {
    id: 'nav-agents',
    group: 'Configuração',
    label: 'Configurar Agentes',
    sublabel: 'Modelos por pipeline',
    icon: Bot,
  },
];

const ROUTES: Record<string, string> = {
  'nav-home': '/workspace',
  'nav-recordings': '/workspace/recordings',
  'nav-search': '/workspace/search',
  'nav-integrations': '/workspace/integrations',
  'nav-settings': '/workspace/settings',
  'nav-downloads': '/workspace/downloads',
  'nav-admin': '/workspace/admin',
  'nav-trash': '/workspace/recordings/trash',
  'nav-agents': '/workspace/settings',
};

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [recordings, setRecordings] = useState<RecordingHit[]>([]);
  const [loadingRec, setLoadingRec] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Open/close with Cmd+K
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Focus input when opening
  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Fetch recordings when query has 2+ chars
  useEffect(() => {
    if (!open || query.length < 2) {
      setRecordings([]);
      return;
    }
    const controller = new AbortController();
    setLoadingRec(true);
    fetch(`/api/recordings/search?q=${encodeURIComponent(query)}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : { recordings: [] }))
      .then((d) => setRecordings(d.recordings ?? []))
      .catch(() => {})
      .finally(() => setLoadingRec(false));
    return () => controller.abort();
  }, [open, query]);

  const navigate = useCallback(
    (path: string) => {
      setOpen(false);
      router.push(path);
    },
    [router],
  );

  const items = useMemo<CommandItem[]>(() => {
    const q = query.toLowerCase();
    const nav: CommandItem[] = STATIC_COMMANDS.filter(
      (c) =>
        !q ||
        c.label.toLowerCase().includes(q) ||
        c.sublabel?.toLowerCase().includes(q) ||
        c.group.toLowerCase().includes(q),
    ).map((c) => ({ ...c, action: () => navigate(ROUTES[c.id] ?? '/workspace') }));

    const rec: CommandItem[] = recordings.map((r) => ({
      id: `rec-${r.id}`,
      group: 'Gravações',
      label: r.title || new Date(r.capturedAt).toLocaleString(),
      sublabel: `${formatDurationMs(r.durationMs)} • ${r.status}`,
      icon: AudioWaveform,
      action: () => navigate(`/workspace/recordings/${r.id}`),
    }));

    return [...nav, ...rec];
  }, [query, recordings, navigate]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive((a) => Math.min(a + 1, items.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((a) => Math.max(a - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        items[active]?.action();
      }
    },
    [items, active],
  );

  // Keep active item in view
  useEffect(() => {
    const el = listRef.current?.children[active] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;

  // Group items
  const groups = new Map<string, CommandItem[]>();
  for (const item of items) {
    if (!groups.has(item.group)) groups.set(item.group, []);
    groups.get(item.group)!.push(item);
  }

  let flatIdx = 0;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/60 pt-[15vh] backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-[24px] border border-border bg-bg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <Search className="h-5 w-5 shrink-0 text-mute" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Buscar páginas, gravações, comandos…"
            className="flex-1 bg-transparent text-text outline-none placeholder:text-mute/50"
          />
          {loadingRec && <Loader2 className="h-4 w-4 animate-spin text-mute" />}
          <kbd className="hidden rounded-md border border-border bg-surfaceAlt px-2 py-0.5 text-[10px] font-medium text-mute sm:inline">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-2">
          {items.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-mute">
              {query ? 'Nenhum resultado encontrado.' : 'Comece a digitar para buscar…'}
            </div>
          )}
          {[...groups.entries()].map(([group, groupItems]) => (
            <div key={group}>
              <div className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-mute">
                {group}
              </div>
              {groupItems.map((item) => {
                const idx = flatIdx++;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={item.action}
                    onMouseEnter={() => setActive(idx)}
                    className={`flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left text-sm transition ${
                      idx === active ? 'bg-accent/12 text-text' : 'text-mute hover:text-text'
                    }`}
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${idx === active ? 'text-accent' : ''}`} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{item.label}</div>
                      {item.sublabel && (
                        <div className="truncate text-xs text-mute">{item.sublabel}</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-5 py-2.5 text-[10px] text-mute">
          <span>↑↓ navegar • Enter selecionar • Esc fechar</span>
          <span>⌘K para abrir</span>
        </div>
      </div>
    </div>
  );
}
