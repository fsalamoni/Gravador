'use client';

import {
  AlertTriangle,
  Bot,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  Loader2,
  Palette,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { type ThemeId, THEMES, useTheme } from './theme-provider';

// ── Types ──

type AIProvider = 'openrouter' | 'openai' | 'anthropic' | 'google' | 'groq' | 'ollama';

interface AgentModelConfig {
  provider?: string;
  model?: string;
}

interface AISettings {
  chatProvider?: string;
  chatModel?: string;
  transcribeProvider?: string;
  embeddingProvider?: string;
  embeddingModel?: string;
  byokKeys?: Record<string, string>;
  agentModels?: Record<string, AgentModelConfig>;
}

interface CatalogModel {
  id: string;
  modelId: string;
  name: string;
  description: string;
  contextLength: number;
  maxCompletionTokens: number;
  pricing: { prompt: number; completion: number; request: number; image: number };
  inputModalities: string[];
  outputModalities: string[];
  supportedParameters: string[];
  qualityScores: { overall?: number; reasoning?: number; coding?: number; instruction?: number } | null;
  expirationDate: string | null;
}

// ── Tabs ──

type Tab = 'account' | 'appearance' | 'providers' | 'agents' | 'security';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'account', label: 'Conta', icon: UserRound },
  { id: 'appearance', label: 'Aparência', icon: Palette },
  { id: 'providers', label: 'Provedores de IA', icon: Sparkles },
  { id: 'agents', label: 'Agentes', icon: Bot },
  { id: 'security', label: 'Segurança', icon: ShieldCheck },
];

const PROVIDERS: { id: AIProvider; label: string; description: string }[] = [
  { id: 'openrouter', label: 'OpenRouter', description: 'Gateway universal — 300+ modelos, uma API key' },
  { id: 'openai', label: 'OpenAI', description: 'GPT-4.1, GPT-4.1-mini, Whisper, embeddings' },
  { id: 'anthropic', label: 'Anthropic', description: 'Claude Sonnet 4.6, Claude Opus 4.7' },
  { id: 'google', label: 'Google', description: 'Gemini 2.5 Pro, Gemini 2.5 Flash' },
  { id: 'groq', label: 'Groq', description: 'Llama 3.1, Whisper v3 — baixa latência' },
  { id: 'ollama', label: 'Ollama', description: 'Modelos locais via servidor self-hosted' },
];

const AGENTS: { key: string; label: string; description: string }[] = [
  { key: 'summarize', label: 'Resumo', description: 'TL;DR, bullet points e resumo longo' },
  { key: 'actionItems', label: 'Itens de Ação', description: 'Tarefas, responsáveis e prazos' },
  { key: 'mindmap', label: 'Mapa Mental', description: 'Hierarquia visual do conteúdo' },
  { key: 'chapters', label: 'Capítulos', description: 'Segmentação temporal do áudio' },
  { key: 'chat', label: 'Chat', description: 'Conversa com a gravação (RAG)' },
  { key: 'embed', label: 'Embeddings', description: 'Indexação vetorial para busca' },
  { key: 'transcribe', label: 'Transcrição', description: 'Conversão de áudio para texto' },
];

// ── Main Component ──

export function SettingsTabs({ email, uid }: { email: string; uid: string }) {
  const [tab, setTab] = useState<Tab>('account');
  const [settings, setSettings] = useState<AISettings>({});
  const [catalog, setCatalog] = useState<CatalogModel[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const { theme: currentTheme, setTheme: applyTheme } = useTheme();
  const [catalogSort, setCatalogSort] = useState<'name' | 'context' | 'price'>('name');

  // Load settings on mount
  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => {
        if (data.aiSettings) setSettings(data.aiSettings);
        // Sync theme from server if stored and different from local
        if (data.theme && THEMES.includes(data.theme as ThemeId)) {
          const stored = localStorage.getItem('gravador-theme');
          if (!stored) applyTheme(data.theme as ThemeId);
        }
      })
      .catch(() => {});
  }, []);

  // Load catalog when switching to providers/agents tab
  useEffect(() => {
    if ((tab === 'providers' || tab === 'agents') && catalog.length === 0 && !catalogLoading) {
      setCatalogLoading(true);
      const provider = settings.chatProvider || 'openrouter';
      fetch(`/api/models?provider=${provider}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.models) setCatalog(data.models);
        })
        .catch(() => {})
        .finally(() => setCatalogLoading(false));
    }
  }, [tab, catalog.length, catalogLoading, settings.chatProvider]);

  const save = useCallback(
    async (newSettings: AISettings) => {
      setSaving(true);
      setSaved(false);
      try {
        const res = await fetch('/api/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ aiSettings: newSettings }),
        });
        if (res.ok) {
          setSettings(newSettings);
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        }
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  const selectedProvider = (settings.chatProvider as AIProvider) || 'openrouter';

  const filteredCatalog = useMemo(() => {
    let list = catalog;
    if (catalogSearch) {
      const q = catalogSearch.toLowerCase();
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.modelId.toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q),
      );
    }
    list = [...list].sort((a, b) => {
      if (catalogSort === 'name') return a.name.localeCompare(b.name);
      if (catalogSort === 'context') return b.contextLength - a.contextLength;
      return a.pricing.prompt - b.pricing.prompt;
    });
    return list;
  }, [catalog, catalogSearch, catalogSort]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <section className="card px-6 py-7 sm:px-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="eyebrow">Conta e preferências</span>
            <h1 className="display-title mt-5 text-5xl leading-[0.96]">Configurações</h1>
            <p className="mt-4 max-w-3xl leading-8 text-mute">
              Configure provedores de IA, escolha modelos para cada agente e gerencie sua conta.
            </p>
          </div>
          {(saving || saved) && (
            <div className="flex items-center gap-2 rounded-full border border-border bg-surfaceAlt/60 px-4 py-2 text-sm">
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-accent" />
                  <span className="text-mute">Salvando…</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 text-ok" />
                  <span className="text-ok">Salvo</span>
                </>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex min-w-fit items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition ${
                isActive
                  ? 'border-accent bg-accent text-onAccent'
                  : 'border-border bg-surfaceAlt/50 text-mute hover:text-text'
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {tab === 'account' && <AccountTab email={email} uid={uid} />}
      {tab === 'appearance' && <AppearanceTab />}
      {tab === 'providers' && (
        <ProvidersTab
          settings={settings}
          selectedProvider={selectedProvider}
          showKey={showKey}
          setShowKey={setShowKey}
          catalog={filteredCatalog}
          catalogLoading={catalogLoading}
          catalogSearch={catalogSearch}
          setCatalogSearch={setCatalogSearch}
          catalogSort={catalogSort}
          setCatalogSort={setCatalogSort}
          totalModels={catalog.length}
          onSave={save}
          onProviderChange={(provider) => {
            const newSettings = { ...settings, chatProvider: provider };
            save(newSettings);
            // Reload catalog for the new provider
            if (provider === 'openrouter') {
              setCatalog([]);
            }
          }}
          onKeyChange={(key) => {
            const newSettings = {
              ...settings,
              byokKeys: { ...settings.byokKeys, [selectedProvider]: key },
            };
            setSettings(newSettings);
          }}
          onKeySave={() => save(settings)}
        />
      )}
      {tab === 'agents' && (
        <AgentsTab
          settings={settings}
          catalog={catalog}
          catalogLoading={catalogLoading}
          onSave={save}
        />
      )}
      {tab === 'security' && <SecurityTab />}
    </div>
  );
}

// ── Account Tab ──

function AccountTab({ email, uid }: { email: string; uid: string }) {
  return (
    <div className="card p-6 sm:p-7">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-accent text-onAccent">
          <UserRound className="h-7 w-7" />
        </div>
        <div>
          <div className="text-xs uppercase tracking-[0.24em] text-mute">Conta</div>
          <div className="mt-2 text-2xl font-semibold text-text">Perfil conectado</div>
        </div>
      </div>
      <div className="mt-6 space-y-4">
        <Field label="E-mail" value={email} />
        <Field label="User ID" value={uid} />
      </div>
    </div>
  );
}

// ── Providers Tab ──

function ProvidersTab({
  settings,
  selectedProvider,
  showKey,
  setShowKey,
  catalog,
  catalogLoading,
  catalogSearch,
  setCatalogSearch,
  catalogSort,
  setCatalogSort,
  totalModels,
  onSave,
  onProviderChange,
  onKeyChange,
  onKeySave,
}: {
  settings: AISettings;
  selectedProvider: AIProvider;
  showKey: boolean;
  setShowKey: (v: boolean) => void;
  catalog: CatalogModel[];
  catalogLoading: boolean;
  catalogSearch: string;
  setCatalogSearch: (v: string) => void;
  catalogSort: 'name' | 'context' | 'price';
  setCatalogSort: (v: 'name' | 'context' | 'price') => void;
  totalModels: number;
  onSave: (s: AISettings) => Promise<void>;
  onProviderChange: (p: AIProvider) => void;
  onKeyChange: (key: string) => void;
  onKeySave: () => void;
}) {
  const currentKey = settings.byokKeys?.[selectedProvider] ?? '';

  return (
    <div className="space-y-4">
      {/* Provider selector */}
      <div className="card p-6">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-accent" />
          <h2 className="text-2xl font-semibold text-text">Provedor de IA</h2>
        </div>
        <p className="mt-3 leading-7 text-mute">
          Selecione o provedor e insira sua API key. Para OpenRouter, uma única chave dá acesso a
          centenas de modelos.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onProviderChange(p.id)}
              className={`rounded-[22px] border p-4 text-left transition ${
                selectedProvider === p.id
                  ? 'border-accent bg-accent/10'
                  : 'border-border bg-bg/55 hover:border-accent/40'
              }`}
            >
              <div className={`font-semibold ${selectedProvider === p.id ? 'text-accent' : 'text-text'}`}>
                {p.label}
              </div>
              <div className="mt-1 text-xs leading-5 text-mute">{p.description}</div>
            </button>
          ))}
        </div>

        {/* API Key input */}
        {selectedProvider !== 'ollama' && (
          <div className="mt-5">
            <label className="text-xs uppercase tracking-[0.24em] text-mute">API Key</label>
            <div className="mt-2 flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={currentKey}
                  onChange={(e) => onKeyChange(e.target.value)}
                  placeholder={`Insira sua ${selectedProvider} API key`}
                  className="w-full rounded-[18px] border border-border bg-bg/70 px-4 py-3 pr-10 font-mono text-sm text-text placeholder:text-mute/50 focus:border-accent focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-mute hover:text-text"
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <button
                type="button"
                onClick={onKeySave}
                className="rounded-[18px] bg-accent px-5 py-3 text-sm font-semibold text-onAccent transition hover:bg-accentSoft"
              >
                Salvar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Model Catalog */}
      {selectedProvider === 'openrouter' && (
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold text-text">Catálogo de Modelos</h2>
              <span className="rounded-full bg-accent/15 px-2.5 py-1 text-xs font-medium text-accent">
                {totalModels} modelos
              </span>
            </div>
          </div>

          {/* Search and sort */}
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mute" />
              <input
                type="text"
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                placeholder="Buscar modelos…"
                className="w-full rounded-[18px] border border-border bg-bg/70 py-2.5 pl-9 pr-4 text-sm text-text placeholder:text-mute/50 focus:border-accent focus:outline-none"
              />
            </div>
            <div className="relative">
              <select
                value={catalogSort}
                onChange={(e) => setCatalogSort(e.target.value as typeof catalogSort)}
                className="appearance-none rounded-[18px] border border-border bg-bg/70 py-2.5 pl-4 pr-9 text-sm text-text focus:border-accent focus:outline-none"
              >
                <option value="name">Nome</option>
                <option value="context">Contexto ↓</option>
                <option value="price">Preço ↑</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mute" />
            </div>
          </div>

          {/* Model list */}
          {catalogLoading ? (
            <div className="mt-6 flex items-center justify-center gap-2 py-8 text-mute">
              <Loader2 className="h-5 w-5 animate-spin" />
              Carregando catálogo…
            </div>
          ) : (
            <div className="mt-4 max-h-[600px] space-y-2 overflow-y-auto pr-1">
              {catalog.length === 0 ? (
                <div className="py-8 text-center text-mute">
                  Nenhum modelo encontrado. Verifique a API key do provedor.
                </div>
              ) : (
                catalog.map((m) => (
                  <ModelCard
                    key={m.id}
                    model={m}
                    isSelected={settings.chatModel === m.modelId}
                    onSelect={() => {
                      onSave({ ...settings, chatModel: m.modelId });
                    }}
                  />
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Model Card ──

function ModelCard({
  model,
  isSelected,
  onSelect,
}: {
  model: CatalogModel;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const promptCost = model.pricing.prompt * 1_000_000;
  const completionCost = model.pricing.completion * 1_000_000;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-[20px] border p-4 text-left transition ${
        isSelected
          ? 'border-accent bg-accent/10'
          : 'border-border bg-bg/40 hover:border-accent/40'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`font-semibold ${isSelected ? 'text-accent' : 'text-text'}`}>
              {model.name}
            </span>
            {isSelected && <Check className="h-4 w-4 text-accent" />}
          </div>
          <div className="mt-0.5 truncate font-mono text-xs text-mute">{model.modelId}</div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full border border-border px-2.5 py-1 text-mute">
          {formatContext(model.contextLength)} ctx
        </span>
        <span className="rounded-full border border-border px-2.5 py-1 text-mute">
          ${promptCost.toFixed(2)}/M in
        </span>
        <span className="rounded-full border border-border px-2.5 py-1 text-mute">
          ${completionCost.toFixed(2)}/M out
        </span>
        {model.qualityScores?.overall != null && (
          <span className="rounded-full bg-accent/15 px-2.5 py-1 font-medium text-accent">
            {model.qualityScores.overall}/100
          </span>
        )}
        {model.qualityScores?.reasoning != null && (
          <span className="rounded-full border border-border px-2.5 py-1 text-mute">
            Raciocínio {model.qualityScores.reasoning}
          </span>
        )}
        {model.qualityScores?.coding != null && (
          <span className="rounded-full border border-border px-2.5 py-1 text-mute">
            Código {model.qualityScores.coding}
          </span>
        )}
        {model.expirationDate && (
          <span className="rounded-full bg-danger/15 px-2.5 py-1 text-danger">
            Descontinuado
          </span>
        )}
      </div>
    </button>
  );
}

// ── Agents Tab ──

function AgentsTab({
  settings,
  catalog,
  catalogLoading,
  onSave,
}: {
  settings: AISettings;
  catalog: CatalogModel[];
  catalogLoading: boolean;
  onSave: (s: AISettings) => Promise<void>;
}) {
  const agentModels = settings.agentModels ?? {};

  const setAgentModel = (agentKey: string, modelId: string | undefined) => {
    const newAgentModels = { ...agentModels };
    if (modelId) {
      newAgentModels[agentKey] = {
        provider: settings.chatProvider || 'openrouter',
        model: modelId,
      };
    } else {
      delete newAgentModels[agentKey];
    }
    onSave({ ...settings, agentModels: newAgentModels });
  };

  return (
    <div className="space-y-4">
      <div className="card p-6">
        <div className="flex items-center gap-3">
          <Bot className="h-5 w-5 text-accent" />
          <h2 className="text-2xl font-semibold text-text">Modelos por Agente</h2>
        </div>
        <p className="mt-3 leading-7 text-mute">
          Cada agente/pipeline pode usar um modelo diferente. Se nenhum modelo for escolhido, o
          agente usa o modelo padrão do workspace.
        </p>
      </div>

      {AGENTS.map((agent) => {
        const current = agentModels[agent.key];
        const currentModel = current?.model;
        const modelInCatalog = catalog.find((m) => m.modelId === currentModel);
        const isUnavailable = currentModel && !modelInCatalog && catalog.length > 0;

        return (
          <div key={agent.key} className="card p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold text-text">{agent.label}</h3>
                <p className="mt-1 text-sm text-mute">{agent.description}</p>
              </div>
              {isUnavailable && (
                <div className="flex items-center gap-1.5 rounded-full bg-danger/15 px-3 py-1.5 text-xs font-medium text-danger">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Modelo indisponível
                </div>
              )}
            </div>

            <div className="mt-3">
              {catalogLoading ? (
                <div className="flex items-center gap-2 text-sm text-mute">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando modelos…
                </div>
              ) : (
                <div className="relative">
                  <select
                    value={currentModel ?? ''}
                    onChange={(e) => setAgentModel(agent.key, e.target.value || undefined)}
                    className="w-full appearance-none rounded-[18px] border border-border bg-bg/70 px-4 py-3 pr-9 text-sm text-text focus:border-accent focus:outline-none"
                  >
                    <option value="">Padrão do workspace</option>
                    {catalog.map((m) => (
                      <option key={m.id} value={m.modelId}>
                        {m.name} — {formatContext(m.contextLength)} ctx, ${(m.pricing.prompt * 1_000_000).toFixed(2)}/M in
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mute" />
                </div>
              )}

              {isUnavailable && (
                <p className="mt-2 text-sm text-danger">
                  O modelo <span className="font-mono">{currentModel}</span> não está mais
                  disponível no catálogo. Selecione outro modelo.
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Appearance Tab ──

const THEME_META: Record<ThemeId, { label: string; emoji: string; accent: string; bg: string; surface: string }> = {
  terra: { label: 'Terra', emoji: '🌄', accent: 'rgb(243,138,55)', bg: 'rgb(18,13,10)', surface: 'rgb(29,21,17)' },
  oceano: { label: 'Oceano', emoji: '🌊', accent: 'rgb(56,189,248)', bg: 'rgb(10,16,23)', surface: 'rgb(17,27,39)' },
  floresta: { label: 'Floresta', emoji: '🌿', accent: 'rgb(52,211,153)', bg: 'rgb(10,18,14)', surface: 'rgb(17,29,22)' },
  noite: { label: 'Noite', emoji: '🌙', accent: 'rgb(167,139,250)', bg: 'rgb(15,11,23)', surface: 'rgb(26,21,37)' },
  aurora: { label: 'Aurora', emoji: '🌸', accent: 'rgb(244,114,182)', bg: 'rgb(21,10,18)', surface: 'rgb(33,21,32)' },
  artico: { label: 'Ártico', emoji: '❄️', accent: 'rgb(96,165,250)', bg: 'rgb(14,17,20)', surface: 'rgb(23,28,34)' },
  vulcao: { label: 'Vulcão', emoji: '🌋', accent: 'rgb(248,113,113)', bg: 'rgb(21,10,10)', surface: 'rgb(33,20,20)' },
  solaris: { label: 'Solaris', emoji: '☀️', accent: 'rgb(251,191,36)', bg: 'rgb(20,17,10)', surface: 'rgb(31,26,17)' },
};

function AppearanceTab() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-4">
      <div className="card p-6">
        <div className="flex items-center gap-3">
          <Palette className="h-5 w-5 text-accent" />
          <h2 className="text-2xl font-semibold text-text">Tema de Cores</h2>
        </div>
        <p className="mt-3 leading-7 text-mute">
          Escolha um tema visual para o Gravador. A mudança é aplicada instantaneamente e salva no
          navegador.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {THEMES.map((id) => {
          const meta = THEME_META[id];
          const isActive = theme === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTheme(id)}
              className={`group relative overflow-hidden rounded-[24px] border p-4 text-left transition ${
                isActive
                  ? 'border-accent ring-2 ring-accent/30'
                  : 'border-border hover:border-accent/40'
              }`}
              style={{ backgroundColor: meta.bg }}
            >
              {/* Preview swatch */}
              <div className="flex items-center gap-3">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-2xl text-lg"
                  style={{ backgroundColor: meta.accent, color: meta.bg }}
                >
                  {meta.emoji}
                </div>
                <div>
                  <div className="font-semibold" style={{ color: isActive ? meta.accent : '#e5e5e5' }}>
                    {meta.label}
                  </div>
                  <div className="mt-0.5 text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
                    {id}
                  </div>
                </div>
                {isActive && (
                  <div className="ml-auto">
                    <Check className="h-5 w-5" style={{ color: meta.accent }} />
                  </div>
                )}
              </div>

              {/* Color bar preview */}
              <div className="mt-3 flex gap-1.5">
                <div className="h-6 flex-1 rounded-lg" style={{ backgroundColor: meta.surface }} />
                <div className="h-6 w-10 rounded-lg" style={{ backgroundColor: meta.accent }} />
                <div className="h-6 w-6 rounded-lg" style={{ backgroundColor: meta.accent, opacity: 0.3 }} />
              </div>
            </button>
          );
        })}
      </div>

      {/* Live preview card */}
      <div className="card p-6">
        <div className="text-xs uppercase tracking-[0.24em] text-mute">Preview ao vivo</div>
        <div className="mt-4 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-onAccent text-lg font-bold">
            G
          </div>
          <div>
            <div className="text-lg font-semibold text-text">Gravador</div>
            <div className="text-sm text-mute">Tema atual: {THEME_META[theme].label}</div>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <span className="rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-onAccent">
            Accent
          </span>
          <span className="rounded-full bg-accent/15 px-3 py-1.5 text-xs font-medium text-accent">
            Soft
          </span>
          <span className="rounded-full border border-border px-3 py-1.5 text-xs text-mute">
            Border
          </span>
          <span className="rounded-full bg-ok/15 px-3 py-1.5 text-xs font-medium text-ok">
            OK
          </span>
          <span className="rounded-full bg-danger/15 px-3 py-1.5 text-xs font-medium text-danger">
            Danger
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Security Tab ──

function SecurityTab() {
  return (
    <div className="card p-6">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-5 w-5 text-ok" />
        <h2 className="text-2xl font-semibold text-text">Segurança</h2>
      </div>
      <ul className="mt-4 space-y-3 text-sm leading-7 text-mute">
        <li className="rounded-[20px] border border-border bg-bg/55 px-4 py-3">
          Autenticação exclusiva via Google.
        </li>
        <li className="rounded-[20px] border border-border bg-bg/55 px-4 py-3">
          Sessão do servidor separada do token do cliente.
        </li>
        <li className="rounded-[20px] border border-border bg-bg/55 px-4 py-3">
          Chaves de API cifradas em repouso, nunca expostas ao frontend após salvamento.
        </li>
        <li className="rounded-[20px] border border-border bg-bg/55 px-4 py-3">
          Infra de produção validada com health check real.
        </li>
      </ul>
    </div>
  );
}

// ── Helpers ──

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-border bg-bg/55 px-4 py-4">
      <div className="text-xs uppercase tracking-[0.24em] text-mute">{label}</div>
      <div className="mt-2 break-all font-mono text-sm text-text">{value}</div>
    </div>
  );
}

function formatContext(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1000) return `${Math.round(tokens / 1000)}K`;
  return String(tokens);
}
