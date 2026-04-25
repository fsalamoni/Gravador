import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';

const WINDOWS_JAVA_FALLBACKS = [
  'C:\\Program Files\\Android\\Android Studio\\jbr\\bin\\java.exe',
  'C:\\Program Files\\Eclipse Adoptium\\jdk-21\\bin\\java.exe',
  'C:\\Program Files\\Java\\jdk-21\\bin\\java.exe',
];

function canRunJava(env = process.env) {
  const result = spawnSync('java', ['-version'], {
    env,
    stdio: 'pipe',
    encoding: 'utf8',
  });

  if (result.error) return false;
  return result.status === 0;
}

function resolveJavaPathPrefix() {
  if (canRunJava()) {
    return { ok: true, pathPrefix: null };
  }

  if (process.platform !== 'win32') {
    return { ok: false, pathPrefix: null };
  }

  for (const javaPath of WINDOWS_JAVA_FALLBACKS) {
    if (!fs.existsSync(javaPath)) continue;

    const binDir = path.dirname(javaPath);
    const env = {
      ...process.env,
      PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ''}`,
    };

    if (canRunJava(env)) {
      return { ok: true, pathPrefix: binDir };
    }
  }

  return { ok: false, pathPrefix: null };
}

function printJavaHelpAndExit() {
  console.error('[test:web:firestore-emulator] Java runtime not found.');
  console.error('Install JDK 21+ or add Java to PATH, then rerun the command.');
  if (process.platform === 'win32') {
    console.error(
      'Windows hint: if Android Studio is installed, add C:\\Program Files\\Android\\Android Studio\\jbr\\bin to PATH.',
    );
  }
  process.exit(1);
}

function parsePort(rawValue, fallback) {
  const value = Number(rawValue);
  if (!Number.isFinite(value)) return fallback;
  const integer = Math.trunc(value);
  if (integer < 1024 || integer > 65535) return fallback;
  return integer;
}

function isPortFree(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', () => {
      resolve(false);
    });

    server.once('listening', () => {
      server.close(() => {
        resolve(true);
      });
    });

    server.listen(port, host);
  });
}

async function selectFirestorePort(preferredPort) {
  if (await isPortFree(preferredPort)) return preferredPort;

  for (let port = preferredPort + 1; port <= preferredPort + 30; port += 1) {
    if (await isPortFree(port)) return port;
  }

  return null;
}

function createTempFirebaseConfig(firestorePort) {
  const rootDir = process.cwd();
  const firebaseConfigPath = path.join(rootDir, 'firebase.json');
  const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));

  const emulators =
    firebaseConfig.emulators && typeof firebaseConfig.emulators === 'object'
      ? { ...firebaseConfig.emulators }
      : {};
  const firestoreConfig =
    emulators.firestore && typeof emulators.firestore === 'object'
      ? { ...emulators.firestore }
      : {};

  emulators.firestore = {
    ...firestoreConfig,
    host: '127.0.0.1',
    port: firestorePort,
  };

  const mergedConfig = {
    ...firebaseConfig,
    emulators,
  };

  const tempConfigPath = path.join(rootDir, `.firebase.emulator.${Date.now()}.${process.pid}.json`);
  fs.writeFileSync(tempConfigPath, `${JSON.stringify(mergedConfig, null, 2)}\n`, 'utf8');

  return { tempConfigPath };
}

const javaResolution = resolveJavaPathPrefix();
if (!javaResolution.ok) {
  printJavaHelpAndExit();
}

const env = { ...process.env };
if (javaResolution.pathPrefix) {
  env.PATH = `${javaResolution.pathPrefix}${path.delimiter}${process.env.PATH ?? ''}`;
  console.log(
    `[test:web:firestore-emulator] Java detected via fallback path: ${javaResolution.pathPrefix}`,
  );
}

const projectId =
  typeof env.FIREBASE_PROJECT_ID === 'string' && env.FIREBASE_PROJECT_ID.trim().length > 0
    ? env.FIREBASE_PROJECT_ID.trim()
    : 'demo-gravador-web';
env.FIREBASE_PROJECT_ID = projectId;

const preferredFirestorePort = parsePort(process.env.FIRESTORE_EMULATOR_PORT, 8080);
const firestorePort = await selectFirestorePort(preferredFirestorePort);

if (firestorePort == null) {
  console.error(
    `[test:web:firestore-emulator] No free port found in range ${preferredFirestorePort}-${preferredFirestorePort + 30}.`,
  );
  process.exit(1);
}

if (firestorePort !== preferredFirestorePort) {
  console.log(
    `[test:web:firestore-emulator] Port ${preferredFirestorePort} is busy, using ${firestorePort} instead.`,
  );
}

const { tempConfigPath } = createTempFirebaseConfig(firestorePort);

const escapedConfigPath = tempConfigPath.replace(/"/g, '\\"');

const emulatorCommand = `pnpm exec firebase emulators:exec --project "${projectId}" --config "${escapedConfigPath}" --only firestore "pnpm --filter @gravador/web run test:firestore-emulator"`;

const result = spawnSync(emulatorCommand, {
  env,
  stdio: 'inherit',
  shell: true,
});

fs.rmSync(tempConfigPath, { force: true });

if (typeof result.status === 'number') {
  process.exit(result.status);
}

if (result.error) {
  console.error(
    `[test:web:firestore-emulator] Failed to start firebase emulator command: ${result.error.message}`,
  );
}

process.exit(1);
