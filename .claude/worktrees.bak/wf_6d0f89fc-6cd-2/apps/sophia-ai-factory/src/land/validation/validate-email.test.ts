import { describe, it, expect } from 'vitest';
import { validateEmail } from './validate-email';

describe('land/validation/validate-email', () => {
  it('accepts valid email', () => {
    expect(validateEmail('test@example.com')).toBe(true);
  });
  it('rejects email without @', () => {
    expect(validateEmail('testexample.com')).toBe(false);
  });
  it('rejects email with multiple @', () => {
    expect(validateEmail('test@@example.com')).toBe(false);
  });
});
