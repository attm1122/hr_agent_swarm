/**
 * Structured Logger
 *
 * Replaces raw console.* calls with levelled, structured JSON logging.
 * In production: outputs JSON for log aggregation.
 * In development: outputs human-readable strings.
 * In tests: can be silenced via the silent instance.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogMeta extends Record<string, unknown> {
  component?: string;
  correlationId?: string;
  tenantId?: string;
}

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function getMinLevel(): LogLevel {
  const env = process.env.LOG_LEVEL;
  if (env && env in LEVELS) return env as LogLevel;
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
}

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] >= LEVELS[getMinLevel()];
}

function formatMessage(
  level: LogLevel,
  message: string,
  meta: LogMeta
): string | Record<string, unknown> {
  if (process.env.NODE_ENV === 'production') {
    return {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message,
      ...meta,
    };
  }

  const parts: string[] = [`[${level.toUpperCase()}]`];
  if (meta.component) parts.push(`[${meta.component}]`);
  if (meta.correlationId) parts.push(`[corr:${meta.correlationId}]`);
  parts.push(message);

  const metaWithoutCommon = { ...meta };
  delete metaWithoutCommon.component;
  delete metaWithoutCommon.correlationId;
  delete metaWithoutCommon.tenantId;

  if (Object.keys(metaWithoutCommon).length > 0) {
    parts.push(JSON.stringify(metaWithoutCommon));
  }

  return parts.join(' ');
}

function writeLog(level: LogLevel, message: string, meta: LogMeta = {}): void {
  if (!shouldLog(level)) return;

  const formatted = formatMessage(level, message, meta);

  if (typeof formatted === 'string') {
    // eslint-disable-next-line no-console
    console[level](formatted);
  } else {
    // eslint-disable-next-line no-console
    console[level](JSON.stringify(formatted));
  }
}

export interface Logger {
  debug(message: string, meta?: LogMeta): void;
  info(message: string, meta?: LogMeta): void;
  warn(message: string, meta?: LogMeta): void;
  error(message: string, meta?: LogMeta): void;
}

export const logger: Logger = {
  debug: (msg, meta) => writeLog('debug', msg, meta),
  info: (msg, meta) => writeLog('info', msg, meta),
  warn: (msg, meta) => writeLog('warn', msg, meta),
  error: (msg, meta) => writeLog('error', msg, meta),
};

/** Silent logger for tests — swallows all output. */
export const silentLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

/** Create a child logger with preset metadata (e.g. component name). */
export function createLogger(component: string, baseMeta: LogMeta = {}): Logger {
  return {
    debug: (msg, meta) => writeLog('debug', msg, { ...baseMeta, ...meta, component }),
    info: (msg, meta) => writeLog('info', msg, { ...baseMeta, ...meta, component }),
    warn: (msg, meta) => writeLog('warn', msg, { ...baseMeta, ...meta, component }),
    error: (msg, meta) => writeLog('error', msg, { ...baseMeta, ...meta, component }),
  };
}

/** Create a logger scoped to an API request with correlation ID. */
export function createRequestLogger(component: string, correlationId: string): Logger {
  return createLogger(component, { correlationId });
}
