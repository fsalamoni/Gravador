import { getServerDb, getSessionUser } from '@/lib/firebase-server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * POST /api/models/health-check
 * Runs a server-side model health check: compares the user's selected models
 * against the OpenRouter catalog cached in Firestore.
 *
 * Body: { selectedModels: string[], agentModels: Record<string, string> }
 * Returns: { removedModels: string[], clearedAgents: string[], catalogSize: number }
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await req.json()) as {
    selectedModels?: string[];
    agentModels?: Record<string, string>;
  };

  const selectedModels = body.selectedModels ?? [];
  const agentModels = body.agentModels ?? {};

  const db = getServerDb();

  // Fetch all available OpenRouter model IDs from our cached catalog
  const snap = await db
    .collection('model_catalog')
    .where('catalogProvider', '==', 'openrouter')
    .where('available', '==', true)
    .select('modelId')
    .get();

  const liveIds = new Set(snap.docs.map((d) => d.data().modelId as string));

  // Only check OpenRouter models (they have "/" in the ID)
  const orModels = selectedModels.filter((id) => id.includes('/'));
  const removedModels = orModels.filter((id) => !liveIds.has(id));
  const removedSet = new Set(removedModels);

  const clearedAgents: string[] = [];
  for (const [agentKey, modelId] of Object.entries(agentModels)) {
    if (removedSet.has(modelId)) {
      clearedAgents.push(agentKey);
    }
  }

  return NextResponse.json({
    removedModels,
    clearedAgents,
    catalogSize: selectedModels.length - removedModels.length,
    checkedAt: new Date().toISOString(),
  });
}
