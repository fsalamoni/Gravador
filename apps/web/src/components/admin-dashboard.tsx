'use client';

import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bot,
  CheckCircle,
  Clock,
  Loader2,
  Mic,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';

interface Stats {
  workspace: { id: string };
  recordings: {
    total: number;
    ready: number;
    failed: number;
    processing: number;
    totalDurationMs: number;
    last7Days: Record<string, number>;
  };
  aiPipelines: {
    totalOutputs: number;
    avgLatencyMs: number;
    byKind: Record<string, number>;
  };
  members: { count: number };
}

const PIPELINE_LABELS: Record<string, string> = {
  summary: 'Resumo',
  action_items: 'Itens de Ação',
  mindmap: 'Mapa Mental',
  chapters: 'Capítulos',
  quotes: 'Citações',
  sentiment: 'Sentimento',
  flashcards: 'Flashcards',
};

export function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/stats')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => setStats(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="card p-6 text-center text-danger">
        <AlertTriangle className="mx-auto h-8 w-8" />
        <p className="mt-3">Erro ao carregar estatísticas: {error}</p>
      </div>
    );
  }

  const r = stats.recordings;
  const ai = stats.aiPipelines;
  const totalHours = Math.round(r.totalDurationMs / 3_600_000 * 10) / 10;

  // Build last 7 days chart data
  const today = new Date();
  const dayLabels: string[] = [];
  const dayValues: number[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    dayLabels.push(d.toLocaleDateString('pt-BR', { weekday: 'short' }));
    dayValues.push(r.last7Days[key] ?? 0);
  }
  const maxDay = Math.max(...dayValues, 1);

  return (
    <div className="space-y-5">
      {/* Header */}
      <section className="card px-6 py-7 sm:px-7">
        <span className="eyebrow">Administração</span>
        <h1 className="display-title mt-5 text-5xl leading-[0.96]">Dashboard</h1>
        <p className="mt-4 max-w-3xl leading-8 text-mute">
          Visão geral do workspace, gravações e pipelines de IA.
        </p>
      </section>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={Mic} label="Total de Gravações" value={r.total} accent />
        <KpiCard icon={CheckCircle} label="Processadas" value={r.ready} />
        <KpiCard icon={AlertTriangle} label="Com Falha" value={r.failed} danger={r.failed > 0} />
        <KpiCard icon={Users} label="Membros" value={stats.members.count} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Duration & Processing */}
        <div className="card p-6">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-accent" />
            <h2 className="text-lg font-semibold text-text">Áudio Total</h2>
          </div>
          <div className="mt-4 text-4xl font-bold text-text">{totalHours}h</div>
          <p className="mt-1 text-sm text-mute">{r.processing} gravações em processamento</p>
        </div>

        {/* AI Pipeline stats */}
        <div className="card p-6">
          <div className="flex items-center gap-3">
            <Bot className="h-5 w-5 text-accent" />
            <h2 className="text-lg font-semibold text-text">Pipelines de IA</h2>
          </div>
          <div className="mt-4 text-4xl font-bold text-text">{ai.totalOutputs}</div>
          <p className="mt-1 text-sm text-mute">
            outputs gerados • Latência média: {ai.avgLatencyMs > 1000 ? `${(ai.avgLatencyMs / 1000).toFixed(1)}s` : `${ai.avgLatencyMs}ms`}
          </p>
        </div>
      </div>

      {/* Last 7 days chart */}
      <div className="card p-6">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-5 w-5 text-accent" />
          <h2 className="text-lg font-semibold text-text">Gravações — Últimos 7 Dias</h2>
        </div>
        <div className="mt-6 flex items-end gap-2" style={{ height: 120 }}>
          {dayValues.map((v, i) => (
            <div key={dayLabels[i]} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-xs font-medium text-accent">{v || ''}</span>
              <div
                className="w-full rounded-t-lg bg-accent/30 transition-all"
                style={{ height: `${Math.max((v / maxDay) * 100, 4)}%` }}
              >
                <div
                  className="h-full w-full rounded-t-lg bg-accent transition-all"
                  style={{ height: `${v > 0 ? 100 : 0}%` }}
                />
              </div>
              <span className="text-[10px] text-mute">{dayLabels[i]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Pipeline breakdown */}
      <div className="card p-6">
        <div className="flex items-center gap-3">
          <Activity className="h-5 w-5 text-accent" />
          <h2 className="text-lg font-semibold text-text">Outputs por Pipeline</h2>
        </div>
        <div className="mt-4 space-y-3">
          {Object.entries(ai.byKind)
            .sort(([, a], [, b]) => b - a)
            .map(([kind, count]) => {
              const maxCount = Math.max(...Object.values(ai.byKind), 1);
              return (
                <div key={kind} className="flex items-center gap-3">
                  <div className="w-28 text-sm font-medium text-text">
                    {PIPELINE_LABELS[kind] ?? kind}
                  </div>
                  <div className="flex-1">
                    <div className="h-6 overflow-hidden rounded-full bg-surfaceAlt">
                      <div
                        className="h-full rounded-full bg-accent/60 transition-all"
                        style={{ width: `${(count / maxCount) * 100}%` }}
                      />
                    </div>
                  </div>
                  <span className="w-10 text-right text-sm font-semibold text-text">{count}</span>
                </div>
              );
            })}
          {Object.keys(ai.byKind).length === 0 && (
            <p className="text-sm text-mute">Nenhum pipeline executado ainda.</p>
          )}
        </div>
      </div>

      {/* Security info */}
      <div className="card p-6">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-ok" />
          <h2 className="text-lg font-semibold text-text">Segurança</h2>
        </div>
        <ul className="mt-4 space-y-2 text-sm text-mute">
          <li className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-ok" /> Rate limiting: 120 req/min (15 para IA)
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-ok" /> CSP + CSRF protection ativo
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-ok" /> Chaves API cifradas em repouso
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-ok" /> Autenticação exclusiva via Google OAuth
          </li>
        </ul>
      </div>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  accent,
  danger,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  accent?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
          danger ? 'bg-danger/15 text-danger' : accent ? 'bg-accent/15 text-accent' : 'bg-surfaceAlt text-mute'
        }`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-mute">{label}</div>
          <div className={`mt-1 text-2xl font-bold ${danger ? 'text-danger' : 'text-text'}`}>{value}</div>
        </div>
      </div>
    </div>
  );
}
