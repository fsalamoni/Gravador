import crypto from 'node:crypto';
import { getServerDb } from '@/lib/firebase-server';
import { receiveWhatsAppAudio, receiveWhatsAppCloudAudio } from '@/lib/integration-sync';
import { enqueueFullPipelineJob } from '@/lib/jobs';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type InboundBody = {
  audioUrl?: string;
  mimeType?: string;
  durationMs?: number;
  title?: string;
  capturedAt?: string;
  phoneNumber?: string;
};

type WhatsAppCloudWebhookPayload = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: Array<{
          from?: string;
          timestamp?: string;
          type?: string;
          audio?: {
            id?: string;
            mime_type?: string;
          };
        }>;
      };
    }>;
  }>;
};

function timingSafeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function ensureCloudSignature(rawBody: string, signatureHeader: string | null) {
  const appSecret = process.env.WHATSAPP_CLOUD_APP_SECRET?.trim();
  if (!appSecret) return;
  if (!signatureHeader?.startsWith('sha256=')) {
    throw new Error('Assinatura da WhatsApp Cloud API ausente.');
  }

  const expected = `sha256=${crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;
  if (!timingSafeEqual(expected, signatureHeader)) {
    throw new Error('Assinatura inválida da WhatsApp Cloud API.');
  }
}

async function downloadWhatsAppCloudMedia(mediaId: string) {
  const accessToken = process.env.WHATSAPP_CLOUD_ACCESS_TOKEN?.trim();
  if (!accessToken) {
    throw new Error('WHATSAPP_CLOUD_ACCESS_TOKEN não configurado.');
  }

  const metaRes = await fetch(`https://graph.facebook.com/v20.0/${mediaId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!metaRes.ok) {
    const body = await metaRes.text();
    throw new Error(`Falha ao resolver mídia da WhatsApp Cloud API (${metaRes.status}): ${body}`);
  }

  const media = (await metaRes.json().catch(() => ({}))) as {
    url?: string;
    mime_type?: string;
  };

  if (!media.url) {
    throw new Error('Resposta da WhatsApp Cloud API sem URL de mídia.');
  }

  const mediaRes = await fetch(media.url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!mediaRes.ok) {
    const body = await mediaRes.text();
    throw new Error(`Falha ao baixar mídia da WhatsApp Cloud API (${mediaRes.status}): ${body}`);
  }

  const audioBytes = Buffer.from(await mediaRes.arrayBuffer());
  if (audioBytes.byteLength === 0) {
    throw new Error('Arquivo de áudio recebido pela WhatsApp Cloud API está vazio.');
  }

  return {
    audioBytes,
    mimeType: media.mime_type || mediaRes.headers.get('content-type') || 'audio/ogg',
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');
  const verifyToken = process.env.WHATSAPP_CLOUD_VERIFY_TOKEN?.trim();

  if (mode !== 'subscribe' || !challenge) {
    return NextResponse.json({ error: 'invalid_verification_request' }, { status: 400 });
  }

  if (!verifyToken) {
    return NextResponse.json({ error: 'verify_token_not_configured' }, { status: 501 });
  }

  if (!token || token !== verifyToken) {
    return NextResponse.json({ error: 'invalid_verify_token' }, { status: 403 });
  }

  return new NextResponse(challenge, {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

export async function POST(req: Request) {
  const token =
    req.headers.get('x-gravador-integration-token') ??
    new URL(req.url).searchParams.get('token') ??
    '';

  if (token) {
    const body = (await req.json().catch(() => ({}))) as InboundBody;

    if (!body.audioUrl) {
      return NextResponse.json({ error: 'missing_audio_url' }, { status: 400 });
    }

    try {
      const db = getServerDb();
      const result = await receiveWhatsAppAudio({
        db,
        token,
        audioUrl: body.audioUrl,
        mimeType: body.mimeType,
        durationMs: body.durationMs,
        title: body.title,
        capturedAt: body.capturedAt,
        phoneNumber: body.phoneNumber,
      });

      await enqueueFullPipelineJob(db, {
        recordingId: result.recordingId,
        workspaceId: result.workspaceId,
        source: 'whatsapp-inbound',
      });

      return NextResponse.json({ status: 'queued', mode: 'legacy-webhook', ...result });
    } catch (error) {
      return NextResponse.json(
        {
          error: 'whatsapp_inbound_failed',
          message: error instanceof Error ? error.message : 'Erro inesperado.',
        },
        { status: 400 },
      );
    }
  }

  const rawBody = await req.text();
  if (!rawBody.trim()) {
    return NextResponse.json({ error: 'empty_payload' }, { status: 400 });
  }

  try {
    ensureCloudSignature(rawBody, req.headers.get('x-hub-signature-256'));

    const payload = JSON.parse(rawBody) as WhatsAppCloudWebhookPayload;
    const events = (payload.entry ?? [])
      .flatMap((entry) => entry.changes ?? [])
      .flatMap((change) => change.value?.messages ?? [])
      .filter((message) => message.type === 'audio' && !!message.audio?.id && !!message.from);

    if (events.length === 0) {
      return NextResponse.json({ status: 'ignored', processed: 0 });
    }

    const db = getServerDb();
    let processed = 0;
    const failures: string[] = [];

    for (const event of events) {
      try {
        const media = await downloadWhatsAppCloudMedia(event.audio!.id!);
        const capturedAt = event.timestamp
          ? new Date(Number.parseInt(event.timestamp, 10) * 1000).toISOString()
          : undefined;

        const result = await receiveWhatsAppCloudAudio({
          db,
          phoneNumber: event.from!,
          audioBytes: media.audioBytes,
          mimeType: media.mimeType,
          capturedAt,
          title: `WhatsApp ${event.from}`,
        });

        await enqueueFullPipelineJob(db, {
          recordingId: result.recordingId,
          workspaceId: result.workspaceId,
          source: 'whatsapp-cloud-inbound',
        });

        processed += 1;
      } catch (error) {
        failures.push(error instanceof Error ? error.message : 'Erro inesperado no evento.');
      }
    }

    return NextResponse.json({
      status: failures.length > 0 ? 'partial' : 'queued',
      mode: 'meta-cloud',
      processed,
      failures,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'whatsapp_cloud_inbound_failed',
        message: error instanceof Error ? error.message : 'Erro inesperado.',
      },
      { status: 400 },
    );
  }
}
