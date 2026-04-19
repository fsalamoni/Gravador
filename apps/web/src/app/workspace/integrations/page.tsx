'use client';

import {
  Check,
  Cloud,
  Copy,
  Download,
  ExternalLink,
  Link2,
  Loader2,
  Sparkles,
  Webhook,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

/* ── Types ─────────────────────────────────────────────────── */

interface Recording {
  id: string;
  title: string;
  capturedAt: string;
  status: string;
}

interface ConnectorItem {
  name: string;
  slug: string;
  description: string;
  action: 'export-json' | 'export-md' | 'copy-webhook' | 'open-link';
  actionLabel: string;
  linkTemplate?: string;
}

const CONNECTORS: ConnectorItem[] = [
  {
    name: 'Notion',
    slug: 'notion',
    description:
      'Exporte seus resumos, itens de ação e transcrições como Markdown para colar no Notion.',
    action: 'export-md',
    actionLabel: 'Exportar Markdown',
  },
  {
    name: 'Obsidian',
    slug: 'obsidian',
    description: 'Baixe notas .md prontas para arrastar ao seu vault Obsidian, com metadados YAML.',
    action: 'export-md',
    actionLabel: 'Baixar .md',
  },
  {
    name: 'Google Drive',
    slug: 'google-drive',
    description: 'Exporte dados completos em JSON para importar no Google Drive ou Sheets.',
    action: 'export-json',
    actionLabel: 'Exportar JSON',
  },
  {
    name: 'Dropbox',
    slug: 'dropbox',
    description: 'Baixe o pacote JSON completo e faça upload ao Dropbox.',
    action: 'export-json',
    actionLabel: 'Baixar JSON',
  },
  {
    name: 'OneDrive',
    slug: 'onedrive',
    description: 'Exporte relatórios JSON para sincronizar com Microsoft 365.',
    action: 'export-json',
    actionLabel: 'Exportar JSON',
  },
  {
    name: 'Webhook',
    slug: 'webhook',
    description: 'Copie a URL do endpoint de export para integrar com Zapier, Make ou n8n.',
    action: 'copy-webhook',
    actionLabel: 'Copiar URL',
  },
];

/* ── Helper: icon per slug ─────────────────────────────────── */

function ConnectorIcon({ slug }: { slug: string }) {
  switch (slug) {
    case 'notion':
    case 'obsidian':
      return <Sparkles className="h-5 w-5 text-accent" />;
    case 'google-drive':
      return <Cloud className="h-5 w-5 text-ok" />;
    case 'webhook':
      return <Webhook className="h-5 w-5 text-warn" />;
    default:
      return <Link2 className="h-5 w-5 text-accentSoft" />;
  }
}

/* ── Page component ────────────────────────────────────────── */

export default function IntegrationsPage() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecording, setSelectedRecording] = useState<string>('');
  const [exporting, setExporting] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Fetch user's recordings for the export selector
  useEffect(() => {
    fetch('/api/recordings/search?q=&limit=50')
      .then((r) => r.json())
      .then((data) => {
        const recs = (data.results ?? data.recordings ?? []) as Recording[];
        setRecordings(recs);
        if (recs[0]) setSelectedRecording(recs[0].id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  /* ── Export actions ──────────────────────────────────────── */

  const handleExport = useCallback(
    async (connector: ConnectorItem) => {
      if (!selectedRecording) {
        showToast('Selecione uma gravação primeiro.');
        return;
      }

      if (connector.action === 'copy-webhook') {
        const url = `${window.location.origin}/api/export?recordingId=${selectedRecording}&format=json`;
        await navigator.clipboard.writeText(url);
        setCopied(true);
        showToast('URL copiada para a área de transferência!');
        setTimeout(() => setCopied(false), 2000);
        return;
      }

      const format = connector.action === 'export-md' ? 'markdown' : 'json';
      const ext = format === 'markdown' ? 'md' : 'json';

      setExporting(connector.slug);
      try {
        const res = await fetch(`/api/export?recordingId=${selectedRecording}&format=${format}`);
        if (!res.ok) throw new Error(`Export failed: ${res.status}`);

        const blob = await res.blob();
        const rec = recordings.find((r) => r.id === selectedRecording);
        const filename = `${(rec?.title ?? 'gravacao').replace(/[^a-zA-Z0-9À-ÿ ]/g, '_')}.${ext}`;

        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(a.href);

        showToast(`Exportado para ${connector.name}!`);
      } catch {
        showToast('Erro ao exportar. Tente novamente.');
      } finally {
        setExporting(null);
      }
    },
    [selectedRecording, recordings, showToast],
  );

  /* ── Render ──────────────────────────────────────────────── */

  return (
    <div className="space-y-5">
      {/* Toast notification */}
      {toast && (
        <div className="fixed right-6 top-6 z-50 flex items-center gap-2 rounded-[18px] border border-border bg-surface px-5 py-3 text-sm text-text shadow-lg">
          <Check className="h-4 w-4 text-ok" />
          {toast}
          <button type="button" onClick={() => setToast(null)}>
            <X className="h-3.5 w-3.5 text-mute" />
          </button>
        </div>
      )}

      {/* Header */}
      <section className="card px-6 py-7 sm:px-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="eyebrow">Delivery layer</span>
            <h1 className="display-title mt-5 text-5xl leading-[0.96]">Integrações e destinos</h1>
            <p className="mt-4 max-w-3xl leading-8 text-mute">
              Exporte gravações, transcrições e relatórios de IA para seus apps favoritos. Selecione
              uma gravação e escolha o destino.
            </p>
          </div>
          <div className="rounded-[24px] border border-border bg-bg/55 px-5 py-4 text-sm text-mute">
            Conectores para backup, documentação e distribuição operacional.
          </div>
        </div>
      </section>

      {/* Recording selector */}
      <section className="card px-6 py-5 sm:px-7">
        <label htmlFor="rec-select" className="text-xs uppercase tracking-[0.24em] text-mute">
          Gravação para exportar
        </label>
        <select
          id="rec-select"
          value={selectedRecording}
          onChange={(e) => setSelectedRecording(e.target.value)}
          disabled={loading}
          className="mt-2 w-full rounded-[18px] border border-border bg-bg/70 px-4 py-3 text-sm text-text focus:border-accent focus:outline-none"
        >
          {loading && <option>Carregando gravações...</option>}
          {!loading && recordings.length === 0 && <option>Nenhuma gravação encontrada</option>}
          {recordings.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title || r.id} —{' '}
              {r.capturedAt ? new Date(r.capturedAt).toLocaleDateString('pt-BR') : ''}
            </option>
          ))}
        </select>
      </section>

      {/* Connector cards */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {CONNECTORS.map((c) => (
          <div key={c.slug} className="card p-6">
            <div className="flex items-center justify-between gap-4">
              <span className="rounded-full border border-border px-3 py-1 text-xs uppercase tracking-[0.2em] text-mute">
                Connector
              </span>
              <ConnectorIcon slug={c.slug} />
            </div>
            <div className="mt-5 text-2xl font-semibold text-text">{c.name}</div>
            <div className="mt-3 text-sm leading-7 text-mute">{c.description}</div>
            <button
              type="button"
              disabled={exporting === c.slug || !selectedRecording}
              onClick={() => handleExport(c)}
              className="mt-6 flex items-center gap-2 rounded-full border border-border bg-surfaceAlt/70 px-4 py-2 text-sm font-semibold transition hover:bg-accent hover:text-onAccent disabled:opacity-50"
            >
              {exporting === c.slug ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : c.action === 'copy-webhook' ? (
                copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )
              ) : c.action === 'export-md' ? (
                <Download className="h-4 w-4" />
              ) : (
                <ExternalLink className="h-4 w-4" />
              )}
              {c.actionLabel}
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}
