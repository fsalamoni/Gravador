import { getServerDb, getSessionUser } from '@/lib/firebase-server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

interface OllamaTag {
  name?: string;
  model?: string;
  details?: {
    parameter_size?: string;
    family?: string;
  };
}

function normalizeOllamaBaseUrl(raw: string | null | undefined): string {
  const fallback = 'http://127.0.0.1:11434';
  const value = (raw ?? '').trim();
  if (!value) return fallback;
  const withoutSlash = value.replace(/\/+$/, '');
  return withoutSlash.endsWith('/api') ? withoutSlash.slice(0, -4) : withoutSlash;
}

async function resolveWorkspaceOllamaUrl(uid: string): Promise<string | null> {
  const db = getServerDb();
  const wsSnap = await db.collection('workspaces').where('ownerId', '==', uid).limit(1).get();
  if (wsSnap.empty) return null;
  const ai = (wsSnap.docs[0]?.data()?.aiSettings ?? {}) as { ollamaUrl?: string };
  return typeof ai.ollamaUrl === 'string' ? ai.ollamaUrl : null;
}

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const queryBaseUrl = searchParams.get('baseUrl');
  const storedUrl = await resolveWorkspaceOllamaUrl(user.uid).catch(() => null);
  const baseUrl = normalizeOllamaBaseUrl(queryBaseUrl ?? storedUrl ?? process.env.OLLAMA_BASE_URL);

  const tagsRes = await fetch(`${baseUrl}/api/tags`, {
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(8_000),
  }).catch((err) => {
    throw new Error(err instanceof Error ? err.message : 'failed_to_connect');
  });

  if (!tagsRes.ok) {
    return NextResponse.json(
      {
        error: 'ollama_unreachable',
        message: `Ollama respondeu HTTP ${tagsRes.status}`,
        baseUrl,
        models: [],
      },
      { status: 200 },
    );
  }

  const json = (await tagsRes.json()) as { models?: OllamaTag[] };
  const models = (json.models ?? []).map((m) => {
    const id = (m.model ?? m.name ?? '').trim();
    const label = (m.name ?? m.model ?? id).replace(/:latest$/, '');
    return {
      id,
      modelId: id,
      name: label,
      description: `Ollama local model${m.details?.family ? ` • ${m.details.family}` : ''}${m.details?.parameter_size ? ` • ${m.details.parameter_size}` : ''}`,
      contextLength: 131072,
      pricing: { prompt: 0, completion: 0 },
      qualityScores: null,
    };
  });

  return NextResponse.json({ provider: 'ollama', baseUrl, count: models.length, models });
}
