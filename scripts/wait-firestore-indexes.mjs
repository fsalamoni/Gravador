import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token?.startsWith('--')) continue;

    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      args[key] = 'true';
      continue;
    }

    args[key] = next;
    index += 1;
  }

  return args;
}

function normalizeField(field) {
  return JSON.stringify({
    fieldPath: field.fieldPath,
    order: field.order ?? null,
    arrayConfig: field.arrayConfig ?? null,
    vectorConfig: field.vectorConfig ? JSON.stringify(field.vectorConfig) : null,
  });
}

function comparableFields(fields) {
  return fields.filter((field) => field.fieldPath !== '__name__').map(normalizeField);
}

function getCollectionGroup(index) {
  if (index.collectionGroup) return index.collectionGroup;

  const match = index.name?.match(/\/collectionGroups\/([^/]+)\/indexes\//);
  return match?.[1] ?? null;
}

function matchesExpectedIndex(expected, remote) {
  if (expected.collectionGroup !== getCollectionGroup(remote)) return false;
  if ((expected.queryScope ?? 'COLLECTION') !== (remote.queryScope ?? 'COLLECTION')) return false;

  const expectedFields = comparableFields(expected.fields ?? []);
  const remoteFields = comparableFields(remote.fields ?? []);

  if (expectedFields.length !== remoteFields.length) return false;
  return expectedFields.every((field, index) => field === remoteFields[index]);
}

function getGcloudBinary() {
  if (process.env.GCLOUD_BIN) return process.env.GCLOUD_BIN;
  return process.platform === 'win32' ? 'gcloud.cmd' : 'gcloud';
}

function shellEscape(value) {
  return `"${String(value).replace(/"/g, '\\"')}"`;
}

function listRemoteIndexes(project, database) {
  const command = [
    getGcloudBinary(),
    'firestore',
    'indexes',
    'composite',
    'list',
    '--project',
    shellEscape(project),
    '--database',
    shellEscape(database),
    '--format=json',
  ].join(' ');

  const output = execSync(command, { encoding: 'utf8' });

  return JSON.parse(output || '[]');
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const args = parseArgs(process.argv.slice(2));
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');
const indexesPath = path.join(rootDir, 'firestore.indexes.json');
const firestoreConfig = JSON.parse(fs.readFileSync(indexesPath, 'utf8'));
const expectedIndexes = firestoreConfig.indexes ?? [];

if (expectedIndexes.length === 0) {
  console.log('No composite Firestore indexes declared.');
  process.exit(0);
}

const project =
  args.project ??
  process.env.FIREBASE_PROJECT_ID ??
  process.env.GOOGLE_CLOUD_PROJECT ??
  process.env.GCLOUD_PROJECT;

if (!project) {
  throw new Error('Missing Firestore project id. Pass --project or set FIREBASE_PROJECT_ID.');
}

const database = args.database ?? process.env.FIRESTORE_DATABASE_ID ?? 'anotes';
const timeoutMs = Number(args['timeout-ms'] ?? 900000);
const intervalMs = Number(args['interval-ms'] ?? 15000);
const deadline = Date.now() + timeoutMs;

while (Date.now() < deadline) {
  const remoteIndexes = listRemoteIndexes(project, database);
  const pendingIndexes = expectedIndexes
    .map((expected) => {
      const remote = remoteIndexes.find((candidate) => matchesExpectedIndex(expected, candidate));

      if (!remote) {
        return {
          collectionGroup: expected.collectionGroup,
          queryScope: expected.queryScope ?? 'COLLECTION',
          state: 'MISSING',
        };
      }

      if (remote.state !== 'READY') {
        return {
          collectionGroup: expected.collectionGroup,
          queryScope: expected.queryScope ?? 'COLLECTION',
          state: remote.state,
        };
      }

      return null;
    })
    .filter(Boolean);

  if (pendingIndexes.length === 0) {
    console.log(
      `All ${expectedIndexes.length} composite Firestore indexes are READY in database ${database}.`,
    );
    process.exit(0);
  }

  console.log(`Waiting for ${pendingIndexes.length} Firestore indexes in database ${database}...`);
  for (const pendingIndex of pendingIndexes) {
    console.log(
      `- ${pendingIndex.collectionGroup} (${pendingIndex.queryScope}) -> ${pendingIndex.state}`,
    );
  }

  await wait(intervalMs);
}

throw new Error(`Timed out waiting for Firestore indexes in database ${database}.`);
