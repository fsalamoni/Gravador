export const BULK_DELETE_CONFIRMATION_PREFIX = 'LIXEIRA';

function normalizePhrase(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toUpperCase();
}

export function buildBulkDeleteConfirmationPhrase(count: number): string {
  const normalizedCount = Number.isFinite(count) ? Math.max(1, Math.floor(count)) : 1;
  return `${BULK_DELETE_CONFIRMATION_PREFIX} ${normalizedCount}`;
}

export function isValidBulkDeleteConfirmationPhrase(input: string, count: number): boolean {
  return normalizePhrase(input) === buildBulkDeleteConfirmationPhrase(count);
}
