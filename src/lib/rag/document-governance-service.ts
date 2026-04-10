/**
 * Document Governance Service
 *
 * Enterprise-grade governance for RAG knowledge base:
 * - Document lifecycle state management
 * - Approval workflows
 * - Ownership and accountability
 * - Review queues
 * - Supersession and revocation
 * - Retrieval eligibility
 * - Stale content management
 *
 * Security: Strict tenant isolation, RBAC, audit logging
 */

import type {
  KnowledgeDocument,
  DocumentLifecycleState,
  DocumentLifecycleEvent,
  DocumentOwnership,
  DocumentReviewQueueItem,
  DocumentRetrievalStatus,
  DocumentSupersessionInfo,
  DocumentRevocationInfo,
} from '@/types/rag';
import type { Role } from '@/types';
import { hasCapability } from '@/lib/auth/authorization';

// ============================================
// State Machine Definition
// ============================================

const VALID_STATE_TRANSITIONS: Record<DocumentLifecycleState, DocumentLifecycleState[]> = {
  draft: ['pending_review', 'archived'],
  pending_review: ['approved', 'rejected', 'draft'],
  approved: ['superseded', 'revoked', 'archived'],
  rejected: ['draft', 'archived'],
  superseded: ['archived'],
  revoked: ['archived'],
  archived: ['draft'], // restored goes to draft
};

// ============================================
// Mock Repository (POC)
// ============================================

const documentStore: Map<string, KnowledgeDocument> = new Map();
const lifecycleEventStore: Map<string, DocumentLifecycleEvent[]> = new Map();

export function storeGovernanceDocument(doc: KnowledgeDocument): void {
  documentStore.set(doc.id, doc);
}

export function getGovernanceDocument(id: string, tenantId: string): KnowledgeDocument | null {
  const doc = documentStore.get(id);
  if (!doc || doc.tenantId !== tenantId) return null;
  return doc;
}

export function updateGovernanceDocument(doc: KnowledgeDocument): void {
  documentStore.set(doc.id, doc);
}

export function addGovernanceLifecycleEvent(event: DocumentLifecycleEvent): void {
  const key = `${event.tenantId}:${event.documentId}`;
  const existing = lifecycleEventStore.get(key) || [];
  existing.push(event);
  lifecycleEventStore.set(key, existing);
}

export function getGovernanceLifecycleHistory(documentId: string, tenantId: string): DocumentLifecycleEvent[] {
  const key = `${tenantId}:${documentId}`;
  return lifecycleEventStore.get(key) || [];
}

// ============================================
// Permission Helpers
// ============================================

export function canUploadDocument(role: Role): boolean {
  return hasCapability(role, 'knowledge:upload');
}

export function canApproveDocument(role: Role, zone: string): boolean {
  const highRiskZones = ['legal_playbook', 'authoritative_policy'];
  if (highRiskZones.includes(zone)) {
    return hasCapability(role, 'knowledge:approve_high_risk');
  }
  return hasCapability(role, 'knowledge:approve');
}

export function canReviewDocument(role: Role, reviewType: 'legal' | 'hr_ops' | 'compliance'): boolean {
  const caps: Record<string, string> = {
    legal: 'knowledge:review_legal',
    hr_ops: 'knowledge:review_hr_ops',
    compliance: 'knowledge:review_compliance',
  };
  return hasCapability(role, caps[reviewType]);
}

export function canSupersedeDocument(role: Role): boolean {
  return hasCapability(role, 'knowledge:supersede');
}

export function canRevokeDocument(role: Role): boolean {
  return hasCapability(role, 'knowledge:revoke');
}

export function canManageMetadata(role: Role): boolean {
  return hasCapability(role, 'knowledge:edit_metadata');
}

// ============================================
// Lifecycle Event Factory
// ============================================

function createLifecycleEvent(params: {
  documentId: string;
  tenantId: string;
  fromState?: DocumentLifecycleState;
  toState: DocumentLifecycleState;
  eventType: DocumentLifecycleEvent['eventType'];
  actorId: string;
  actorRole: string;
  reason?: string;
  metadataChanges?: Record<string, { old: unknown; new: unknown }>;
}): DocumentLifecycleEvent {
  return {
    id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    ...params,
  };
}

// ============================================
// Validation Helpers
// ============================================

function validateStateTransition(from: DocumentLifecycleState, to: DocumentLifecycleState): void {
  if (from === to) return;
  const validTransitions = VALID_STATE_TRANSITIONS[from];
  if (!validTransitions.includes(to)) {
    throw new Error(`Invalid transition from ${from} to ${to}`);
  }
}

function getDocumentOrThrow(documentId: string, tenantId: string): KnowledgeDocument {
  const doc = getGovernanceDocument(documentId, tenantId);
  if (!doc) {
    throw new Error(`Document not found: ${documentId}`);
  }
  return doc;
}

// ============================================
// Lifecycle Operations
// ============================================

export async function submitForReview(
  documentId: string,
  tenantId: string,
  submittedBy: string
): Promise<DocumentLifecycleEvent> {
  const doc = getDocumentOrThrow(documentId, tenantId);
  validateStateTransition(doc.lifecycleState, 'pending_review');

  const event = createLifecycleEvent({
    documentId,
    tenantId,
    fromState: doc.lifecycleState,
    toState: 'pending_review',
    eventType: 'submitted_for_review',
    actorId: submittedBy,
    actorRole: 'user',
  });

  doc.lifecycleState = 'pending_review';
  doc.updatedAt = new Date().toISOString();
  doc.ownership = { ...doc.ownership, updatedBy: submittedBy };

  updateGovernanceDocument(doc);
  addGovernanceLifecycleEvent(event);

  return event;
}

export async function approveDocument(
  documentId: string,
  tenantId: string,
  approvedBy: string,
  notes?: string
): Promise<DocumentLifecycleEvent> {
  const doc = getDocumentOrThrow(documentId, tenantId);
  validateStateTransition(doc.lifecycleState, 'approved');

  const event = createLifecycleEvent({
    documentId,
    tenantId,
    fromState: doc.lifecycleState,
    toState: 'approved',
    eventType: 'approved',
    actorId: approvedBy,
    actorRole: 'admin',
    reason: notes,
  });

  doc.lifecycleState = 'approved';
  doc.approvalStatus = 'approved';
  doc.updatedAt = new Date().toISOString();
  doc.ownership = { ...doc.ownership, approvedBy, updatedBy: approvedBy };
  doc.governanceMetadata = {
    ...doc.governanceMetadata,
    requiresLegalReview: false,
    requiresHROpsReview: false,
    requiresComplianceReview: false,
    lastReviewedAt: new Date().toISOString(),
    lastReviewedBy: approvedBy,
    reviewNotes: notes,
  };

  updateGovernanceDocument(doc);
  addGovernanceLifecycleEvent(event);

  return event;
}

export async function rejectDocument(
  documentId: string,
  tenantId: string,
  rejectedBy: string,
  reason: string
): Promise<DocumentLifecycleEvent> {
  const doc = getDocumentOrThrow(documentId, tenantId);
  validateStateTransition(doc.lifecycleState, 'rejected');

  if (!reason?.trim()) {
    throw new Error('Rejection reason is required');
  }

  const event = createLifecycleEvent({
    documentId,
    tenantId,
    fromState: doc.lifecycleState,
    toState: 'rejected',
    eventType: 'rejected',
    actorId: rejectedBy,
    actorRole: 'admin',
    reason,
  });

  doc.lifecycleState = 'rejected';
  doc.approvalStatus = 'rejected';
  doc.updatedAt = new Date().toISOString();
  doc.ownership = { ...doc.ownership, rejectedBy, updatedBy: rejectedBy };
  doc.governanceMetadata = { ...doc.governanceMetadata, rejectionReason: reason };

  updateGovernanceDocument(doc);
  addGovernanceLifecycleEvent(event);

  return event;
}

export async function supersedeDocument(
  documentId: string,
  tenantId: string,
  supersededById: string,
  supersededByUser: string,
  reason: string
): Promise<DocumentLifecycleEvent> {
  const doc = getDocumentOrThrow(documentId, tenantId);
  const newDoc = getGovernanceDocument(supersededById, tenantId);

  if (!newDoc) {
    throw new Error('Superseding document not found');
  }

  validateStateTransition(doc.lifecycleState, 'superseded');

  const event = createLifecycleEvent({
    documentId,
    tenantId,
    fromState: doc.lifecycleState,
    toState: 'superseded',
    eventType: 'superseded',
    actorId: supersededByUser,
    actorRole: 'admin',
    reason,
  });

  doc.lifecycleState = 'superseded';
  doc.isCurrentVersion = false;
  doc.approvalStatus = 'superseded';
  doc.updatedAt = new Date().toISOString();
  doc.supersessionInfo = {
    supersededByDocumentId: supersededById,
    supersededByDocumentTitle: newDoc.title,
    supersededAt: new Date().toISOString(),
    supersessionReason: reason,
    supersessionApprovedBy: supersededByUser,
  };
  doc.ownership = { ...doc.ownership, supersededBy: supersededByUser, updatedBy: supersededByUser };

  newDoc.isCurrentVersion = true;

  updateGovernanceDocument(doc);
  updateGovernanceDocument(newDoc);
  addGovernanceLifecycleEvent(event);

  return event;
}

export async function revokeDocument(
  documentId: string,
  tenantId: string,
  revokedBy: string,
  reason: string,
  scheduledDate?: string
): Promise<DocumentLifecycleEvent> {
  const doc = getDocumentOrThrow(documentId, tenantId);

  const validFromStates: DocumentLifecycleState[] = ['draft', 'pending_review', 'approved', 'rejected'];
  if (!validFromStates.includes(doc.lifecycleState)) {
    throw new Error(`Cannot revoke document in state: ${doc.lifecycleState}`);
  }

  if (!reason?.trim()) {
    throw new Error('Revocation reason is required');
  }

  const event = createLifecycleEvent({
    documentId,
    tenantId,
    fromState: doc.lifecycleState,
    toState: 'revoked',
    eventType: 'revoked',
    actorId: revokedBy,
    actorRole: 'admin',
    reason,
  });

  doc.lifecycleState = 'revoked';
  doc.isCurrentVersion = false;
  doc.approvalStatus = 'revoked';
  doc.updatedAt = new Date().toISOString();
  doc.revocationInfo = {
    revokedAt: new Date().toISOString(),
    revokedBy,
    revocationReason: reason,
    revocationApprovedBy: revokedBy,
    scheduledRemovalDate: scheduledDate,
  };
  doc.ownership = { ...doc.ownership, updatedBy: revokedBy };

  updateGovernanceDocument(doc);
  addGovernanceLifecycleEvent(event);

  return event;
}

export async function archiveDocument(
  documentId: string,
  tenantId: string,
  archivedBy: string,
  reason: string
): Promise<DocumentLifecycleEvent> {
  const doc = getDocumentOrThrow(documentId, tenantId);
  validateStateTransition(doc.lifecycleState, 'archived');

  const event = createLifecycleEvent({
    documentId,
    tenantId,
    fromState: doc.lifecycleState,
    toState: 'archived',
    eventType: 'archived',
    actorId: archivedBy,
    actorRole: 'admin',
    reason,
  });

  doc.lifecycleState = 'archived';
  doc.isCurrentVersion = false;
  doc.updatedAt = new Date().toISOString();
  doc.ownership = { ...doc.ownership, updatedBy: archivedBy };

  updateGovernanceDocument(doc);
  addGovernanceLifecycleEvent(event);

  return event;
}

export async function restoreDocument(
  documentId: string,
  tenantId: string,
  restoredBy: string,
  reason: string
): Promise<DocumentLifecycleEvent> {
  const doc = getDocumentOrThrow(documentId, tenantId);

  if (doc.lifecycleState !== 'archived') {
    throw new Error('Can only restore archived documents');
  }

  const event = createLifecycleEvent({
    documentId,
    tenantId,
    fromState: 'archived',
    toState: 'draft',
    eventType: 'restored',
    actorId: restoredBy,
    actorRole: 'admin',
    reason,
  });

  doc.lifecycleState = 'draft';
  doc.approvalStatus = 'pending_approval';
  doc.updatedAt = new Date().toISOString();
  doc.ownership = { ...doc.ownership, updatedBy: restoredBy };

  updateGovernanceDocument(doc);
  addGovernanceLifecycleEvent(event);

  return event;
}

// ============================================
// Ownership & Metadata Operations
// ============================================

export async function changeDocumentOwnership(
  documentId: string,
  tenantId: string,
  changes: Partial<DocumentOwnership>,
  changedBy: string,
  reason: string
): Promise<DocumentLifecycleEvent> {
  const doc = getDocumentOrThrow(documentId, tenantId);

  const event = createLifecycleEvent({
    documentId,
    tenantId,
    fromState: doc.lifecycleState,
    toState: doc.lifecycleState,
    eventType: 'ownership_changed',
    actorId: changedBy,
    actorRole: 'admin',
    reason,
  });

  doc.ownership = { ...doc.ownership, ...changes, updatedBy: changedBy };
  doc.updatedAt = new Date().toISOString();

  updateGovernanceDocument(doc);
  addGovernanceLifecycleEvent(event);

  return event;
}

export async function updateDocumentReviewDate(
  documentId: string,
  tenantId: string,
  newReviewDate: string,
  updatedBy: string,
  reason: string
): Promise<DocumentLifecycleEvent> {
  const doc = getDocumentOrThrow(documentId, tenantId);

  const event = createLifecycleEvent({
    documentId,
    tenantId,
    fromState: doc.lifecycleState,
    toState: doc.lifecycleState,
    eventType: 'review_date_changed',
    actorId: updatedBy,
    actorRole: 'admin',
    reason,
  });

  doc.reviewDate = newReviewDate;
  doc.governanceMetadata = { ...doc.governanceMetadata, nextReviewDue: newReviewDate };
  doc.updatedAt = new Date().toISOString();
  doc.ownership = { ...doc.ownership, updatedBy };

  updateGovernanceDocument(doc);
  addGovernanceLifecycleEvent(event);

  return event;
}

// ============================================
// Queries
// ============================================

export async function getReviewQueue(
  tenantId: string,
  reviewerId?: string
): Promise<DocumentReviewQueueItem[]> {
  const queue: DocumentReviewQueueItem[] = [];

  for (const doc of documentStore.values()) {
    if (doc.tenantId !== tenantId) continue;
    if (doc.lifecycleState !== 'pending_review') continue;

    const requiredReviewers: string[] = [];
    const requiredReviewTypes: ('legal' | 'hr_ops' | 'compliance')[] = [];

    if (doc.governanceMetadata?.requiresLegalReview) {
      requiredReviewTypes.push('legal');
      if (doc.governanceMetadata.legalReviewerId) {
        requiredReviewers.push(doc.governanceMetadata.legalReviewerId);
      }
    }
    if (doc.governanceMetadata?.requiresHROpsReview) {
      requiredReviewTypes.push('hr_ops');
      if (doc.governanceMetadata.hrOpsReviewerId) {
        requiredReviewers.push(doc.governanceMetadata.hrOpsReviewerId);
      }
    }
    if (doc.governanceMetadata?.requiresComplianceReview) {
      requiredReviewTypes.push('compliance');
      if (doc.governanceMetadata.complianceReviewerId) {
        requiredReviewers.push(doc.governanceMetadata.complianceReviewerId);
      }
    }

    if (reviewerId && !requiredReviewers.includes(reviewerId)) continue;

    const daysInQueue = Math.floor(
      (Date.now() - new Date(doc.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );

    queue.push({
      documentId: doc.id,
      title: doc.title,
      documentType: doc.documentType,
      knowledgeZone: doc.knowledgeZone,
      submittedBy: doc.ownership.createdBy,
      submittedAt: doc.createdAt,
      pendingReviewers: requiredReviewers,
      requiredReviewTypes,
      priority: daysInQueue > 7 ? 'high' : daysInQueue > 3 ? 'medium' : 'low',
      daysInQueue,
    });
  }

  return queue.sort((a, b) => b.daysInQueue - a.daysInQueue);
}

export async function checkRetrievalEligibility(
  documentId: string,
  tenantId: string
): Promise<DocumentRetrievalStatus> {
  const doc = getGovernanceDocument(documentId, tenantId);

  if (!doc) {
    return {
      isRetrievable: false,
      reason: 'Document not found',
      effectiveDatePassed: false,
      reviewDateValid: false,
      approvalStatusValid: false,
      indexingStatusValid: false,
      notSuperseded: false,
      notRevoked: false,
      notArchived: false,
    };
  }

  const now = new Date();
  const effectiveDate = new Date(doc.effectiveDate);
  const reviewDate = doc.reviewDate ? new Date(doc.reviewDate) : null;

  const status: DocumentRetrievalStatus = {
    isRetrievable: true,
    effectiveDatePassed: effectiveDate <= now,
    reviewDateValid: reviewDate ? reviewDate >= now : true,
    approvalStatusValid: doc.lifecycleState === 'approved' && doc.approvalStatus === 'approved',
    indexingStatusValid: doc.indexingMetadata?.indexingStatus === 'completed',
    notSuperseded: doc.lifecycleState !== 'superseded',
    notRevoked: doc.lifecycleState !== 'revoked',
    notArchived: doc.lifecycleState !== 'archived',
  };

  const issues: string[] = [];
  if (!status.effectiveDatePassed) issues.push('effective date not reached');
  if (!status.reviewDateValid) issues.push('review date passed');
  if (!status.approvalStatusValid) issues.push('not approved');
  if (!status.indexingStatusValid) issues.push('not indexed');
  if (!status.notSuperseded) issues.push('superseded');
  if (!status.notRevoked) issues.push('revoked');
  if (!status.notArchived) issues.push('archived');

  if (issues.length > 0) {
    status.reason = issues.join(', ');
    status.isRetrievable = false;
  } else {
    status.isRetrievable = true;
  }

  return status;
}

export async function getStaleDocuments(
  tenantId: string,
  staleAfterDays: number = 30
): Promise<KnowledgeDocument[]> {
  const stale: KnowledgeDocument[] = [];
  const now = new Date();

  for (const doc of documentStore.values()) {
    if (doc.tenantId !== tenantId) continue;
    if (!['approved', 'pending_review'].includes(doc.lifecycleState)) continue;

    const reviewDate = doc.reviewDate ? new Date(doc.reviewDate) : null;
    const lastReviewed = doc.governanceMetadata?.lastReviewedAt
      ? new Date(doc.governanceMetadata.lastReviewedAt)
      : new Date(doc.effectiveDate);

    if (reviewDate && reviewDate < now) {
      stale.push(doc);
      continue;
    }

    const daysSinceReview = Math.floor(
      (now.getTime() - lastReviewed.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceReview > staleAfterDays) {
      stale.push(doc);
    }
  }

  return stale;
}

export async function getDocumentsByState(
  tenantId: string,
  state: DocumentLifecycleState,
  limit?: number
): Promise<KnowledgeDocument[]> {
  const docs: KnowledgeDocument[] = [];
  for (const doc of documentStore.values()) {
    if (doc.tenantId === tenantId && doc.lifecycleState === state) {
      docs.push(doc);
      if (limit && docs.length >= limit) break;
    }
  }
  return docs;
}

// ============================================
// Governance Service Export
// ============================================

export const DocumentGovernanceService = {
  // Permissions
  canUpload: canUploadDocument,
  canApprove: canApproveDocument,
  canReview: canReviewDocument,
  canSupersede: canSupersedeDocument,
  canRevoke: canRevokeDocument,
  canManageMetadata: canManageMetadata,

  // Lifecycle
  submitForReview,
  approve: approveDocument,
  reject: rejectDocument,
  supersede: supersedeDocument,
  revoke: revokeDocument,
  archive: archiveDocument,
  restore: restoreDocument,

  // Ownership
  changeOwnership: changeDocumentOwnership,
  updateReviewDate: updateDocumentReviewDate,

  // Queries
  getLifecycleHistory: getGovernanceLifecycleHistory,
  getReviewQueue,
  checkRetrievalEligibility,
  getStaleDocuments,
  getDocumentsByState,
};
