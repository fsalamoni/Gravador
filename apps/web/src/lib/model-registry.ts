/**
 * Static model registry for all supported providers.
 * Ratings are 0–100 for: extraction, synthesis, reasoning, writing.
 * Pricing is per 1M tokens (USD). Context in tokens.
 */

export interface ModelSpec {
  id: string;
  provider: string;
  name: string;
  description: string;
  contextTokens: number;
  pricing: { input: number; output: number };
  ratings: { extraction: number; synthesis: number; reasoning: number; writing: number };
}

export const MODEL_REGISTRY: ModelSpec[] = [
  // ── OpenAI ──
  {
    id: 'gpt-4.1',
    provider: 'openai',
    name: 'GPT-4.1',
    description: 'Flagship model — excellent at complex reasoning and long-form generation',
    contextTokens: 1_048_576,
    pricing: { input: 2.0, output: 8.0 },
    ratings: { extraction: 92, synthesis: 94, reasoning: 95, writing: 93 },
  },
  {
    id: 'gpt-4.1-mini',
    provider: 'openai',
    name: 'GPT-4.1 Mini',
    description: 'Balanced cost-performance for everyday tasks',
    contextTokens: 1_048_576,
    pricing: { input: 0.4, output: 1.6 },
    ratings: { extraction: 85, synthesis: 86, reasoning: 84, writing: 85 },
  },
  {
    id: 'gpt-4.1-nano',
    provider: 'openai',
    name: 'GPT-4.1 Nano',
    description: 'Ultra-fast, lowest cost — ideal for simple extraction',
    contextTokens: 1_048_576,
    pricing: { input: 0.1, output: 0.4 },
    ratings: { extraction: 75, synthesis: 72, reasoning: 68, writing: 70 },
  },
  {
    id: 'o3',
    provider: 'openai',
    name: 'o3',
    description: 'Advanced reasoning model with extended thinking',
    contextTokens: 200_000,
    pricing: { input: 10.0, output: 40.0 },
    ratings: { extraction: 90, synthesis: 92, reasoning: 99, writing: 88 },
  },
  {
    id: 'o3-mini',
    provider: 'openai',
    name: 'o3-mini',
    description: 'Compact reasoning model — fast and efficient',
    contextTokens: 200_000,
    pricing: { input: 1.1, output: 4.4 },
    ratings: { extraction: 82, synthesis: 83, reasoning: 91, writing: 80 },
  },
  {
    id: 'o4-mini',
    provider: 'openai',
    name: 'o4-mini',
    description: 'Latest cost-effective reasoning model',
    contextTokens: 200_000,
    pricing: { input: 1.1, output: 4.4 },
    ratings: { extraction: 84, synthesis: 85, reasoning: 93, writing: 82 },
  },
  {
    id: 'gpt-4o',
    provider: 'openai',
    name: 'GPT-4o',
    description: 'Multimodal flagship with vision and audio',
    contextTokens: 128_000,
    pricing: { input: 2.5, output: 10.0 },
    ratings: { extraction: 90, synthesis: 91, reasoning: 92, writing: 91 },
  },
  {
    id: 'gpt-4o-mini',
    provider: 'openai',
    name: 'GPT-4o Mini',
    description: 'Compact multimodal model',
    contextTokens: 128_000,
    pricing: { input: 0.15, output: 0.6 },
    ratings: { extraction: 80, synthesis: 80, reasoning: 78, writing: 79 },
  },
  {
    id: 'gpt-4-turbo',
    provider: 'openai',
    name: 'GPT-4 Turbo',
    description: 'Previous generation flagship with vision',
    contextTokens: 128_000,
    pricing: { input: 10.0, output: 30.0 },
    ratings: { extraction: 88, synthesis: 89, reasoning: 90, writing: 90 },
  },
  {
    id: 'gpt-3.5-turbo',
    provider: 'openai',
    name: 'GPT-3.5 Turbo',
    description: 'Legacy fast model — lowest cost for simple tasks',
    contextTokens: 16_385,
    pricing: { input: 0.5, output: 1.5 },
    ratings: { extraction: 72, synthesis: 70, reasoning: 65, writing: 72 },
  },

  // ── Anthropic ──
  {
    id: 'claude-opus-4',
    provider: 'anthropic',
    name: 'Claude Opus 4',
    description: 'Most capable Anthropic model — superior reasoning and analysis',
    contextTokens: 200_000,
    pricing: { input: 15.0, output: 75.0 },
    ratings: { extraction: 96, synthesis: 97, reasoning: 98, writing: 97 },
  },
  {
    id: 'claude-sonnet-4-6',
    provider: 'anthropic',
    name: 'Claude Sonnet 4.6',
    description: 'Best balance of quality & speed — excellent for structured extraction',
    contextTokens: 200_000,
    pricing: { input: 3.0, output: 15.0 },
    ratings: { extraction: 95, synthesis: 94, reasoning: 94, writing: 96 },
  },
  {
    id: 'claude-3.5-sonnet',
    provider: 'anthropic',
    name: 'Claude 3.5 Sonnet',
    description: 'Previous generation Sonnet — excellent writing quality',
    contextTokens: 200_000,
    pricing: { input: 3.0, output: 15.0 },
    ratings: { extraction: 92, synthesis: 91, reasoning: 91, writing: 94 },
  },
  {
    id: 'claude-haiku-3.5',
    provider: 'anthropic',
    name: 'Claude Haiku 3.5',
    description: 'Ultra-fast and affordable — great for high-volume tasks',
    contextTokens: 200_000,
    pricing: { input: 0.8, output: 4.0 },
    ratings: { extraction: 82, synthesis: 80, reasoning: 78, writing: 80 },
  },
  {
    id: 'claude-3-haiku',
    provider: 'anthropic',
    name: 'Claude 3 Haiku',
    description: 'Legacy compact model — near-instant responses',
    contextTokens: 200_000,
    pricing: { input: 0.25, output: 1.25 },
    ratings: { extraction: 75, synthesis: 73, reasoning: 70, writing: 74 },
  },

  // ── Google ──
  {
    id: 'gemini-2.5-pro',
    provider: 'google',
    name: 'Gemini 2.5 Pro',
    description: 'Thinking model — advanced reasoning with long context',
    contextTokens: 1_048_576,
    pricing: { input: 1.25, output: 10.0 },
    ratings: { extraction: 93, synthesis: 93, reasoning: 96, writing: 92 },
  },
  {
    id: 'gemini-2.5-flash',
    provider: 'google',
    name: 'Gemini 2.5 Flash',
    description: 'Fast thinking model — good for everyday workloads',
    contextTokens: 1_048_576,
    pricing: { input: 0.15, output: 0.6 },
    ratings: { extraction: 86, synthesis: 85, reasoning: 87, writing: 84 },
  },
  {
    id: 'gemini-2.0-flash',
    provider: 'google',
    name: 'Gemini 2.0 Flash',
    description: 'Balanced speed and quality with multimodal support',
    contextTokens: 1_048_576,
    pricing: { input: 0.1, output: 0.4 },
    ratings: { extraction: 82, synthesis: 80, reasoning: 80, writing: 78 },
  },
  {
    id: 'gemini-2.0-flash-lite',
    provider: 'google',
    name: 'Gemini 2.0 Flash-Lite',
    description: 'Lightweight and cost-efficient for simple tasks',
    contextTokens: 1_048_576,
    pricing: { input: 0.04, output: 0.15 },
    ratings: { extraction: 72, synthesis: 70, reasoning: 68, writing: 68 },
  },
  {
    id: 'gemini-1.5-pro',
    provider: 'google',
    name: 'Gemini 1.5 Pro',
    description: 'Previous gen with 2M context for very long documents',
    contextTokens: 2_097_152,
    pricing: { input: 1.25, output: 5.0 },
    ratings: { extraction: 88, synthesis: 87, reasoning: 88, writing: 86 },
  },
  {
    id: 'gemini-1.5-flash',
    provider: 'google',
    name: 'Gemini 1.5 Flash',
    description: 'Previous gen fast model with long context',
    contextTokens: 1_048_576,
    pricing: { input: 0.075, output: 0.3 },
    ratings: { extraction: 78, synthesis: 76, reasoning: 75, writing: 74 },
  },

  // ── Groq ──
  {
    id: 'llama-3.3-70b-versatile',
    provider: 'groq',
    name: 'Llama 3.3 70B',
    description: 'High-quality open model with blazing-fast inference',
    contextTokens: 128_000,
    pricing: { input: 0.59, output: 0.79 },
    ratings: { extraction: 83, synthesis: 82, reasoning: 82, writing: 81 },
  },
  {
    id: 'llama-3.1-70b-versatile',
    provider: 'groq',
    name: 'Llama 3.1 70B',
    description: 'Previous gen 70B — strong general performance',
    contextTokens: 128_000,
    pricing: { input: 0.59, output: 0.79 },
    ratings: { extraction: 80, synthesis: 79, reasoning: 80, writing: 78 },
  },
  {
    id: 'llama-3.1-8b-instant',
    provider: 'groq',
    name: 'Llama 3.1 8B',
    description: 'Ultra-fast small model — best for low-latency tasks',
    contextTokens: 128_000,
    pricing: { input: 0.05, output: 0.08 },
    ratings: { extraction: 68, synthesis: 65, reasoning: 62, writing: 64 },
  },
  {
    id: 'llama-3.2-3b-preview',
    provider: 'groq',
    name: 'Llama 3.2 3B',
    description: 'Compact model — fastest latency for basic tasks',
    contextTokens: 128_000,
    pricing: { input: 0.06, output: 0.06 },
    ratings: { extraction: 62, synthesis: 58, reasoning: 55, writing: 58 },
  },
  {
    id: 'mixtral-8x7b-32768',
    provider: 'groq',
    name: 'Mixtral 8x7B',
    description: 'Sparse MoE model with strong multilingual performance',
    contextTokens: 32_768,
    pricing: { input: 0.24, output: 0.24 },
    ratings: { extraction: 75, synthesis: 74, reasoning: 73, writing: 74 },
  },
  {
    id: 'gemma2-9b-it',
    provider: 'groq',
    name: 'Gemma 2 9B',
    description: 'Google Gemma — compact and efficient',
    contextTokens: 8_192,
    pricing: { input: 0.2, output: 0.2 },
    ratings: { extraction: 70, synthesis: 68, reasoning: 66, writing: 68 },
  },
  {
    id: 'deepseek-r1-distill-llama-70b',
    provider: 'groq',
    name: 'DeepSeek R1 70B',
    description: 'Reasoning-focused distilled model',
    contextTokens: 128_000,
    pricing: { input: 0.75, output: 0.99 },
    ratings: { extraction: 80, synthesis: 80, reasoning: 88, writing: 78 },
  },
  {
    id: 'qwen-qwq-32b',
    provider: 'groq',
    name: 'Qwen QwQ 32B',
    description: 'Alibaba reasoning model with strong multilingual',
    contextTokens: 128_000,
    pricing: { input: 0.29, output: 0.39 },
    ratings: { extraction: 78, synthesis: 76, reasoning: 85, writing: 75 },
  },

  // ── Ollama (local, free) ──
  {
    id: 'llama3.2:latest',
    provider: 'ollama',
    name: 'Llama 3.2 (local)',
    description: 'Run Llama 3.2 locally — no API costs',
    contextTokens: 128_000,
    pricing: { input: 0, output: 0 },
    ratings: { extraction: 72, synthesis: 70, reasoning: 68, writing: 70 },
  },
  {
    id: 'llama3.1:latest',
    provider: 'ollama',
    name: 'Llama 3.1 8B (local)',
    description: 'Run Llama 3.1 8B locally — solid general performance',
    contextTokens: 128_000,
    pricing: { input: 0, output: 0 },
    ratings: { extraction: 68, synthesis: 65, reasoning: 62, writing: 64 },
  },
  {
    id: 'llama3.1:70b',
    provider: 'ollama',
    name: 'Llama 3.1 70B (local)',
    description: 'Large local model — needs 40GB+ VRAM',
    contextTokens: 128_000,
    pricing: { input: 0, output: 0 },
    ratings: { extraction: 80, synthesis: 79, reasoning: 80, writing: 78 },
  },
  {
    id: 'mistral:latest',
    provider: 'ollama',
    name: 'Mistral 7B (local)',
    description: 'Run Mistral locally — fast inference on CPU',
    contextTokens: 32_768,
    pricing: { input: 0, output: 0 },
    ratings: { extraction: 68, synthesis: 66, reasoning: 64, writing: 66 },
  },
  {
    id: 'mixtral:latest',
    provider: 'ollama',
    name: 'Mixtral 8x7B (local)',
    description: 'MoE model — strong multilingual, needs 26GB+',
    contextTokens: 32_768,
    pricing: { input: 0, output: 0 },
    ratings: { extraction: 75, synthesis: 74, reasoning: 73, writing: 74 },
  },
  {
    id: 'phi3:latest',
    provider: 'ollama',
    name: 'Phi-3 (local)',
    description: 'Microsoft Phi-3 — small but capable',
    contextTokens: 128_000,
    pricing: { input: 0, output: 0 },
    ratings: { extraction: 70, synthesis: 68, reasoning: 72, writing: 67 },
  },
  {
    id: 'gemma2:latest',
    provider: 'ollama',
    name: 'Gemma 2 9B (local)',
    description: 'Google Gemma 2 — efficient and accurate',
    contextTokens: 8_192,
    pricing: { input: 0, output: 0 },
    ratings: { extraction: 70, synthesis: 68, reasoning: 66, writing: 68 },
  },
  {
    id: 'qwen2.5:latest',
    provider: 'ollama',
    name: 'Qwen 2.5 (local)',
    description: 'Alibaba Qwen — strong multilingual support',
    contextTokens: 32_768,
    pricing: { input: 0, output: 0 },
    ratings: { extraction: 71, synthesis: 69, reasoning: 70, writing: 69 },
  },
  {
    id: 'deepseek-r1:latest',
    provider: 'ollama',
    name: 'DeepSeek R1 (local)',
    description: 'Reasoning-focused model — strong at analysis',
    contextTokens: 128_000,
    pricing: { input: 0, output: 0 },
    ratings: { extraction: 78, synthesis: 77, reasoning: 86, writing: 75 },
  },
  {
    id: 'nomic-embed-text:latest',
    provider: 'ollama',
    name: 'Nomic Embed (local)',
    description: 'Text embedding model for vector search',
    contextTokens: 8_192,
    pricing: { input: 0, output: 0 },
    ratings: { extraction: 60, synthesis: 40, reasoning: 30, writing: 30 },
  },

  // ── OpenRouter (popular models as offline fallback) ──
  {
    id: 'anthropic/claude-sonnet-4-6',
    provider: 'openrouter',
    name: 'Claude Sonnet 4.6 (OR)',
    description: 'Claude Sonnet 4.6 via OpenRouter gateway',
    contextTokens: 200_000,
    pricing: { input: 3.0, output: 15.0 },
    ratings: { extraction: 95, synthesis: 94, reasoning: 94, writing: 96 },
  },
  {
    id: 'anthropic/claude-opus-4',
    provider: 'openrouter',
    name: 'Claude Opus 4 (OR)',
    description: 'Claude Opus 4 via OpenRouter — most powerful',
    contextTokens: 200_000,
    pricing: { input: 15.0, output: 75.0 },
    ratings: { extraction: 96, synthesis: 97, reasoning: 98, writing: 97 },
  },
  {
    id: 'openai/gpt-4.1',
    provider: 'openrouter',
    name: 'GPT-4.1 (OR)',
    description: 'GPT-4.1 via OpenRouter gateway',
    contextTokens: 1_048_576,
    pricing: { input: 2.0, output: 8.0 },
    ratings: { extraction: 92, synthesis: 94, reasoning: 95, writing: 93 },
  },
  {
    id: 'openai/gpt-4.1-mini',
    provider: 'openrouter',
    name: 'GPT-4.1 Mini (OR)',
    description: 'GPT-4.1 Mini via OpenRouter gateway',
    contextTokens: 1_048_576,
    pricing: { input: 0.4, output: 1.6 },
    ratings: { extraction: 85, synthesis: 86, reasoning: 84, writing: 85 },
  },
  {
    id: 'openai/o3',
    provider: 'openrouter',
    name: 'o3 (OR)',
    description: 'OpenAI o3 reasoning model via OpenRouter',
    contextTokens: 200_000,
    pricing: { input: 10.0, output: 40.0 },
    ratings: { extraction: 90, synthesis: 92, reasoning: 99, writing: 88 },
  },
  {
    id: 'google/gemini-2.5-pro',
    provider: 'openrouter',
    name: 'Gemini 2.5 Pro (OR)',
    description: 'Gemini 2.5 Pro via OpenRouter gateway',
    contextTokens: 1_048_576,
    pricing: { input: 1.25, output: 10.0 },
    ratings: { extraction: 93, synthesis: 93, reasoning: 96, writing: 92 },
  },
  {
    id: 'google/gemini-2.5-flash',
    provider: 'openrouter',
    name: 'Gemini 2.5 Flash (OR)',
    description: 'Gemini 2.5 Flash via OpenRouter gateway',
    contextTokens: 1_048_576,
    pricing: { input: 0.15, output: 0.6 },
    ratings: { extraction: 86, synthesis: 85, reasoning: 87, writing: 84 },
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct',
    provider: 'openrouter',
    name: 'Llama 3.3 70B (OR)',
    description: 'Llama 3.3 via OpenRouter — open-source strength',
    contextTokens: 128_000,
    pricing: { input: 0.39, output: 0.39 },
    ratings: { extraction: 83, synthesis: 82, reasoning: 82, writing: 81 },
  },
  {
    id: 'deepseek/deepseek-r1',
    provider: 'openrouter',
    name: 'DeepSeek R1 (OR)',
    description: 'DeepSeek R1 — advanced reasoning via OpenRouter',
    contextTokens: 128_000,
    pricing: { input: 0.55, output: 2.19 },
    ratings: { extraction: 85, synthesis: 84, reasoning: 92, writing: 82 },
  },
  {
    id: 'deepseek/deepseek-chat',
    provider: 'openrouter',
    name: 'DeepSeek V3 (OR)',
    description: 'DeepSeek V3 chat model — excellent value',
    contextTokens: 128_000,
    pricing: { input: 0.27, output: 1.1 },
    ratings: { extraction: 82, synthesis: 81, reasoning: 84, writing: 80 },
  },
  {
    id: 'mistralai/mistral-large-2',
    provider: 'openrouter',
    name: 'Mistral Large 2 (OR)',
    description: 'Mistral Large 2 via OpenRouter',
    contextTokens: 128_000,
    pricing: { input: 2.0, output: 6.0 },
    ratings: { extraction: 84, synthesis: 83, reasoning: 84, writing: 83 },
  },
  {
    id: 'mistralai/mistral-small-3.2',
    provider: 'openrouter',
    name: 'Mistral Small 3.2 (OR)',
    description: 'Mistral Small — fast and efficient',
    contextTokens: 128_000,
    pricing: { input: 0.1, output: 0.3 },
    ratings: { extraction: 74, synthesis: 72, reasoning: 70, writing: 72 },
  },
  {
    id: 'qwen/qwen-2.5-72b-instruct',
    provider: 'openrouter',
    name: 'Qwen 2.5 72B (OR)',
    description: 'Qwen 2.5 72B via OpenRouter',
    contextTokens: 128_000,
    pricing: { input: 0.36, output: 0.36 },
    ratings: { extraction: 82, synthesis: 80, reasoning: 83, writing: 80 },
  },
  {
    id: 'cohere/command-r-plus',
    provider: 'openrouter',
    name: 'Command R+ (OR)',
    description: 'Cohere Command R+ — strong for RAG and retrieval',
    contextTokens: 128_000,
    pricing: { input: 2.5, output: 10.0 },
    ratings: { extraction: 86, synthesis: 84, reasoning: 82, writing: 83 },
  },
  {
    id: 'x-ai/grok-3',
    provider: 'openrouter',
    name: 'Grok 3 (OR)',
    description: 'xAI Grok 3 — competitive flagship model',
    contextTokens: 131_072,
    pricing: { input: 3.0, output: 15.0 },
    ratings: { extraction: 88, synthesis: 87, reasoning: 90, writing: 86 },
  },
];

export function getModelsForProvider(provider: string): ModelSpec[] {
  return MODEL_REGISTRY.filter((m) => m.provider === provider);
}

export function getModelById(id: string): ModelSpec | undefined {
  return MODEL_REGISTRY.find((m) => m.id === id);
}

export function avgRating(m: ModelSpec): number {
  const r = m.ratings;
  return Math.round((r.extraction + r.synthesis + r.reasoning + r.writing) / 4);
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

export function formatCost(n: number): string {
  if (n === 0) return 'Free';
  if (n < 0.01) return '<$0.01';
  return `$${n.toFixed(2)}`;
}

/**
 * Estimate quality ratings from OpenRouter API quality scores + pricing.
 * Maps: extraction ≈ instruction, synthesis ≈ overall, reasoning, writing ≈ avg(overall+instruction).
 */
export function estimateRatingsFromApi(
  qualityScores: {
    overall?: number;
    reasoning?: number;
    coding?: number;
    instruction?: number;
  } | null,
  pricingInputPerM: number,
): { extraction: number; synthesis: number; reasoning: number; writing: number } {
  if (qualityScores && qualityScores.overall != null) {
    const overall = qualityScores.overall;
    const reasoning = qualityScores.reasoning ?? overall;
    const instruction = qualityScores.instruction ?? overall;
    return {
      extraction: Math.round(instruction * 0.8 + overall * 0.2),
      synthesis: Math.round(overall),
      reasoning: Math.round(reasoning),
      writing: Math.round((overall + instruction) / 2),
    };
  }
  // Estimate from price tier
  if (pricingInputPerM >= 10) return { extraction: 88, synthesis: 90, reasoning: 92, writing: 89 };
  if (pricingInputPerM >= 3) return { extraction: 85, synthesis: 86, reasoning: 87, writing: 85 };
  if (pricingInputPerM >= 1) return { extraction: 80, synthesis: 80, reasoning: 80, writing: 80 };
  if (pricingInputPerM >= 0.1) return { extraction: 72, synthesis: 70, reasoning: 70, writing: 70 };
  return { extraction: 65, synthesis: 63, reasoning: 60, writing: 62 };
}

/**
 * Agent-specific fit scores (1–10 scale) based on model capabilities.
 * Ported from Lexio's `inferFitScores()` pattern.
 */
export type AgentFitKey =
  | 'summarize'
  | 'actionItems'
  | 'mindmap'
  | 'chapters'
  | 'chat'
  | 'embed'
  | 'transcribe';

const AGENT_WEIGHT_MAP: Record<
  AgentFitKey,
  { extraction: number; synthesis: number; reasoning: number; writing: number }
> = {
  summarize: { extraction: 0.2, synthesis: 0.35, reasoning: 0.15, writing: 0.3 },
  actionItems: { extraction: 0.4, synthesis: 0.2, reasoning: 0.2, writing: 0.2 },
  mindmap: { extraction: 0.3, synthesis: 0.3, reasoning: 0.25, writing: 0.15 },
  chapters: { extraction: 0.35, synthesis: 0.25, reasoning: 0.2, writing: 0.2 },
  chat: { extraction: 0.15, synthesis: 0.2, reasoning: 0.35, writing: 0.3 },
  embed: { extraction: 0.5, synthesis: 0.3, reasoning: 0.1, writing: 0.1 },
  transcribe: { extraction: 0.6, synthesis: 0.1, reasoning: 0.1, writing: 0.2 },
};

export function inferFitScore(model: ModelSpec, agentKey: AgentFitKey): number {
  const weights = AGENT_WEIGHT_MAP[agentKey];
  const r = model.ratings;
  const raw =
    r.extraction * weights.extraction +
    r.synthesis * weights.synthesis +
    r.reasoning * weights.reasoning +
    r.writing * weights.writing;
  // Map 0–100 rating → 1–10 scale
  return Math.max(1, Math.min(10, Math.round(raw / 10)));
}

export function isModelCompatibleWithAgent(model: ModelSpec, agentKey: AgentFitKey): boolean {
  const haystack = `${model.id} ${model.name} ${model.description}`.toLowerCase();

  if (agentKey === 'embed') {
    return haystack.includes('embed') || haystack.includes('embedding');
  }

  if (agentKey === 'transcribe') {
    return (
      haystack.includes('whisper') ||
      haystack.includes('transcribe') ||
      haystack.includes('speech') ||
      haystack.includes('stt')
    );
  }

  return inferFitScore(model, agentKey) >= 5;
}

/**
 * Convert an OpenRouter API model to a ModelSpec.
 * Ported from Lexio's `openRouterToModelOption()`.
 */
export function openRouterToModelSpec(apiModel: {
  id: string;
  name?: string;
  description?: string;
  context_length?: number;
  pricing?: { prompt?: string; completion?: string };
  quality_scores?: { overall?: number; reasoning?: number; coding?: number; instruction?: number };
}): ModelSpec {
  const inputPerM = apiModel.pricing?.prompt ? Number(apiModel.pricing.prompt) * 1_000_000 : 0;
  const outputPerM = apiModel.pricing?.completion
    ? Number(apiModel.pricing.completion) * 1_000_000
    : 0;
  return {
    id: apiModel.id,
    provider: 'openrouter',
    name: apiModel.name ?? apiModel.id.split('/').pop() ?? apiModel.id,
    description: apiModel.description ?? '',
    contextTokens: apiModel.context_length ?? 128_000,
    pricing: { input: inputPerM, output: outputPerM },
    ratings: estimateRatingsFromApi(apiModel.quality_scores ?? null, inputPerM),
  };
}
