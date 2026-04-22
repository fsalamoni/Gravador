import { getServerStorage } from '@/lib/firebase-server';
import {
  buildRecordingMarkdown,
  getRecordingExportBundle,
  sanitizeFilename,
} from '@/lib/recording-export';
import { shortId } from '@gravador/core';
import type { Firestore } from 'firebase-admin/firestore';

export type IntegrationId =
  | 'google-drive'
  | 'google-calendar'
  | 'onedrive'
  | 'dropbox'
  | 'whatsapp'
  | 'email';

type StorageIntegrationId = Extract<IntegrationId, 'google-drive' | 'onedrive' | 'dropbox'>;

type StoredIntegrationDoc = {
  status?: string;
  type?: 'oauth' | 'webhook';
  deliveryMode?: 'webhook' | 'meta-cloud';
  provider?: string;
  connectedAt?: string | null;
  connectedEmail?: string | null;
  tokenType?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  expiresIn?: number | null;
  tokenObtainedAt?: string | null;
  scope?: string | null;
  targetFolder?: string | null;
  phoneNumber?: string | null;
  phoneNumberNormalized?: string | null;
  emailAddress?: string | null;
  webhookUrl?: string | null;
  inboundToken?: string | null;
  lastSyncedAt?: string | null;
  lastSyncStatus?: string | null;
  lastSyncError?: string | null;
  lastSentAt?: string | null;
};

type RecordingStorageDoc = {
  title?: string;
  workspaceId: string;
  createdBy: string;
  storagePath: string;
  mimeType?: string | null;
};

export interface IntegrationClientView {
  id: IntegrationId;
  status: 'disconnected' | 'connected';
  deliveryMode?: 'webhook' | 'meta-cloud' | null;
  connectedAt?: string | null;
  connectedEmail?: string | null;
  targetFolder?: string | null;
  phoneNumber?: string | null;
  emailAddress?: string | null;
  receiveUrl?: string | null;
  receiveToken?: string | null;
  lastSyncedAt?: string | null;
  lastSyncStatus?: string | null;
  lastSyncError?: string | null;
  lastSentAt?: string | null;
}

export interface StorageSyncResult {
  integrationId: StorageIntegrationId;
  recordingId: string;
  folderPath: string;
  uploadedFiles: string[];
}

export interface WhatsAppSendResult {
  integrationId: 'whatsapp';
  recordingId: string;
  target: string | null;
}

export interface EmailSendResult {
  integrationId: 'email';
  recordingId: string | null;
  target: string | null;
}

const OAUTH_ENV: Record<
  StorageIntegrationId | 'google-calendar',
  { clientId: string; clientSecret: string; tokenUrl: string }
> = {
  'google-drive': {
    clientId: 'GOOGLE_OAUTH_CLIENT_ID',
    clientSecret: 'GOOGLE_OAUTH_CLIENT_SECRET',
    tokenUrl: 'https://oauth2.googleapis.com/token',
  },
  'google-calendar': {
    clientId: 'GOOGLE_OAUTH_CLIENT_ID',
    clientSecret: 'GOOGLE_OAUTH_CLIENT_SECRET',
    tokenUrl: 'https://oauth2.googleapis.com/token',
  },
  onedrive: {
    clientId: 'MICROSOFT_OAUTH_CLIENT_ID',
    clientSecret: 'MICROSOFT_OAUTH_CLIENT_SECRET',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
  },
  dropbox: {
    clientId: 'DROPBOX_OAUTH_CLIENT_ID',
    clientSecret: 'DROPBOX_OAUTH_CLIENT_SECRET',
    tokenUrl: 'https://api.dropboxapi.com/oauth2/token',
  },
};

export function getDefaultTargetFolder(integrationId: StorageIntegrationId) {
  switch (integrationId) {
    case 'google-drive':
      return '/Gravador';
    case 'onedrive':
      return '/Apps/Gravador';
    case 'dropbox':
      return '/Apps/Gravador';
  }
}

export function normalizeTargetFolder(
  input: string | null | undefined,
  integrationId: StorageIntegrationId,
) {
  const trimmed = input?.trim();
  if (!trimmed) return getDefaultTargetFolder(integrationId);
  const withoutTrailing = trimTrailingSlashes(trimmed);
  return withoutTrailing.startsWith('/') ? withoutTrailing : `/${withoutTrailing}`;
}

export function buildWhatsAppReceiveUrl(appBaseUrl: string) {
  return `${trimTrailingSlashes(appBaseUrl)}/api/integrations/whatsapp/inbound`;
}

export function normalizePhoneNumber(input: string | null | undefined) {
  const raw = input?.trim() ?? '';
  if (!raw) return null;

  const digits = raw.replace(/[^\d]/g, '');
  if (!digits) return null;
  return `+${digits}`;
}

export function sanitizeIntegrationForClient(
  integrationId: IntegrationId,
  raw: StoredIntegrationDoc | undefined,
  appBaseUrl: string,
): IntegrationClientView {
  if (!raw || raw.status !== 'connected') {
    return { id: integrationId, status: 'disconnected' };
  }

  const common = {
    id: integrationId,
    status: 'connected' as const,
    connectedAt: raw.connectedAt ?? null,
    connectedEmail: raw.connectedEmail ?? null,
    targetFolder:
      integrationId === 'google-drive' ||
      integrationId === 'onedrive' ||
      integrationId === 'dropbox'
        ? normalizeTargetFolder(raw.targetFolder, integrationId)
        : null,
    phoneNumber: raw.phoneNumber ?? null,
    emailAddress: raw.emailAddress ?? null,
    lastSyncedAt: raw.lastSyncedAt ?? null,
    lastSyncStatus: raw.lastSyncStatus ?? null,
    lastSyncError: raw.lastSyncError ?? null,
    lastSentAt: raw.lastSentAt ?? null,
  };

  if (integrationId === 'whatsapp') {
    return {
      ...common,
      deliveryMode: raw.deliveryMode ?? null,
      receiveUrl: buildWhatsAppReceiveUrl(appBaseUrl),
      receiveToken: raw.inboundToken ?? null,
    };
  }

  if (integrationId === 'email') {
    return {
      ...common,
      deliveryMode: 'webhook',
    };
  }

  return common;
}

export async function syncRecordingToStorageIntegration(params: {
  db: Firestore;
  userId: string;
  integrationId: StorageIntegrationId;
  recordingId: string;
}): Promise<StorageSyncResult> {
  const integration = await getConnectedIntegration(params.db, params.userId, params.integrationId);
  const accessToken = await ensureAccessToken(
    params.db,
    params.userId,
    params.integrationId,
    integration,
  );
  const recordingDoc = await params.db.collection('recordings').doc(params.recordingId).get();
  if (!recordingDoc.exists) {
    throw new Error('Gravação não encontrada para sincronização.');
  }

  const recording = recordingDoc.data() as RecordingStorageDoc;
  const bundle = await getRecordingExportBundle(params.db, params.recordingId, params.userId);
  const markdown = buildRecordingMarkdown(bundle);
  const manifest = JSON.stringify(bundle, null, 2);
  const audioBytes = await downloadRecordingAudio(recording.storagePath);
  const recordingFolderName = buildRecordingFolderName(bundle.recording.title, params.recordingId);
  const targetFolder = normalizeTargetFolder(integration.targetFolder, params.integrationId);
  const fullFolderPath = joinPathSegments(targetFolder, recordingFolderName);
  const baseName = sanitizeFilename(bundle.recording.title || params.recordingId);
  const audioExt = fileExtensionFromMime(recording.mimeType, recording.storagePath);
  const files = [
    {
      name: `${baseName}${audioExt}`,
      bytes: audioBytes,
      contentType: recording.mimeType ?? 'audio/mp4',
    },
    {
      name: `${baseName}.json`,
      bytes: Buffer.from(manifest, 'utf8'),
      contentType: 'application/json',
    },
    {
      name: `${baseName}.md`,
      bytes: Buffer.from(markdown, 'utf8'),
      contentType: 'text/markdown; charset=utf-8',
    },
  ];

  if (params.integrationId === 'google-drive') {
    const folderId = await ensureGoogleDriveFolder(accessToken, fullFolderPath);
    for (const file of files) {
      await uploadGoogleDriveFile(accessToken, folderId, file);
    }
  } else if (params.integrationId === 'onedrive') {
    await ensureOneDriveFolder(accessToken, fullFolderPath);
    for (const file of files) {
      await uploadOneDriveFile(
        accessToken,
        `${fullFolderPath}/${file.name}`,
        file.bytes,
        file.contentType,
      );
    }
  } else {
    await ensureDropboxFolder(accessToken, fullFolderPath);
    for (const file of files) {
      await uploadDropboxFile(
        accessToken,
        `${fullFolderPath}/${file.name}`,
        file.bytes,
        file.contentType,
      );
    }
  }

  await markIntegrationSync(params.db, params.userId, params.integrationId, 'ok');
  return {
    integrationId: params.integrationId,
    recordingId: params.recordingId,
    folderPath: fullFolderPath,
    uploadedFiles: files.map((file) => file.name),
  };
}

export async function sendRecordingToWhatsAppWebhook(params: {
  db: Firestore;
  userId: string;
  recordingId: string;
}): Promise<WhatsAppSendResult> {
  const integration = await getConnectedIntegration(params.db, params.userId, 'whatsapp');
  const normalizedPhone = normalizePhoneNumber(integration.phoneNumber);
  if (!normalizedPhone) {
    throw new Error('Número do WhatsApp não configurado para envio.');
  }

  const hasMetaCloudConfig = Boolean(
    process.env.WHATSAPP_CLOUD_ACCESS_TOKEN && process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID,
  );
  const shouldUseMetaCloud =
    integration.deliveryMode === 'meta-cloud' || (!integration.webhookUrl && hasMetaCloudConfig);

  if (!shouldUseMetaCloud && !integration.webhookUrl) {
    throw new Error('Webhook do WhatsApp não configurado.');
  }

  const recordingDoc = await params.db.collection('recordings').doc(params.recordingId).get();
  if (!recordingDoc.exists) {
    throw new Error('Gravação não encontrada para envio ao WhatsApp.');
  }
  const recording = recordingDoc.data() as RecordingStorageDoc;
  const bundle = await getRecordingExportBundle(params.db, params.recordingId, params.userId);
  const markdown = buildRecordingMarkdown(bundle);
  const audioUrl = await getSignedRecordingUrl(recording.storagePath);
  const summary =
    (bundle.outputs.summary as { tldr?: string; bullets?: string[] } | undefined) ?? undefined;

  if (shouldUseMetaCloud) {
    await sendRecordingToWhatsAppCloud({
      phoneNumber: normalizedPhone,
      title: bundle.recording.title ?? params.recordingId,
      summary: summary?.tldr ?? null,
      audioUrl,
    });
  } else {
    const res = await fetch(integration.webhookUrl!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(integration.inboundToken
          ? { 'x-gravador-integration-token': integration.inboundToken }
          : {}),
      },
      body: JSON.stringify({
        event: 'recording.ready',
        phoneNumber: normalizedPhone,
        recording: bundle.recording,
        transcript: bundle.transcript,
        markdown,
        summary: summary?.tldr ?? null,
        bullets: summary?.bullets ?? [],
        audioUrl,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Webhook do WhatsApp respondeu ${res.status}: ${body || 'sem detalhes'}`);
    }
  }

  await params.db
    .collection('users')
    .doc(params.userId)
    .collection('integrations')
    .doc('whatsapp')
    .set(
      {
        lastSentAt: new Date().toISOString(),
        lastSyncStatus: 'ok',
        lastSyncError: null,
      },
      { merge: true },
    );

  return {
    integrationId: 'whatsapp',
    recordingId: params.recordingId,
    target: normalizedPhone,
  };
}

export async function sendWhatsAppNotificationTest(params: {
  db: Firestore;
  userId: string;
}): Promise<WhatsAppSendResult> {
  const integration = await getConnectedIntegration(params.db, params.userId, 'whatsapp');
  const normalizedPhone = normalizePhoneNumber(integration.phoneNumber);
  if (!normalizedPhone) {
    throw new Error('Número do WhatsApp não configurado para envio de teste.');
  }

  const hasMetaCloudConfig = Boolean(
    process.env.WHATSAPP_CLOUD_ACCESS_TOKEN && process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID,
  );
  const shouldUseMetaCloud =
    integration.deliveryMode === 'meta-cloud' || (!integration.webhookUrl && hasMetaCloudConfig);

  if (!shouldUseMetaCloud && !integration.webhookUrl) {
    throw new Error('Webhook do WhatsApp não configurado.');
  }

  if (shouldUseMetaCloud) {
    const accessToken = process.env.WHATSAPP_CLOUD_ACCESS_TOKEN?.trim();
    const phoneNumberId = process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID?.trim();
    if (!accessToken || !phoneNumberId) {
      throw new Error('WhatsApp Cloud API não configurada no ambiente.');
    }
    const endpoint = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;
    const recipient = normalizedPhone.replace(/[^\d]/g, '');
    if (!recipient) {
      throw new Error('Número de destino inválido para WhatsApp Cloud API.');
    }

    await sendWhatsAppCloudPayload(endpoint, accessToken, {
      messaging_product: 'whatsapp',
      to: recipient,
      type: 'text',
      text: { body: '✅ Teste de notificação do Gravador concluído com sucesso.' },
    });
  } else {
    const res = await fetch(integration.webhookUrl!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(integration.inboundToken
          ? { 'x-gravador-integration-token': integration.inboundToken }
          : {}),
      },
      body: JSON.stringify({
        event: 'notification.test',
        phoneNumber: normalizedPhone,
        message: 'Teste de notificação do Gravador concluído com sucesso.',
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Webhook do WhatsApp respondeu ${res.status}: ${body || 'sem detalhes'}`);
    }
  }

  await params.db
    .collection('users')
    .doc(params.userId)
    .collection('integrations')
    .doc('whatsapp')
    .set(
      {
        lastSentAt: new Date().toISOString(),
        lastSyncStatus: 'ok',
        lastSyncError: null,
      },
      { merge: true },
    );

  return {
    integrationId: 'whatsapp',
    recordingId: 'test',
    target: normalizedPhone,
  };
}

export async function sendRecordingToEmailIntegration(params: {
  db: Firestore;
  userId: string;
  recordingId: string;
}): Promise<EmailSendResult> {
  const integration = await getConnectedIntegration(params.db, params.userId, 'email');
  const emailAddress = normalizeEmailAddress(integration.emailAddress);
  if (!emailAddress) {
    throw new Error('E-mail de destino não configurado para integração de notificações.');
  }
  const webhookUrl = process.env.EMAIL_NOTIFICATIONS_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    throw new Error('Canal de e-mail não configurado no ambiente.');
  }

  const recordingDoc = await params.db.collection('recordings').doc(params.recordingId).get();
  if (!recordingDoc.exists) {
    throw new Error('Gravação não encontrada para envio de e-mail.');
  }

  const bundle = await getRecordingExportBundle(params.db, params.recordingId, params.userId);
  const summary =
    (bundle.outputs.summary as { tldr?: string; bullets?: string[] } | undefined) ?? undefined;
  const markdown = buildRecordingMarkdown(bundle);

  await sendEmailWebhook(webhookUrl, {
    event: 'recording.ready',
    to: emailAddress,
    subject: `Gravador • ${bundle.recording.title ?? params.recordingId}`,
    text: summary?.tldr ?? 'Uma nova gravação foi processada no Gravador.',
    markdown,
    recordingId: params.recordingId,
  });

  await params.db
    .collection('users')
    .doc(params.userId)
    .collection('integrations')
    .doc('email')
    .set(
      {
        lastSentAt: new Date().toISOString(),
        lastSyncStatus: 'ok',
        lastSyncError: null,
      },
      { merge: true },
    );

  return {
    integrationId: 'email',
    recordingId: params.recordingId,
    target: emailAddress,
  };
}

export async function sendEmailNotificationTest(params: {
  db: Firestore;
  userId: string;
}): Promise<EmailSendResult> {
  const integration = await getConnectedIntegration(params.db, params.userId, 'email');
  const emailAddress = normalizeEmailAddress(integration.emailAddress);
  if (!emailAddress) {
    throw new Error('E-mail de destino não configurado para teste.');
  }
  const webhookUrl = process.env.EMAIL_NOTIFICATIONS_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    throw new Error('Canal de e-mail não configurado no ambiente.');
  }

  await sendEmailWebhook(webhookUrl, {
    event: 'notification.test',
    to: emailAddress,
    subject: 'Gravador • teste de notificação',
    text: 'Este é um envio de teste da integração de e-mail.',
  });

  await params.db
    .collection('users')
    .doc(params.userId)
    .collection('integrations')
    .doc('email')
    .set(
      {
        lastSentAt: new Date().toISOString(),
        lastSyncStatus: 'ok',
        lastSyncError: null,
      },
      { merge: true },
    );

  return {
    integrationId: 'email',
    recordingId: null,
    target: emailAddress,
  };
}

async function sendRecordingToWhatsAppCloud(params: {
  phoneNumber: string;
  title: string;
  summary: string | null;
  audioUrl: string;
}) {
  const accessToken = process.env.WHATSAPP_CLOUD_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID?.trim();
  if (!accessToken || !phoneNumberId) {
    throw new Error('WhatsApp Cloud API não configurada no ambiente.');
  }

  const endpoint = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;
  const recipient = params.phoneNumber.replace(/[^\d]/g, '');
  if (!recipient) {
    throw new Error('Número de destino inválido para WhatsApp Cloud API.');
  }

  const text = [
    `🎙️ ${params.title}`,
    params.summary ? `Resumo: ${params.summary}` : 'Seu áudio foi processado com sucesso.',
  ]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 4096);

  await sendWhatsAppCloudPayload(endpoint, accessToken, {
    messaging_product: 'whatsapp',
    to: recipient,
    type: 'text',
    text: { body: text },
  });

  await sendWhatsAppCloudPayload(endpoint, accessToken, {
    messaging_product: 'whatsapp',
    to: recipient,
    type: 'audio',
    audio: { link: params.audioUrl },
  });
}

async function sendWhatsAppCloudPayload(
  endpoint: string,
  accessToken: string,
  payload: Record<string, unknown>,
) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`WhatsApp Cloud API respondeu ${res.status}: ${body || 'sem detalhes'}`);
  }
}

export async function receiveWhatsAppAudio(params: {
  db: Firestore;
  token: string;
  audioUrl: string;
  mimeType?: string | null;
  durationMs?: number | null;
  title?: string | null;
  capturedAt?: string | null;
  phoneNumber?: string | null;
}): Promise<{ recordingId: string; workspaceId: string; userId: string }> {
  const resolved = await resolveWhatsAppIntegrationByToken(params.db, params.token);

  const remoteRes = await fetch(params.audioUrl);
  if (!remoteRes.ok) {
    throw new Error(`Falha ao baixar o áudio remoto (${remoteRes.status}).`);
  }

  const contentType =
    params.mimeType?.trim() || remoteRes.headers.get('content-type') || 'audio/mpeg';
  const arrayBuffer = await remoteRes.arrayBuffer();
  if (arrayBuffer.byteLength === 0) {
    throw new Error('O áudio recebido está vazio.');
  }

  return createRecordingFromAudioBytes({
    db: params.db,
    userId: resolved.userId,
    integration: resolved.integration,
    audioBytes: Buffer.from(arrayBuffer),
    mimeType: contentType,
    durationMs: params.durationMs,
    title: params.title,
    capturedAt: params.capturedAt,
    phoneNumber: params.phoneNumber,
    source: 'whatsapp-webhook',
    fallbackPath: params.audioUrl,
  });
}

export async function receiveWhatsAppCloudAudio(params: {
  db: Firestore;
  phoneNumber: string;
  audioBytes: Buffer;
  mimeType?: string | null;
  durationMs?: number | null;
  title?: string | null;
  capturedAt?: string | null;
}): Promise<{ recordingId: string; workspaceId: string; userId: string }> {
  const normalizedPhone = normalizePhoneNumber(params.phoneNumber);
  if (!normalizedPhone) {
    throw new Error('Número de origem inválido no WhatsApp Cloud API.');
  }

  const resolved = await resolveWhatsAppIntegrationByPhone(params.db, normalizedPhone);
  return createRecordingFromAudioBytes({
    db: params.db,
    userId: resolved.userId,
    integration: resolved.integration,
    audioBytes: params.audioBytes,
    mimeType: params.mimeType?.trim() || 'audio/ogg',
    durationMs: params.durationMs,
    title: params.title,
    capturedAt: params.capturedAt,
    phoneNumber: normalizedPhone,
    source: 'whatsapp-cloud',
  });
}

type ResolvedWhatsAppIntegration = {
  userId: string;
  integration: StoredIntegrationDoc;
};

async function resolveWhatsAppIntegrationByToken(
  db: Firestore,
  token: string,
): Promise<ResolvedWhatsAppIntegration> {
  const match = await db
    .collectionGroup('integrations')
    .where('inboundToken', '==', token)
    .limit(1)
    .get();

  if (match.empty) {
    throw new Error('Token de integração inválido.');
  }

  const integrationRef = match.docs[0]!.ref;
  const integration = match.docs[0]!.data() as StoredIntegrationDoc;
  if (integrationRef.id !== 'whatsapp' || integration.status !== 'connected') {
    throw new Error('Integração do WhatsApp não está ativa.');
  }

  const userId = integrationRef.parent.parent?.id;
  if (!userId) {
    throw new Error('Não foi possível identificar o usuário da integração.');
  }

  return { userId, integration };
}

async function resolveWhatsAppIntegrationByPhone(
  db: Firestore,
  phoneNumberNormalized: string,
): Promise<ResolvedWhatsAppIntegration> {
  const matchByNormalized = await db
    .collectionGroup('integrations')
    .where('phoneNumberNormalized', '==', phoneNumberNormalized)
    .limit(5)
    .get();

  const normalizedDoc = matchByNormalized.docs.find(
    (doc) => doc.ref.id === 'whatsapp' && doc.data().status === 'connected',
  );

  const fallbackDoc =
    normalizedDoc ??
    (
      await db
        .collectionGroup('integrations')
        .where('phoneNumber', '==', phoneNumberNormalized)
        .limit(5)
        .get()
    ).docs.find((doc) => doc.ref.id === 'whatsapp' && doc.data().status === 'connected');

  const integrationDoc = fallbackDoc;
  if (!integrationDoc) {
    throw new Error('Nenhuma integração WhatsApp ativa encontrada para este número.');
  }

  const userId = integrationDoc.ref.parent.parent?.id;
  if (!userId) {
    throw new Error('Não foi possível identificar o usuário da integração WhatsApp.');
  }

  return {
    userId,
    integration: integrationDoc.data() as StoredIntegrationDoc,
  };
}

async function createRecordingFromAudioBytes(params: {
  db: Firestore;
  userId: string;
  integration: StoredIntegrationDoc;
  audioBytes: Buffer;
  mimeType: string;
  durationMs?: number | null;
  title?: string | null;
  capturedAt?: string | null;
  phoneNumber?: string | null;
  source: 'whatsapp-webhook' | 'whatsapp-cloud';
  fallbackPath?: string | null;
}) {
  if (params.audioBytes.byteLength === 0) {
    throw new Error('O áudio recebido está vazio.');
  }

  const workspaceId = await resolvePrimaryWorkspaceId(params.db, params.userId);
  if (!workspaceId) {
    throw new Error('Nenhum workspace encontrado para a integração.');
  }

  const id = shortId();
  const ext = fileExtensionFromMime(params.mimeType, params.fallbackPath);
  const storagePath = `anotes/audio-raw/${workspaceId}/${id}${ext}`;
  const bucket = getServerStorage().bucket();
  const normalizedPhone = normalizePhoneNumber(
    params.phoneNumber ?? params.integration.phoneNumber,
  );

  await bucket.file(storagePath).save(params.audioBytes, {
    resumable: false,
    contentType: params.mimeType,
    metadata: {
      metadata: {
        source: params.source,
        phoneNumber: normalizedPhone ?? '',
      },
    },
  });

  const capturedAt = params.capturedAt ? new Date(params.capturedAt) : new Date();
  const title =
    params.title?.trim() ||
    `WhatsApp ${normalizedPhone ?? ''}`.trim() ||
    `WhatsApp ${capturedAt.toISOString()}`;
  const now = new Date();

  await params.db
    .collection('recordings')
    .doc(id)
    .set({
      workspaceId,
      createdBy: params.userId,
      status: 'transcribing',
      title,
      durationMs: params.durationMs ?? 0,
      sizeBytes: params.audioBytes.byteLength,
      mimeType: params.mimeType,
      storagePath,
      storageBucket: 'default',
      capturedAt,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      source: 'whatsapp',
      sourceChannel: params.source,
      sourcePhoneNumber: normalizedPhone,
      lifecycle: {
        schemaVersion: 1,
        status: 'active',
        recordingVersion: 1,
        retainedVersions: 1,
        source: 'whatsapp',
        activeAudioVersionId: id,
        archivedAt: null,
        trashedAt: null,
        lastEvent: 'created',
        lastEventAt: now,
        lastEventBy: params.userId,
      },
      retention: {
        keepOriginal: true,
        keepEditedVersions: true,
        manualDeleteOnly: true,
        purgeAfterDays: null,
      },
    });

  return { recordingId: id, workspaceId, userId: params.userId };
}

export function normalizeEmailAddress(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase() ?? '';
  if (!normalized) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return null;
  if (normalized.includes('..')) return null;
  return normalized;
}

async function sendEmailWebhook(
  webhookUrl: string,
  payload: {
    event: 'recording.ready' | 'notification.test';
    to: string;
    subject: string;
    text: string;
    markdown?: string;
    recordingId?: string;
  },
) {
  const token = process.env.EMAIL_NOTIFICATIONS_WEBHOOK_TOKEN?.trim();
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Provider de e-mail respondeu ${res.status}: ${body || 'sem detalhes'}`);
  }
}

async function getConnectedIntegration(
  db: Firestore,
  userId: string,
  integrationId: IntegrationId,
): Promise<StoredIntegrationDoc> {
  const doc = await db
    .collection('users')
    .doc(userId)
    .collection('integrations')
    .doc(integrationId)
    .get();
  const data = doc.data() as StoredIntegrationDoc | undefined;
  if (!doc.exists || data?.status !== 'connected') {
    throw new Error(`Integração ${integrationId} não está conectada.`);
  }
  return data;
}

async function ensureAccessToken(
  db: Firestore,
  userId: string,
  integrationId: StorageIntegrationId,
  integration: StoredIntegrationDoc,
) {
  const accessToken = integration.accessToken?.trim();
  if (!accessToken) {
    throw new Error(`Integração ${integrationId} sem access token.`);
  }

  const obtainedAt = integration.tokenObtainedAt ? new Date(integration.tokenObtainedAt) : null;
  const expiresIn = integration.expiresIn ?? null;
  const shouldRefresh =
    Boolean(integration.refreshToken) &&
    obtainedAt &&
    expiresIn != null &&
    obtainedAt.getTime() + expiresIn * 1000 - Date.now() < 5 * 60 * 1000;

  if (!shouldRefresh) {
    return accessToken;
  }

  return refreshAccessToken(db, userId, integrationId, integration);
}

async function refreshAccessToken(
  db: Firestore,
  userId: string,
  integrationId: StorageIntegrationId,
  integration: StoredIntegrationDoc,
) {
  const config = OAUTH_ENV[integrationId];
  const clientId = process.env[config.clientId];
  const clientSecret = process.env[config.clientSecret];
  const refreshToken = integration.refreshToken?.trim();
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(`Integração ${integrationId} não consegue renovar token.`);
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  const res = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    throw new Error(`Falha ao renovar token ${integrationId} (${res.status}).`);
  }

  const token = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
  };
  if (!token.access_token) {
    throw new Error(`Renovação de token ${integrationId} não retornou access_token.`);
  }

  await db
    .collection('users')
    .doc(userId)
    .collection('integrations')
    .doc(integrationId)
    .set(
      {
        accessToken: token.access_token,
        refreshToken: token.refresh_token ?? refreshToken,
        expiresIn: token.expires_in ?? integration.expiresIn ?? null,
        scope: token.scope ?? integration.scope ?? null,
        tokenType: token.token_type ?? integration.tokenType ?? 'Bearer',
        tokenObtainedAt: new Date().toISOString(),
      },
      { merge: true },
    );

  return token.access_token;
}

async function downloadRecordingAudio(storagePath: string) {
  const bucket = getServerStorage().bucket();
  const [bytes] = await bucket.file(storagePath).download();
  return bytes;
}

async function getSignedRecordingUrl(storagePath: string) {
  const bucket = getServerStorage().bucket();
  const [url] = await bucket.file(storagePath).getSignedUrl({
    action: 'read',
    expires: Date.now() + 60 * 60 * 1000,
  });
  return url;
}

function buildRecordingFolderName(title: string, recordingId: string) {
  const slug = sanitizeFilename(title || 'recording').replace(/\s+/g, '-');
  return `${slug || 'recording'}-${recordingId.slice(0, 8)}`;
}

function fileExtensionFromMime(mimeType?: string | null, fallbackPath?: string | null) {
  const normalized = mimeType?.toLowerCase() ?? '';
  if (normalized.includes('webm')) return '.webm';
  if (normalized.includes('mpeg')) return '.mp3';
  if (normalized.includes('wav')) return '.wav';
  if (normalized.includes('ogg')) return '.ogg';
  if (normalized.includes('aac') || normalized.includes('mp4') || normalized.includes('m4a')) {
    return '.m4a';
  }
  const fromPath = fallbackPath?.match(/\.[a-z0-9]+$/i)?.[0];
  return fromPath ?? '.m4a';
}

async function ensureGoogleDriveFolder(accessToken: string, targetPath: string) {
  let parentId = 'root';
  for (const segment of splitFolderPath(targetPath)) {
    const query = encodeURIComponent(
      `mimeType='application/vnd.google-apps.folder' and trashed=false and name='${escapeGoogleDriveQueryValue(segment)}' and '${escapeGoogleDriveQueryValue(parentId)}' in parents`,
    );
    const listRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&pageSize=1`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    if (!listRes.ok) {
      throw new Error(`Falha ao consultar pasta no Google Drive (${listRes.status}).`);
    }
    const list = (await listRes.json()) as { files?: Array<{ id: string }> };
    if (list.files?.[0]?.id) {
      parentId = list.files[0].id;
      continue;
    }

    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: segment,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      }),
    });
    if (!createRes.ok) {
      throw new Error(`Falha ao criar pasta no Google Drive (${createRes.status}).`);
    }
    const created = (await createRes.json()) as { id?: string };
    if (!created.id) {
      throw new Error('Google Drive não retornou o ID da pasta criada.');
    }
    parentId = created.id;
  }
  return parentId;
}

async function uploadGoogleDriveFile(
  accessToken: string,
  folderId: string,
  file: { name: string; bytes: Buffer; contentType: string },
) {
  const boundary = `gravador-${shortId(10)}`;
  const metadata = JSON.stringify({
    name: file.name,
    parents: [folderId],
  });
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${file.contentType}\r\n\r\n`,
      'utf8',
    ),
    file.bytes,
    Buffer.from(`\r\n--${boundary}--`, 'utf8'),
  ]);

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  if (!res.ok) {
    throw new Error(`Falha ao enviar arquivo ao Google Drive (${res.status}).`);
  }
}

async function ensureDropboxFolder(accessToken: string, targetPath: string) {
  const normalized = normalizeDropboxPath(targetPath);
  if (normalized === '/') return;
  const res = await fetch('https://api.dropboxapi.com/2/files/create_folder_v2', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      path: normalized,
      autorename: false,
    }),
  });

  if (res.ok || res.status === 409) {
    return;
  }

  throw new Error(`Falha ao preparar pasta no Dropbox (${res.status}).`);
}

async function uploadDropboxFile(
  accessToken: string,
  targetPath: string,
  bytes: Buffer,
  contentType: string,
) {
  const res = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': JSON.stringify({
        path: normalizeDropboxPath(targetPath),
        mode: 'overwrite',
        autorename: false,
        mute: true,
      }),
      'X-Content-Type': contentType,
    },
    body: bytes,
  });
  if (!res.ok) {
    throw new Error(`Falha ao enviar arquivo ao Dropbox (${res.status}).`);
  }
}

async function ensureOneDriveFolder(accessToken: string, targetPath: string) {
  let current = '';
  for (const segment of splitFolderPath(targetPath)) {
    current = joinPathSegments(current, segment);
    const getRes = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/root:${encodeOneDrivePath(current)}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    if (getRes.ok) continue;
    if (getRes.status !== 404) {
      throw new Error(`Falha ao consultar pasta no OneDrive (${getRes.status}).`);
    }

    const parent = current.split('/').slice(0, -1).join('/');
    const createUrl = parent
      ? `https://graph.microsoft.com/v1.0/me/drive/root:${encodeOneDrivePath(parent)}:/children`
      : 'https://graph.microsoft.com/v1.0/me/drive/root/children';
    const createRes = await fetch(createUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: segment,
        folder: {},
        '@microsoft.graph.conflictBehavior': 'replace',
      }),
    });
    if (!createRes.ok && createRes.status !== 409) {
      throw new Error(`Falha ao criar pasta no OneDrive (${createRes.status}).`);
    }
  }
}

async function uploadOneDriveFile(
  accessToken: string,
  targetPath: string,
  bytes: Buffer,
  contentType: string,
) {
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/root:${encodeOneDrivePath(targetPath)}:/content`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': contentType,
      },
      body: bytes,
    },
  );
  if (!res.ok) {
    throw new Error(`Falha ao enviar arquivo ao OneDrive (${res.status}).`);
  }
}

async function markIntegrationSync(
  db: Firestore,
  userId: string,
  integrationId: IntegrationId,
  status: 'ok' | 'failed',
  error?: string,
) {
  await db
    .collection('users')
    .doc(userId)
    .collection('integrations')
    .doc(integrationId)
    .set(
      {
        lastSyncedAt: new Date().toISOString(),
        lastSyncStatus: status,
        lastSyncError: error ?? null,
      },
      { merge: true },
    );
}

async function resolvePrimaryWorkspaceId(db: Firestore, userId: string) {
  const workspace = await db.collection('workspaces').where('ownerId', '==', userId).limit(1).get();
  return workspace.empty ? null : workspace.docs[0]!.id;
}

function splitFolderPath(input: string) {
  return input
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function normalizeDropboxPath(input: string) {
  const normalized = collapseSlashes(input);
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

function encodeOneDrivePath(input: string) {
  const normalized = trimTrailingSlashes(collapseSlashes(input));
  return normalized
    .split('/')
    .filter(Boolean)
    .map((segment) => `/${encodeURIComponent(segment)}`)
    .join('');
}

function trimTrailingSlashes(input: string) {
  let index = input.length;
  while (index > 0 && input[index - 1] === '/') {
    index -= 1;
  }
  return input.slice(0, index);
}

function collapseSlashes(input: string) {
  let output = '';
  let previousSlash = false;
  for (const char of input) {
    if (char === '/') {
      if (!previousSlash) output += char;
      previousSlash = true;
      continue;
    }
    previousSlash = false;
    output += char;
  }
  return output;
}

function joinPathSegments(...segments: string[]) {
  const joined = segments.filter(Boolean).join('/');
  const normalized = collapseSlashes(joined);
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

function escapeGoogleDriveQueryValue(value: string) {
  return value.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
}
