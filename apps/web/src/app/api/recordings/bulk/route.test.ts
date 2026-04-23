import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetApiSessionUser, mockGetServerDb, mockGetAccessibleRecording, mockFeatureFlags } =
  vi.hoisted(() => ({
    mockGetApiSessionUser: vi.fn(),
    mockGetServerDb: vi.fn(),
    mockGetAccessibleRecording: vi.fn(),
    mockFeatureFlags: { bulkOpsV1: true },
  }));

vi.mock('@/lib/api-session', () => ({
  getApiSessionUser: mockGetApiSessionUser,
}));

vi.mock('@/lib/firebase-server', () => ({
  getServerDb: mockGetServerDb,
}));

vi.mock('@/lib/recording-access', () => ({
  getAccessibleRecording: mockGetAccessibleRecording,
}));

vi.mock('@/lib/feature-flags', () => ({
  featureFlags: mockFeatureFlags,
}));

import { POST } from './route';

type DocData = Record<string, unknown>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false;
  return Object.getPrototypeOf(value) === Object.prototype;
}

function deepMerge(target: unknown, source: unknown): unknown {
  if (!isPlainObject(target) || !isPlainObject(source)) {
    return source;
  }

  const merged: Record<string, unknown> = { ...target };
  for (const [key, sourceValue] of Object.entries(source)) {
    const targetValue = merged[key];
    merged[key] =
      isPlainObject(targetValue) && isPlainObject(sourceValue)
        ? deepMerge(targetValue, sourceValue)
        : sourceValue;
  }
  return merged;
}

function cloneData<T>(value: T): T {
  if (value == null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((item) => cloneData(item)) as T;
  }
  if (!isPlainObject(value)) {
    return value;
  }

  const cloned: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    cloned[key] = cloneData(entry);
  }
  return cloned as T;
}

class FakeDocumentSnapshot {
  constructor(
    readonly id: string,
    readonly exists: boolean,
    private readonly payload: DocData | undefined,
  ) {}

  data() {
    return this.payload;
  }
}

class FakeCollectionReference {
  constructor(
    private readonly db: FakeFirestoreDb,
    readonly path: string,
  ) {}

  doc(id?: string) {
    const docId = id ?? this.db.nextId();
    return new FakeDocumentReference(this.db, `${this.path}/${docId}`);
  }

  async get() {
    const prefix = `${this.path}/`;
    const docs = this.db
      .entries()
      .filter(([path]) => {
        if (!path.startsWith(prefix)) return false;
        return !path.slice(prefix.length).includes('/');
      })
      .map(
        ([path, payload]) =>
          new FakeDocumentSnapshot(path.split('/').pop() ?? '', true, cloneData(payload)),
      );

    return { docs };
  }
}

class FakeDocumentReference {
  readonly id: string;

  constructor(
    private readonly db: FakeFirestoreDb,
    readonly path: string,
  ) {
    this.id = path.split('/').pop() ?? '';
  }

  collection(name: string) {
    return new FakeCollectionReference(this.db, `${this.path}/${name}`);
  }

  async get() {
    const payload = this.db.get(this.path);
    return new FakeDocumentSnapshot(this.id, payload !== undefined, cloneData(payload));
  }

  async set(payload: DocData, options?: { merge?: boolean }) {
    this.db.set(this.path, payload, options);
  }
}

class FakeTransaction {
  constructor(private readonly db: FakeFirestoreDb) {}

  async get(ref: FakeDocumentReference) {
    return ref.get();
  }

  set(ref: FakeDocumentReference, payload: DocData, options?: { merge?: boolean }) {
    this.db.set(ref.path, payload, options);
  }
}

class FakeFirestoreDb {
  private readonly docs = new Map<string, DocData>();
  private autoIdCounter = 0;

  collection(name: string) {
    return new FakeCollectionReference(this, name);
  }

  nextId() {
    this.autoIdCounter += 1;
    return `auto-${this.autoIdCounter}`;
  }

  entries() {
    return [...this.docs.entries()];
  }

  get(path: string) {
    const payload = this.docs.get(path);
    return payload ? cloneData(payload) : undefined;
  }

  set(path: string, payload: DocData, options?: { merge?: boolean }) {
    if (options?.merge) {
      const current = this.docs.get(path) ?? {};
      this.docs.set(path, deepMerge(current, payload) as DocData);
      return;
    }
    this.docs.set(path, cloneData(payload));
  }

  async runTransaction<T>(handler: (tx: FakeTransaction) => Promise<T>) {
    const tx = new FakeTransaction(this);
    return handler(tx);
  }
}

function jsonRequest(body: Record<string, unknown>) {
  return new Request('https://test.local/api/recordings/bulk', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/recordings/bulk (merge execute)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFeatureFlags.bulkOpsV1 = true;
    mockGetApiSessionUser.mockResolvedValue({ uid: 'user-1' });
  });

  it('copies only missing active artifacts from secondary', async () => {
    const db = new FakeFirestoreDb();
    mockGetServerDb.mockReturnValue(db as never);

    const primaryRef = db.collection('recordings').doc('rec-primary');
    const secondaryRef = db.collection('recordings').doc('rec-secondary');

    await primaryRef.set({
      workspaceId: 'ws-1',
      createdBy: 'user-1',
      lifecycle: {
        schemaVersion: 1,
        status: 'active',
        recordingVersion: 1,
        retainedVersions: 1,
      },
    });

    await secondaryRef.set({
      workspaceId: 'ws-1',
      createdBy: 'user-1',
      lifecycle: {
        schemaVersion: 1,
        status: 'active',
        recordingVersion: 1,
        retainedVersions: 1,
      },
    });

    await primaryRef
      .collection('ai_outputs')
      .doc('summary')
      .set({
        kind: 'summary',
        artifactStatus: 'active',
        payload: { source: 'primary' },
        provider: 'primary-provider',
        artifactVersion: 7,
      });

    await secondaryRef
      .collection('ai_outputs')
      .doc('summary')
      .set({
        kind: 'summary',
        artifactStatus: 'active',
        payload: { source: 'secondary' },
        provider: 'secondary-provider',
        artifactVersion: 3,
      });

    await secondaryRef
      .collection('ai_outputs')
      .doc('mindmap')
      .set({
        kind: 'mindmap',
        artifactStatus: 'active',
        payload: { source: 'secondary' },
        provider: 'secondary-provider',
        artifactVersion: 2,
      });

    mockGetAccessibleRecording.mockImplementation(async (_db: unknown, recordingId: string) => {
      if (recordingId === 'rec-primary') {
        return {
          ok: true,
          ref: primaryRef,
          data: db.get(primaryRef.path),
        };
      }
      if (recordingId === 'rec-secondary') {
        return {
          ok: true,
          ref: secondaryRef,
          data: db.get(secondaryRef.path),
        };
      }
      return { ok: false, error: 'not_found' };
    });

    const response = await POST(
      jsonRequest({
        schemaVersion: 1,
        operation: 'merge',
        mode: 'execute',
        primaryRecordingId: 'rec-primary',
        secondaryRecordingId: 'rec-secondary',
        preserveArtifacts: 'side_by_side',
      }),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      copied: number;
      copiedArtifactKinds: string[];
      copyCandidateKinds: string[];
      primaryRecordingVersionBefore: number;
      primaryRecordingVersionAfter: number;
    };

    expect(body.copyCandidateKinds).toEqual(['mindmap']);
    expect(body.copied).toBe(1);
    expect(body.copiedArtifactKinds).toEqual(['mindmap']);
    expect(body.primaryRecordingVersionBefore).toBe(1);
    expect(body.primaryRecordingVersionAfter).toBe(2);

    const copiedMindmap = db.get('recordings/rec-primary/ai_outputs/mindmap');
    expect(copiedMindmap?.payload).toEqual({ source: 'secondary' });
    expect(copiedMindmap?.mergeSource).toMatchObject({
      preserveArtifacts: 'side_by_side',
      sourceRecordingId: 'rec-secondary',
    });

    const primarySummary = db.get('recordings/rec-primary/ai_outputs/summary');
    expect(primarySummary?.provider).toBe('primary-provider');
    expect(primarySummary?.payload).toEqual({ source: 'primary' });

    const auditEntry = db.entries().find(([path]) => path.startsWith('recording_bulk_ops/'))?.[1];
    expect(auditEntry).toBeDefined();
    expect(auditEntry?.execution).toMatchObject({
      mode: 'execute',
      mergeMode: 'side_by_side',
      copiedArtifactKinds: ['mindmap'],
    });
  });

  it('does not overwrite primary artifact when target already exists', async () => {
    const db = new FakeFirestoreDb();
    mockGetServerDb.mockReturnValue(db as never);

    const primaryRef = db.collection('recordings').doc('rec-primary');
    const secondaryRef = db.collection('recordings').doc('rec-secondary');

    await primaryRef.set({
      workspaceId: 'ws-1',
      createdBy: 'user-1',
      lifecycle: {
        schemaVersion: 1,
        status: 'active',
        recordingVersion: 1,
        retainedVersions: 1,
      },
    });
    await secondaryRef.set({ workspaceId: 'ws-1', createdBy: 'user-1' });

    await primaryRef
      .collection('ai_outputs')
      .doc('mindmap')
      .set({
        kind: 'mindmap',
        artifactStatus: 'active',
        payload: { source: 'primary-existing' },
        provider: 'primary-provider',
        artifactVersion: 4,
      });

    await secondaryRef
      .collection('ai_outputs')
      .doc('mindmap')
      .set({
        kind: 'mindmap',
        artifactStatus: 'active',
        payload: { source: 'secondary' },
        provider: 'secondary-provider',
        artifactVersion: 2,
      });

    mockGetAccessibleRecording.mockImplementation(async (_db: unknown, recordingId: string) => {
      if (recordingId === 'rec-primary') {
        return { ok: true, ref: primaryRef, data: db.get(primaryRef.path) };
      }
      if (recordingId === 'rec-secondary') {
        return { ok: true, ref: secondaryRef, data: db.get(secondaryRef.path) };
      }
      return { ok: false, error: 'not_found' };
    });

    const response = await POST(
      jsonRequest({
        schemaVersion: 1,
        operation: 'merge',
        mode: 'execute',
        primaryRecordingId: 'rec-primary',
        secondaryRecordingId: 'rec-secondary',
        preserveArtifacts: 'side_by_side',
      }),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      copied: number;
      copiedArtifactKinds: string[];
    };
    expect(body.copied).toBe(0);
    expect(body.copiedArtifactKinds).toEqual([]);

    const primaryMindmap = db.get('recordings/rec-primary/ai_outputs/mindmap');
    expect(primaryMindmap?.provider).toBe('primary-provider');
    expect(primaryMindmap?.payload).toEqual({ source: 'primary-existing' });
  });
});
