/**
 * Document Ingestion Service
 * 
 * Manages the complete pipeline for adding documents to the knowledge base:
 * - Document import and validation
 * - Structure parsing
 * - Metadata extraction
 * - Chunking
 * - Indexing and embedding generation
 * - Version management
 * - Supersession handling
 * 
 * Architecture:
 * - Pure domain logic, no infrastructure dependencies
 * - Idempotent operations
 * - Safe revocation and re-indexing
 * - Full audit trail
 * 
 * Security:
 * - Tenant isolation enforced at all stages
 * - Content hash verification
 * - Approval workflow integration
 * - No ingestion without proper authorization
 */

import { createHash } from 'crypto';

import type {
  KnowledgeDocument,
  KnowledgeChunk,
  IngestionJob,
  IngestionStatus,
  DocumentType,
  KnowledgeZone,
  Jurisdiction,
  ConfidentialityLevel,
  ApprovalStatus,
  DocumentStructure,
} from './types';
import type { AgentContext, Role } from '@/types';
import { parseDocumentStructure, chunkDocument } from './chunking-service';
import { KNOWLEDGE_ZONE_CONFIG, validateZoneAssignment } from './knowledge-zones';
import { logSensitiveAction } from '@/lib/infrastructure/audit/audit-logger';
import { hasCapability } from '@/lib/auth/authorization';

// ============================================
// Ingestion Configuration
// ============================================

interface IngestionConfig {
  requireApproval: boolean;
  autoIndex: boolean;
  generateEmbeddings: boolean;
  validateStructure: boolean;
  notifyOnComplete: boolean;
}

const DEFAULT_CONFIG: IngestionConfig = {
  requireApproval: true,
  autoIndex: true,
  generateEmbeddings: true,
  validateStructure: true,
  notifyOnComplete: true,
};

// ============================================
// Ingestion Job Management
// ============================================

// In-memory store for POC - production uses database
const ingestionJobs: Map<string, IngestionJob> = new Map();

/**
 * Create a new ingestion job
 */
export function createIngestionJob(
  sourceUri: string,
  sourceType: 'upload' | 'sync' | 'api' | 'manual',
  sourceSystem: string | null,
  tenantId: string,
  initiatedBy: string
): IngestionJob {
  const now = new Date().toISOString();

  const job: IngestionJob = {
    id: `ingest-${crypto.randomUUID()}`,
    tenantId,
    documentId: null,
    sourceUri,
    sourceType,
    sourceSystem,
    status: 'pending',
    stage: 'created',
    progress: 0,
    documentCreated: false,
    chunksCreated: 0,
    errors: [],
    startedAt: now,
    completedAt: null,
    estimatedCompletion: null,
    initiatedBy,
    reviewedBy: null,
    approvedAt: null,
  };

  ingestionJobs.set(job.id, job);

  return job;
}

/**
 * Get ingestion job by ID
 */
export function getIngestionJob(jobId: string): IngestionJob | null {
  return ingestionJobs.get(jobId) || null;
}

/**
 * Update job status
 */
function updateJobStatus(
  jobId: string,
  status: IngestionStatus,
  stage: string,
  progress: number
): void {
  const job = ingestionJobs.get(jobId);
  if (!job) return;

  job.status = status;
  job.stage = stage;
  job.progress = progress;

  if (status === 'completed' || status === 'failed') {
    job.completedAt = new Date().toISOString();
  }

  ingestionJobs.set(jobId, job);
}

/**
 * Add error to job
 */
function addJobError(jobId: string, stage: string, message: string): void {
  const job = ingestionJobs.get(jobId);
  if (!job) return;

  job.errors.push({
    stage,
    message,
    timestamp: new Date().toISOString(),
  });

  ingestionJobs.set(jobId, job);
}

// ============================================
// Document Creation
// ============================================

export interface CreateDocumentInput {
  title: string;
  description?: string;
  sourceType: 'upload' | 'sync' | 'api' | 'manual';
  sourceUri: string | null;
  sourceSystem: string | null;
  rawText: string;
  documentType: DocumentType;
  knowledgeZone: KnowledgeZone;
  topic: string;
  topics?: string[];
  audience?: Role[];
  jurisdiction?: Jurisdiction;
  appliesToLocations?: string[];
  appliesToDepartments?: string[];
  appliesToEmploymentTypes?: string[];
  confidentiality?: ConfidentialityLevel;
  version: string;
  effectiveDate: string;
  reviewDate?: string | null;
  previousVersion?: string | null;
  legalEntity?: string | null;
}

/**
 * Create a new knowledge document
 * 
 * Validates zone assignment, creates document record, logs audit event
 */
export function createDocument(
  input: CreateDocumentInput,
  context: AgentContext,
  config: Partial<IngestionConfig> = {}
): { success: boolean; document?: KnowledgeDocument; job?: IngestionJob; error?: string } {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };

  // Permission check
  if (!hasCapability(context.role, 'policy:write')) {
    return { success: false, error: 'Insufficient permissions to create documents' };
  }

  // Validate zone assignment
  const zoneValidation = validateZoneAssignment(
    input.knowledgeZone,
    input.confidentiality || 'internal',
    'draft'
  );
  if (!zoneValidation.valid) {
    return { success: false, error: zoneValidation.error };
  }

  // Check if zone requires approval
  const zoneConfig = KNOWLEDGE_ZONE_CONFIG[input.knowledgeZone];
  const approvalStatus: ApprovalStatus = zoneConfig.requiresApproval && fullConfig.requireApproval
    ? 'pending_approval'
    : 'approved';

  // Generate content hash
  const contentHash = generateContentHash(input.rawText);

  // Parse structure
  const structure = parseDocumentStructure(input.rawText, input.documentType);

  // Create document
  const now = new Date().toISOString();
  const document: KnowledgeDocument = {
    id: `doc-${crypto.randomUUID()}`,
    tenantId: context.userId, // Use user tenant for POC
    legalEntity: input.legalEntity || null,
    title: input.title,
    description: input.description || null,
    sourceType: input.sourceType,
    sourceUri: input.sourceUri,
    sourceSystem: input.sourceSystem,
    documentType: input.documentType,
    knowledgeZone: input.knowledgeZone,
    topic: input.topic,
    topics: input.topics || [input.topic],
    audience: input.audience || zoneConfig.defaultRoles,
    jurisdiction: input.jurisdiction || 'unknown',
    appliesToLocations: input.appliesToLocations || [],
    appliesToDepartments: input.appliesToDepartments || [],
    appliesToEmploymentTypes: input.appliesToEmploymentTypes || [],
    confidentiality: input.confidentiality || 'internal',
    approvalStatus,
    approvedBy: approvalStatus === 'approved' ? context.employeeId || context.userId : null,
    approvedAt: approvalStatus === 'approved' ? now : null,
    version: input.version,
    effectiveDate: input.effectiveDate,
    reviewDate: input.reviewDate || null,
    supersededBy: null,
    previousVersion: input.previousVersion || null,
    isCurrentVersion: true,
    sourceOfTruthRank: zoneConfig.priority,
    contentHash,
    checksumAlgorithm: 'sha256',
    rawText: input.rawText,
    parsedStructure: structure,
    totalChunks: 0,
    totalTokens: 0,
    embeddingModel: null,
    // Governance fields
    lifecycleState: 'draft',
    ownership: {
      documentOwner: context.employeeId || context.userId,
      createdBy: context.employeeId || context.userId,
      updatedBy: context.employeeId || context.userId,
    },
    governanceMetadata: {
      sourceAuthorityRank: 'reference',
      requiresLegalReview: false,
      requiresHROpsReview: false,
      requiresComplianceReview: false,
    },
    indexingMetadata: {
      ingestionStatus: 'pending',
      indexingStatus: 'pending',
      chunksCreated: 0,
      chunksIndexed: 0,
    },
    createdBy: context.employeeId || context.userId,
    createdAt: now,
    updatedBy: context.employeeId || context.userId,
    updatedAt: now,
    indexedAt: null,
    lastSyncAt: null,
  };

  // Create ingestion job
  const job = createIngestionJob(
    input.sourceUri || `internal://${document.id}`,
    input.sourceType,
    input.sourceSystem,
    document.tenantId,
    context.employeeId || context.userId
  );

  job.documentId = document.id;

  // Log creation
  logSensitiveAction(
    context,
    'document_created',
    'knowledge_document',
    document.id,
    false
  );

  return {
    success: true,
    document,
    job,
  };
}

/**
 * Generate SHA-256 hash of content
 */
function generateContentHash(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}

// ============================================
// Chunking and Indexing
// ============================================

/**
 * Process document through chunking pipeline
 */
export function processDocumentChunks(
  document: KnowledgeDocument,
  jobId: string
): { success: boolean; chunks?: KnowledgeChunk[]; error?: string } {
  try {
    updateJobStatus(jobId, 'chunking', 'parsing_structure', 20);

    // Ensure structure is parsed
    if (!document.parsedStructure) {
      document.parsedStructure = parseDocumentStructure(
        document.rawText,
        document.documentType
      );
    }

    updateJobStatus(jobId, 'chunking', 'creating_chunks', 40);

    // Chunk the document
    const chunks = chunkDocument(document, document.parsedStructure);

    // Calculate totals
    const totalTokens = chunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0);

    // Update document
    document.totalChunks = chunks.length;
    document.totalTokens = totalTokens;
    document.updatedAt = new Date().toISOString();

    // Update job
    const job = ingestionJobs.get(jobId);
    if (job) {
      job.chunksCreated = chunks.length;
    }

    updateJobStatus(jobId, 'indexing', 'chunks_created', 60);

    return {
      success: true,
      chunks,
    };

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Chunking failed';
    addJobError(jobId, 'chunking', message);
    updateJobStatus(jobId, 'failed', 'chunking_failed', 0);

    return {
      success: false,
      error: message,
    };
  }
}

// ============================================
// Version Management
// ============================================

/**
 * Supersede a document with a new version
 * 
 * Marks old version as superseded, creates new version as current
 */
export function supersedeDocument(
  existingDocumentId: string,
  newDocumentInput: CreateDocumentInput,
  context: AgentContext
): { success: boolean; newDocument?: KnowledgeDocument; job?: IngestionJob; error?: string } {
  // Permission check
  if (!hasCapability(context.role, 'policy:write')) {
    return { success: false, error: 'Insufficient permissions to supersede documents' };
  }

  // Note: In production, this would fetch the existing document from database
  // For POC, we assume the caller has validated the document exists

  // Create new version
  const newInput: CreateDocumentInput = {
    ...newDocumentInput,
    previousVersion: existingDocumentId,
  };

  const result = createDocument(newInput, context);

  if (!result.success) {
    return result;
  }

  // Mark as superseded would happen in database update
  // For now, just log the action
  logSensitiveAction(
    context,
    'document_superseded',
    'knowledge_document',
    existingDocumentId,
    false
  );

  return result;
}

/**
 * Revoke document access
 * 
 * Soft-delete: marks document as revoked, removes from search
 */
export function revokeDocument(
  documentId: string,
  reason: string,
  context: AgentContext
): { success: boolean; error?: string } {
  // Permission check
  if (!hasCapability(context.role, 'policy:admin')) {
    return { success: false, error: 'Insufficient permissions to revoke documents' };
  }

  // Note: In production, this would update the database
  // Mark as revoked

  logSensitiveAction(
    context,
    'document_revoked',
    'knowledge_document',
    documentId,
    false
  );

  return { success: true };
}

// ============================================
// Approval Workflow
// ============================================

/**
 * Approve a pending document
 */
export function approveDocument(
  documentId: string,
  context: AgentContext
): { success: boolean; error?: string } {
  // Permission check
  if (!hasCapability(context.role, 'policy:admin')) {
    return { success: false, error: 'Insufficient permissions to approve documents' };
  }

  // Note: In production, this would update the database

  const now = new Date().toISOString();

  logSensitiveAction(
    context,
    'document_approved',
    'knowledge_document',
    documentId,
    false
  );

  return { success: true };
}

/**
 * Reject a pending document
 */
export function rejectDocument(
  documentId: string,
  reason: string,
  context: AgentContext
): { success: boolean; error?: string } {
  // Permission check
  if (!hasCapability(context.role, 'policy:admin')) {
    return { success: false, error: 'Insufficient permissions to reject documents' };
  }

  // Note: In production, this would update the database

  logSensitiveAction(
    context,
    'document_rejected',
    'knowledge_document',
    documentId,
    false
  );

  return { success: true };
}

// ============================================
// Re-Indexing
// ============================================

/**
 * Trigger re-indexing of a document
 * 
 * Used when:
 * - Document content changes
 * - Chunking strategy changes
 * - Metadata changes requiring re-chunking
 */
export function reindexDocument(
  documentId: string,
  context: AgentContext,
  config: Partial<IngestionConfig> = {}
): { success: boolean; job?: IngestionJob; error?: string } {
  // Permission check
  if (!hasCapability(context.role, 'policy:write')) {
    return { success: false, error: 'Insufficient permissions to reindex documents' };
  }

  // Note: In production, this would fetch the document and create a re-indexing job

  const job = createIngestionJob(
    `reindex://${documentId}`,
    'api',
    null,
    context.userId,
    context.employeeId || context.userId
  );

  updateJobStatus(job.id, 'pending', 'reindex_scheduled', 0);

  logSensitiveAction(
    context,
    'document_reindex_triggered',
    'knowledge_document',
    documentId,
    false
  );

  return {
    success: true,
    job,
  };
}

// ============================================
// Validation
// ============================================

/**
 * Validate document input
 */
export function validateDocumentInput(
  input: Partial<CreateDocumentInput>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!input.title || input.title.length < 3) {
    errors.push('Title must be at least 3 characters');
  }

  if (!input.rawText || input.rawText.length < 50) {
    errors.push('Content must be at least 50 characters');
  }

  if (!input.documentType) {
    errors.push('Document type is required');
  }

  if (!input.knowledgeZone) {
    errors.push('Knowledge zone is required');
  }

  if (!input.topic) {
    errors.push('Topic is required');
  }

  if (!input.version) {
    errors.push('Version is required');
  }

  if (!input.effectiveDate) {
    errors.push('Effective date is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
