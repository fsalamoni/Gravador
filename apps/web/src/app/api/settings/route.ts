import { getServerDb, getSessionUser } from '@/lib/firebase-server';
import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

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
    const validThemes = ['terra', 'oceano', 'floresta', 'noite', 'aurora', 'artico', 'vulcao', 'solaris'];
    if (validThemes.includes(body.theme)) {
      const db = getServerDb();
      const ws = await getUserWorkspace(db, user.uid);
      if (ws) {
        await db.collection('workspaces').doc(ws.id).update({ theme: body.theme, updatedAt: FieldValue.serverTimestamp() });
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
    'chatProvider',
    'chatModel',
    'embeddingProvider',
    'embeddingModel',
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
