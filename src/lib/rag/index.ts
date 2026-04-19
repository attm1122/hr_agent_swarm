/**
 * RAG (Retrieval-Augmented Generation) Subsystem
 * 
 * A production-grade, permission-aware knowledge retrieval system for HR Agent Swarm.
 * 
 * Architecture:
 * - Hybrid retrieval (semantic + lexical)
 * - Metadata-first filtering
 * - Parent/child chunking
 * - HR-specific reranking
 * - Grounded generation with citations
 * - Answer verification for high-risk queries
 * - Full audit traceability
 * 
 * Security Model:
 * - Strict tenant isolation
 * - Permission-aware retrieval
 * - No unauthorized content to LLM
 * - Complete audit logging
 * - GDPR/SOC 2 compliant
 * 
 * Usage:
 * ```typescript
 * import { classifyQuery, RAGPipeline } from '@/lib/rag';
 * 
 * // Classify query
 * const classification = classifyQuery(query, context);
 * 
 * // Execute RAG pipeline
 * const result = await RAGPipeline.execute(query, context);
 * ```
 */

// ============================================
// Domain Types (re-export for convenience)
// ============================================
export type {
  // Query Classification
  QueryClassification,
  QueryIntent,
  QueryDomain,
  RiskLevel,
  ActorPersona,
  ResponseMode,

  // Document & Chunks
  KnowledgeDocument,
  KnowledgeChunk,
  DocumentStructure,
  DocumentType,

  // Knowledge Zones
  KnowledgeZone,

  // Retrieval
  RetrievalCandidate,
  RerankedResult,
  Citation,
  ContextPack,
  RetrievalProfile,

  // Generation
  GroundedAnswer,
  VerificationResult,

  // Audit
  RAGQueryTrace,

  // Ingestion
  IngestionJob,
  IngestionStatus,
} from './types';

// Types defined in service modules
export type { ClassificationResult } from './query-classifier';
export type { ZoneConfig } from './knowledge-zones';
export type { CreateDocumentInput } from './ingestion-service';
export type {
  MetadataFilter,
  ChunkFilter,
} from './metadata-filter-builder';
export type {
  HybridRetrievalConfig,
} from './hybrid-retriever';
export type {
  ParentChildConfig,
  EnrichedCandidate,
} from './parent-child-retriever';
export type {
  RerankerConfig,
} from './hr-reranker';

// ============================================
// Phase 1: Foundation (Query Classification, Chunking, Ingestion)
// ============================================

// Query Classification
export {
  classifyQuery,
  TEST_EXPORTS as QueryClassifierTestExports,
} from './query-classifier';

// Structure-Aware Chunking
export {
  parseDocumentStructure,
  chunkDocument,
  type TEST_EXPORTS as ChunkingTestExports,
} from './chunking-service';

// Knowledge Zones
export {
  KNOWLEDGE_ZONE_CONFIG,
  canAccessZone,
  getAccessibleZones,
  filterZonesByRisk,
  getZonePriority,
  sortZonesByPriority,
  getRetrievalRules,
  getRankingWeights,
  requiresApprovedContent,
  getMaxConfidentiality,
  recommendZones,
  validateZoneAssignment,
} from './knowledge-zones';

// Document Ingestion
export {
  createIngestionJob,
  getIngestionJob,
  createDocument,
  processDocumentChunks,
  supersedeDocument,
  revokeDocument,
  approveDocument,
  rejectDocument,
  reindexDocument,
  validateDocumentInput,
} from './ingestion-service';

// ============================================
// Phase 2: Hybrid Retrieval & Context Assembly
// ============================================

// Metadata Filter Builder
export {
  buildMetadataFilter,
  documentMatchesFilter,
  toSupabaseFilter,
  toPostgrestQuery,
  mergeFilters,
  createPolicyFilter,
  createLegalPlaybookFilter,
  createTemplateFilter,
} from './metadata-filter-builder';

// Hybrid Retriever
export {
  executeHybridRetrieval,
  DEFAULT_RETRIEVAL_CONFIG,
  storeChunkWithEmbedding,
  generatePOCEmbedding,
  shouldUseFastLane,
  shouldUseDeepLane,
} from './hybrid-retriever';

// Permission-Aware Retriever
export {
  executePermissionAwareRetrieval,
  filterByPermissions,
  isHighRiskContent,
  requireAdditionalVerification,
  getRetrievalAccessLogs,
  clearRetrievalAccessLogs,
} from './permission-aware-retriever';

// Parent/Child Retriever
export {
  expandWithParentChildContext,
  DEFAULT_PARENT_CHILD_CONFIG,
  storeDocument,
  storeChunk,
  getDocumentById,
  getChunkById,
  getChunksByDocument,
  getChunksByParent,
  assembleExpandedContext,
  buildContextByStrategy,
  selectContextStrategy,
} from './parent-child-retriever';

// HR-Specific Reranker
export {
  rerankCandidates,
  DEFAULT_RERANKER_CONFIG,
  rerankForPolicyLookup,
  rerankForDrafting,
  rerankForProceduralHelp,
  rerankForHighRisk,
  rerankWithStrategy,
  deduplicateCandidates,
  selectTopKWithDiversity,
} from './hr-reranker';

// Context Assembler
export {
  assembleContextPack,
  DEFAULT_ASSEMBLY_CONFIG,
  formatForPrompt,
  formatForPolicyLookup,
  formatForDrafting,
  formatForProceduralHelp,
  formatByQueryType,
} from './context-assembler';

// ============================================
// Constants & Configuration
// ============================================

/**
 * High-risk ER keywords that trigger escalation
 */
export const HIGH_RISK_ER_KEYWORDS = [
  'terminate', 'termination', 'fire', 'firing', 'dismiss', 'dismissal',
  'redundancy', 'redundant', 'layoff', 'lay off', 'let go',
  'misconduct', 'gross misconduct', 'disciplinary', 'disciplinary action',
  'investigation', 'formal warning', 'final warning', 'pip', 'performance improvement',
  'grievance', 'complaint', 'harassment', 'bullying', 'discrimination',
  'unfair dismissal', 'constructive dismissal', 'workplace conflict',
  'legal action', 'lawsuit', 'tribunal', 'fair work', 'adverse action',
  'workers compensation', 'compo claim', 'injury claim',
];

/**
 * Medium-risk keywords requiring careful handling
 */
export const MEDIUM_RISK_KEYWORDS = [
  'probation', 'probationary', 'performance review', 'underperformance',
  'salary increase', 'pay rise', 'promotion', 'demotion',
  'leave without pay', 'unpaid leave', 'extended leave',
  'visa', 'sponsorship', 'work rights', '482', '186', '491',
  'redundancy consultation', 'consultation period',
  'notice period', 'resignation', 'resign', 'quit',
];

/**
 * Default retrieval profile configurations
 */
export const DEFAULT_RETRIEVAL_PROFILES = {
  fast: {
    candidateLimit: 10,
    finalLimit: 3,
    semanticWeight: 0.6,
    lexicalWeight: 0.4,
    contextBudget: 2000,
    verificationRequired: false,
  },
  standard: {
    candidateLimit: 20,
    finalLimit: 5,
    semanticWeight: 0.7,
    lexicalWeight: 0.3,
    contextBudget: 4000,
    verificationRequired: false,
  },
  deep: {
    candidateLimit: 50,
    finalLimit: 10,
    semanticWeight: 0.8,
    lexicalWeight: 0.2,
    contextBudget: 6000,
    verificationRequired: true,
  },
} as const;

// ============================================
// Utility Functions
// ============================================

/**
 * Calculate approximate token count from text
 * Conservative estimate: ~4 characters per token
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Truncate text to fit within token budget
 */
export function truncateToTokens(text: string, maxTokens: number): string {
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return text;

  // Truncate at sentence boundary
  const truncated = text.substring(0, maxChars);
  const lastSentence = truncated.lastIndexOf('.');
  if (lastSentence > maxChars * 0.8) {
    return truncated.substring(0, lastSentence + 1);
  }

  return truncated + '...';
}

/**
 * Generate a deterministic hash for content
 */
export function generateContentHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(64, '0');
}

/**
 * Check if query is high-risk
 */
export function isHighRiskQuery(query: string): boolean {
  const normalized = query.toLowerCase();
  return HIGH_RISK_ER_KEYWORDS.some(keyword => normalized.includes(keyword));
}

/**
 * Check if query is medium-risk
 */
export function isMediumRiskQuery(query: string): boolean {
  const normalized = query.toLowerCase();
  return MEDIUM_RISK_KEYWORDS.some(keyword => normalized.includes(keyword));
}
