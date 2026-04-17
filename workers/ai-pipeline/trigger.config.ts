import { defineConfig } from '@trigger.dev/sdk/v3';

export default defineConfig({
  project: 'gravador',
  runtime: 'node',
  logLevel: 'info',
  maxDuration: 900,
  retries: {
    enabledInDev: true,
    default: { maxAttempts: 3, factor: 2, minTimeoutInMs: 1000, maxTimeoutInMs: 30_000 },
  },
  dirs: ['./src/tasks'],
});
