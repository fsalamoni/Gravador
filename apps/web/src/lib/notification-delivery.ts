export type NotificationChannel = 'email' | 'whatsapp';
export type NotificationDeliveryStatus =
  | 'disabled'
  | 'queued'
  | 'sent'
  | 'failed'
  | 'test_sent'
  | 'test_failed';

export type NotificationErrorCode =
  | 'not_configured'
  | 'invalid_target'
  | 'delivery_provider_error'
  | 'recording_not_found'
  | 'integration_not_connected'
  | 'notifications_disabled'
  | 'unknown_error';

export interface NotificationDeliveryResult {
  channel: NotificationChannel;
  status: NotificationDeliveryStatus;
  mode: 'test' | 'send';
  target: string | null;
  errorCode: NotificationErrorCode | null;
  message: string | null;
}

export function toNotificationDeliveryError(error: unknown): {
  code: NotificationErrorCode;
  message: string;
} {
  const message =
    error instanceof Error && error.message.trim()
      ? error.message.trim()
      : 'Erro desconhecido ao entregar notificação.';

  if (message.includes('não configurad')) {
    return { code: 'not_configured', message };
  }
  if (message.includes('não conectado')) {
    return { code: 'integration_not_connected', message };
  }
  if (message.includes('não encontrada')) {
    return { code: 'recording_not_found', message };
  }
  if (message.includes('inválid') || message.includes('obrigatório')) {
    return { code: 'invalid_target', message };
  }
  if (message.includes('respondeu') || message.includes('provider')) {
    return { code: 'delivery_provider_error', message };
  }
  return { code: 'unknown_error', message };
}
