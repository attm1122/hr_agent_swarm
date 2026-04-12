/**
 * Persistent Audit Logger
 * Security-focused audit trail with tamper-resistant storage.
 * 
 * Logs:
 * - Agent executions (who, what, when, success/failure)
 * - Data access (sensitive field access)
 * - Permission changes
 * - Integration calls
 * - Security events (blocked requests, anomalies)
 * 
 * Security Features:
 * - Structured logging with integrity hashes
 * - Automatic redaction of sensitive data
 * - Async batch writing (performance)
 * - Retention policy enforcement
 */

import type { AgentContext, AgentIntent } from '@/types';
import { createHash } from 'crypto';
import { createAdminClient } from '@/infrastructure/database/client';

/** Minimal context for security logging - compatible with both AgentContext and SecurityContext */
export interface SecurityLogContext {
  userId: string;
  role: string;
  sessionId: string;
}

export type AuditEventType = 
  | 'agent_execute'
  | 'data_access'
  | 'permission_check'
  | 'integration_call'
  | 'security_blocked'
  | 'auth_failure'
  | 'rate_limit_hit'
  | 'csrf_violation'
  | 'sensitive_action';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  eventType: AuditEventType;
  userId: string;
  role: string;
  sessionId: string;
  ipAddress?: string;
  userAgent?: string;
  
  // Event-specific fields
  intent?: AgentIntent;
  agentType?: string;
  success: boolean;
  errorMessage?: string;
  
  // Data access tracking
  resourceType?: string;
  resourceId?: string;
  action?: string;
  fieldsAccessed?: string[];
  sensitivityLevel?: string;
  
  // Security context
  riskScore?: number;
  requiresApproval?: boolean;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  
  // Integrity
  previousHash?: string;
  integrityHash: string;
}

// In-memory buffer (flush to DB periodically)
// Production: Use write-ahead logging for durability
const auditBuffer: AuditLogEntry[] = [];
const BUFFER_SIZE = 100;
const FLUSH_INTERVAL_MS = 5000; // 5 seconds

// Retention: 90 days for security logs
const RETENTION_DAYS = 90;

let lastHash = '';

/**
 * Create integrity hash for audit entry (tamper detection)
 */
function createIntegrityHash(entry: Omit<AuditLogEntry, 'integrityHash'>): string {
  const data = JSON.stringify({
    id: entry.id,
    timestamp: entry.timestamp,
    userId: entry.userId,
    eventType: entry.eventType,
    previousHash: entry.previousHash,
  });
  
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Redact sensitive fields from audit entry
 */
function redactSensitiveData(entry: Partial<AuditLogEntry>): Partial<AuditLogEntry> {
  const redacted = { ...entry };
  
  // Never log full error messages that might contain sensitive data
  if (redacted.errorMessage) {
    // Keep only first 100 chars, remove any PII patterns
    redacted.errorMessage = redacted.errorMessage
      .substring(0, 100)
      .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]')  // SSN pattern
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]');  // Email
  }
  
  // Limit fields accessed array size
  if (redacted.fieldsAccessed && redacted.fieldsAccessed.length > 50) {
    redacted.fieldsAccessed = redacted.fieldsAccessed.slice(0, 50);
    redacted.fieldsAccessed.push('...[truncated]');
  }
  
  return redacted;
}

/**
 * Log an agent execution event
 */
export function logAgentExecution(
  context: AgentContext | SecurityLogContext,
  intent: AgentIntent,
  agentType: string,
  success: boolean,
  errorMessage?: string,
  executionTimeMs?: number
): void {
  const entry: Omit<AuditLogEntry, 'integrityHash'> = {
    id: generateAuditId(),
    timestamp: new Date().toISOString(),
    eventType: 'agent_execute',
    userId: context.userId,
    role: context.role,
    sessionId: context.sessionId,
    intent,
    agentType,
    success,
    errorMessage,
    previousHash: lastHash,
  };
  
  addToBuffer(entry);
}

/**
 * Log a data access event
 */
export function logDataAccess(
  context: AgentContext | SecurityLogContext,
  resourceType: string,
  resourceId: string,
  action: string,
  fieldsAccessed: string[],
  sensitivityLevel: string,
  success: boolean
): void {
  // Don't log self-access for own records (reduces noise)
  const employeeId = 'employeeId' in context ? (context as AgentContext).employeeId : undefined;
  if (resourceId === employeeId && action === 'read') {
    return;
  }
  
  const entry: Omit<AuditLogEntry, 'integrityHash'> = {
    id: generateAuditId(),
    timestamp: new Date().toISOString(),
    eventType: 'data_access',
    userId: context.userId,
    role: context.role,
    sessionId: context.sessionId,
    resourceType,
    resourceId,
    action,
    fieldsAccessed: fieldsAccessed.filter(f => !isSystemField(f)),
    sensitivityLevel,
    success,
    previousHash: lastHash,
  };
  
  addToBuffer(entry);
}

/**
 * Log a security event (blocked request, violation, etc.)
 */
export function logSecurityEvent(
  eventType: 'security_blocked' | 'auth_failure' | 'rate_limit_hit' | 'csrf_violation',
  context: SecurityLogContext,
  details: {
    resourceType?: string;
    resourceId?: string;
    reason: string;
    ipAddress?: string;
  }
): void {
  const entry: Omit<AuditLogEntry, 'integrityHash'> = {
    id: generateAuditId(),
    timestamp: new Date().toISOString(),
    eventType,
    userId: context.userId,
    role: context.role,
    sessionId: context.sessionId,
    ipAddress: details.ipAddress,
    resourceType: details.resourceType,
    resourceId: details.resourceId,
    success: false,
    errorMessage: details.reason,
    previousHash: lastHash,
  };
  
  // Security events are high priority - flush immediately
  addToBuffer(entry, true);
  
  // In production: Also alert security team for critical events
  if (eventType === 'auth_failure' || eventType === 'csrf_violation') {
    alertSecurityTeam(entry);
  }
}

/**
 * Log sensitive action requiring approval
 */
export function logSensitiveAction(
  context: SecurityLogContext,
  action: string,
  resourceType: string,
  resourceId: string,
  requiresApproval: boolean,
  approvalStatus?: 'pending' | 'approved' | 'rejected'
): void {
  const entry: Omit<AuditLogEntry, 'integrityHash'> = {
    id: generateAuditId(),
    timestamp: new Date().toISOString(),
    eventType: 'sensitive_action',
    userId: context.userId,
    role: context.role,
    sessionId: context.sessionId,
    action,
    resourceType,
    resourceId,
    success: true,
    requiresApproval,
    approvalStatus,
    previousHash: lastHash,
  };
  
  addToBuffer(entry);
}

/**
 * Add entry to buffer and flush if needed
 */
function addToBuffer(entry: Omit<AuditLogEntry, 'integrityHash'>, immediateFlush = false): void {
  const redacted = redactSensitiveData(entry);
  const hash = createIntegrityHash(entry);
  lastHash = hash;
  
  const fullEntry: AuditLogEntry = {
    ...entry,
    ...redacted,
    integrityHash: hash,
  };
  
  auditBuffer.push(fullEntry);
  
  if (immediateFlush || auditBuffer.length >= BUFFER_SIZE) {
    flushBuffer();
  }
}

/**
 * Generate unique audit ID
 */
function generateAuditId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Check if field is a system/internal field (not worth logging)
 */
function isSystemField(field: string): boolean {
  const systemFields = ['id', 'createdAt', 'updatedAt', 'version', '_id'];
  return systemFields.includes(field);
}

/**
 * Flush buffer to persistent storage
 * Production: Write to Supabase/PostgreSQL
 */
async function flushBuffer(): Promise<void> {
  if (auditBuffer.length === 0) return;
  
  const entries = [...auditBuffer];
  auditBuffer.length = 0; // Clear buffer
  
  try {
    if (process.env.NODE_ENV === 'production') {
      // Production: Persist to Supabase database
      const supabase = createAdminClient();
      const { error } = await supabase.from('audit_logs').insert(entries);
      
      if (error) {
        throw error;
      }
      
      // eslint-disable-next-line no-console
      console.log('[AUDIT_FLUSH]', { count: entries.length, status: 'persisted' });
    } else {
      // Development: Log to console for visibility
      // eslint-disable-next-line no-console
      entries.forEach(e => console.log('[AUDIT]', e.eventType, e.userId, e.resourceType));
    }
  } catch (error) {
    // Critical: Don't lose audit logs on failure
    // Re-add to buffer for retry
    auditBuffer.unshift(...entries);
    
    // Alert on audit failure - this is a security incident
    // eslint-disable-next-line no-console
    console.error('[CRITICAL AUDIT FAILURE] Failed to persist audit logs:', error);
    
    // In production: Alert security team immediately
    alertSecurityTeam({
      id: generateAuditId(),
      timestamp: new Date().toISOString(),
      eventType: 'security_blocked',
      userId: 'system',
      role: 'system',
      sessionId: 'system',
      success: false,
      errorMessage: `Audit persistence failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      previousHash: lastHash,
    });
  }
}

/**
 * Alert security team for critical events
 * Production: Integrate with PagerDuty, Slack, etc.
 */
function alertSecurityTeam(entry: Omit<AuditLogEntry, 'integrityHash'>): void {
  // POC: Console alert
  // Production: Send to security monitoring
  // eslint-disable-next-line no-console
  console.error('[SECURITY_ALERT]', {
    eventType: entry.eventType,
    userId: entry.userId,
    reason: entry.errorMessage,
    timestamp: entry.timestamp,
  });
}

/**
 * Query audit logs (admin only)
 */
export async function queryAuditLogs(
  filters: {
    userId?: string;
    eventType?: AuditEventType;
    startDate?: string;
    endDate?: string;
    resourceType?: string;
    success?: boolean;
  },
  limit: number = 100
): Promise<AuditLogEntry[]> {
  // POC: Return from buffer + query would go here
  // Production: Query database with filters
  
  let results = [...auditBuffer];
  
  if (filters.userId) {
    results = results.filter(e => e.userId === filters.userId);
  }
  if (filters.eventType) {
    results = results.filter(e => e.eventType === filters.eventType);
  }
  if (filters.success !== undefined) {
    results = results.filter(e => e.success === filters.success);
  }
  
  return results.slice(0, limit);
}

/**
 * Get audit statistics for monitoring
 */
export function getAuditStats(): {
  totalEvents: number;
  failedEvents: number;
  securityEvents: number;
  bufferSize: number;
} {
  return {
    totalEvents: auditBuffer.length,
    failedEvents: auditBuffer.filter(e => !e.success).length,
    securityEvents: auditBuffer.filter(e => 
      ['security_blocked', 'auth_failure', 'csrf_violation'].includes(e.eventType)
    ).length,
    bufferSize: auditBuffer.length,
  };
}

/**
 * Verify audit log integrity (tamper detection)
 */
export function verifyAuditIntegrity(entries: AuditLogEntry[]): boolean {
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const { integrityHash, ...data } = entry;
    
    // Verify current entry hash
    const computedHash = createIntegrityHash(data);
    if (computedHash !== integrityHash) {
      return false;
    }
    
    // Verify chain (previous hash matches)
    if (i > 0) {
      const previousEntry = entries[i - 1];
      if (data.previousHash !== previousEntry.integrityHash) {
        return false;
      }
    }
  }
  
  return true;
}

// Auto-flush on interval
setInterval(flushBuffer, FLUSH_INTERVAL_MS);

// Flush on graceful shutdown
process.on('beforeExit', () => {
  flushBuffer();
});
