import { writeFile } from 'node:fs/promises';

const VALID_TARGETS = new Set(['all', 'notifications', 'audio-edit', 'transcription']);

function parseBoolean(value, fallback = false) {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
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

function check(id, status, message, details = null) {
  return {
    check: id,
    status,
    message,
    details,
  };
}

function evaluateNotifications() {
  const checks = [];

  const smokeEnabled = parseBoolean(process.env.ENABLE_NOTIFICATIONS_SMOKE, false);
  const notificationsFlagEnabled = parseBoolean(process.env.NEXT_PUBLIC_FF_NOTIFICATIONS_V1, false);

  const hasWhatsAppToken = parseBoolean(process.env.HAS_WHATSAPP_CLOUD_ACCESS_TOKEN, false);
  const hasWhatsAppPhoneId = parseBoolean(process.env.HAS_WHATSAPP_CLOUD_PHONE_NUMBER_ID, false);
  const hasEmailWebhookUrl = parseBoolean(process.env.HAS_EMAIL_NOTIFICATIONS_WEBHOOK_URL, false);
  const hasEmailWebhookToken = parseBoolean(
    process.env.HAS_EMAIL_NOTIFICATIONS_WEBHOOK_TOKEN,
    false,
  );

  const whatsappConfigured = hasWhatsAppToken && hasWhatsAppPhoneId;
  const emailConfigured = hasEmailWebhookUrl && hasEmailWebhookToken;

  const whatsappPartial = hasWhatsAppToken !== hasWhatsAppPhoneId;
  const emailPartial = hasEmailWebhookUrl !== hasEmailWebhookToken;

  checks.push(
    check(
      'notifications.workflow_toggle',
      smokeEnabled ? 'passed' : 'failed',
      smokeEnabled
        ? 'ENABLE_NOTIFICATIONS_SMOKE is enabled.'
        : 'ENABLE_NOTIFICATIONS_SMOKE is disabled.',
      { enabled: smokeEnabled },
    ),
  );

  checks.push(
    check(
      'notifications.feature_flag',
      notificationsFlagEnabled ? 'passed' : 'failed',
      notificationsFlagEnabled
        ? 'NEXT_PUBLIC_FF_NOTIFICATIONS_V1 is enabled.'
        : 'NEXT_PUBLIC_FF_NOTIFICATIONS_V1 is disabled.',
      { enabled: notificationsFlagEnabled },
    ),
  );

  checks.push(
    check(
      'notifications.whatsapp_credentials',
      whatsappConfigured ? 'passed' : whatsappPartial ? 'failed' : 'skipped',
      whatsappConfigured
        ? 'WhatsApp Cloud credentials are fully configured.'
        : whatsappPartial
          ? 'WhatsApp Cloud credentials are partially configured.'
          : 'WhatsApp Cloud credentials are not configured.',
      {
        hasToken: hasWhatsAppToken,
        hasPhoneNumberId: hasWhatsAppPhoneId,
      },
    ),
  );

  checks.push(
    check(
      'notifications.email_webhook_credentials',
      emailConfigured ? 'passed' : emailPartial ? 'failed' : 'skipped',
      emailConfigured
        ? 'Email webhook credentials are fully configured.'
        : emailPartial
          ? 'Email webhook credentials are partially configured.'
          : 'Email webhook credentials are not configured.',
      {
        hasWebhookUrl: hasEmailWebhookUrl,
        hasWebhookToken: hasEmailWebhookToken,
      },
    ),
  );

  const providerReady = whatsappConfigured || emailConfigured;
  checks.push(
    check(
      'notifications.provider_minimum',
      providerReady ? 'passed' : 'failed',
      providerReady
        ? 'At least one notification provider is fully configured.'
        : 'No notification provider is fully configured.',
      {
        whatsappConfigured,
        emailConfigured,
      },
    ),
  );

  return checks;
}

function evaluateAudioEditRunner() {
  const checks = [];

  const runnerEnabled = parseBoolean(process.env.ENABLE_AUDIO_EDIT_RUNNER, false);
  const audioFlagEnabled = parseBoolean(process.env.NEXT_PUBLIC_FF_AUDIO_EDITING_V1, false);

  const hasServiceAccount = parseBoolean(process.env.HAS_FIREBASE_SERVICE_ACCOUNT, false);
  const hasProjectId = parseBoolean(process.env.HAS_FIREBASE_PROJECT_ID, false);
  const hasInternalJobsSecret = parseBoolean(process.env.HAS_INTERNAL_JOBS_SECRET, false);

  checks.push(
    check(
      'audio_runner.workflow_toggle',
      runnerEnabled ? 'passed' : 'failed',
      runnerEnabled
        ? 'ENABLE_AUDIO_EDIT_RUNNER is enabled.'
        : 'ENABLE_AUDIO_EDIT_RUNNER is disabled.',
      { enabled: runnerEnabled },
    ),
  );

  checks.push(
    check(
      'audio_runner.feature_flag',
      audioFlagEnabled ? 'passed' : 'failed',
      audioFlagEnabled
        ? 'NEXT_PUBLIC_FF_AUDIO_EDITING_V1 is enabled.'
        : 'NEXT_PUBLIC_FF_AUDIO_EDITING_V1 is disabled.',
      { enabled: audioFlagEnabled },
    ),
  );

  const missingSecrets = [];
  if (!hasServiceAccount) missingSecrets.push('FIREBASE_SERVICE_ACCOUNT');
  if (!hasProjectId) missingSecrets.push('FIREBASE_PROJECT_ID');
  if (!hasInternalJobsSecret) missingSecrets.push('INTERNAL_JOBS_SECRET');

  checks.push(
    check(
      'audio_runner.required_secrets',
      missingSecrets.length === 0 ? 'passed' : 'failed',
      missingSecrets.length === 0
        ? 'Runner required secrets are configured.'
        : `Runner required secrets are missing: ${missingSecrets.join(', ')}.`,
      {
        hasServiceAccount,
        hasProjectId,
        hasInternalJobsSecret,
        missingSecrets,
      },
    ),
  );

  return checks;
}

function evaluateTranscription() {
  const checks = [];

  const hasOpenAIKey = parseBoolean(process.env.HAS_OPENAI_API_KEY, false);
  const hasGroqKey = parseBoolean(process.env.HAS_GROQ_API_KEY, false);
  const hasLocalWhisperUrl = parseBoolean(process.env.HAS_LOCAL_WHISPER_URL, false);

  checks.push(
    check(
      'transcription.openai_key',
      hasOpenAIKey ? 'passed' : 'skipped',
      hasOpenAIKey
        ? 'OPENAI_API_KEY is configured for cloud transcription.'
        : 'OPENAI_API_KEY is not configured.',
      { configured: hasOpenAIKey },
    ),
  );

  checks.push(
    check(
      'transcription.groq_key',
      hasGroqKey ? 'passed' : 'skipped',
      hasGroqKey
        ? 'GROQ_API_KEY is configured for cloud transcription.'
        : 'GROQ_API_KEY is not configured.',
      { configured: hasGroqKey },
    ),
  );

  checks.push(
    check(
      'transcription.local_endpoint',
      hasLocalWhisperUrl ? 'passed' : 'skipped',
      hasLocalWhisperUrl
        ? 'LOCAL_WHISPER_URL is configured for self-host transcription.'
        : 'LOCAL_WHISPER_URL is not configured.',
      { configured: hasLocalWhisperUrl },
    ),
  );

  const providerReady = hasOpenAIKey || hasGroqKey || hasLocalWhisperUrl;
  checks.push(
    check(
      'transcription.provider_minimum',
      providerReady ? 'passed' : 'failed',
      providerReady
        ? 'At least one transcription path is configured (OpenAI, Groq, or local whisper).'
        : 'No transcription path is configured. Configure OPENAI_API_KEY, GROQ_API_KEY, or LOCAL_WHISPER_URL.',
      {
        hasOpenAIKey,
        hasGroqKey,
        hasLocalWhisperUrl,
      },
    ),
  );

  return checks;
}

function computeTotals(checks) {
  return {
    passed: checks.filter((entry) => entry.status === 'passed').length,
    failed: checks.filter((entry) => entry.status === 'failed').length,
    skipped: checks.filter((entry) => entry.status === 'skipped').length,
  };
}

async function main() {
  const argv = process.argv.slice(2);

  const strict = argv.includes('--strict');
  const summaryPath = readArg(argv, '--summary-path')?.trim() || null;
  const target = (readArg(argv, '--target')?.trim() || 'all').toLowerCase();

  if (!VALID_TARGETS.has(target)) {
    throw new Error(
      `Invalid --target value: ${target}. Expected one of: ${Array.from(VALID_TARGETS).join(', ')}.`,
    );
  }

  const checks = [];
  if (target === 'all' || target === 'notifications') {
    checks.push(...evaluateNotifications());
  }
  if (target === 'all' || target === 'audio-edit') {
    checks.push(...evaluateAudioEditRunner());
  }
  if (target === 'all' || target === 'transcription') {
    checks.push(...evaluateTranscription());
  }

  const totals = computeTotals(checks);

  const summary = {
    generatedAt: new Date().toISOString(),
    strict,
    target,
    checks,
    totals,
    ok: totals.failed === 0,
  };

  if (summaryPath) {
    await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  }

  console.log('[ops-activation-audit] summary-json', JSON.stringify(summary));
  console.log(JSON.stringify(summary, null, 2));

  if (strict && totals.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[ops-activation-audit] fatal error', error);
  process.exitCode = 1;
});
