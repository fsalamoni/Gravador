import { describe, expect, it } from 'vitest';
import {
  buildBulkDeleteConfirmationPhrase,
  isValidBulkDeleteConfirmationPhrase,
} from './bulk-delete-confirmation';

describe('bulk delete confirmation phrase', () => {
  it('builds a deterministic phrase from selected count', () => {
    expect(buildBulkDeleteConfirmationPhrase(3)).toBe('LIXEIRA 3');
  });

  it('normalizes whitespace and casing while validating user input', () => {
    expect(isValidBulkDeleteConfirmationPhrase('  lixeira   3  ', 3)).toBe(true);
  });

  it('rejects phrase when expected count does not match', () => {
    expect(isValidBulkDeleteConfirmationPhrase('LIXEIRA 2', 3)).toBe(false);
  });
});
