'use client';

import {
  type AgentFitKey,
  type ModelSpec,
  avgRating,
  formatCost,
  formatTokens,
  inferFitScore,
  isModelCompatibleWithAgent,
} from '@/lib/model-registry';
import { Check, ChevronDown, ChevronUp, Info, Search, X } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

const AGENT_TIPS: Record<AgentFitKey, { type: string; why: string; recommended: string }> = {
  transcribe: {
    type: 'Modelo de Fala-para-Texto (STT)',
    why: 'Exige modelo especializado em reconhecimento de fala. Não funciona com LLMs genéricos.',
    recommended: 'Whisper Large v3 (Groq) · Whisper-1 (OpenAI) · Faster-Whisper local',
  },
  summarize: {
    type: 'LLM com alta Síntese e Redação',
    why: 'Precisa condensar longos trascritos preservando nuances. Síntese e escrita fluente são essenciais.',
    recommended: 'Claude Sonnet 4.6 · GPT-4.1 · Gemini 2.5 Pro',
  },
  actionItems: {
    type: 'LLM com alta Extração e Raciocínio',
    why: 'Deve identificar compromissos implícitos e atribuir responsáveis com precisão. Temperatura baixa.',
    recommended: 'Claude Sonnet 4.6 · GPT-4.1 · GPT-4.1-mini',
  },
  mindmap: {
    type: 'LLM com Extração estruturada e Síntese',
    why: 'Precisa organizar hierarquias de tópicos de forma coerente a partir de conteúdo extenso.',
    recommended: 'Claude Sonnet 4.6 · Gemini 2.5 Flash · GPT-4.1-mini',
  },
  chapters: {
    type: 'LLM com alta Extração temporal',
    why: 'Segmenta o conteúdo por timestamps; prioriza extração sobre criatividade. Modelos compactos bastam.',
    recommended: 'GPT-4.1-mini · Claude Haiku 3.5 · Gemma 2.5 Flash',
  },
  chat: {
    type: 'LLM com alto Raciocínio conversacional (RAG)',
    why: 'Combina recuperação de contexto com geração fluente. Raciocínio e escrita são o diferencial.',
    recommended: 'Claude Opus 4 · GPT-4o · Gemini 2.5 Pro',
  },
  embed: {
    type: 'Modelo de Embedding vetorial',
    why: 'Gera vetores semânticos para busca por similaridade. Apenas modelos de embedding são compatíveis.',
    recommended: 'text-embedding-3-small (OpenAI) · text-embedding-3-large · nomic-embed (Ollama)',
  },
};

type SortKey =
  | 'name'
  | 'fit'
  | 'extraction'
  | 'synthesis'
  | 'reasoning'
  | 'writing'
  | 'avg'
  | 'context'
  | 'input'
  | 'output';
type SortDir = 'asc' | 'desc';

interface Props {
  agentKey?: AgentFitKey;
  agentLabel: string;
  agentDescription: string;
  models: ModelSpec[];
  currentModelId: string | undefined;
  onSelect: (model: ModelSpec | undefined) => void;
  onClose: () => void;
}

export function AgentModelModal({
  agentKey,
  agentLabel,
  agentDescription,
  models,
  currentModelId,
  onSelect,
  onClose,
}: Props) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>(agentKey ? 'fit' : 'avg');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const toggleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      else {
        setSortKey(key);
        setSortDir(key === 'name' ? 'asc' : 'desc');
      }
    },
    [sortKey],
  );

  const filtered = useMemo(() => {
    let list = models;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.id.toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      switch (sortKey) {
        case 'name':
          return dir * a.name.localeCompare(b.name);
        case 'fit':
          if (!agentKey) return dir * (avgRating(a) - avgRating(b));
          return dir * (inferFitScore(a, agentKey) - inferFitScore(b, agentKey));
        case 'extraction':
          return dir * (a.ratings.extraction - b.ratings.extraction);
        case 'synthesis':
          return dir * (a.ratings.synthesis - b.ratings.synthesis);
        case 'reasoning':
          return dir * (a.ratings.reasoning - b.ratings.reasoning);
        case 'writing':
          return dir * (a.ratings.writing - b.ratings.writing);
        case 'avg':
          return dir * (avgRating(a) - avgRating(b));
        case 'context':
          return dir * (a.contextTokens - b.contextTokens);
        case 'input':
          return dir * (a.pricing.input - b.pricing.input);
        case 'output':
          return dir * (a.pricing.output - b.pricing.output);
        default:
          return 0;
      }
    });
  }, [models, search, sortKey, sortDir, agentKey]);

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ChevronDown className="ml-0.5 inline h-3 w-3 opacity-30" />;
    return sortDir === 'asc' ? (
      <ChevronUp className="ml-0.5 inline h-3 w-3 text-accent" />
    ) : (
      <ChevronDown className="ml-0.5 inline h-3 w-3 text-accent" />
    );
  };

  const thCls =
    'cursor-pointer select-none whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-mute hover:text-text transition';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative mx-4 flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-border bg-bg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-text">Selecionar Modelo — {agentLabel}</h2>
            <p className="mt-1 text-sm text-mute">{agentDescription}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-mute hover:bg-surfaceAlt hover:text-text transition"
            aria-label="Fechar"
          >
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
              placeholder="Buscar no catálogo pessoal…"
              className="w-full rounded-[16px] border border-border bg-surfaceAlt/50 py-2 pl-9 pr-4 text-sm text-text placeholder:text-mute/50 focus:border-accent focus:outline-none"
            />
          </div>
        </div>

        {/* Agent recommendation banner */}
        {agentKey && AGENT_TIPS[agentKey] && (
          <div className="border-b border-border bg-accent/5 px-6 py-3">
            <div className="flex items-start gap-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <div className="space-y-0.5 text-sm">
                <span className="font-semibold text-text">{AGENT_TIPS[agentKey].type}</span>
                <span className="mx-2 text-mute">—</span>
                <span className="text-mute">{AGENT_TIPS[agentKey].why}</span>
                <div className="mt-1 text-xs text-accent/80">
                  <span className="font-medium text-text/70">Recomendado: </span>
                  {AGENT_TIPS[agentKey].recommended}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {models.length === 0 ? (
            <div className="px-6 py-12 text-center text-mute">
              Nenhum modelo no catálogo pessoal para este provedor.
              <br />
              Vá em <strong>Provedores de IA</strong> e adicione modelos ao catálogo primeiro.
            </div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-bg/95 backdrop-blur-sm">
                <tr className="border-b border-border">
                  <th className="w-10 px-3 py-2.5" />
                  <th className={thCls} onClick={() => toggleSort('name')}>
                    Modelo <SortIcon col="name" />
                  </th>
                  {agentKey && (
                    <th className={thCls} onClick={() => toggleSort('fit')}>
                      Fit <SortIcon col="fit" />
                    </th>
                  )}
                  <th className={`${thCls} hidden sm:table-cell`} onClick={() => toggleSort('avg')}>
                    Média <SortIcon col="avg" />
                  </th>
                  <th
                    className={`${thCls} hidden md:table-cell`}
                    onClick={() => toggleSort('extraction')}
                  >
                    Extração <SortIcon col="extraction" />
                  </th>
                  <th
                    className={`${thCls} hidden md:table-cell`}
                    onClick={() => toggleSort('synthesis')}
                  >
                    Síntese <SortIcon col="synthesis" />
                  </th>
                  <th
                    className={`${thCls} hidden lg:table-cell`}
                    onClick={() => toggleSort('reasoning')}
                  >
                    Raciocínio <SortIcon col="reasoning" />
                  </th>
                  <th
                    className={`${thCls} hidden lg:table-cell`}
                    onClick={() => toggleSort('writing')}
                  >
                    Redação <SortIcon col="writing" />
                  </th>
                  <th className={thCls} onClick={() => toggleSort('context')}>
                    Contexto <SortIcon col="context" />
                  </th>
                  <th className={thCls} onClick={() => toggleSort('input')}>
                    $/M in <SortIcon col="input" />
                  </th>
                  <th
                    className={`${thCls} hidden sm:table-cell`}
                    onClick={() => toggleSort('output')}
                  >
                    $/M out <SortIcon col="output" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* Default row */}
                <tr
                  onClick={() => {
                    onSelect(undefined);
                  }}
                  className={`cursor-pointer border-b border-border/50 transition ${
                    !currentModelId ? 'bg-accent/8 hover:bg-accent/12' : 'hover:bg-surfaceAlt/50'
                  }`}
                >
                  <td className="px-3 py-2.5 text-center">
                    <div
                      className={`flex h-5 w-5 items-center justify-center rounded-md border transition ${
                        !currentModelId ? 'border-accent bg-accent' : 'border-border'
                      }`}
                    >
                      {!currentModelId && <Check className="h-3 w-3 text-onAccent" />}
                    </div>
                  </td>
                  <td className="px-3 py-2.5" colSpan={9}>
                    <div className="font-medium text-text">Padrão do workspace</div>
                    <div className="mt-0.5 text-xs text-mute">
                      Usa o modelo padrão configurado no provedor
                    </div>
                  </td>
                </tr>
                {filtered.map((m) => {
                  const selected = currentModelId === m.id;
                  const compatible = agentKey ? isModelCompatibleWithAgent(m, agentKey) : true;
                  return (
                    <tr
                      key={m.id}
                      onClick={() => {
                        if (!compatible) return;
                        onSelect(m);
                      }}
                      className={`border-b border-border/50 transition ${
                        compatible ? 'cursor-pointer' : 'cursor-not-allowed opacity-55'
                      } ${
                        selected
                          ? 'bg-accent/8 hover:bg-accent/12'
                          : compatible
                            ? 'hover:bg-surfaceAlt/50'
                            : ''
                      }`}
                    >
                      <td className="px-3 py-2.5 text-center">
                        <div
                          className={`flex h-5 w-5 items-center justify-center rounded-md border transition ${
                            selected ? 'border-accent bg-accent' : 'border-border'
                          }`}
                        >
                          {selected && <Check className="h-3 w-3 text-onAccent" />}
                        </div>
                      </td>
                      <td className="max-w-[200px] px-3 py-2.5">
                        <div className="font-medium text-text">{m.name}</div>
                        <div className="mt-0.5 truncate text-xs text-mute">{m.description}</div>
                        {!compatible && (
                          <div className="mt-1 text-[11px] font-medium text-danger">
                            Incompatível com este agente
                          </div>
                        )}
                      </td>
                      {agentKey && (
                        <td className="px-3 py-2.5">
                          <FitBadge score={inferFitScore(m, agentKey)} />
                        </td>
                      )}
                      <td className="hidden px-3 py-2.5 sm:table-cell">
                        <RatingBadge value={avgRating(m)} />
                      </td>
                      <td className="hidden px-3 py-2.5 md:table-cell">
                        <RatingBadge value={m.ratings.extraction} />
                      </td>
                      <td className="hidden px-3 py-2.5 md:table-cell">
                        <RatingBadge value={m.ratings.synthesis} />
                      </td>
                      <td className="hidden px-3 py-2.5 lg:table-cell">
                        <RatingBadge value={m.ratings.reasoning} />
                      </td>
                      <td className="hidden px-3 py-2.5 lg:table-cell">
                        <RatingBadge value={m.ratings.writing} />
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-mute">
                        {formatTokens(m.contextTokens)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-mute">
                        {formatCost(m.pricing.input)}
                      </td>
                      <td className="hidden whitespace-nowrap px-3 py-2.5 font-mono text-xs text-mute sm:table-cell">
                        {formatCost(m.pricing.output)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <p className="text-sm text-mute">
            {filtered.length} modelos no catálogo
            {agentKey &&
              ` • ${filtered.filter((m) => isModelCompatibleWithAgent(m, agentKey)).length} habilitados`}
            {currentModelId &&
              ` • Selecionado: ${models.find((m) => m.id === currentModelId)?.name ?? currentModelId}`}
          </p>
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
    <span
      className={`inline-flex min-w-[36px] items-center justify-center rounded-md border px-1.5 py-0.5 text-xs font-bold ${color}`}
    >
      {value}
    </span>
  );
}

function FitBadge({ score }: { score: number }) {
  let color = 'text-mute border-border';
  let label = '';
  if (score >= 8) {
    color = 'text-ok border-ok/30 bg-ok/10';
    label = 'Ideal';
  } else if (score >= 6) {
    color = 'text-accent border-accent/30 bg-accent/10';
    label = 'Bom';
  } else if (score >= 4) {
    color = 'text-text border-border bg-surfaceAlt/50';
    label = 'OK';
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold ${color}`}
    >
      {score}/10
      {label && <span className="font-medium">{label}</span>}
    </span>
  );
}
