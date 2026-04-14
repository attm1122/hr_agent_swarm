/**
 * Structured Security Logger
 *
 * Replaces raw `console.*` calls with a logger that:
 * 1. Outputs structured JSON (machine-parseable by log aggregators)
 * 2. Auto-redacts PII patterns before writing
 * 3. Adds standard context (timestamp, level, service)
 * 4. Can be silenced in tests
 *
 * Usage:
 *   import { securityLog } from '@/lib/security/logger';
 *   securityLog.warn('rate-limit', 'Store approaching limit', { size: 8000 });
 *   securityLog.error('auth', 'Session resolution failed', { error: err.message });
 */

const PII_PATTERNS: [RegExp, string][] = [
  [/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED:SSN]'],
  [/\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g, '[REDACTED:EMAIL]'],
  [/\b\d{3}\s?\d{3}\s?\d{3}\b/g, '[REDACTED:TFN]'],
  [/\b\d{4}\s?\d{5}\s?\d{1,2}\b/g, '[REDACTED:MEDICARE]'],
  [/\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b/g, '[REDACTED:PHONE]'],
  [/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED:JWT]'],
  [/[A-Za-z0-9+/]{60,}={0,2}/g, '[REDACTED:B64]'],
];

/** Scrub known PII patterns from a string value. */
function redact(value: string): string {
  let result = value;
  for (const [pattern, replacement] of PII_PATTERNS) {
    pattern.lastIndex = 0;
    result = result.replace(pattern, replacement);
  }
  return result;
}

/** Deep-redact an arbitrary value for logging. */
function redactValue(val: unknown, depth = 0): unknown {
  if (depth > 8) return '[DEPTH_LIMIT]';
  if (typeof val === 'string') return redact(val);
  if (typeof val !== 'object' || val === null) return val;
  if (val instanceof Error) {
    return { name: val.name, message: redact(val.message) };
  }
  if (Array.isArray(val)) {
    return val.slice(0, 20).map((v) => redactValue(v, depth + 1));
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
    out[k] = redactValue(v, depth + 1);
  }
  return out;
}

type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  data?: unknown;
}

function emit(level: LogLevel, category: string, message: string, data?: unknown) {
  // Silent in test to avoid noise
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) return;

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    category,
    message,
  };

  if (data !== undefined) {
    entry.data = redactValue(data);
  }

  const json = JSON.stringify(entry);

  switch (level) {
    case 'error':
      // eslint-disable-next-line no-console
      console.error(json);
      break;
    case 'warn':
      // eslint-disable-next-line no-console
      console.warn(json);
      break;
    default:
      // eslint-disable-next-line no-console
      console.log(json);
  }
}

/**
 * Structured logger with auto-PII-redaction.
 *
 * Categories should be kebab-case namespaces:
 *   'auth', 'rate-limit', 'csrf', 'audit', 'integration',
 *   'ai-os', 'export', 'cron', 'middleware', etc.
 */
export const securityLog = {
  info: (category: string, message: string, data?: unknown) =>
    emit('info', category, message, data),

  warn: (category: string, message: string, data?: unknown) =>
    emit('warn', category, message, data),

  error: (category: string, message: string, data?: unknown) =>
    emit('error', category, message, data),
};
