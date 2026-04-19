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
  { id: 'gpt-4.1', provider: 'openai', name: 'GPT-4.1', description: 'Flagship model — excellent at complex reasoning and long-form generation', contextTokens: 1_048_576, pricing: { input: 2.0, output: 8.0 }, ratings: { extraction: 92, synthesis: 94, reasoning: 95, writing: 93 } },
  { id: 'gpt-4.1-mini', provider: 'openai', name: 'GPT-4.1 Mini', description: 'Balanced cost-performance for everyday tasks', contextTokens: 1_048_576, pricing: { input: 0.4, output: 1.6 }, ratings: { extraction: 85, synthesis: 86, reasoning: 84, writing: 85 } },
  { id: 'gpt-4.1-nano', provider: 'openai', name: 'GPT-4.1 Nano', description: 'Ultra-fast, lowest cost — ideal for simple extraction', contextTokens: 1_048_576, pricing: { input: 0.1, output: 0.4 }, ratings: { extraction: 75, synthesis: 72, reasoning: 68, writing: 70 } },
  { id: 'o3', provider: 'openai', name: 'o3', description: 'Advanced reasoning model with extended thinking', contextTokens: 200_000, pricing: { input: 10.0, output: 40.0 }, ratings: { extraction: 90, synthesis: 92, reasoning: 99, writing: 88 } },
  { id: 'o4-mini', provider: 'openai', name: 'o4-mini', description: 'Cost-effective reasoning model', contextTokens: 200_000, pricing: { input: 1.1, output: 4.4 }, ratings: { extraction: 82, synthesis: 83, reasoning: 90, writing: 80 } },
  { id: 'gpt-4o', provider: 'openai', name: 'GPT-4o', description: 'Multimodal flagship with vision and audio', contextTokens: 128_000, pricing: { input: 2.5, output: 10.0 }, ratings: { extraction: 90, synthesis: 91, reasoning: 92, writing: 91 } },
  { id: 'gpt-4o-mini', provider: 'openai', name: 'GPT-4o Mini', description: 'Compact multimodal model', contextTokens: 128_000, pricing: { input: 0.15, output: 0.6 }, ratings: { extraction: 80, synthesis: 80, reasoning: 78, writing: 79 } },

  // ── Anthropic ──
  { id: 'claude-sonnet-4-6', provider: 'anthropic', name: 'Claude Sonnet 4.6', description: 'Best balance of quality & speed — excellent for structured extraction', contextTokens: 200_000, pricing: { input: 3.0, output: 15.0 }, ratings: { extraction: 95, synthesis: 94, reasoning: 94, writing: 96 } },
  { id: 'claude-opus-4', provider: 'anthropic', name: 'Claude Opus 4', description: 'Most capable Anthropic model — superior reasoning', contextTokens: 200_000, pricing: { input: 15.0, output: 75.0 }, ratings: { extraction: 96, synthesis: 97, reasoning: 98, writing: 97 } },
  { id: 'claude-haiku-3.5', provider: 'anthropic', name: 'Claude Haiku 3.5', description: 'Ultra-fast and affordable — great for high-volume tasks', contextTokens: 200_000, pricing: { input: 0.8, output: 4.0 }, ratings: { extraction: 82, synthesis: 80, reasoning: 78, writing: 80 } },

  // ── Google ──
  { id: 'gemini-2.5-pro', provider: 'google', name: 'Gemini 2.5 Pro', description: 'Thinking model — advanced reasoning with long context', contextTokens: 1_048_576, pricing: { input: 1.25, output: 10.0 }, ratings: { extraction: 93, synthesis: 93, reasoning: 96, writing: 92 } },
  { id: 'gemini-2.5-flash', provider: 'google', name: 'Gemini 2.5 Flash', description: 'Fast thinking model — good for everyday workloads', contextTokens: 1_048_576, pricing: { input: 0.15, output: 0.6 }, ratings: { extraction: 86, synthesis: 85, reasoning: 87, writing: 84 } },
  { id: 'gemini-2.0-flash', provider: 'google', name: 'Gemini 2.0 Flash', description: 'Balanced speed and quality with multimodal support', contextTokens: 1_048_576, pricing: { input: 0.1, output: 0.4 }, ratings: { extraction: 82, synthesis: 80, reasoning: 80, writing: 78 } },
  { id: 'gemini-2.0-flash-lite', provider: 'google', name: 'Gemini 2.0 Flash-Lite', description: 'Lightweight and cost-efficient for simple tasks', contextTokens: 1_048_576, pricing: { input: 0.04, output: 0.15 }, ratings: { extraction: 72, synthesis: 70, reasoning: 68, writing: 68 } },

  // ── Groq ──
  { id: 'llama-3.3-70b-versatile', provider: 'groq', name: 'Llama 3.3 70B', description: 'High-quality open model with blazing-fast inference', contextTokens: 128_000, pricing: { input: 0.59, output: 0.79 }, ratings: { extraction: 83, synthesis: 82, reasoning: 82, writing: 81 } },
  { id: 'llama-3.1-8b-instant', provider: 'groq', name: 'Llama 3.1 8B', description: 'Ultra-fast small model — best for low-latency tasks', contextTokens: 128_000, pricing: { input: 0.05, output: 0.08 }, ratings: { extraction: 68, synthesis: 65, reasoning: 62, writing: 64 } },
  { id: 'mixtral-8x7b-32768', provider: 'groq', name: 'Mixtral 8x7B', description: 'Sparse MoE model with strong multilingual performance', contextTokens: 32_768, pricing: { input: 0.24, output: 0.24 }, ratings: { extraction: 75, synthesis: 74, reasoning: 73, writing: 74 } },
  { id: 'gemma2-9b-it', provider: 'groq', name: 'Gemma 2 9B', description: 'Google Gemma — compact and efficient', contextTokens: 8_192, pricing: { input: 0.2, output: 0.2 }, ratings: { extraction: 70, synthesis: 68, reasoning: 66, writing: 68 } },
  { id: 'deepseek-r1-distill-llama-70b', provider: 'groq', name: 'DeepSeek R1 70B', description: 'Reasoning-focused distilled model', contextTokens: 128_000, pricing: { input: 0.75, output: 0.99 }, ratings: { extraction: 80, synthesis: 80, reasoning: 88, writing: 78 } },

  // ── Ollama (local, free) ──
  { id: 'llama3.2:latest', provider: 'ollama', name: 'Llama 3.2 (local)', description: 'Run Llama 3.2 locally — no API costs', contextTokens: 128_000, pricing: { input: 0, output: 0 }, ratings: { extraction: 72, synthesis: 70, reasoning: 68, writing: 70 } },
  { id: 'mistral:latest', provider: 'ollama', name: 'Mistral 7B (local)', description: 'Run Mistral locally — fast inference on CPU', contextTokens: 32_768, pricing: { input: 0, output: 0 }, ratings: { extraction: 68, synthesis: 66, reasoning: 64, writing: 66 } },
  { id: 'phi3:latest', provider: 'ollama', name: 'Phi-3 (local)', description: 'Microsoft Phi-3 — small but capable', contextTokens: 128_000, pricing: { input: 0, output: 0 }, ratings: { extraction: 70, synthesis: 68, reasoning: 72, writing: 67 } },
  { id: 'qwen2.5:latest', provider: 'ollama', name: 'Qwen 2.5 (local)', description: 'Alibaba Qwen — strong multilingual support', contextTokens: 32_768, pricing: { input: 0, output: 0 }, ratings: { extraction: 71, synthesis: 69, reasoning: 70, writing: 69 } },

  // ── OpenRouter (popular models via gateway) ──
  { id: 'anthropic/claude-sonnet-4-6', provider: 'openrouter', name: 'Claude Sonnet 4.6 (OR)', description: 'Claude Sonnet 4.6 via OpenRouter gateway', contextTokens: 200_000, pricing: { input: 3.0, output: 15.0 }, ratings: { extraction: 95, synthesis: 94, reasoning: 94, writing: 96 } },
  { id: 'openai/gpt-4.1', provider: 'openrouter', name: 'GPT-4.1 (OR)', description: 'GPT-4.1 via OpenRouter gateway', contextTokens: 1_048_576, pricing: { input: 2.0, output: 8.0 }, ratings: { extraction: 92, synthesis: 94, reasoning: 95, writing: 93 } },
  { id: 'openai/gpt-4.1-mini', provider: 'openrouter', name: 'GPT-4.1 Mini (OR)', description: 'GPT-4.1 Mini via OpenRouter gateway', contextTokens: 1_048_576, pricing: { input: 0.4, output: 1.6 }, ratings: { extraction: 85, synthesis: 86, reasoning: 84, writing: 85 } },
  { id: 'google/gemini-2.5-pro', provider: 'openrouter', name: 'Gemini 2.5 Pro (OR)', description: 'Gemini 2.5 Pro via OpenRouter gateway', contextTokens: 1_048_576, pricing: { input: 1.25, output: 10.0 }, ratings: { extraction: 93, synthesis: 93, reasoning: 96, writing: 92 } },
  { id: 'google/gemini-2.5-flash', provider: 'openrouter', name: 'Gemini 2.5 Flash (OR)', description: 'Gemini 2.5 Flash via OpenRouter gateway', contextTokens: 1_048_576, pricing: { input: 0.15, output: 0.6 }, ratings: { extraction: 86, synthesis: 85, reasoning: 87, writing: 84 } },
  { id: 'meta-llama/llama-3.3-70b-instruct', provider: 'openrouter', name: 'Llama 3.3 70B (OR)', description: 'Llama 3.3 via OpenRouter — open-source strength', contextTokens: 128_000, pricing: { input: 0.39, output: 0.39 }, ratings: { extraction: 83, synthesis: 82, reasoning: 82, writing: 81 } },
  { id: 'deepseek/deepseek-r1', provider: 'openrouter', name: 'DeepSeek R1 (OR)', description: 'DeepSeek R1 — advanced reasoning via OpenRouter', contextTokens: 128_000, pricing: { input: 0.55, output: 2.19 }, ratings: { extraction: 85, synthesis: 84, reasoning: 92, writing: 82 } },
  { id: 'mistralai/mistral-large-2', provider: 'openrouter', name: 'Mistral Large 2 (OR)', description: 'Mistral Large 2 via OpenRouter', contextTokens: 128_000, pricing: { input: 2.0, output: 6.0 }, ratings: { extraction: 84, synthesis: 83, reasoning: 84, writing: 83 } },
  { id: 'qwen/qwen-2.5-72b-instruct', provider: 'openrouter', name: 'Qwen 2.5 72B (OR)', description: 'Qwen 2.5 72B via OpenRouter', contextTokens: 128_000, pricing: { input: 0.36, output: 0.36 }, ratings: { extraction: 82, synthesis: 80, reasoning: 83, writing: 80 } },
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
