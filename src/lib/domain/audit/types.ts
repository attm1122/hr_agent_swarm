/**
 * Audit Domain Types
 */

export interface AuditEvent {
  id: string;
  eventType: string;
  entityType: string;
  entityId: string;
  actorId: string | null;
  actorType: 'user' | 'agent' | 'system';
  action: string;
  previousState: Record<string, unknown> | null;
  newState: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface AgentRunRecord {
  id: string;
  agentType: string;
  intent: string;
  inputPayload: Record<string, unknown>;
  outputResult: Record<string, unknown> | null;
  confidence: number | null;
  executionTimeMs: number;
  success: boolean;
  errorMessage: string | null;
  context: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: string;
}
