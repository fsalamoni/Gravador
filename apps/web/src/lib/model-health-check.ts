/**
 * Model Health Check — validates the user's personal model catalog against the
 * live OpenRouter API to remove unavailable models and clear stale agent configs.
 *
 * Inspired by Lexio's model-health-check pattern:
 * - Runs once per session (on settings page load)
 * - Can be triggered manually via the UI
 * - Compares local catalog against live OpenRouter model list
 * - Removes unavailable models from personal catalog
 * - Clears agent configs that reference removed models
 */

const HEALTH_CHECK_STORAGE_KEY = 'nexus:model-health-check-ts';
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

let sessionCheckDone = false;

export interface HealthCheckResult {
  removedModels: string[];
  clearedAgents: string[];
  catalogSize: number;
  didRun: boolean;
}

/**
 * Fetch the live model list from OpenRouter (via our caching API or direct).
 * Returns a Set of model IDs that are currently available.
 */
async function fetchLiveModelIds(): Promise<Set<string>> {
  // Try our API first (cached in Firestore, 6h staleness)
  const res = await fetch('/api/models?provider=openrouter');
  if (res.ok) {
    const data = (await res.json()) as { models?: Array<{ modelId: string }> };
    if (data.models && data.models.length > 0) {
      return new Set(data.models.map((m) => m.modelId));
    }
  }
  // Fallback: direct OpenRouter API
  const directRes = await fetch('https://openrouter.ai/api/v1/models');
  if (!directRes.ok) throw new Error(`OpenRouter API ${directRes.status}`);
  const json = (await directRes.json()) as { data?: Array<{ id: string }> };
  return new Set((json.data ?? []).map((m) => m.id));
}

/**
 * Run the model health check. Compares the user's selected models and agent
 * model configs against the live OpenRouter catalog.
 *
 * @param selectedModels - Current personal catalog model IDs
 * @param agentModels - Current agent model mapping (agentKey → modelId)
 * @param force - Bypass the 24h interval guard
 * @returns Result with removed models and cleared agents
 */
export async function runModelHealthCheck(
  selectedModels: string[],
  agentModels: Record<string, string>,
  force = false,
): Promise<HealthCheckResult> {
  const noop: HealthCheckResult = {
    removedModels: [],
    clearedAgents: [],
    catalogSize: selectedModels.length,
    didRun: false,
  };

  // Session guard
  if (sessionCheckDone && !force) return noop;

  // Interval guard
  if (!force) {
    const lastRun = localStorage.getItem(HEALTH_CHECK_STORAGE_KEY);
    if (lastRun && Date.now() - Number(lastRun) < CHECK_INTERVAL_MS) {
      sessionCheckDone = true;
      return noop;
    }
  }

  sessionCheckDone = true;

  // Only check OpenRouter models (they have "/" in the ID)
  const orModels = selectedModels.filter((id) => id.includes('/'));
  if (orModels.length === 0) {
    localStorage.setItem(HEALTH_CHECK_STORAGE_KEY, String(Date.now()));
    return { ...noop, didRun: true };
  }

  const liveIds = await fetchLiveModelIds();
  if (liveIds.size === 0) return noop; // API failure, don't remove anything

  const removedModels = orModels.filter((id) => !liveIds.has(id));
  const removedSet = new Set(removedModels);

  // Find agents that reference removed models
  const clearedAgents: string[] = [];
  for (const [agentKey, modelId] of Object.entries(agentModels)) {
    if (removedSet.has(modelId)) {
      clearedAgents.push(agentKey);
    }
  }

  localStorage.setItem(HEALTH_CHECK_STORAGE_KEY, String(Date.now()));

  return {
    removedModels,
    clearedAgents,
    catalogSize: selectedModels.length - removedModels.length,
    didRun: true,
  };
}

/**
 * Format health check results for display as a toast notification.
 */
export function formatHealthCheckMessage(result: HealthCheckResult): {
  title: string;
  message: string;
} | null {
  if (!result.didRun || result.removedModels.length === 0) return null;

  const models = result.removedModels.join(', ');
  const agentCount = result.clearedAgents.length;

  return {
    title: `${result.removedModels.length} modelo(s) removido(s)`,
    message:
      agentCount > 0
        ? `Modelos indisponíveis no OpenRouter removidos: ${models}. ${agentCount} agente(s) precisam de novo modelo nas Configurações.`
        : `Modelos indisponíveis no OpenRouter removidos: ${models}.`,
  };
}
