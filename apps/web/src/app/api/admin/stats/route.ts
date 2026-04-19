import { getServerDb, getSessionUser } from '@/lib/firebase-server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * GET /api/admin/stats — workspace usage statistics
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const db = getServerDb();

  // Find workspace owned by user
  const wsSnap = await db.collection('workspaces').where('ownerId', '==', user.uid).limit(1).get();
  if (wsSnap.empty) return NextResponse.json({ error: 'no_workspace' }, { status: 404 });
  const workspaceId = wsSnap.docs[0]!.id;

  // Recordings stats
  const allRecordings = await db
    .collection('recordings')
    .where('workspaceId', '==', workspaceId)
    .select('status', 'createdAt', 'durationMs')
    .get();

  let totalRecordings = 0;
  let readyCount = 0;
  let failedCount = 0;
  let processingCount = 0;
  let totalDurationMs = 0;
  const last7Days: Record<string, number> = {};

  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  for (const doc of allRecordings.docs) {
    const d = doc.data();
    totalRecordings++;
    if (d.status === 'ready') readyCount++;
    else if (d.status === 'failed') failedCount++;
    else processingCount++;
    if (d.durationMs) totalDurationMs += d.durationMs;

    const createdAt = d.createdAt?.toMillis?.() ?? 0;
    if (createdAt > sevenDaysAgo) {
      const day = new Date(createdAt).toISOString().slice(0, 10);
      last7Days[day] = (last7Days[day] ?? 0) + 1;
    }
  }

  // AI outputs count
  const outputsSnap = await db
    .collectionGroup('ai_outputs')
    .where('recordingId', '!=', '')
    .select('kind', 'latencyMs')
    .limit(1000)
    .get();

  const pipelineCounts: Record<string, number> = {};
  let totalLatencyMs = 0;
  let outputCount = 0;
  for (const doc of outputsSnap.docs) {
    const d = doc.data();
    const kind = d.kind as string;
    pipelineCounts[kind] = (pipelineCounts[kind] ?? 0) + 1;
    if (d.latencyMs) totalLatencyMs += d.latencyMs;
    outputCount++;
  }

  // Members count
  const membersSnap = await db
    .collection('workspace_members')
    .where('workspaceId', '==', workspaceId)
    .select()
    .get();

  return NextResponse.json({
    workspace: { id: workspaceId },
    recordings: {
      total: totalRecordings,
      ready: readyCount,
      failed: failedCount,
      processing: processingCount,
      totalDurationMs,
      last7Days,
    },
    aiPipelines: {
      totalOutputs: outputCount,
      avgLatencyMs: outputCount > 0 ? Math.round(totalLatencyMs / outputCount) : 0,
      byKind: pipelineCounts,
    },
    members: { count: membersSnap.size + 1 },
  });
}
