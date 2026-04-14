import { describe, it, expect } from 'vitest';
import { redactPII, redactPIIString } from './pii-redactor';

describe('redactPII', () => {
  it('redacts TFN-shaped numbers in strings', () => {
    const { value, report } = redactPII('My TFN is 123 456 789 btw.');
    expect(value).toBe('My TFN is [REDACTED:TFN] btw.');
    expect(report.categories).toContain('TFN');
    expect(report.redactedCount).toBeGreaterThan(0);
  });

  it('redacts Medicare numbers', () => {
    const { value } = redactPII('Medicare 2123 45678 1');
    expect(value).toBe('Medicare [REDACTED:MEDICARE]');
  });

  it('redacts DOB written as dd/mm/yyyy and yyyy-mm-dd', () => {
    const { value } = redactPII('DOB 12/04/1987 and 1990-05-22');
    expect(value).toBe('DOB [REDACTED:DOB] and [REDACTED:DOB]');
  });

  it('redacts AU passport numbers', () => {
    const { value } = redactPII('Passport N12345678 is expiring');
    expect(value).toBe('Passport [REDACTED:PASSPORT] is expiring');
  });

  it('redacts credit-card-shaped digit runs', () => {
    const { value } = redactPII('Card 4111 1111 1111 1111 here');
    expect(value).toBe('Card [REDACTED:CARD] here');
  });

  it('recurses into arrays and objects and drops reserved PII keys', () => {
    const input = {
      user: 'alice',
      tfn: '123456789',
      notes: ['DOB 01/01/1990', 'ok'],
      nested: { bankAccount: '012-345 6789012', fine: 'no pii' },
    };
    const { value, report } = redactPII(input);
    const out = value as {
      user: string;
      tfn: string;
      notes: string[];
      nested: { bankAccount: string; fine: string };
    };
    expect(out.user).toBe('alice');
    expect(out.tfn).toBe('[REDACTED]');
    expect(out.notes[0]).toBe('DOB [REDACTED:DOB]');
    expect(out.nested.bankAccount).toBe('[REDACTED]');
    expect(out.nested.fine).toBe('no pii');
    expect(report.categories).toEqual(expect.arrayContaining(['TFN', 'DOB', 'BANKACCOUNT']));
  });

  it('is a no-op for strings without PII', () => {
    expect(redactPIIString('Can I update my email?')).toBe('Can I update my email?');
  });
});
