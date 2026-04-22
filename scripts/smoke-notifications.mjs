import { writeFile } from 'node:fs/promises';

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

function truncate(value, max = 300) {
  if (typeof value !== 'string') return String(value ?? '');
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

async function probeWhatsAppCloud() {
  const accessToken = process.env.WHATSAPP_CLOUD_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID?.trim();

  if (!accessToken || !phoneNumberId) {
    return {
      check: 'whatsapp_cloud',
      status: 'skipped',
      message: 'WHATSAPP_CLOUD_ACCESS_TOKEN and/or WHATSAPP_CLOUD_PHONE_NUMBER_ID not configured.',
      details: null,
    };
  }

  const endpoint = new URL(`https://graph.facebook.com/v20.0/${phoneNumberId}`);
  endpoint.searchParams.set('fields', 'id,display_phone_number,verified_name');

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const bodyText = await response.text();
    const body = bodyText ? JSON.parse(bodyText) : null;

    if (!response.ok) {
      return {
        check: 'whatsapp_cloud',
        status: 'failed',
        message: `Graph API responded ${response.status}.`,
        details: truncate(bodyText),
      };
    }

    return {
      check: 'whatsapp_cloud',
      status: 'passed',
      message: 'Graph API credentials validated.',
      details: {
        id: body?.id ?? phoneNumberId,
        display_phone_number: body?.display_phone_number ?? null,
        verified_name: body?.verified_name ?? null,
      },
    };
  } catch (error) {
    return {
      check: 'whatsapp_cloud',
      status: 'failed',
      message: 'Network failure while probing WhatsApp Cloud API.',
      details: truncate(error instanceof Error ? error.message : String(error)),
    };
  }
}

async function probeEmailWebhook(sendTest) {
  const webhookUrl = process.env.EMAIL_NOTIFICATIONS_WEBHOOK_URL?.trim();
  const webhookToken = process.env.EMAIL_NOTIFICATIONS_WEBHOOK_TOKEN?.trim();

  if (!webhookUrl) {
    return {
      check: 'email_webhook',
      status: 'skipped',
      message: 'EMAIL_NOTIFICATIONS_WEBHOOK_URL not configured.',
      details: null,
    };
  }

  const headers = {
    'content-type': 'application/json',
    ...(webhookToken ? { 'x-gravador-email-token': webhookToken } : {}),
  };

  if (!sendTest) {
    try {
      const response = await fetch(webhookUrl, {
        method: 'GET',
        headers,
      });

      if (response.status >= 500) {
        const bodyText = await response.text();
        return {
          check: 'email_webhook',
          status: 'failed',
          message: `Webhook endpoint unhealthy (${response.status}).`,
          details: truncate(bodyText),
        };
      }

      return {
        check: 'email_webhook',
        status: 'passed',
        message: `Webhook endpoint reachable (${response.status}).`,
        details: { mode: 'reachability-only' },
      };
    } catch (error) {
      return {
        check: 'email_webhook',
        status: 'failed',
        message: 'Network failure while probing email webhook reachability.',
        details: truncate(error instanceof Error ? error.message : String(error)),
      };
    }
  }

  const smokeTo = process.env.EMAIL_NOTIFICATIONS_SMOKE_TO?.trim();
  if (!smokeTo) {
    return {
      check: 'email_webhook',
      status: 'failed',
      message: 'EMAIL_NOTIFICATIONS_SMOKE_TO is required when EMAIL_NOTIFICATIONS_SMOKE_SEND=true.',
      details: null,
    };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        event: 'notification.test',
        to: smokeTo,
        subject: 'Gravador notification smoke test',
        text: 'This is a smoke test payload from CI.',
        metadata: {
          source: 'notifications-smoke',
          dryRun: true,
          sentAt: new Date().toISOString(),
        },
      }),
    });

    const bodyText = await response.text();
    if (!response.ok) {
      return {
        check: 'email_webhook',
        status: 'failed',
        message: `Webhook send test failed (${response.status}).`,
        details: truncate(bodyText),
      };
    }

    return {
      check: 'email_webhook',
      status: 'passed',
      message: 'Webhook accepted smoke test payload.',
      details: {
        mode: 'send-test',
        responseStatus: response.status,
        responseBody: truncate(bodyText),
      },
    };
  } catch (error) {
    return {
      check: 'email_webhook',
      status: 'failed',
      message: 'Network failure while sending webhook smoke payload.',
      details: truncate(error instanceof Error ? error.message : String(error)),
    };
  }
}

function evaluateNotificationsFlag() {
  const enabled = parseBoolean(process.env.NEXT_PUBLIC_FF_NOTIFICATIONS_V1, false);
  return {
    check: 'notifications_feature_flag',
    status: enabled ? 'passed' : 'failed',
    message: enabled
      ? 'NEXT_PUBLIC_FF_NOTIFICATIONS_V1 is enabled.'
      : 'NEXT_PUBLIC_FF_NOTIFICATIONS_V1 is disabled.',
    details: { enabled },
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const strict = argv.includes('--strict');
  const summaryPath = readArg(argv, '--summary-path')?.trim() || null;
  const sendEmailTest = parseBoolean(process.env.EMAIL_NOTIFICATIONS_SMOKE_SEND, false);

  const checks = [];
  checks.push(evaluateNotificationsFlag());
  checks.push(await probeWhatsAppCloud());
  checks.push(await probeEmailWebhook(sendEmailTest));

  const totals = {
    passed: checks.filter((check) => check.status === 'passed').length,
    failed: checks.filter((check) => check.status === 'failed').length,
    skipped: checks.filter((check) => check.status === 'skipped').length,
  };

  const summary = {
    generatedAt: new Date().toISOString(),
    strict,
    sendEmailTest,
    checks,
    totals,
    ok: totals.failed === 0,
  };

  if (summaryPath) {
    await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  }

  console.log('[notifications-smoke] summary-json', JSON.stringify(summary));
  console.log(JSON.stringify(summary, null, 2));

  if (strict && totals.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[notifications-smoke] fatal error', error);
  process.exitCode = 1;
});
