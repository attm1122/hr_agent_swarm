/**
 * RAG (Retrieval-Augmented Generation) Domain Types
 * 
 * Production-grade type definitions for the knowledge retrieval subsystem.
 * 
 * Architecture:
 * - Pure domain types - no infrastructure dependencies
 * - Immutable value objects where possible
 * - Strict typing for safety and auditability
 * 
 * Security Model:
 * - All content carries tenant isolation markers
 * - Permission scopes enforced at retrieval time
 * - Metadata-first filtering before any LLM exposure
 * - Full traceability for audit and compliance
 */

import type { Role } from '@/types';

// ============================================
// Knowledge Zones
// ============================================

export type KnowledgeZone =
  | 'authoritative_policy'    // Approved company policies
  | 'legal_playbook'          // ER/legal playbooks
  | 'templates_precedents'    // Approved templates and precedents
  | 'workflow_sop'            // Workflow and SOP guidance
  | 'system_help'             // System/process help
  | 'private_case_data';      // Matter-specific (strongly isolated)

export const ZONE_PRIORITY: Record<KnowledgeZone, number> = {
  authoritative_policy: 100,
  legal_playbook: 90,
  templates_precedents: 80,
  workflow_sop: 70,
  system_help: 60,
  private_case_data: 50,
};

// ============================================
// Document Classification
// ============================================

export type DocumentType =
  | 'policy'
  | 'procedure'
  | 'playbook'
  | 'template'
  | 'sop'
  | 'guide'
  | 'faq'
  | 'form'
  | 'checklist'
  | 'legal_brief';

export type Jurisdiction =
  | 'AU'        // Australia federal
  | 'NSW'       // New South Wales
  | 'VIC'       // Victoria
  | 'QLD'       // Queensland
  | 'WA'        // Western Australia
  | 'SA'        // South Australia
  | 'TAS'       // Tasmania
  | 'ACT'       // Australian Capital Territory
  | 'NT'        // Northern Territory
  | 'NZ'        // New Zealand
  | 'global'    // Global/Jurisdiction-agnostic
  | 'unknown';

export type ConfidentialityLevel =
  | 'public'           // Publicly available
  | 'internal'         // All employees
  | 'manager_only'     // Managers and above
  | 'hr_only'          // HR and admin only
  | 'confidential'     // Restricted access
  | 'legal_privileged'; // Legal privilege protection

export type ApprovalStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'superseded'
  | 'revoked';

// ============================================
// Query Classification
// ============================================

export type QueryIntent =
  | 'policy_lookup'
  | 'drafting_support'
  | 'procedural_help'
  | 'manager_guidance'
  | 'hr_guidance'
  | 'template_lookup'
  | 'high_risk_er';

export type QueryDomain =
  | 'leave'
  | 'probation'
  | 'redundancy'
  | 'termination'
  | 'misconduct'
  | 'grievance'
  | 'performance'
  | 'onboarding'
  | 'offboarding'
  | 'visa'
  | 'payroll'
  | 'policies'
  | 'systems'
  | 'general';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type ActorPersona = 'employee' | 'manager' | 'hr' | 'admin' | 'exec' | 'legal';

export type ResponseMode =
  | 'answer'          // Direct answer with citations
  | 'checklist'       // Step-by-step checklist
  | 'draft_support'   // Drafting assistance
  | 'cite_only'       // Citations only, no generation
  | 'escalate';       // Immediate escalation

/**
 * Structured query classification profile
 * Drives retrieval strategy and safety controls
 */
export interface QueryClassification {
  intent: QueryIntent;
  domain: QueryDomain;
  risk: RiskLevel;
  jurisdiction: Jurisdiction;
  actor: ActorPersona;
  responseMode: ResponseMode;
  // Derived filters
  allowedZones: KnowledgeZone[];
  requiredVerification: boolean;
  maxContextBudget: number;  // Tokens
  retrievalDepth: 'fast' | 'standard' | 'deep';
}

// ============================================
// Canonical Document Model
// ============================================

/**
 * Enhanced Policy Document with full governance metadata
 * Replaces/enhances existing PolicyDocument type
 */
export interface KnowledgeDocument {
  id: string;
  tenantId: string;
  legalEntity: string | null;  // For multi-entity orgs

  // Content
  title: string;
  description: string | null;
  sourceType: 'upload' | 'sync' | 'api' | 'manual';
  sourceUri: string | null;
  sourceSystem: string | null;  // e.g., 'sharepoint', 'confluence'

  // Classification
  documentType: DocumentType;
  knowledgeZone: KnowledgeZone;
  topic: string;  // Primary topic
  topics: string[];  // All relevant topics
  audience: Role[];

  // Jurisdiction & Scope
  jurisdiction: Jurisdiction;
  appliesToLocations: string[];
  appliesToDepartments: string[];
  appliesToEmploymentTypes: string[];

  // Confidentiality & Access
  confidentiality: ConfidentialityLevel;
  approvalStatus: ApprovalStatus;
  approvedBy: string | null;
  approvedAt: string | null;

  // Versioning & Authority
  version: string;
  effectiveDate: string;
  reviewDate: string | null;
  supersededBy: string | null;  // Document ID
  previousVersion: string | null;  // Document ID
  isCurrentVersion: boolean;
  sourceOfTruthRank: number;  // Higher = more authoritative

  // Content integrity
  contentHash: string;  // SHA-256 of raw content
  checksumAlgorithm: 'sha256';
  rawText: string;  // Full text for re-chunking
  parsedStructure: DocumentStructure | null;

  // Indexing
  totalChunks: number;
  totalTokens: number;
  embeddingModel: string | null;

  // Audit
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
  indexedAt: string | null;
  lastSyncAt: string | null;

  // Governance Fields
  lifecycleState: DocumentLifecycleState;
  ownership: DocumentOwnership;
  governanceMetadata: DocumentGovernanceMetadata;
  supersessionInfo?: DocumentSupersessionInfo;
  revocationInfo?: DocumentRevocationInfo;
  indexingMetadata: DocumentIndexingMetadata;
}

/**
 * Document structure extracted during parsing
 */
export interface DocumentStructure {
  headings: Array<{
    level: number;
    title: string;
    lineStart: number;
    lineEnd: number | null;
  }>;
  sections: Array<{
    id: string;
    headingRef: string | null;
    level: number;
    title: string;
    content: string;
    lineStart: number;
    lineEnd: number | null;
  }>;
  tables: Array<{
    caption: string | null;
    headers: string[];
    rows: string[][];
  }>;
  lists: Array<{
    type: 'ordered' | 'unordered';
    items: string[];
  }>;
}

// ============================================
// Structure-Aware Chunk Model
// ============================================

/**
 * Document chunk with parent/child relationships
 * Optimized for retrieval precision and context preservation
 */
export interface KnowledgeChunk {
  id: string;
  documentId: string;
  tenantId: string;

  // Hierarchy
  parentSectionId: string | null;  // Parent section/chunk
  rootDocumentId: string;  // Top-level document
  chunkOrder: number;  // Sequential order in document
  chunkLevel: number;  // 0 = root, 1 = section, 2 = subsection

  // Content
  titlePath: string[];  // Hierarchical path: ["Heading 1", "Subheading"]
  clauseRef: string | null;  // "3.2(a)", "Section 4", etc.
  content: string;
  tokenCount: number;

  // Context preservation
  surroundingContext: {
    previousChunkId: string | null;
    nextChunkId: string | null;
    parentChunkId: string | null;
    siblingChunkIds: string[];
  } | null;

  // Metadata (inherited from parent document)
  knowledgeZone: KnowledgeZone;
  documentType: DocumentType;
  topic: string;
  topics: string[];
  audience: Role[];
  jurisdiction: Jurisdiction;
  confidentiality: ConfidentialityLevel;
  approvalStatus: ApprovalStatus;
  isCurrentVersion: boolean;
  effectiveDate: string;
  version: string;

  // Embeddings (stored separately or as reference)
  embeddingVector: number[] | null;
  embeddingModel: string | null;
  embeddingUpdatedAt: string | null;

  // Retrieval optimization
  keywords: string[];  // Extracted keywords for lexical search
  keyPhrases: string[];  // Key phrases for matching
  entities: string[];  // Named entities mentioned

  // Audit
  createdAt: string;
  updatedAt: string;
  indexedAt: string | null;
}

// ============================================
// Retrieval & Ranking
// ============================================

/**
 * Search candidate from initial retrieval
 */
export interface RetrievalCandidate {
  chunk: KnowledgeChunk;
  document: KnowledgeDocument;
  semanticScore: number;  // 0-1 from vector similarity
  lexicalScore: number;   // 0-1 from keyword/BM25
  combinedScore: number;  // Merged score
  matchDetails: {
    matchedKeywords: string[];
    matchedPhrases: string[];
    semanticDistance: number;
  };
}

/**
 * Reranked result after HR-specific reranking
 */
export interface RerankedResult {
  chunk: KnowledgeChunk;
  document: KnowledgeDocument;
  originalScore: number;
  rerankedScore: number;
  rankChange: number;  // +N improved, -N declined

  // Reranking factors
  authorityBonus: number;  // Based on sourceOfTruthRank
  recencyBonus: number;    // Based on effectiveDate
  jurisdictionMatch: boolean;
  roleMatch: boolean;
  versionBoost: boolean;   // Current version bonus
  zonePriority: number;    // ZONE_PRIORITY value

  // Citation info
  citation: Citation;
}

/**
 * Citation for answer generation
 */
export interface Citation {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  version: string;
  titlePath: string[];
  clauseRef: string | null;
  content: string;  // The cited content
  relevanceScore: number;
}

// ============================================
// Context Assembly
// ============================================

/**
 * Assembled context pack for generation
 */
export interface ContextPack {
  query: string;
  classification: QueryClassification;
  sources: RerankedResult[];
  citations: Citation[];
  totalTokens: number;
  tokenBudget: number;
  assemblyStrategy: 'authority_first' | 'compact' | 'expanded';

  // Context content
  contextText: string;
  citationIndex: Map<string, Citation>;

  // Risk and verification flags
  highRiskMode: boolean;
  verificationRequired: boolean;

  // Grouping info
  sourcesByDocument: Map<string, RerankedResult[]>;
  sourcesByZone: Map<KnowledgeZone, RerankedResult[]>;
}

/**
 * Retrieval profile configuration
 */
export interface RetrievalProfile {
  id: string;
  name: string;

  // Matching configuration
  semanticWeight: number;  // 0-1
  lexicalWeight: number;   // 0-1
  candidateLimit: number;  // Initial candidates
  finalLimit: number;      // After reranking

  // Filtering
  requiredZones: KnowledgeZone[];
  excludedZones: KnowledgeZone[];
  requiredStatus: ApprovalStatus[];
  confidentialityLimit: ConfidentialityLevel;

  // Reranking
  authorityWeight: number;
  recencyWeight: number;
  jurisdictionWeight: number;

  // Assembly
  contextBudget: number;   // Max tokens
  expandParents: boolean; // Include parent sections
  deduplicate: boolean;

  // Risk controls
  verificationRequired: boolean;
  maxAnswerConfidence: number;  // Cap confidence for risky domains
  requireEscalationLanguage: boolean;
}

// ============================================
// Generation & Verification
// ============================================

/**
 * Grounded answer with full traceability
 */
export interface GroundedAnswer {
  answer: string;
  citations: Citation[];
  confidence: number;
  generationMetadata: {
    model: string;
    tokensUsed: number;
    generationTimeMs: number;
    promptVersion: string;
  };

  // Risk indicators
  requiresEscalation: boolean;
  escalationReason: string | null;
  riskLevel: RiskLevel;

  // Verification
  verificationResult: VerificationResult | null;
  unsupportedClaims: string[];
  weakEvidenceClaims: string[];
}

/**
 * Verification result for answer validation
 */
export interface VerificationResult {
  verified: boolean;
  confidence: number;
  checks: Array<{
    check: string;
    passed: boolean;
    details: string;
  }>;
  issues: string[];
  recommendations: string[];
}

// ============================================
// Audit & Traceability
// ============================================

/**
 * Complete trace of a RAG query execution
 */
export interface RAGQueryTrace {
  id: string;
  tenantId: string;

  // Request
  actorId: string;
  actorRole: Role;
  sessionId: string;
  query: string;
  timestamp: string;

  // Classification
  classification: QueryClassification;
  retrievalProfileId: string;

  // Retrieval
  retrievalSteps: Array<{
    step: string;
    timestamp: string;
    candidates: number;
    durationMs: number;
  }>;
  retrievedChunkIds: string[];
  rerankedChunkIds: string[];

  // Generation
  citationsUsed: string[];
  answerGenerated: boolean;
  generationDurationMs: number;

  // Verification
  verificationRequired: boolean;
  verificationPassed: boolean | null;
  verificationIssues: string[];

  // Response
  responseMode: ResponseMode;
  requiresEscalation: boolean;
  confidence: number;

  // Performance
  totalLatencyMs: number;
  tokensConsumed: number;

  // Safety flags
  safetyFlags: string[];
  permissionDenied: boolean;
  staleContentRetrieved: boolean;
}

// ============================================
// Ingestion Pipeline
// ============================================

/**
 * Input for creating a new document
 */
export interface CreateDocumentInput {
  tenantId: string;
  title: string;
  content: string;
  documentType: DocumentType;
  knowledgeZone: KnowledgeZone;
  jurisdiction: Jurisdiction;
  topics?: string[];
  audience?: string[];
  confidentiality?: ConfidentialityLevel;
  effectiveDate?: string;
  reviewDate?: string;
  legalEntity?: string | null;
  sourceUri?: string;
  sourceSystem?: string | null;
  ownerId?: string;
  createdBy: string;
}

/**
 * Document ingestion job
 */
export interface IngestionJob {
  id: string;
  tenantId: string;
  documentId: string | null;

  // Source
  sourceUri: string;
  sourceType: 'upload' | 'sync' | 'api' | 'manual';
  sourceSystem: string | null;

  // Status
  status: IngestionStatus;
  stage: string;  // Current processing stage
  progress: number;  // 0-100

  // Results
  documentCreated: boolean;
  chunksCreated: number;
  errors: Array<{
    stage: string;
    message: string;
    timestamp: string;
  }>;

  // Timing
  startedAt: string;
  completedAt: string | null;
  estimatedCompletion: string | null;

  // Audit
  initiatedBy: string;
  reviewedBy: string | null;
  approvedAt: string | null;
}

// ============================================
// Service Layer Interfaces (Ports)
// ============================================

/**
 * Interface for document repository
 * Infrastructure implements this
 */
export interface DocumentRepository {
  findById(id: string, tenantId: string): Promise<KnowledgeDocument | null>;
  findByQuery(query: DocumentQuery): Promise<KnowledgeDocument[]>;
  save(document: KnowledgeDocument): Promise<void>;
  updateStatus(id: string, tenantId: string, status: ApprovalStatus): Promise<void>;
  supersede(id: string, tenantId: string, newVersionId: string): Promise<void>;
  findCurrentVersions(tenantId: string, zone?: KnowledgeZone): Promise<KnowledgeDocument[]>;
}

/**
 * Query for document search
 */
export interface DocumentQuery {
  tenantId: string;
  knowledgeZones?: KnowledgeZone[];
  documentType?: DocumentType;
  topic?: string;
  jurisdiction?: Jurisdiction;
  audience?: Role[];
  approvalStatus?: ApprovalStatus[];
  isCurrentVersion?: boolean;
  effectiveBefore?: string;
  effectiveAfter?: string;
  confidentiality?: ConfidentialityLevel[];
  searchQuery?: string;
  limit?: number;
  offset?: number;
}

/**
 * Interface for chunk repository
 */
export interface ChunkRepository {
  findById(id: string, tenantId: string): Promise<KnowledgeChunk | null>;
  findByDocument(documentId: string, tenantId: string): Promise<KnowledgeChunk[]>;
  findByIds(ids: string[], tenantId: string): Promise<KnowledgeChunk[]>;
  searchSemantic(query: string, tenantId: string, limit: number): Promise<RetrievalCandidate[]>;
  searchLexical(query: string, tenantId: string, limit: number): Promise<RetrievalCandidate[]>;
  save(chunk: KnowledgeChunk): Promise<void>;
  saveMany(chunks: KnowledgeChunk[]): Promise<void>;
  deleteByDocument(documentId: string, tenantId: string): Promise<void>;
  updateEmbeddings(chunkId: string, tenantId: string, vector: number[]): Promise<void>;
}

/**
 * Interface for query trace repository
 */
export interface QueryTraceRepository {
  save(trace: RAGQueryTrace): Promise<void>;
  findById(id: string, tenantId: string): Promise<RAGQueryTrace | null>;
  findByActor(actorId: string, tenantId: string, limit: number): Promise<RAGQueryTrace[]>;
  findByTimeRange(tenantId: string, start: string, end: string): Promise<RAGQueryTrace[]>;
}

/**
 * Interface for embedding service
 */
export interface EmbeddingService {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  getModelInfo(): { name: string; dimensions: number; version: string };
}

/**
 * Interface for LLM generation service
 */
export interface GenerationService {
  generate(context: ContextPack, options: GenerationOptions): Promise<GroundedAnswer>;
  getModelInfo(): { name: string; version: string; maxTokens: number };
}

export interface GenerationOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  promptVersion?: string;
  requireCitations?: boolean;
  escalationLanguage?: boolean;
}

// ============================================
// Knowledge Governance Types
// ============================================

export type DocumentLifecycleState =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'superseded'
  | 'revoked'
  | 'archived';

export type IngestionStatus =
  | 'pending'
  | 'validating'
  | 'extracting_metadata'
  | 'chunking'
  | 'indexing'
  | 'completed'
  | 'failed'
  | 'retrying';

export type IndexingStatus =
  | 'pending'
  | 'queued'
  | 'processing'
  | 'embedding'
  | 'storing'
  | 'completed'
  | 'failed'
  | 'partial_failure';

export interface DocumentOwnership {
  documentOwner: string; // User ID
  businessOwner?: string; // User ID
  contentSteward?: string; // User ID
  reviewOwner?: string; // User ID
  createdBy: string;
  updatedBy: string;
  approvedBy?: string;
  rejectedBy?: string;
  supersededBy?: string;
  revokedBy?: string;
}

export interface DocumentGovernanceMetadata {
  sourceAuthorityRank: 'authoritative' | 'interpretive' | 'procedural' | 'reference';
  requiresLegalReview: boolean;
  requiresHROpsReview: boolean;
  requiresComplianceReview: boolean;
  legalReviewerId?: string;
  hrOpsReviewerId?: string;
  complianceReviewerId?: string;
  reviewDueDate?: string;
  lastReviewedAt?: string;
  lastReviewedBy?: string;
  nextReviewDue?: string;
  reviewNotes?: string;
  rejectionReason?: string;
  revocationReason?: string;
  supersessionReason?: string;
}

export interface DocumentIndexingMetadata {
  ingestionStatus: IngestionStatus;
  indexingStatus: IndexingStatus;
  ingestionError?: string;
  indexingError?: string;
  chunksCreated: number;
  chunksIndexed: number;
  lastIndexedAt?: string;
  lastReindexRequestedAt?: string;
  lastReindexRequestedBy?: string;
  embeddingModelUsed?: string;
  indexingDurationMs?: number;
}

export interface DocumentSupersessionInfo {
  supersededByDocumentId?: string;
  supersededByDocumentTitle?: string;
  supersededAt?: string;
  supersessionReason?: string;
  supersessionApprovedBy?: string;
}

export interface DocumentRevocationInfo {
  revokedAt?: string;
  revokedBy?: string;
  revocationReason?: string;
  revocationApprovedBy?: string;
  scheduledRemovalDate?: string;
}

export interface DocumentVersionChain {
  originalDocumentId: string;
  versionNumber: number;
  previousVersionId?: string;
  nextVersionId?: string;
  isLatestVersion: boolean;
}

export interface DocumentLifecycleEvent {
  id: string;
  documentId: string;
  tenantId: string;
  eventType:
    | 'uploaded'
    | 'metadata_edited'
    | 'submitted_for_review'
    | 'approved'
    | 'rejected'
    | 'indexed'
    | 'reindex_requested'
    | 'reindexed'
    | 'superseded'
    | 'revoked'
    | 'unrevoked'
    | 'archived'
    | 'restored'
    | 'ownership_changed'
    | 'review_date_changed';
  fromState?: DocumentLifecycleState;
  toState: DocumentLifecycleState;
  actorId: string;
  actorRole: string;
  reason?: string;
  metadataChanges?: Record<string, { old: unknown; new: unknown }>;
  timestamp: string;
}

export interface DocumentRetrievalStatus {
  isRetrievable: boolean;
  reason?: string;
  effectiveDatePassed: boolean;
  reviewDateValid: boolean;
  approvalStatusValid: boolean;
  indexingStatusValid: boolean;
  notSuperseded: boolean;
  notRevoked: boolean;
  notArchived: boolean;
  jurisdictionMatch?: boolean;
  audienceMatch?: boolean;
}

export interface DocumentReviewQueueItem {
  documentId: string;
  title: string;
  documentType: DocumentType;
  knowledgeZone: KnowledgeZone;
  submittedBy: string;
  submittedAt: string;
  pendingReviewers: string[];
  requiredReviewTypes: ('legal' | 'hr_ops' | 'compliance')[];
  priority: 'low' | 'medium' | 'high' | 'urgent';
  daysInQueue: number;
}

export interface GovernanceRules {
  requiredMetadataFields: string[];
  autoApproveIf: {
    zones?: KnowledgeZone[];
    authorityRank?: 'authoritative' | 'interpretive' | 'procedural' | 'reference';
    uploaderRole?: string[];
  };
  requireReviewIf: {
    zones?: KnowledgeZone[];
    authorityRank?: 'authoritative' | 'interpretive' | 'procedural' | 'reference';
    jurisdiction?: Jurisdiction[];
    missingFields?: string[];
  };
  reviewRoles: {
    legal?: string[];
    hr_ops?: string[];
    compliance?: string[];
  };
  escalationAfterDays: number;
  staleContentWarningDays: number;
}

// Governance Service Interfaces
export interface DocumentGovernanceService {
  submitForReview(documentId: string, tenantId: string, submittedBy: string): Promise<DocumentLifecycleEvent>;
  approve(documentId: string, tenantId: string, approvedBy: string, notes?: string): Promise<DocumentLifecycleEvent>;
  reject(documentId: string, tenantId: string, rejectedBy: string, reason: string): Promise<DocumentLifecycleEvent>;
  requestChanges(documentId: string, tenantId: string, reviewerId: string, changeRequests: string[]): Promise<DocumentLifecycleEvent>;
  markSuperseded(documentId: string, tenantId: string, supersededById: string, supersededBy: string, reason: string): Promise<DocumentLifecycleEvent>;
  revoke(documentId: string, tenantId: string, revokedBy: string, reason: string, scheduledDate?: string): Promise<DocumentLifecycleEvent>;
  unrevoke(documentId: string, tenantId: string, unrevokedBy: string, reason: string): Promise<DocumentLifecycleEvent>;
  archive(documentId: string, tenantId: string, archivedBy: string, reason: string): Promise<DocumentLifecycleEvent>;
  restore(documentId: string, tenantId: string, restoredBy: string, reason: string): Promise<DocumentLifecycleEvent>;
  changeOwnership(documentId: string, tenantId: string, ownershipChanges: Partial<DocumentOwnership>, changedBy: string, reason: string): Promise<DocumentLifecycleEvent>;
  updateReviewDate(documentId: string, tenantId: string, newReviewDate: string, updatedBy: string, reason: string): Promise<DocumentLifecycleEvent>;
  getLifecycleHistory(documentId: string, tenantId: string): Promise<DocumentLifecycleEvent[]>;
  getReviewQueue(tenantId: string, reviewerId?: string): Promise<DocumentReviewQueueItem[]>;
  checkRetrievalEligibility(documentId: string, tenantId: string): Promise<DocumentRetrievalStatus>;
  getStaleDocuments(tenantId: string, staleAfterDays?: number): Promise<KnowledgeDocument[]>;
}

// Operational Service Interfaces
export interface DocumentOperationalService {
  uploadDocument(input: CreateDocumentInput, uploadedBy: string): Promise<{ document: KnowledgeDocument; job: IngestionJob }>;
  importFromSource(sourceUri: string, sourceType: 'upload' | 'sync' | 'api' | 'manual', sourceSystem: string | null, tenantId: string, initiatedBy: string): Promise<IngestionJob>;
  updateMetadata(documentId: string, tenantId: string, updates: Partial<KnowledgeDocument>, updatedBy: string): Promise<KnowledgeDocument>;
  enrichMetadata(documentId: string, tenantId: string, enricherId: string): Promise<KnowledgeDocument>;
  triggerIndexing(documentId: string, tenantId: string, triggeredBy: string): Promise<IngestionJob>;
  reindexDocument(documentId: string, tenantId: string, triggeredBy: string, reason: string): Promise<IngestionJob>;
  cancelIndexing(documentId: string, tenantId: string, cancelledBy: string): Promise<void>;
  retryFailedIndexing(documentId: string, tenantId: string, retriedBy: string): Promise<IngestionJob>;
  getIndexingStatus(documentId: string, tenantId: string): Promise<DocumentIndexingMetadata>;
  getIngestionErrors(tenantId: string, limit?: number): Promise<Array<{ documentId: string; error: string; timestamp: string }>>;
  validateDocumentReadiness(documentId: string, tenantId: string): Promise<{ ready: boolean; missing: string[]; warnings: string[] }>;
}

// Repository Extension for Governance
export interface DocumentGovernanceRepository {
  saveLifecycleEvent(event: DocumentLifecycleEvent): Promise<void>;
  getLifecycleHistory(documentId: string, tenantId: string): Promise<DocumentLifecycleEvent[]>;
  getDocumentsByState(tenantId: string, state: DocumentLifecycleState, limit?: number): Promise<KnowledgeDocument[]>;
  getReviewQueue(tenantId: string, reviewerId?: string): Promise<DocumentReviewQueueItem[]>;
  getStaleDocuments(tenantId: string, staleAfterDays: number): Promise<KnowledgeDocument[]>;
  getDocumentsDueForReview(tenantId: string, withinDays: number): Promise<KnowledgeDocument[]>;
  updateRetrievalStatus(documentId: string, tenantId: string, status: DocumentRetrievalStatus): Promise<void>;
}

// Audit Types
export interface DocumentAuditEntry {
  id: string;
  timestamp: string;
  tenantId: string;
  documentId?: string;
  action:
    | 'upload'
    | 'metadata_edit'
    | 'review_decision'
    | 'approval'
    | 'rejection'
    | 'indexing_start'
    | 'indexing_complete'
    | 'indexing_failure'
    | 'supersession'
    | 'revocation'
    | 'ownership_change'
    | 'manual_reindex'
    | 'restore'
    | 'archive';
  actorId: string;
  actorRole: string;
  reason?: string;
  metadataBefore?: Record<string, unknown>;
  metadataAfter?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}
