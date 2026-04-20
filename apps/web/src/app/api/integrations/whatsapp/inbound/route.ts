import { getServerDb } from '@/lib/firebase-server';
import { receiveWhatsAppAudio } from '@/lib/integration-sync';
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

export async function POST(req: Request) {
  const token =
    req.headers.get('x-gravador-integration-token') ??
    new URL(req.url).searchParams.get('token') ??
    '';
  const body = (await req.json().catch(() => ({}))) as InboundBody;

  if (!token) {
    return NextResponse.json({ error: 'missing_token' }, { status: 401 });
  }
  if (!body.audioUrl) {
    return NextResponse.json({ error: 'missing_audio_url' }, { status: 400 });
  }

  try {
    const result = await receiveWhatsAppAudio({
      db: getServerDb(),
      token,
      audioUrl: body.audioUrl,
      mimeType: body.mimeType,
      durationMs: body.durationMs,
      title: body.title,
      capturedAt: body.capturedAt,
      phoneNumber: body.phoneNumber,
    });
    return NextResponse.json({ status: 'queued', ...result });
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
