import type { AIOutputKind } from '@gravador/core';
import { isAIOutputKind } from './recording-lifecycle';

export type MergeArtifactStatus = 'missing' | 'active' | 'deleted';
export type MergeReconciliationAction = 'copy_secondary' | 'keep_primary' | 'no_change';

export interface BulkMergeArtifactRecord {
  kind: string;
  artifactStatus?: 'active' | 'deleted' | null;
}

export interface BulkMergeReconciliationRow {
  kind: AIOutputKind;
  primaryStatus: MergeArtifactStatus;
  secondaryStatus: MergeArtifactStatus;
  action: MergeReconciliationAction;
  shouldCopyFromSecondary: boolean;
}

export interface BulkMergePlan {
  rows: BulkMergeReconciliationRow[];
  copyFromSecondaryKinds: AIOutputKind[];
  summary: {
    totalKinds: number;
    copiedCount: number;
    keptPrimaryCount: number;
    noChangeCount: number;
  };
}

function toArtifactStatus(record: BulkMergeArtifactRecord | null | undefined): MergeArtifactStatus {
  if (!record) return 'missing';
  if (record.artifactStatus === 'deleted') return 'deleted';
  return 'active';
}

function toArtifactMap(
  records: BulkMergeArtifactRecord[],
): Map<AIOutputKind, BulkMergeArtifactRecord> {
  const map = new Map<AIOutputKind, BulkMergeArtifactRecord>();
  for (const record of records) {
    if (!isAIOutputKind(record.kind)) continue;
    if (map.has(record.kind)) continue;
    map.set(record.kind, record);
  }
  return map;
}

export function buildSideBySideMergePlan(
  primaryArtifacts: BulkMergeArtifactRecord[],
  secondaryArtifacts: BulkMergeArtifactRecord[],
): BulkMergePlan {
  const primaryByKind = toArtifactMap(primaryArtifacts);
  const secondaryByKind = toArtifactMap(secondaryArtifacts);

  const kinds = [...new Set([...primaryByKind.keys(), ...secondaryByKind.keys()])].sort();

  const rows: BulkMergeReconciliationRow[] = [];
  for (const kind of kinds) {
    const primaryStatus = toArtifactStatus(primaryByKind.get(kind));
    const secondaryStatus = toArtifactStatus(secondaryByKind.get(kind));

    let action: MergeReconciliationAction = 'no_change';
    let shouldCopyFromSecondary = false;

    if (primaryStatus === 'active') {
      action = 'keep_primary';
    } else if (primaryStatus === 'missing' && secondaryStatus === 'active') {
      action = 'copy_secondary';
      shouldCopyFromSecondary = true;
    }

    rows.push({
      kind,
      primaryStatus,
      secondaryStatus,
      action,
      shouldCopyFromSecondary,
    });
  }

  const copyFromSecondaryKinds = rows
    .filter((row) => row.shouldCopyFromSecondary)
    .map((row) => row.kind);

  return {
    rows,
    copyFromSecondaryKinds,
    summary: {
      totalKinds: rows.length,
      copiedCount: rows.filter((row) => row.action === 'copy_secondary').length,
      keptPrimaryCount: rows.filter((row) => row.action === 'keep_primary').length,
      noChangeCount: rows.filter((row) => row.action === 'no_change').length,
    },
  };
}
