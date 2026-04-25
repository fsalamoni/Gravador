import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const POLL_INTERVAL_MS = 5_000;
const DISPATCH_LOOKUP_TIMEOUT_MS = 60_000;
const DEFAULT_RUN_TIMEOUT_MS = 20 * 60 * 1_000;

const ACTIVATION_TARGETS = ['notifications', 'audio-edit', 'transcription'];

function parseBoolean(value, fallback = false) {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function parseInteger(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readArg(argv, name) {
  const prefixed = argv.find((value) => value.startsWith(`${name}=`));
  if (prefixed) {
    return prefixed.split('=').slice(1).join('=');
  }

  const index = argv.indexOf(name);
  if (index >= 0 && index + 1 < argv.length) {
    return argv[index + 1];
  }

  return undefined;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function runGh(args) {
  try {
    const { stdout } = await execFileAsync('gh', args, {
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 10,
    });

    return stdout?.trim() ?? '';
  } catch (error) {
    const stdout = error?.stdout ? String(error.stdout).trim() : '';
    const stderr = error?.stderr ? String(error.stderr).trim() : '';
    const details = [stdout, stderr].filter(Boolean).join('\n').trim();
    const message = details || (error instanceof Error ? error.message : String(error));
    throw new Error(`gh ${args.join(' ')} failed: ${message}`);
  }
}

async function getCurrentRepo() {
  const output = await runGh(['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner']);
  const repo = output.trim();
  if (!repo) {
    throw new Error('Unable to resolve current repository from gh repo view.');
  }
  return repo;
}

async function listWorkflowRuns({ repo, workflow }) {
  const output = await runGh([
    'run',
    'list',
    '--repo',
    repo,
    '--workflow',
    workflow,
    '--limit',
    '30',
    '--json',
    'databaseId,status,conclusion,event,url,displayTitle,createdAt,updatedAt,headSha',
  ]);

  const parsed = JSON.parse(output || '[]');
  return Array.isArray(parsed) ? parsed : [];
}

async function dispatchWorkflow({ repo, workflow, fields }) {
  const args = ['workflow', 'run', workflow, '--repo', repo];
  for (const [key, value] of Object.entries(fields)) {
    args.push('-f', `${key}=${String(value)}`);
  }

  const dispatchStartMs = Date.now();
  await runGh(args);

  const lookupDeadline = Date.now() + DISPATCH_LOOKUP_TIMEOUT_MS;
  while (Date.now() < lookupDeadline) {
    const runs = await listWorkflowRuns({ repo, workflow });
    const candidate = runs
      .filter((run) => run.event === 'workflow_dispatch')
      .filter((run) => {
        const createdAtMs = Date.parse(run.createdAt ?? '');
        return Number.isFinite(createdAtMs) && createdAtMs >= dispatchStartMs - 5_000;
      })
      .sort(
        (left, right) => Date.parse(right.createdAt ?? '') - Date.parse(left.createdAt ?? ''),
      )[0];

    if (candidate?.databaseId) {
      return candidate.databaseId;
    }

    await sleep(2_500);
  }

  throw new Error(
    `Unable to locate dispatched workflow run for ${workflow} within ${DISPATCH_LOOKUP_TIMEOUT_MS}ms.`,
  );
}

async function getRunDetails({ repo, runId }) {
  const output = await runGh(['api', `repos/${repo}/actions/runs/${runId}`]);
  const parsed = JSON.parse(output || '{}');

  return {
    status: parsed.status ?? 'unknown',
    conclusion: parsed.conclusion ?? null,
    name: parsed.name ?? null,
    event: parsed.event ?? null,
    url: parsed.html_url ?? null,
    updatedAt: parsed.updated_at ?? null,
  };
}

async function waitForCompletion({ repo, runId, timeoutMs }) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const details = await getRunDetails({ repo, runId });
    if (details.status === 'completed') {
      return details;
    }

    await sleep(POLL_INTERVAL_MS);
  }

  return {
    status: 'completed',
    conclusion: 'timed_out',
    name: null,
    event: null,
    url: `https://github.com/${repo}/actions/runs/${runId}`,
    updatedAt: new Date().toISOString(),
  };
}

async function executeWorkflow({ repo, workflow, kind, target = null, fields, timeoutMs }) {
  const startedAt = new Date().toISOString();

  try {
    const runId = await dispatchWorkflow({ repo, workflow, fields });
    const details = await waitForCompletion({ repo, runId, timeoutMs });

    return {
      kind,
      workflow,
      target,
      inputs: fields,
      runId,
      startedAt,
      endedAt: new Date().toISOString(),
      status: details.status,
      conclusion: details.conclusion,
      url: details.url,
      updatedAt: details.updatedAt,
      ok: details.status === 'completed' && details.conclusion === 'success',
      error: null,
    };
  } catch (error) {
    return {
      kind,
      workflow,
      target,
      inputs: fields,
      runId: null,
      startedAt,
      endedAt: new Date().toISOString(),
      status: 'dispatch_failed',
      conclusion: 'failure',
      url: null,
      updatedAt: null,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function summarize(results) {
  const totals = {
    total: results.length,
    success: results.filter((entry) => entry.ok).length,
    failed: results.filter((entry) => !entry.ok).length,
  };

  return {
    totals,
    ok: totals.failed === 0,
  };
}

async function main() {
  const argv = process.argv.slice(2);

  const strict = parseBoolean(readArg(argv, '--strict') ?? 'true', true);
  const includeSmoke = parseBoolean(readArg(argv, '--include-smoke') ?? 'true', true);
  const includeRunner = parseBoolean(readArg(argv, '--include-runner') ?? 'true', true);
  const sendEmailTest = parseBoolean(readArg(argv, '--send-email-test') ?? 'false', false);
  const batchSize = readArg(argv, '--batch-size') ?? '5';
  const queryLimit = readArg(argv, '--query-limit') ?? '50';
  const maxFailedDispatch = readArg(argv, '--max-failed-dispatch') ?? '0';
  const summaryPath = readArg(argv, '--summary-path')?.trim() || null;
  const timeoutMs = parseInteger(readArg(argv, '--timeout-ms'), DEFAULT_RUN_TIMEOUT_MS);
  const repo = readArg(argv, '--repo')?.trim() || (await getCurrentRepo());

  const results = [];

  for (const target of ACTIVATION_TARGETS) {
    // Run strict/non-strict activation checks per scope to collect explicit evidence.
    results.push(
      await executeWorkflow({
        repo,
        workflow: 'Ops Activation Audit',
        kind: 'activation-audit',
        target,
        fields: {
          strict: strict ? 'true' : 'false',
          target,
        },
        timeoutMs,
      }),
    );
  }

  if (includeSmoke) {
    results.push(
      await executeWorkflow({
        repo,
        workflow: 'Notifications Smoke',
        kind: 'notifications-smoke',
        fields: {
          strict: strict ? 'true' : 'false',
          send_email_test: sendEmailTest ? 'true' : 'false',
        },
        timeoutMs,
      }),
    );
  }

  if (includeRunner) {
    results.push(
      await executeWorkflow({
        repo,
        workflow: 'Audio Edit Runner',
        kind: 'audio-edit-runner',
        fields: {
          batch_size: batchSize,
          query_limit: queryLimit,
          max_failed_dispatch: maxFailedDispatch,
        },
        timeoutMs,
      }),
    );
  }

  const aggregate = summarize(results);
  const summary = {
    generatedAt: new Date().toISOString(),
    repo,
    strict,
    includeSmoke,
    includeRunner,
    sendEmailTest,
    timeoutMs,
    batchSize,
    queryLimit,
    maxFailedDispatch,
    results,
    totals: aggregate.totals,
    ok: aggregate.ok,
  };

  if (summaryPath) {
    await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  }

  console.log('[ops-readiness-evidence] summary-json', JSON.stringify(summary));
  console.log(JSON.stringify(summary, null, 2));

  if (strict && !summary.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[ops-readiness-evidence] fatal error', error);
  process.exitCode = 1;
});
