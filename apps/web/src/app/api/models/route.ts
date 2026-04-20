import { getServerDb, getSessionUser } from '@/lib/firebase-server';
import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/** How long before we consider the catalog stale (6 hours). */
const STALE_MS = 6 * 60 * 60 * 1000;

interface OpenRouterModel {
  id: string;
  name: string;
  description: string;
  context_length: number;
  pricing: {
    prompt: string;
    completion: string;
    request: string;
    image: string;
  };
  architecture: {
    input_modalities: string[];
    output_modalities: string[];
    tokenizer: string;
    instruct_type: string | null;
  };
  top_provider: {
    context_length: number;
    max_completion_tokens: number;
    is_moderated: boolean;
  };
  supported_parameters: string[];
  per_request_limits: unknown;
  quality_scores?: {
    overall?: number;
    reasoning?: number;
    coding?: number;
    instruction?: number;
  };
}

/**
 * GET /api/models?provider=openrouter
 * Returns the cached model catalog for a given provider.
 * If the cache is stale (>6h), fetches fresh data from the provider API.
 */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const provider = searchParams.get('provider') ?? 'openrouter';
  const forceRefresh = searchParams.get('force') === 'true';

  if (provider !== 'openrouter') {
    return NextResponse.json(
      { error: 'unsupported_provider', message: 'Only openrouter catalog is supported for now' },
      { status: 400 },
    );
  }

  const db = getServerDb();
  const metaRef = db.collection('model_catalog_meta').doc(provider);
  const metaSnap = await metaRef.get();
  const meta = metaSnap.data() as { lastFetchedAt?: { toMillis(): number } } | undefined;

  const now = Date.now();
  const lastFetched = meta?.lastFetchedAt?.toMillis() ?? 0;
  const isStale = now - lastFetched > STALE_MS;

  if (isStale || forceRefresh) {
    try {
      await refreshOpenRouterCatalog(db, provider);
    } catch (err) {
      console.error('[models] failed to refresh catalog:', err);
      // Fall through — serve stale data if available
    }
  }

  let models: Array<Record<string, unknown>> = [];
  let queryFailed = false;
  try {
    const modelsSnap = await db
      .collection('model_catalog')
      .where('catalogProvider', '==', provider)
      .where('available', '==', true)
      .orderBy('name')
      .get();

    models = modelsSnap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        modelId: d.modelId,
        name: d.name,
        description: d.description,
        contextLength: d.contextLength,
        maxCompletionTokens: d.maxCompletionTokens,
        pricing: d.pricing,
        inputModalities: d.inputModalities,
        outputModalities: d.outputModalities,
        supportedParameters: d.supportedParameters,
        qualityScores: d.qualityScores ?? null,
        expirationDate: d.expirationDate ?? null,
      };
    });
  } catch (err) {
    console.error('[models] Firestore query failed (missing index?):', err);
    queryFailed = true;
  }

  if (models.length === 0) {
    try {
      const liveModels = await fetchOpenRouterLiveModels();
      if (liveModels.length > 0) {
        console.log(`[models] returning ${liveModels.length} live models for ${provider}`);
        return NextResponse.json({
          provider,
          source: 'openrouter-live',
          count: liveModels.length,
          models: liveModels,
          ...(queryFailed ? { warning: 'catalog_query_failed' } : {}),
        });
      }
    } catch (err) {
      console.error('[models] live OpenRouter fallback failed:', err);
      if (queryFailed) {
        return NextResponse.json(
          { provider, count: 0, models: [], error: 'catalog_query_failed' },
          { status: 200 },
        );
      }
    }
  }

  console.log(`[models] returning ${models.length} models for ${provider}`);
  return NextResponse.json({ provider, count: models.length, models });
}

async function fetchOpenRouterLiveModels(): Promise<Array<Record<string, unknown>>> {
  const res = await fetch('https://openrouter.ai/api/v1/models', {
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`OpenRouter API returned ${res.status}`);

  const json = (await res.json()) as { data: OpenRouterModel[] };
  return (json.data ?? [])
    .filter((m) => m.architecture?.output_modalities?.includes('text'))
    .map((m) => ({
      id: m.id.replace(/\//g, '__'),
      modelId: m.id,
      name: m.name,
      description: m.description ?? '',
      contextLength: m.context_length ?? 0,
      maxCompletionTokens: m.top_provider?.max_completion_tokens ?? 0,
      pricing: {
        prompt: Number.parseFloat(m.pricing?.prompt ?? '0'),
        completion: Number.parseFloat(m.pricing?.completion ?? '0'),
        request: Number.parseFloat(m.pricing?.request ?? '0'),
        image: Number.parseFloat(m.pricing?.image ?? '0'),
      },
      inputModalities: m.architecture?.input_modalities ?? ['text'],
      outputModalities: m.architecture?.output_modalities ?? ['text'],
      supportedParameters: m.supported_parameters ?? [],
      qualityScores: m.quality_scores ?? null,
      expirationDate: null,
    }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

async function refreshOpenRouterCatalog(db: FirebaseFirestore.Firestore, catalogProvider: string) {
  const res = await fetch('https://openrouter.ai/api/v1/models', {
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`OpenRouter API returned ${res.status}`);

  const json = (await res.json()) as { data: OpenRouterModel[] };
  const models = json.data;

  // Fetch existing model IDs to detect removals
  const existingSnap = await db
    .collection('model_catalog')
    .where('catalogProvider', '==', catalogProvider)
    .select('modelId')
    .get();
  const existingIds = new Set(existingSnap.docs.map((d) => d.data().modelId as string));
  const incomingIds = new Set(models.map((m) => m.id));

  // Batch write: up to 490 ops per batch
  const BATCH_LIMIT = 490;
  let batch = db.batch();
  let opCount = 0;

  async function flushIfNeeded() {
    if (opCount >= BATCH_LIMIT) {
      await batch.commit();
      batch = db.batch();
      opCount = 0;
    }
  }

  const now = FieldValue.serverTimestamp();

  // Upsert incoming models
  for (const m of models) {
    // Only include text-capable models
    if (!m.architecture?.output_modalities?.includes('text')) continue;

    const docId = m.id.replace(/\//g, '__');
    const ref = db.collection('model_catalog').doc(docId);

    batch.set(
      ref,
      {
        modelId: m.id,
        catalogProvider,
        name: m.name,
        description: m.description ?? '',
        contextLength: m.context_length ?? 0,
        maxCompletionTokens: m.top_provider?.max_completion_tokens ?? 0,
        pricing: {
          prompt: Number.parseFloat(m.pricing?.prompt ?? '0'),
          completion: Number.parseFloat(m.pricing?.completion ?? '0'),
          request: Number.parseFloat(m.pricing?.request ?? '0'),
          image: Number.parseFloat(m.pricing?.image ?? '0'),
        },
        qualityScores: m.quality_scores ?? null,
        inputModalities: m.architecture?.input_modalities ?? ['text'],
        outputModalities: m.architecture?.output_modalities ?? ['text'],
        supportedParameters: m.supported_parameters ?? [],
        available: true,
        lastCheckedAt: now,
      },
      { merge: true },
    );
    opCount++;
    await flushIfNeeded();
  }

  // Mark removed models as unavailable
  for (const existingId of existingIds) {
    if (!incomingIds.has(existingId)) {
      const docId = existingId.replace(/\//g, '__');
      const ref = db.collection('model_catalog').doc(docId);
      batch.update(ref, { available: false, lastCheckedAt: now });
      opCount++;
      await flushIfNeeded();
    }
  }

  if (opCount > 0) await batch.commit();

  // Update metadata
  await db
    .collection('model_catalog_meta')
    .doc(catalogProvider)
    .set({ lastFetchedAt: now, modelCount: models.length }, { merge: true });

  console.log(`[models] refreshed ${catalogProvider} catalog: ${models.length} models`);
}
