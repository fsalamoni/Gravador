import { FieldValue } from 'firebase-admin/firestore';

export type DocData = Record<string, unknown>;

type AnyObject = Record<string, unknown>;

const serverTimestampCtor = FieldValue.serverTimestamp().constructor;
const incrementCtor = FieldValue.increment(1).constructor;

function isPlainObject(value: unknown): value is AnyObject {
  if (!value || typeof value !== 'object') return false;
  return Object.getPrototypeOf(value) === Object.prototype;
}

function isServerTimestampTransform(value: unknown): boolean {
  return Boolean(value && value.constructor === serverTimestampCtor);
}

function isIncrementTransform(value: unknown): value is { operand?: unknown } {
  return Boolean(value && value.constructor === incrementCtor);
}

function cloneData<T>(value: T): T {
  if (value == null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((item) => cloneData(item)) as T;
  }
  if (!isPlainObject(value)) {
    return value;
  }

  const cloned: AnyObject = {};
  for (const [key, entry] of Object.entries(value)) {
    cloned[key] = cloneData(entry);
  }
  return cloned as T;
}

function deepMerge(target: unknown, source: unknown): unknown {
  if (!isPlainObject(target) || !isPlainObject(source)) {
    return source;
  }

  const merged: AnyObject = { ...target };
  for (const [key, sourceValue] of Object.entries(source)) {
    const targetValue = merged[key];
    merged[key] =
      isPlainObject(targetValue) && isPlainObject(sourceValue)
        ? deepMerge(targetValue, sourceValue)
        : sourceValue;
  }
  return merged;
}

function setByPath(target: AnyObject, path: string, value: unknown): void {
  const segments = path.split('.');
  let current: AnyObject = target;

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    if (segment === undefined) {
      return;
    }
    const isLast = index === segments.length - 1;

    if (isLast) {
      current[segment] = value;
      return;
    }

    const next = current[segment];
    if (!isPlainObject(next)) {
      current[segment] = {};
    }

    current = current[segment] as AnyObject;
  }
}

function normalizePathKeys(payload: DocData): DocData {
  const normalized: AnyObject = {};

  for (const [key, value] of Object.entries(payload)) {
    if (key.includes('.')) {
      setByPath(normalized, key, value);
      continue;
    }

    normalized[key] = value;
  }

  return normalized;
}

function resolveTransforms(value: unknown, currentValue: unknown): unknown {
  if (isServerTimestampTransform(value)) {
    return new Date();
  }

  if (isIncrementTransform(value)) {
    const base = typeof currentValue === 'number' ? currentValue : 0;
    const operand = typeof value.operand === 'number' ? value.operand : 0;
    return base + operand;
  }

  if (Array.isArray(value)) {
    return value.map((entry, index) =>
      resolveTransforms(entry, Array.isArray(currentValue) ? currentValue[index] : undefined),
    );
  }

  if (isPlainObject(value)) {
    const current = isPlainObject(currentValue) ? currentValue : {};
    const resolved: AnyObject = {};

    for (const [key, entry] of Object.entries(value)) {
      resolved[key] = resolveTransforms(entry, current[key]);
    }

    return resolved;
  }

  return cloneData(value);
}

export class FakeDocumentSnapshot {
  constructor(
    readonly id: string,
    readonly exists: boolean,
    private readonly payload: DocData | undefined,
  ) {}

  data() {
    return this.payload;
  }
}

class FakeCollectionQuery {
  constructor(
    private readonly db: FakeFirestoreDb,
    private readonly path: string,
    private readonly orderField: string,
  ) {}

  async get() {
    const docs = this.db.listCollectionDocs(this.path).sort((a, b) => {
      const left = a.payload[this.orderField];
      const right = b.payload[this.orderField];

      if (typeof left === 'string' && typeof right === 'string') {
        return left.localeCompare(right);
      }
      if (typeof left === 'number' && typeof right === 'number') {
        return left - right;
      }
      return a.id.localeCompare(b.id);
    });

    return {
      docs: docs.map((entry) => new FakeDocumentSnapshot(entry.id, true, cloneData(entry.payload))),
    };
  }
}

export class FakeCollectionReference {
  constructor(
    private readonly db: FakeFirestoreDb,
    readonly path: string,
  ) {}

  doc(id?: string) {
    const docId = id ?? this.db.nextId();
    return new FakeDocumentReference(this.db, `${this.path}/${docId}`);
  }

  orderBy(field: string) {
    return new FakeCollectionQuery(this.db, this.path, field);
  }

  async get() {
    const docs = this.db.listCollectionDocs(this.path);
    return {
      docs: docs.map((entry) => new FakeDocumentSnapshot(entry.id, true, cloneData(entry.payload))),
    };
  }
}

export class FakeDocumentReference {
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

  async update(payload: DocData) {
    this.db.set(this.path, payload, { merge: true });
  }
}

export class FakeTransaction {
  constructor(private readonly db: FakeFirestoreDb) {}

  async get(ref: FakeDocumentReference) {
    return ref.get();
  }

  set(ref: FakeDocumentReference, payload: DocData, options?: { merge?: boolean }) {
    this.db.set(ref.path, payload, options);
  }
}

export class FakeFirestoreDb {
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

  listCollectionDocs(collectionPath: string) {
    const prefix = `${collectionPath}/`;

    return this.entries()
      .filter(([path]) => {
        if (!path.startsWith(prefix)) return false;
        return !path.slice(prefix.length).includes('/');
      })
      .map(([path, payload]) => ({
        id: path.split('/').pop() ?? '',
        payload,
      }));
  }

  get(path: string) {
    const payload = this.docs.get(path);
    return payload ? cloneData(payload) : undefined;
  }

  set(path: string, payload: DocData, options?: { merge?: boolean }) {
    const normalizedPayload = normalizePathKeys(payload);
    const current = this.docs.get(path) ?? {};
    const transformedPayload = resolveTransforms(normalizedPayload, current) as DocData;

    if (options?.merge) {
      this.docs.set(path, deepMerge(current, transformedPayload) as DocData);
      return;
    }

    this.docs.set(path, cloneData(transformedPayload));
  }

  async runTransaction<T>(handler: (tx: FakeTransaction) => Promise<T>) {
    const tx = new FakeTransaction(this);
    return handler(tx);
  }
}
