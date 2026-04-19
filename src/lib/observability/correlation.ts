/**
 * Request Correlation ID
 *
 * Extracts or generates a correlation ID for request tracing.
 * API routes should call this at the start of handling to ensure
 * all logs for a single request are grouped together.
 */

import { randomUUID } from 'crypto';

const CORRELATION_HEADER = 'x-correlation-id';

export function getCorrelationId(headers: Headers): string {
  const existing = headers.get(CORRELATION_HEADER);
  if (existing) return existing;
  return randomUUID();
}

export function setCorrelationHeader(headers: Headers, correlationId: string): void {
  headers.set(CORRELATION_HEADER, correlationId);
}
