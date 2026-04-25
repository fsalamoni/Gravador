import { describe, expect, it } from 'vitest';
import type { ModelSpec } from './model-registry';
import {
  EMBEDDING_MODEL_RULES,
  resolveAgentCatalogModels,
  resolvePersonalCatalogModels,
} from './settings-model-catalog';

function makeModel(id: string, provider: ModelSpec['provider']): ModelSpec {
  return {
    id,
    provider,
    name: id,
    description: `${provider}:${id}`,
    contextTokens: 128000,
    pricing: { input: 1, output: 2 },
    ratings: { extraction: 80, synthesis: 80, reasoning: 80, writing: 80 },
  };
}

const OPENAI_MODEL = makeModel('gpt-4.1', 'openai');
const OLLAMA_MODEL = makeModel('nomic-embed-text', 'ollama');
const REGISTRY = [OPENAI_MODEL, OLLAMA_MODEL];

const findModelById = (id: string) => REGISTRY.find((model) => model.id === id);
const getProviderModels = (provider: string) =>
  REGISTRY.filter((model) => model.provider === provider);

describe('settings-model-catalog', () => {
  it('returns provider catalog when personal catalog is empty', () => {
    const models = resolveAgentCatalogModels([], 'openai', getProviderModels, findModelById);

    expect(models).toEqual([OPENAI_MODEL]);
  });

  it('returns all selected personal models across providers for agent selection', () => {
    const models = resolveAgentCatalogModels(
      ['gpt-4.1', 'nomic-embed-text'],
      'openai',
      getProviderModels,
      findModelById,
    );

    expect(models).toEqual([OPENAI_MODEL, OLLAMA_MODEL]);
  });

  it('deduplicates model ids and reports unresolved entries', () => {
    const result = resolvePersonalCatalogModels(
      ['gpt-4.1', 'gpt-4.1', 'missing-model', 'nomic-embed-text'],
      findModelById,
    );

    expect(result.models).toEqual([OPENAI_MODEL, OLLAMA_MODEL]);
    expect(result.unresolvedModelIds).toEqual(['missing-model']);
  });

  it('keeps embedding support matrix explicit for supported and unsupported providers', () => {
    expect(EMBEDDING_MODEL_RULES.openai.supported).toBe(true);
    expect(EMBEDDING_MODEL_RULES.ollama.supported).toBe(true);
    expect(EMBEDDING_MODEL_RULES.openrouter.supported).toBe(false);
    expect(EMBEDDING_MODEL_RULES.openai.acceptedModels).toContain('text-embedding-3-small');
  });
});
