import { describe, expect, it } from 'vitest';
import { toNotificationDeliveryError } from './notification-delivery';

describe('notification delivery contracts', () => {
  it('maps known configuration errors', () => {
    expect(
      toNotificationDeliveryError(new Error('Canal de e-mail não configurado no ambiente.')),
    ).toEqual(expect.objectContaining({ code: 'not_configured' }));
  });

  it('maps provider delivery failures', () => {
    expect(
      toNotificationDeliveryError(new Error('Provider de e-mail respondeu 502: bad_gateway')),
    ).toEqual(expect.objectContaining({ code: 'delivery_provider_error' }));
  });

  it('falls back to unknown error code', () => {
    expect(toNotificationDeliveryError(new Error('falha inesperada xyz'))).toEqual(
      expect.objectContaining({ code: 'unknown_error' }),
    );
  });
});
