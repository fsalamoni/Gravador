import type { ModelSpec } from './model-registry';

export type CatalogProvider = 'openrouter' | 'openai' | 'anthropic' | 'google' | 'groq' | 'ollama';

export interface EmbeddingProviderRule {
  supported: boolean;
  acceptedModels: string[];
  note: string;
}

export const EMBEDDING_MODEL_RULES: Record<CatalogProvider, EmbeddingProviderRule> = {
  openrouter: {
    supported: false,
    acceptedModels: [],
    note: 'Embeddings via OpenRouter are not consumed directly by the current pipeline.',
  },
  openai: {
    supported: true,
    acceptedModels: ['text-embedding-3-small', 'text-embedding-3-large', 'text-embedding-ada-002'],
    note: 'Native embedding support in pipeline (requires OPENAI_API_KEY).',
  },
  anthropic: {
    supported: false,
    acceptedModels: [],
    note: 'Anthropic is enabled for LLM/chat only in this flow.',
  },
  google: {
    supported: false,
    acceptedModels: [],
    note: 'Google is enabled for LLM/chat only in this flow.',
  },
  groq: {
    supported: false,
    acceptedModels: [],
    note: 'Groq is enabled for chat/transcription only in this flow.',
  },
  ollama: {
    supported: true,
    acceptedModels: [
      'nomic-embed-text',
      'nomic-embed-text:latest',
      'mxbai-embed-large',
      'mxbai-embed-large:latest',
      'all-minilm',
      'all-minilm:latest',
    ],
    note: 'Native embedding support via local Ollama /api/embeddings endpoint.',
  },
};

export function resolvePersonalCatalogModels(
  selectedModelIds: string[],
  findModelById: (id: string) => ModelSpec | undefined,
): { models: ModelSpec[]; unresolvedModelIds: string[] } {
  const models: ModelSpec[] = [];
  const unresolvedModelIds: string[] = [];
  const seen = new Set<string>();

  for (const modelId of selectedModelIds) {
    if (seen.has(modelId)) continue;
    seen.add(modelId);

    const model = findModelById(modelId);
    if (model) models.push(model);
    else unresolvedModelIds.push(modelId);
  }

  return { models, unresolvedModelIds };
}

export function resolveAgentCatalogModels(
  selectedModelIds: string[],
  selectedProvider: CatalogProvider,
  getProviderModels: (provider: string) => ModelSpec[],
  findModelById: (id: string) => ModelSpec | undefined,
): ModelSpec[] {
  if (selectedModelIds.length === 0) {
    return getProviderModels(selectedProvider);
  }

  return resolvePersonalCatalogModels(selectedModelIds, findModelById).models;
}
