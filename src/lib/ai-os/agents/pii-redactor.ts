/**
 * PII redactor.
 *
 * Cleans AU-context PII out of text before it is persisted to the
 * `ai_os_traces` row. The assumption is that the raw user input and any
 * rationale/summary strings produced downstream could contain:
 *   - Tax File Numbers (9 digits, with/without spaces)
 *   - Medicare numbers (10 digits, sometimes spaced 4-5-1)
 *   - Australian bank account numbers (BSB 6 digits + 6-10 digit account)
 *   - Credit card numbers (13-19 digits)
 *   - Dates of birth written as `dd/mm/yyyy` or `yyyy-mm-dd`
 *   - Email addresses (kept, just domain-masked if we want stricter later)
 *   - Passport numbers (AU: letter + 8 digits)
 *
 * Patterns err on the side of over-redaction — this is audit trail, not
 * the user-facing answer. The output preserves string length roughly to
 * keep traces readable.
 */

const TFN_RE = /\b\d{3}\s?\d{3}\s?\d{3}\b/g;
const MEDICARE_RE = /\b\d{4}\s?\d{5}\s?\d{1,2}\b/g; // AU Medicare: 4-5-N where N is 1 (IRN) or 2 (IRN + check digit)
const BSB_ACCOUNT_RE = /\b\d{3}-?\d{3}\s+\d{6,10}\b/g;
const CC_RE = /\b(?:\d[ -]*?){13,19}\b/g;
const DOB_SLASH_RE = /\b\d{1,2}\/\d{1,2}\/(?:19|20)\d{2}\b/g;
const DOB_ISO_RE = /\b(?:19|20)\d{2}-\d{2}-\d{2}\b/g;
const PASSPORT_RE = /\b[A-Z]\d{8}\b/g;
// AU mobile: 04XX XXX XXX or +614XXXXXXXX; AU landline: 0X XXXX XXXX
const AU_PHONE_RE = /\b(?:\+?61|0)4\d{2}\s?\d{3}\s?\d{3}\b/g;
const AU_LANDLINE_RE = /\b0[2-9]\s?\d{4}\s?\d{4}\b/g;
// International phone with country code (E.164-ish): +XXXXXXXX (8-15 digits)
const INTL_PHONE_RE = /\+\d{8,15}\b/g;

/** Maximum recursion depth for walk() to prevent stack overflow on pathological input. */
const MAX_DEPTH = 32;

export interface RedactionReport {
  redactedCount: number;
  categories: string[];
}

export function redactPII(input: unknown): { value: unknown; report: RedactionReport } {
  const categories: string[] = [];
  let count = 0;

  const redactString = (s: string): string => {
    let out = s;
    if (TFN_RE.test(out)) {
      out = out.replace(TFN_RE, '[REDACTED:TFN]');
      categories.push('TFN');
      count += 1;
    }
    if (MEDICARE_RE.test(out)) {
      out = out.replace(MEDICARE_RE, '[REDACTED:MEDICARE]');
      categories.push('MEDICARE');
      count += 1;
    }
    if (BSB_ACCOUNT_RE.test(out)) {
      out = out.replace(BSB_ACCOUNT_RE, '[REDACTED:BANK]');
      categories.push('BANK');
      count += 1;
    }
    if (CC_RE.test(out)) {
      out = out.replace(CC_RE, '[REDACTED:CARD]');
      categories.push('CARD');
      count += 1;
    }
    if (DOB_SLASH_RE.test(out) || DOB_ISO_RE.test(out)) {
      out = out.replace(DOB_SLASH_RE, '[REDACTED:DOB]').replace(DOB_ISO_RE, '[REDACTED:DOB]');
      categories.push('DOB');
      count += 1;
    }
    if (PASSPORT_RE.test(out)) {
      out = out.replace(PASSPORT_RE, '[REDACTED:PASSPORT]');
      categories.push('PASSPORT');
      count += 1;
    }
    if (AU_PHONE_RE.test(out)) {
      out = out.replace(AU_PHONE_RE, '[REDACTED:PHONE]');
      categories.push('PHONE');
      count += 1;
    }
    if (AU_LANDLINE_RE.test(out)) {
      out = out.replace(AU_LANDLINE_RE, '[REDACTED:PHONE]');
      if (!categories.includes('PHONE')) categories.push('PHONE');
      count += 1;
    }
    if (INTL_PHONE_RE.test(out)) {
      out = out.replace(INTL_PHONE_RE, '[REDACTED:PHONE]');
      if (!categories.includes('PHONE')) categories.push('PHONE');
      count += 1;
    }
    return out;
  };

  const walk = (value: unknown, depth = 0): unknown => {
    // SECURITY: Prevent stack overflow on deeply nested / circular structures.
    if (depth >= MAX_DEPTH) return '[REDACTED:DEPTH_LIMIT]';

    if (typeof value === 'string') return redactString(value);
    if (Array.isArray(value)) return value.map((v) => walk(v, depth + 1));
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        // Never persist these keys at all — drop them completely.
        if (
          k === 'tfn' ||
          k === 'taxFileNumber' ||
          k === 'bankAccount' ||
          k === 'bankAccountNumber' ||
          k === 'passportNumber' ||
          k === 'medicareNumber' ||
          k === 'ssn' ||
          k === 'phoneNumber' ||
          k === 'mobileNumber' ||
          k === 'emergencyContactPhone'
        ) {
          out[k] = '[REDACTED]';
          categories.push(k.toUpperCase());
          count += 1;
          continue;
        }
        out[k] = walk(v, depth + 1);
      }
      return out;
    }
    return value;
  };

  return {
    value: walk(input),
    report: { redactedCount: count, categories: Array.from(new Set(categories)) },
  };
}

/** Convenience helper for redacting just a single string. */
export function redactPIIString(s: string): string {
  return redactPII(s).value as string;
}
