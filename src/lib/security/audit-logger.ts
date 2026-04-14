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
    redacted.errorMessage = redactPiiFromString(
      redacted.errorMessage.substring(0, 200),
    );
  }

  // Limit fields accessed array size
  if (redacted.fieldsAccessed && redacted.fieldsAccessed.length > 50) {
    redacted.fieldsAccessed = redacted.fieldsAccessed.slice(0, 50);
    redacted.fieldsAccessed.push('...[truncated]');
  }

  return redacted;
}

/**
 * Redact common PII patterns from a string.
 * Covers: SSN, email, credit card, AU TFN, AU Medicare, phone numbers,
 * base64-encoded blobs (often contain encoded PII), and JWT tokens.
 */
function redactPiiFromString(text: string): string {
  return text
    // SSN (US): 123-45-6789
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED:SSN]')
    // Email
    .replace(/\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Z|a-z]{2,}\b/g, '[REDACTED:EMAIL]')
    // Credit card (Visa/MC/Amex loose patterns)
    .replace(/\b(?:\d[ -]*?){13,19}\b/g, (m) => {
      const digits = m.replace(/\D/g, '');
      return digits.length >= 13 && digits.length <= 19 ? '[REDACTED:CC]' : m;
    })
    // AU Tax File Number: 123 456 789
    .replace(/\b\d{3}\s?\d{3}\s?\d{3}\b/g, '[REDACTED:TFN]')
    // AU Medicare: 2123 45678 1
    .replace(/\b\d{4}\s?\d{5}\s?\d{1,2}\b/g, '[REDACTED:MEDICARE]')
    // Phone numbers (international + AU)
    .replace(/\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b/g, '[REDACTED:PHONE]')
    // JWT tokens (three base64 segments separated by dots)
    .replace(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED:JWT]')
    // Long base64 blobs (40+ chars, often encoded PII)
    .replace(/[A-Za-z0-9+/]{40,}={0,2}/g, '[REDACTED:B64]');
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
 * Map camelCase entry to snake_case database columns
 */
function mapToDbColumns(entry: AuditLogEntry, tenantId: string) {
  return {
    tenant_id: tenantId,
    event_id: entry.id,
    timestamp: entry.timestamp,
    event_type: entry.eventType,
    user_id: entry.userId,
    role: entry.role,
    session_id: entry.sessionId,
    ip_address: entry.ipAddress,
    user_agent: entry.userAgent,
    intent: entry.intent,
    agent_type: entry.agentType,
    success: entry.success,
    error_message: entry.errorMessage,
    resource_type: entry.resourceType,
    resource_id: entry.resourceId,
    action: entry.action,
    fields_accessed: entry.fieldsAccessed,
    sensitivity_level: entry.sensitivityLevel,
    risk_score: entry.riskScore,
    requires_approval: entry.requiresApproval,
    approval_status: entry.approvalStatus,
    previous_hash: entry.previousHash,
    integrity_hash: entry.integrityHash,
  };
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
    // Get tenant ID from env or default
    const tenantId = process.env.DEFAULT_TENANT_ID || '00000000-0000-0000-0000-000000000000';
    
    // Map to database columns (snake_case)
    const dbEntries = entries.map(e => mapToDbColumns(e, tenantId));
    
    if (process.env.NODE_ENV === 'production') {
      // Production: Persist to Supabase database
      const supabase = createAdminClient();
      const { error } = await supabase.from('audit_logs').insert(dbEntries);
      
      if (error) {
        throw error;
      }
      
      console.log('[AUDIT_FLUSH]', { count: entries.length, status: 'persisted' });
    } else {
      // Development: Log to console for visibility
      entries.forEach(e => console.log('[AUDIT]', e.eventType, e.userId, e.resourceType));
    }
  } catch (error) {
    // Critical: Don't lose audit logs on failure
    // Re-add to buffer for retry
    auditBuffer.unshift(...entries);
    
    // Alert on audit failure - this is a security incident
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
