import { getServerDb, getSessionUser } from '@/lib/firebase-server';
import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const VALID_THEMES = [
  'terra',
  'oceano',
  'floresta',
  'noite',
  'aurora',
  'artico',
  'vulcao',
  'solaris',
  'claro',
] as const;

const VALID_TRANSCRIBE_PROVIDERS = new Set(['groq', 'openai', 'local-faster-whisper']);

async function getUserWorkspace(db: FirebaseFirestore.Firestore, uid: string) {
  const snap = await db.collection('workspaces').where('ownerId', '==', uid).limit(1).get();
  if (snap.empty) return null;
  return { id: snap.docs[0]!.id, ...snap.docs[0]!.data() };
}

/**
 * GET /api/settings — returns the current workspace AI settings
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const db = getServerDb();
  const ws = await getUserWorkspace(db, user.uid);
  if (!ws) return NextResponse.json({ aiSettings: {} });

  return NextResponse.json({
    workspaceId: ws.id,
    aiSettings: (ws as Record<string, unknown>).aiSettings ?? {},
    theme: (ws as Record<string, unknown>).theme ?? null,
  });
}

/**
 * PUT /api/settings — updates workspace AI settings
 * Body: { aiSettings: WorkspaceAISettings }
 */
export async function PUT(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await req.json()) as { aiSettings?: Record<string, unknown>; theme?: string };

  // Handle theme update
  if (body.theme && typeof body.theme === 'string') {
    if (VALID_THEMES.includes(body.theme as (typeof VALID_THEMES)[number])) {
      const db = getServerDb();
      const ws = await getUserWorkspace(db, user.uid);
      if (ws) {
        await db
          .collection('workspaces')
          .doc(ws.id)
          .update({ theme: body.theme, updatedAt: FieldValue.serverTimestamp() });
      }
      if (!body.aiSettings) {
        return NextResponse.json({ workspaceId: ws?.id, theme: body.theme });
      }
    }
  }

  if (!body.aiSettings || typeof body.aiSettings !== 'object') {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  // Sanitize: only allow known fields
  const allowed = [
    'transcribeProvider',
    'transcribeModel',
    'chatProvider',
    'chatModel',
    'embeddingProvider',
    'embeddingModel',
    'ollamaUrl',
    'byokKeys',
    'agentModels',
    'agentPrompts',
    'selectedModels',
  ];
  const sanitized: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body.aiSettings) {
      sanitized[key] = body.aiSettings[key];
    }
  }

  if (typeof sanitized.transcribeProvider === 'string') {
    const mapped =
      sanitized.transcribeProvider === 'local'
        ? 'local-faster-whisper'
        : sanitized.transcribeProvider;
    if (VALID_TRANSCRIBE_PROVIDERS.has(mapped)) {
      sanitized.transcribeProvider = mapped;
    } else {
      sanitized.transcribeProvider = undefined;
    }
  }

  if (typeof sanitized.transcribeModel === 'string') {
    const model = sanitized.transcribeModel.trim();
    if (model) sanitized.transcribeModel = model;
    else sanitized.transcribeModel = undefined;
  }

  if (typeof sanitized.ollamaUrl === 'string') {
    const url = sanitized.ollamaUrl.trim();
    if (url) sanitized.ollamaUrl = url;
    else sanitized.ollamaUrl = undefined;
  }

  // Sanitize byokKeys: only allow known provider keys, strip empty strings
  if (sanitized.byokKeys && typeof sanitized.byokKeys === 'object') {
    const allowedKeyProviders = ['openai', 'anthropic', 'groq', 'google', 'openrouter'];
    const rawKeys = sanitized.byokKeys as Record<string, unknown>;
    const cleanKeys: Record<string, string> = {};
    for (const k of allowedKeyProviders) {
      if (typeof rawKeys[k] === 'string' && (rawKeys[k] as string).trim()) {
        cleanKeys[k] = (rawKeys[k] as string).trim();
      }
    }
    sanitized.byokKeys = cleanKeys;
  }

  const db = getServerDb();
  const ws = await getUserWorkspace(db, user.uid);

  if (!ws) {
    // Auto-create workspace for user
    const wsRef = db.collection('workspaces').doc();
    await wsRef.set({
      slug: user.uid,
      name: 'Meu Workspace',
      ownerId: user.uid,
      plan: 'free',
      aiSettings: sanitized,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ workspaceId: wsRef.id, aiSettings: sanitized });
  }

  await db.collection('workspaces').doc(ws.id).update({
    aiSettings: sanitized,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ workspaceId: ws.id, aiSettings: sanitized });
}
