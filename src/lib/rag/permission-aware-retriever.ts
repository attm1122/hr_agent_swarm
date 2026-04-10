/**
 * Permission-Aware Retriever
 * 
 * Enforces RBAC at the retrieval layer to ensure no unauthorized
 * content ever reaches the search results or LLM.
 * 
 * Security Model:
 * 1. Pre-filter: Apply metadata constraints before any search
 * 2. Post-filter: Verify each candidate matches permissions
 * 3. Audit: Log all retrieval access decisions
 * 
 * Permission Checks:
 * - Tenant isolation (strict)
 * - Knowledge zone access
 * - Confidentiality level
 * - Audience/role matching
 * - Jurisdiction matching
 * - Document approval status
 * 
 * This layer sits between the hybrid retriever and the repository,
 * ensuring all results are properly authorized.
 */

import type {
  KnowledgeChunk,
  KnowledgeDocument,
  QueryClassification,
  RetrievalCandidate,
} from '@/types/rag';
import type { AgentContext, Role } from '@/types';
import { hasCapability } from '@/lib/auth/authorization';
import { logSensitiveAction } from '@/lib/security/audit-logger';
import { executeHybridRetrieval, HybridRetrievalConfig } from './hybrid-retriever';
import { buildMetadataFilter, MetadataFilter, documentMatchesFilter } from './metadata-filter-builder';
import { canAccessZone, getAccessibleZones } from './knowledge-zones';

// ============================================
// Permission Check Result
// ============================================

interface PermissionCheck {
  allowed: boolean;
  reason?: string;
  checks: {
    tenantMatch: boolean;
    zoneAccess: boolean;
    confidentialityOk: boolean;
    audienceMatch: boolean;
    jurisdictionMatch: boolean;
    approvalOk: boolean;
  };
}

// ============================================
// Main Permission-Aware Retrieval Function
// ============================================

/**
 * Execute permission-aware retrieval
 * 
 * This is the primary retrieval entry point for Phase 2.
 * It combines hybrid search with comprehensive permission verification.
 */
export async function executePermissionAwareRetrieval(
  query: string,
  queryEmbedding: number[],
  classification: QueryClassification,
  context: AgentContext,
  config?: Partial<HybridRetrievalConfig>
): Promise<{ candidates: RetrievalCandidate[]; filtered: number; auditLogId: string }> {
  // Generate audit log ID for this retrieval operation
  const auditLogId = `retrieval-${Date.now()}-${Math.random().toString(36).substring(7)}`;

  // 1. Verify user has search capability
  if (!hasCapability(context.role, 'policy:read')) {
    logRetrievalAccess(context, auditLogId, 'denied', 'insufficient_capabilities');
    return { candidates: [], filtered: 0, auditLogId };
  }

  // 2. Validate zone access against classification
  const accessibleZones = getAccessibleZones(context.role);
  const requestedZones = classification.allowedZones;
  const unauthorizedZones = requestedZones.filter(z => !accessibleZones.includes(z));

  if (unauthorizedZones.length > 0) {
    logRetrievalAccess(
      context,
      auditLogId,
      'denied',
      `unauthorized_zones: ${unauthorizedZones.join(', ')}`
    );
    return { candidates: [], filtered: 0, auditLogId };
  }

  // 3. Build permission-aware metadata filter
  const metadataFilter = buildMetadataFilter(
    classification,
    context.userId, // Using userId as tenant for POC
    context.role
  );

  // 4. Execute hybrid retrieval with filters applied
  const candidates = await executeHybridRetrieval(
    query,
    queryEmbedding,
    classification,
    context,
    config
  );

  // 5. Post-filter: Verify each candidate individually
  const verifiedCandidates: RetrievalCandidate[] = [];
  let filteredCount = 0;

  for (const candidate of candidates) {
    const permissionCheck = verifyCandidatePermissions(
      candidate.chunk,
      classification,
      context,
      metadataFilter
    );

    if (permissionCheck.allowed) {
      verifiedCandidates.push(candidate);
    } else {
      filteredCount++;
      logRetrievalAccess(
        context,
        auditLogId,
        'filtered',
        `candidate_filtered: ${candidate.chunk.id}, reason: ${permissionCheck.reason}`
      );
    }
  }

  // 6. Log successful retrieval
  logRetrievalAccess(
    context,
    auditLogId,
    'allowed',
    `retrieved: ${verifiedCandidates.length}, filtered: ${filteredCount}`
  );

  // 7. Audit logging for security
  logSensitiveAction(
    context,
    'knowledge_retrieval',
    'knowledge_chunk',
    auditLogId,
    false
  );

  return {
    candidates: verifiedCandidates,
    filtered: filteredCount,
    auditLogId,
  };
}

// ============================================
// Permission Verification
// ============================================

/**
 * Verify if a single chunk is accessible to the user
 */
function verifyCandidatePermissions(
  chunk: KnowledgeChunk,
  classification: QueryClassification,
  context: AgentContext,
  filter: MetadataFilter
): PermissionCheck {
  const checks = {
    tenantMatch: verifyTenantMatch(chunk, context),
    zoneAccess: verifyZoneAccess(chunk, context.role),
    confidentialityOk: verifyConfidentiality(chunk, context.role),
    audienceMatch: verifyAudience(chunk, context.role),
    jurisdictionMatch: verifyJurisdiction(chunk, classification.jurisdiction),
    approvalOk: verifyApproval(chunk),
  };

  const allPassed = Object.values(checks).every(check => check);

  if (!allPassed) {
    const failedChecks = Object.entries(checks)
      .filter(([, passed]) => !passed)
      .map(([name]) => name);

    return {
      allowed: false,
      reason: `failed_checks: ${failedChecks.join(', ')}`,
      checks,
    };
  }

  return {
    allowed: true,
    checks,
  };
}

/**
 * Verify tenant isolation
 */
function verifyTenantMatch(chunk: KnowledgeChunk, context: AgentContext): boolean {
  // Strict tenant isolation
  return chunk.tenantId === context.userId; // Using userId as tenant for POC
}

/**
 * Verify knowledge zone access
 */
function verifyZoneAccess(chunk: KnowledgeChunk, role: Role): boolean {
  return canAccessZone(chunk.knowledgeZone, role);
}

/**
 * Verify confidentiality level
 */
function verifyConfidentiality(chunk: KnowledgeChunk, role: Role): boolean {
  const maxLevel = getMaxConfidentialityForRole(role);
  return isConfidentialityAtOrBelow(chunk.confidentiality, maxLevel);
}

/**
 * Verify audience/role matching
 */
function verifyAudience(chunk: KnowledgeChunk, role: Role): boolean {
  // If no specific audience, content is accessible
  if (!chunk.audience || chunk.audience.length === 0) {
    return true;
  }

  // Check if user's role is in the audience
  return chunk.audience.includes(role);
}

/**
 * Verify jurisdiction matching
 */
function verifyJurisdiction(
  chunk: KnowledgeChunk,
  queryJurisdiction: string
): boolean {
  // If no specific jurisdiction requested, allow all
  if (!queryJurisdiction || queryJurisdiction === 'unknown') {
    return true;
  }

  // Match exact jurisdiction or AU (federal)
  return chunk.jurisdiction === queryJurisdiction || chunk.jurisdiction === 'AU';
}

/**
 * Verify document approval status
 */
function verifyApproval(chunk: KnowledgeChunk): boolean {
  // For POC, only require approval for sensitive zones
  if (chunk.knowledgeZone === 'legal_playbook' ||
      chunk.knowledgeZone === 'authoritative_policy') {
    return chunk.approvalStatus === 'approved';
  }

  return true;
}

// ============================================
// Confidentiality Helpers
// ============================================

const CONFIDENTIALITY_HIERARCHY = [
  'public',
  'internal',
  'manager_only',
  'hr_only',
  'confidential',
  'legal_privileged',
] as const;

type ConfidentialityLevel = typeof CONFIDENTIALITY_HIERARCHY[number];

function getMaxConfidentialityForRole(role: Role): ConfidentialityLevel {
  const levels: Record<Role, ConfidentialityLevel> = {
    admin: 'legal_privileged',
    manager: 'manager_only',
    team_lead: 'manager_only',
    employee: 'internal',
    payroll: 'confidential',
  };

  return levels[role] || 'internal';
}

function isConfidentialityAtOrBelow(
  level: string,
  max: ConfidentialityLevel
): boolean {
  const levelIndex = CONFIDENTIALITY_HIERARCHY.indexOf(level as ConfidentialityLevel);
  const maxIndex = CONFIDENTIALITY_HIERARCHY.indexOf(max);

  if (levelIndex === -1) return false;

  return levelIndex <= maxIndex;
}

// ============================================
// Audit Logging
// ============================================

interface RetrievalAccessLog {
  timestamp: string;
  userId: string;
  role: Role;
  auditLogId: string;
  decision: 'allowed' | 'denied' | 'filtered';
  reason: string;
  context?: Record<string, unknown>;
}

const retrievalAccessLogs: RetrievalAccessLog[] = [];

function logRetrievalAccess(
  context: AgentContext,
  auditLogId: string,
  decision: 'allowed' | 'denied' | 'filtered',
  reason: string,
  additionalContext?: Record<string, unknown>
): void {
  const log: RetrievalAccessLog = {
    timestamp: new Date().toISOString(),
    userId: context.userId,
    role: context.role,
    auditLogId,
    decision,
    reason,
    context: additionalContext,
  };

  retrievalAccessLogs.push(log);

  // In production, this would write to audit database
  if (process.env.NODE_ENV === 'development') {
    console.log(`[RAG Retrieval] ${decision.toUpperCase()}: ${reason}`);
  }
}

/**
 * Get retrieval access logs (for audit review)
 */
export function getRetrievalAccessLogs(
  auditLogId?: string
): RetrievalAccessLog[] {
  if (auditLogId) {
    return retrievalAccessLogs.filter(log => log.auditLogId === auditLogId);
  }
  return [...retrievalAccessLogs];
}

/**
 * Clear retrieval access logs (for testing)
 */
export function clearRetrievalAccessLogs(): void {
  retrievalAccessLogs.length = 0;
}

// ============================================
// High-Risk Content Protection
// ============================================

/**
 * Check if content is high-risk and requires additional verification
 */
export function isHighRiskContent(chunk: KnowledgeChunk): boolean {
  const highRiskZones = ['legal_playbook', 'private_case_data'];
  const highRiskConfidentiality = ['confidential', 'legal_privileged'];

  return highRiskZones.includes(chunk.knowledgeZone) ||
    highRiskConfidentiality.includes(chunk.confidentiality);
}

/**
 * Require additional verification for high-risk content
 */
export function requireAdditionalVerification(
  candidates: RetrievalCandidate[],
  context: AgentContext
): { verified: RetrievalCandidate[]; requireEscalation: boolean } {
  const highRiskCount = candidates.filter(c => isHighRiskContent(c.chunk)).length;

  // If more than 50% of results are high-risk, escalate
  const requireEscalation = highRiskCount > 0 &&
    highRiskCount / candidates.length > 0.5;

  if (requireEscalation && context.role !== 'admin') {
    logRetrievalAccess(
      context,
      'escalation-check',
      'denied',
      'high_risk_content_requires_admin'
    );

    return {
      verified: candidates.filter(c => !isHighRiskContent(c.chunk)),
      requireEscalation: true,
    };
  }

  return {
    verified: candidates,
    requireEscalation: false,
  };
}

// ============================================
// Batch Permission Check
// ============================================

/**
 * Filter a batch of chunks by permissions
 */
export function filterByPermissions(
  chunks: KnowledgeChunk[],
  context: AgentContext,
  classification: QueryClassification
): { allowed: KnowledgeChunk[]; denied: KnowledgeChunk[] } {
  const filter = buildMetadataFilter(
    classification,
    context.userId,
    context.role
  );

  const allowed: KnowledgeChunk[] = [];
  const denied: KnowledgeChunk[] = [];

  for (const chunk of chunks) {
    const check = verifyCandidatePermissions(chunk, classification, context, filter);

    if (check.allowed) {
      allowed.push(chunk);
    } else {
      denied.push(chunk);
    }
  }

  return { allowed, denied };
}
