import { describe, expect, it } from 'vitest';
import { buildSideBySideMergePlan } from './bulk-merge';

describe('buildSideBySideMergePlan', () => {
  it('copies active secondary artifacts that are missing in primary', () => {
    const plan = buildSideBySideMergePlan(
      [{ kind: 'summary', artifactStatus: 'active' }],
      [
        { kind: 'summary', artifactStatus: 'active' },
        { kind: 'mindmap', artifactStatus: 'active' },
      ],
    );

    expect(plan.copyFromSecondaryKinds).toEqual(['mindmap']);
    expect(plan.summary).toEqual({
      totalKinds: 2,
      copiedCount: 1,
      keptPrimaryCount: 1,
      noChangeCount: 0,
    });
  });

  it('keeps primary artifact when both sides are active', () => {
    const plan = buildSideBySideMergePlan(
      [{ kind: 'summary', artifactStatus: 'active' }],
      [{ kind: 'summary', artifactStatus: 'active' }],
    );

    expect(plan.rows).toEqual([
      {
        kind: 'summary',
        primaryStatus: 'active',
        secondaryStatus: 'active',
        action: 'keep_primary',
        shouldCopyFromSecondary: false,
      },
    ]);
  });

  it('does not copy when primary artifact was explicitly deleted', () => {
    const plan = buildSideBySideMergePlan(
      [{ kind: 'summary', artifactStatus: 'deleted' }],
      [{ kind: 'summary', artifactStatus: 'active' }],
    );

    expect(plan.rows[0]).toEqual({
      kind: 'summary',
      primaryStatus: 'deleted',
      secondaryStatus: 'active',
      action: 'no_change',
      shouldCopyFromSecondary: false,
    });
  });

  it('ignores unknown artifact kinds from source data', () => {
    const plan = buildSideBySideMergePlan(
      [{ kind: 'summary', artifactStatus: 'active' }],
      [{ kind: 'custom_kind', artifactStatus: 'active' }],
    );

    expect(plan.rows).toHaveLength(1);
    expect(plan.rows[0]?.kind).toBe('summary');
  });
});
