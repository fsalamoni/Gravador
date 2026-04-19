'use client';

import { formatHealthCheckMessage, runModelHealthCheck } from '@/lib/model-health-check';
import {
  type AgentFitKey,
  type ModelSpec,
  avgRating,
  estimateRatingsFromApi,
  formatCost,
  formatTokens,
  getModelById,
  getModelsForProvider,
  inferFitScore,
} from '@/lib/model-registry';
import {
  AlertTriangle,
  BookOpen,
  Bot,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  HeartPulse,
  Loader2,
  Palette,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AgentModelModal } from './agent-model-modal';
import { ModelCatalogModal } from './model-catalog-modal';
import { THEMES, type ThemeId, useTheme } from './theme-provider';

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
  transcribeModel?: string;
  embeddingProvider?: string;
  embeddingModel?: string;
  byokKeys?: Record<string, string>;
  ollamaUrl?: string;
  agentModels?: Record<string, AgentModelConfig>;
  agentPrompts?: Record<string, string>;
  selectedModels?: string[];
}

/** Shape of OpenRouter API model response */
interface ApiCatalogModel {
  modelId: string;
  name: string;
  description: string;
  contextLength: number;
  pricing: { prompt: number; completion: number };
  qualityScores: {
    overall?: number;
    reasoning?: number;
    coding?: number;
    instruction?: number;
  } | null;
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
  {
    id: 'openrouter',
    label: 'OpenRouter',
    description: 'Gateway universal — 300+ modelos, uma API key',
  },
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
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const { theme: currentTheme, setTheme: applyTheme } = useTheme();

  // Modal states
  const [catalogModalProvider, setCatalogModalProvider] = useState<string | null>(null);
  const [agentModalKey, setAgentModalKey] = useState<string | null>(null);

  // OpenRouter API models (loaded on demand)
  const [openRouterApiModels, setOpenRouterApiModels] = useState<ModelSpec[]>([]);
  const [orLoading, setOrLoading] = useState(false);
  const [orError, setOrError] = useState<string | null>(null);

  // Personal catalog as Set for O(1) lookups
  const selectedModelIds = new Set(settings.selectedModels ?? []);

  // Load settings on mount
  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => {
        if (data.aiSettings) setSettings(data.aiSettings);
        if (data.theme && THEMES.includes(data.theme as ThemeId)) {
          const stored = localStorage.getItem('gravador-theme');
          if (!stored) applyTheme(data.theme as ThemeId);
        }
      })
      .catch(() => {});
  }, [applyTheme]);

  // Fetch OpenRouter full catalog from API when user visits providers/agents
  useEffect(() => {
    if (
      (tab === 'providers' || tab === 'agents') &&
      openRouterApiModels.length === 0 &&
      !orLoading &&
      !orError
    ) {
      setOrLoading(true);
      setOrError(null);
      fetch('/api/models?provider=openrouter')
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then((data) => {
          if (data.models && data.models.length > 0) {
            const specs: ModelSpec[] = data.models.map((m: ApiCatalogModel) => ({
              id: m.modelId,
              provider: 'openrouter',
              name: m.name,
              description: m.description || '',
              contextTokens: m.contextLength || 0,
              pricing: {
                input: m.pricing.prompt * 1_000_000,
                output: m.pricing.completion * 1_000_000,
              },
              ratings: estimateRatingsFromApi(m.qualityScores, m.pricing.prompt * 1_000_000),
            }));
            setOpenRouterApiModels(specs);
          } else {
            // No remote models — try force refresh
            return fetch('/api/models?provider=openrouter&force=true')
              .then((r2) => {
                if (!r2.ok) throw new Error(`HTTP ${r2.status}`);
                return r2.json();
              })
              .then((data2) => {
                if (data2.models && data2.models.length > 0) {
                  const specs2: ModelSpec[] = data2.models.map((m: ApiCatalogModel) => ({
                    id: m.modelId,
                    provider: 'openrouter',
                    name: m.name,
                    description: m.description || '',
                    contextTokens: m.contextLength || 0,
                    pricing: {
                      input: m.pricing.prompt * 1_000_000,
                      output: m.pricing.completion * 1_000_000,
                    },
                    ratings: estimateRatingsFromApi(
                      m.qualityScores,
                      m.pricing.prompt * 1_000_000,
                    ),
                  }));
                  setOpenRouterApiModels(specs2);
                } else {
                  setOrError('empty');
                }
              });
          }
        })
        .catch((err: unknown) => {
          setOrError(err instanceof Error ? err.message : 'Erro de rede');
        })
        .finally(() => setOrLoading(false));
    }
  }, [tab, openRouterApiModels.length, orLoading, orError]);

  /** Retry loading OpenRouter models after error */
  const retryOpenRouter = useCallback(() => {
    setOrError(null);
    setOpenRouterApiModels([]);
  }, []);

  const save = useCallback(async (newSettings: AISettings) => {
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
  }, []);

  const selectedProvider = (settings.chatProvider as AIProvider) || 'openrouter';

  const toggleCatalogModel = useCallback(
    (modelId: string) => {
      const current = new Set(settings.selectedModels ?? []);
      if (current.has(modelId)) current.delete(modelId);
      else current.add(modelId);
      const newSettings = { ...settings, selectedModels: [...current] };
      save(newSettings);
    },
    [settings, save],
  );

  /** Resolve models for a provider — OpenRouter uses API, others use static registry */
  const getProviderModels = useCallback(
    (provider: string): ModelSpec[] => {
      if (provider === 'openrouter' && openRouterApiModels.length > 0) return openRouterApiModels;
      return getModelsForProvider(provider);
    },
    [openRouterApiModels],
  );

  /** Lookup a model by ID — searches both static registry and API models */
  const findModelById = useCallback(
    (id: string): ModelSpec | undefined => {
      return getModelById(id) ?? openRouterApiModels.find((m) => m.id === id);
    },
    [openRouterApiModels],
  );

  /** All personal catalog models for the current provider (for agent selection) */
  const agentCatalogModels = useMemo(() => {
    const ids = new Set(settings.selectedModels ?? []);
    if (ids.size === 0) return [];
    return getProviderModels(selectedProvider).filter((m) => ids.has(m.id));
  }, [getProviderModels, selectedProvider, settings.selectedModels]);

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
      <div className="card px-4 py-3 sm:px-5">
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
          selectedModelIds={selectedModelIds}
          getProviderModels={getProviderModels}
          onSave={save}
          onProviderChange={(provider) => {
            const newSettings = { ...settings, chatProvider: provider };
            save(newSettings);
          }}
          onKeyChange={(key) => {
            const newSettings = {
              ...settings,
              byokKeys: { ...settings.byokKeys, [selectedProvider]: key },
            };
            setSettings(newSettings);
          }}
          onKeySave={() => save(settings)}
          onOpenCatalog={(provider) => setCatalogModalProvider(provider)}
          onOllamaUrlChange={(url) => {
            setSettings((prev) => ({ ...prev, ollamaUrl: url }));
          }}
        />
      )}
      {tab === 'agents' && (
        <AgentsTab
          settings={settings}
          selectedModelIds={selectedModelIds}
          findModelById={findModelById}
          onSave={save}
          onOpenAgentModal={(key) => setAgentModalKey(key)}
        />
      )}
      {tab === 'security' && <SecurityTab />}

      {/* Model Catalog Modal */}
      {catalogModalProvider && (
        <ModelCatalogModal
          providerLabel={
            PROVIDERS.find((p) => p.id === catalogModalProvider)?.label ?? catalogModalProvider
          }
          models={getProviderModels(catalogModalProvider)}
          loading={catalogModalProvider === 'openrouter' && orLoading}
          error={catalogModalProvider === 'openrouter' ? orError : null}
          onRetry={catalogModalProvider === 'openrouter' ? retryOpenRouter : undefined}
          selectedIds={selectedModelIds}
          onToggle={toggleCatalogModel}
          onClose={() => setCatalogModalProvider(null)}
        />
      )}

      {/* Agent Model Selection Modal */}
      {agentModalKey &&
        (() => {
          const agent = AGENTS.find((a) => a.key === agentModalKey);
          if (!agent) return null;
          const currentModel = settings.agentModels?.[agentModalKey]?.model;
          return (
            <AgentModelModal
              agentKey={agentModalKey as AgentFitKey}
              agentLabel={agent.label}
              agentDescription={agent.description}
              models={agentCatalogModels}
              currentModelId={currentModel}
              onSelect={(model) => {
                const newAgentModels = { ...settings.agentModels };
                if (model) {
                  newAgentModels[agentModalKey] = { provider: model.provider, model: model.id };
                } else {
                  delete newAgentModels[agentModalKey];
                }
                save({ ...settings, agentModels: newAgentModels });
              }}
              onClose={() => setAgentModalKey(null)}
            />
          );
        })()}
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
  selectedModelIds,
  getProviderModels,
  onSave,
  onProviderChange,
  onKeyChange,
  onKeySave,
  onOpenCatalog,
  onOllamaUrlChange,
}: {
  settings: AISettings;
  selectedProvider: AIProvider;
  showKey: boolean;
  setShowKey: (v: boolean) => void;
  selectedModelIds: Set<string>;
  getProviderModels: (provider: string) => ModelSpec[];
  onSave: (s: AISettings) => Promise<void>;
  onProviderChange: (p: AIProvider) => void;
  onKeyChange: (key: string) => void;
  onKeySave: () => void;
  onOpenCatalog: (provider: string) => void;
  onOllamaUrlChange: (url: string) => void;
}) {
  const currentKey = settings.byokKeys?.[selectedProvider] ?? '';
  const providerModels = getProviderModels(selectedProvider);
  const catalogCount = providerModels.filter((m) => selectedModelIds.has(m.id)).length;

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
          {PROVIDERS.map((p) => {
            const pModels = getProviderModels(p.id);
            const pSelected = pModels.filter((m) => selectedModelIds.has(m.id)).length;
            return (
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
                <div
                  className={`font-semibold ${selectedProvider === p.id ? 'text-accent' : 'text-text'}`}
                >
                  {p.label}
                </div>
                <div className="mt-1 text-xs leading-5 text-mute">{p.description}</div>
                <div className="mt-2 text-xs text-mute">
                  {pModels.length} modelos •{' '}
                  <span className="text-accent">{pSelected} no catálogo</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* API Key input */}
        {selectedProvider === 'ollama' ? (
          <div className="mt-5">
            <label
              htmlFor="ollama-url-input"
              className="text-xs uppercase tracking-[0.24em] text-mute"
            >
              URL do Servidor Ollama
            </label>
            <div className="mt-2 flex gap-2">
              <input
                id="ollama-url-input"
                type="url"
                value={settings.ollamaUrl ?? 'http://localhost:11434'}
                onChange={(e) =>
                  onOllamaUrlChange(e.target.value)
                }
                placeholder="http://localhost:11434"
                className="flex-1 rounded-[18px] border border-border bg-bg/70 px-4 py-3 font-mono text-sm text-text placeholder:text-mute/50 focus:border-accent focus:outline-none"
              />
              <button
                type="button"
                onClick={onKeySave}
                className="rounded-[18px] bg-accent px-5 py-3 text-sm font-semibold text-onAccent transition hover:bg-accentSoft"
              >
                Salvar
              </button>
            </div>
            <p className="mt-2 text-xs text-mute">
              Certifique-se de que o Ollama está rodando e acessível nesse endereço. Modelos
              disponíveis são detectados automaticamente via <code>/api/tags</code>.
            </p>
          </div>
        ) : (
          <div className="mt-5">
            <label
              htmlFor="api-key-input"
              className="text-xs uppercase tracking-[0.24em] text-mute"
            >
              API Key
            </label>
            <div className="mt-2 flex gap-2">
              <div className="relative flex-1">
                <input
                  id="api-key-input"
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

      {/* Personal Model Catalog */}
      <div className="card p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="h-5 w-5 text-accent" />
            <h2 className="text-xl font-semibold text-text">Catálogo Pessoal</h2>
            <span className="rounded-full bg-accent/15 px-2.5 py-1 text-xs font-medium text-accent">
              {catalogCount} de {providerModels.length}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onOpenCatalog(selectedProvider)}
            className="rounded-[18px] bg-accent px-5 py-2.5 text-sm font-semibold text-onAccent transition hover:bg-accentSoft"
          >
            Gerenciar Catálogo
          </button>
        </div>
        <p className="mt-3 text-sm leading-7 text-mute">
          Selecione os modelos que deseja usar. Apenas modelos do catálogo pessoal aparecem na
          seleção de agentes.
        </p>

        {catalogCount === 0 ? (
          <div className="mt-4 rounded-[20px] border border-dashed border-border px-6 py-8 text-center text-mute">
            Nenhum modelo selecionado. Clique em <strong>Gerenciar Catálogo</strong> para adicionar
            modelos.
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {providerModels
              .filter((m) => selectedModelIds.has(m.id))
              .sort((a, b) => avgRating(b) - avgRating(a))
              .map((m) => (
                <div
                  key={m.id}
                  className={`flex items-center justify-between rounded-[20px] border p-4 transition ${
                    settings.chatModel === m.id
                      ? 'border-accent bg-accent/10'
                      : 'border-border bg-bg/40 hover:border-accent/40'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-semibold ${settings.chatModel === m.id ? 'text-accent' : 'text-text'}`}
                      >
                        {m.name}
                      </span>
                      {settings.chatModel === m.id && <Check className="h-4 w-4 text-accent" />}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-accent/15 px-2 py-0.5 font-medium text-accent">
                        Média {avgRating(m)}
                      </span>
                      <span className="rounded-full border border-border px-2 py-0.5 text-mute">
                        {formatTokens(m.contextTokens)} ctx
                      </span>
                      <span className="rounded-full border border-border px-2 py-0.5 text-mute">
                        {formatCost(m.pricing.input)}/M in
                      </span>
                      <span className="rounded-full border border-border px-2 py-0.5 text-mute">
                        {formatCost(m.pricing.output)}/M out
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSave({ ...settings, chatModel: m.id })}
                    className={`ml-4 rounded-[14px] px-4 py-2 text-xs font-semibold transition ${
                      settings.chatModel === m.id
                        ? 'bg-accent text-onAccent'
                        : 'border border-border text-mute hover:border-accent hover:text-accent'
                    }`}
                  >
                    {settings.chatModel === m.id ? 'Padrão ✓' : 'Usar como padrão'}
                  </button>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Agents Tab ──

function AgentsTab({
  settings,
  selectedModelIds,
  findModelById,
  onSave,
  onOpenAgentModal,
}: {
  settings: AISettings;
  selectedModelIds: Set<string>;
  findModelById: (id: string) => ModelSpec | undefined;
  onSave: (s: AISettings) => Promise<void>;
  onOpenAgentModal: (agentKey: string) => void;
}) {
  const agentModels = settings.agentModels ?? {};
  const agentPrompts = settings.agentPrompts ?? {};
  const [expandedPrompts, setExpandedPrompts] = useState<Record<string, boolean>>({});
  const [promptDrafts, setPromptDrafts] = useState<Record<string, string>>(agentPrompts);
  const [savingPrompt, setSavingPrompt] = useState<string | null>(null);
  const [reprocessing, setReprocessing] = useState(false);
  const [healthChecking, setHealthChecking] = useState(false);

  const togglePrompt = (key: string) =>
    setExpandedPrompts((prev) => ({ ...prev, [key]: !prev[key] }));

  const savePrompt = async (key: string) => {
    setSavingPrompt(key);
    const next = { ...agentPrompts, [key]: promptDrafts[key] ?? '' };
    await onSave({ ...settings, agentPrompts: next });
    setSavingPrompt(null);
  };

  const handleReprocessAll = async () => {
    if (!confirm('Reprocessar todas as gravações com os pipelines de IA? Isso pode demorar.'))
      return;
    setReprocessing(true);
    try {
      const resp = await fetch('/api/recordings/reprocess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordingIds: ['__all__'] }),
      });
      if (!resp.ok) throw new Error('Falha ao reprocessar');
      alert('Reprocessamento enfileirado com sucesso!');
    } catch {
      alert('Erro ao reprocessar. Tente novamente.');
    } finally {
      setReprocessing(false);
    }
  };

  const handleHealthCheck = async () => {
    setHealthChecking(true);
    try {
      const selected = settings.selectedModels ?? [];
      const agents: Record<string, string> = {};
      for (const [key, cfg] of Object.entries(agentModels)) {
        if (cfg?.model) agents[key] = cfg.model;
      }
      const result = await runModelHealthCheck(selected, agents, true);
      const msg = formatHealthCheckMessage(result);
      if (msg) {
        // Remove unavailable models from catalog and clear agent configs
        const removedSet = new Set(result.removedModels);
        const nextSelected = selected.filter((id) => !removedSet.has(id));
        const nextAgentModels = { ...agentModels };
        for (const agentKey of result.clearedAgents) {
          delete nextAgentModels[agentKey];
        }
        await onSave({
          ...settings,
          selectedModels: nextSelected,
          agentModels: nextAgentModels,
        });
        alert(`${msg.title}\n\n${msg.message}`);
      } else {
        alert('Todos os modelos do catálogo estão disponíveis!');
      }
    } catch {
      alert('Erro ao verificar modelos. Tente novamente.');
    } finally {
      setHealthChecking(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="card p-6">
        <div className="flex items-center gap-3">
          <Bot className="h-5 w-5 text-accent" />
          <h2 className="text-2xl font-semibold text-text">Modelos por Agente</h2>
        </div>
        <p className="mt-3 leading-7 text-mute">
          Cada agente/pipeline pode usar um modelo diferente. Clique para escolher do catálogo
          pessoal. Se nenhum modelo for escolhido, o agente usa o modelo padrão do workspace.
        </p>
      </div>

      {/* Transcription Provider */}
      <div className="card p-5">
        <h3 className="font-semibold text-text">Provedor de Transcrição</h3>
        <p className="mt-1 text-sm text-mute">
          Escolha o provedor e modelo para transcrição de áudio (speech-to-text). Você paga pelo uso
          normalmente na conta do seu provedor.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="transcribe-provider" className="text-xs uppercase tracking-[0.24em] text-mute">
              Provedor
            </label>
            <select
              id="transcribe-provider"
              value={settings.transcribeProvider ?? 'groq'}
              onChange={(e) => {
                const provider = e.target.value;
                const defaultModels: Record<string, string> = {
                  groq: 'whisper-large-v3',
                  openai: 'whisper-1',
                  local: 'self-hosted',
                };
                onSave({
                  ...settings,
                  transcribeProvider: provider,
                  transcribeModel: defaultModels[provider] ?? '',
                });
              }}
              className="mt-1.5 w-full rounded-[14px] border border-border bg-bg/70 px-4 py-3 text-sm text-text outline-none focus:border-accent/50"
            >
              <option value="groq">Groq (Whisper v3 — rápido)</option>
              <option value="openai">OpenAI (Whisper — referência)</option>
              <option value="google">Google (Chirp / Speech-to-Text)</option>
              <option value="local">Local / Self-hosted</option>
            </select>
          </div>
          <div>
            <label htmlFor="transcribe-model" className="text-xs uppercase tracking-[0.24em] text-mute">
              Modelo
            </label>
            <input
              id="transcribe-model"
              type="text"
              value={settings.transcribeModel ?? ''}
              onChange={(e) => {
                onSave({ ...settings, transcribeModel: e.target.value });
              }}
              placeholder={
                settings.transcribeProvider === 'openai'
                  ? 'whisper-1'
                  : settings.transcribeProvider === 'google'
                    ? 'chirp'
                    : settings.transcribeProvider === 'local'
                      ? 'http://localhost:8080'
                      : 'whisper-large-v3'
              }
              className="mt-1.5 w-full rounded-[14px] border border-border bg-bg/70 px-4 py-3 font-mono text-sm text-text outline-none placeholder:text-mute/50 focus:border-accent/50"
            />
          </div>
        </div>
        <p className="mt-2 text-xs text-mute">
          {settings.transcribeProvider === 'groq' && 'Usa sua API key do Groq. Whisper v3 é gratuito no tier free.'}
          {settings.transcribeProvider === 'openai' && 'Usa sua API key da OpenAI. Whisper-1 cobra $0.006/minuto.'}
          {settings.transcribeProvider === 'google' && 'Usa sua API key do Google Cloud. Verifique preços no console.'}
          {settings.transcribeProvider === 'local' && 'Aponte para seu servidor Whisper local (ex: whisper-server.py da infra Docker).'}
          {!settings.transcribeProvider && 'Usa sua API key do Groq. Whisper v3 é gratuito no tier free.'}
        </p>
      </div>

      {AGENTS.map((agent) => {
        const current = agentModels[agent.key];
        const currentModelId = current?.model;
        const modelSpec = currentModelId ? findModelById(currentModelId) : undefined;
        const isInCatalog = currentModelId ? selectedModelIds.has(currentModelId) : true;
        const isExpanded = expandedPrompts[agent.key] ?? false;
        const draft = promptDrafts[agent.key] ?? '';

        return (
          <div key={agent.key} className="card p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="font-semibold text-text">{agent.label}</h3>
                <p className="mt-1 text-sm text-mute">{agent.description}</p>
              </div>
              {currentModelId && !isInCatalog && (
                <div className="flex items-center gap-1.5 rounded-full bg-danger/15 px-3 py-1.5 text-xs font-medium text-danger">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Fora do catálogo
                </div>
              )}
            </div>

            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={() => onOpenAgentModal(agent.key)}
                className="flex-1 rounded-[18px] border border-border bg-bg/70 px-4 py-3 text-left text-sm transition hover:border-accent/40"
              >
                {modelSpec ? (
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <span className="font-medium text-text">{modelSpec.name}</span>
                      <span className="ml-2 text-xs text-mute">
                        Média {avgRating(modelSpec)} • {formatTokens(modelSpec.contextTokens)} ctx •{' '}
                        {formatCost(modelSpec.pricing.input)}/M in
                      </span>
                    </div>
                    <ChevronDown className="h-4 w-4 text-mute" />
                  </div>
                ) : currentModelId ? (
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-xs text-mute">{currentModelId}</span>
                    <ChevronDown className="h-4 w-4 text-mute" />
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-mute">Padrão do workspace</span>
                    <ChevronDown className="h-4 w-4 text-mute" />
                  </div>
                )}
              </button>
            </div>

            {/* Custom prompt section */}
            <button
              type="button"
              onClick={() => togglePrompt(agent.key)}
              className="mt-3 flex items-center gap-2 text-xs font-medium text-accent hover:underline"
            >
              <ChevronDown className={`h-3.5 w-3.5 transition ${isExpanded ? 'rotate-180' : ''}`} />
              {isExpanded ? 'Ocultar prompt customizado' : 'Prompt customizado'}
            </button>
            {isExpanded && (
              <div className="mt-2 space-y-2">
                <textarea
                  value={draft}
                  onChange={(e) =>
                    setPromptDrafts((prev) => ({ ...prev, [agent.key]: e.target.value }))
                  }
                  placeholder={`Instruções adicionais para o agente "${agent.label}"…`}
                  rows={4}
                  className="w-full rounded-[14px] border border-border bg-bg/70 px-4 py-3 text-sm text-text outline-none placeholder:text-mute/50 focus:border-accent/50"
                />
                <button
                  type="button"
                  onClick={() => savePrompt(agent.key)}
                  disabled={savingPrompt === agent.key}
                  className="rounded-[14px] bg-accent px-4 py-2 text-xs font-medium text-onAccent transition hover:opacity-90 disabled:opacity-50"
                >
                  {savingPrompt === agent.key ? 'Salvando…' : 'Salvar prompt'}
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* Batch reprocess */}
      <div className="card p-5">
        <h3 className="font-semibold text-text">Reprocessamento em Lote</h3>
        <p className="mt-1 text-sm text-mute">
          Reprocessar todas as gravações com os pipelines de IA usando os modelos e prompts atuais.
        </p>
        <button
          type="button"
          onClick={handleReprocessAll}
          disabled={reprocessing}
          className="mt-3 rounded-[18px] border border-accent/40 bg-accent/10 px-5 py-3 text-sm font-medium text-accent transition hover:bg-accent/20 disabled:opacity-50"
        >
          {reprocessing ? 'Enfileirando…' : '🔄 Reprocessar todas as gravações'}
        </button>
      </div>

      {/* Model health check */}
      <div className="card p-5">
        <div className="flex items-center gap-3">
          <HeartPulse className="h-5 w-5 text-ok" />
          <h3 className="font-semibold text-text">Health Check de Modelos</h3>
        </div>
        <p className="mt-1 text-sm text-mute">
          Verifica se os modelos OpenRouter do seu catálogo pessoal ainda estão disponíveis. Remove
          automaticamente modelos indisponíveis e limpa configurações de agentes afetados.
        </p>
        <button
          type="button"
          onClick={handleHealthCheck}
          disabled={healthChecking}
          className="mt-3 rounded-[18px] border border-ok/40 bg-ok/10 px-5 py-3 text-sm font-medium text-ok transition hover:bg-ok/20 disabled:opacity-50"
        >
          {healthChecking ? 'Verificando…' : '🩺 Verificar disponibilidade'}
        </button>
      </div>
    </div>
  );
}

// ── Appearance Tab ──

const THEME_META: Record<
  ThemeId,
  { label: string; emoji: string; accent: string; bg: string; surface: string }
> = {
  terra: {
    label: 'Terra',
    emoji: '🌄',
    accent: 'rgb(243,138,55)',
    bg: 'rgb(18,13,10)',
    surface: 'rgb(29,21,17)',
  },
  oceano: {
    label: 'Oceano',
    emoji: '🌊',
    accent: 'rgb(56,189,248)',
    bg: 'rgb(10,16,23)',
    surface: 'rgb(17,27,39)',
  },
  floresta: {
    label: 'Floresta',
    emoji: '🌿',
    accent: 'rgb(52,211,153)',
    bg: 'rgb(10,18,14)',
    surface: 'rgb(17,29,22)',
  },
  noite: {
    label: 'Noite',
    emoji: '🌙',
    accent: 'rgb(167,139,250)',
    bg: 'rgb(15,11,23)',
    surface: 'rgb(26,21,37)',
  },
  aurora: {
    label: 'Aurora',
    emoji: '🌸',
    accent: 'rgb(244,114,182)',
    bg: 'rgb(21,10,18)',
    surface: 'rgb(33,21,32)',
  },
  artico: {
    label: 'Ártico',
    emoji: '❄️',
    accent: 'rgb(96,165,250)',
    bg: 'rgb(14,17,20)',
    surface: 'rgb(23,28,34)',
  },
  vulcao: {
    label: 'Vulcão',
    emoji: '🌋',
    accent: 'rgb(248,113,113)',
    bg: 'rgb(21,10,10)',
    surface: 'rgb(33,20,20)',
  },
  solaris: {
    label: 'Solaris',
    emoji: '☀️',
    accent: 'rgb(251,191,36)',
    bg: 'rgb(20,17,10)',
    surface: 'rgb(31,26,17)',
  },
  claro: {
    label: 'Claro',
    emoji: '🌤️',
    accent: 'rgb(59,130,246)',
    bg: 'rgb(248,250,252)',
    surface: 'rgb(255,255,255)',
  },
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
          Escolha um tema visual para o Nexus. A mudança é aplicada instantaneamente e salva no
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
                  <div
                    className="font-semibold"
                    style={{ color: isActive ? meta.accent : '#e5e5e5' }}
                  >
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
                <div
                  className="h-6 w-6 rounded-lg"
                  style={{ backgroundColor: meta.accent, opacity: 0.3 }}
                />
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
            N
          </div>
          <div>
            <div className="text-lg font-semibold text-text">Nexus</div>
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
          <span className="rounded-full bg-ok/15 px-3 py-1.5 text-xs font-medium text-ok">OK</span>
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
