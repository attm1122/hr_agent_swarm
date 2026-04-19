/**
 * Hybrid Retriever
 * 
 * Combines semantic (embedding-based) and lexical (keyword-based) retrieval
 * with metadata-first filtering for efficient candidate selection.
 * 
 * Architecture:
 * 1. Apply metadata filters BEFORE any vector/text search (narrow candidate pool)
 * 2. Execute semantic search via vector similarity
 * 3. Execute lexical search via keyword matching
 * 4. Merge and deduplicate results
 * 5. Return candidates for reranking
 * 
 * Security:
 * - Tenant isolation enforced at database level
 * - Permission checks via metadata filters
 * - No content returned without authorization
 */

import type {
  KnowledgeChunk,
  RetrievalCandidate,
  QueryClassification,
  RetrievalProfile,
} from './types';
import type { AgentContext } from '@/types';
import type { MetadataFilter, ChunkFilter } from './metadata-filter-builder';
import { buildMetadataFilter } from './metadata-filter-builder';

// ============================================
// Search Result Types
// ============================================

interface SemanticResult {
  chunk: KnowledgeChunk;
  similarity: number;
}

interface LexicalResult {
  chunk: KnowledgeChunk;
  bm25Score: number;
  matchedTerms: string[];
}

// ============================================
// Hybrid Retrieval Configuration
// ============================================

export interface HybridRetrievalConfig {
  // Result limits
  semanticCandidateLimit: number;
  lexicalCandidateLimit: number;
  finalCandidateLimit: number;

  // Weighting (0-1, must sum to 1)
  semanticWeight: number;
  lexicalWeight: number;

  // Similarity thresholds
  minSemanticScore: number;
  minLexicalScore: number;

  // Boosting
  keywordMatchBoost: number;
  exactMatchBoost: number;
}

export const DEFAULT_RETRIEVAL_CONFIG: HybridRetrievalConfig = {
  semanticCandidateLimit: 50,
  lexicalCandidateLimit: 50,
  finalCandidateLimit: 20,
  semanticWeight: 0.7,
  lexicalWeight: 0.3,
  minSemanticScore: 0.5,
  minLexicalScore: 0.1,
  keywordMatchBoost: 0.1,
  exactMatchBoost: 0.2,
};

// ============================================
// Mock Repository Functions (POC)
// In production, these connect to Supabase vector store

// In-memory store for POC
const chunkStore: Map<string, KnowledgeChunk> = new Map();
const embeddingStore: Map<string, number[]> = new Map();

/**
 * Store a chunk with its embedding (POC)
 */
export function storeChunkWithEmbedding(
  chunk: KnowledgeChunk,
  embedding: number[]
): void {
  chunkStore.set(chunk.id, chunk);
  embeddingStore.set(chunk.id, embedding);
}

/**
 * Semantic search via cosine similarity (POC implementation)
 * Production: Uses pgvector approximate nearest neighbor
 */
async function semanticSearch(
  queryEmbedding: number[],
  filter: ChunkFilter,
  limit: number,
  minScore: number
): Promise<SemanticResult[]> {
  const results: SemanticResult[] = [];

  // Filter chunks by metadata first
  const candidates: Array<{ chunk: KnowledgeChunk; embedding: number[] }> = [];

  for (const [chunkId, chunk] of chunkStore) {
    // Apply document-level filters
    if (!matchesChunkFilter(chunk, filter)) {
      continue;
    }

    const embedding = embeddingStore.get(chunkId);
    if (embedding) {
      candidates.push({ chunk, embedding });
    }
  }

  // Calculate cosine similarity for all candidates
  for (const { chunk, embedding } of candidates) {
    const similarity = cosineSimilarity(queryEmbedding, embedding);
    if (similarity >= minScore) {
      results.push({ chunk, similarity });
    }
  }

  // Sort by similarity descending
  results.sort((a, b) => b.similarity - a.similarity);

  return results.slice(0, limit);
}

/**
 * Lexical search via keyword matching (POC)
 * Production: Uses PostgreSQL full-text search with tsvector
 */
async function lexicalSearch(
  query: string,
  filter: ChunkFilter,
  limit: number,
  minScore: number
): Promise<LexicalResult[]> {
  const results: LexicalResult[] = [];

  // Extract query terms
  const queryTerms = extractQueryTerms(query);

  // Score each chunk
  for (const [chunkId, chunk] of chunkStore) {
    // Apply metadata filters
    if (!matchesChunkFilter(chunk, filter)) {
      continue;
    }

    // Calculate BM25-like score
    const { score, matchedTerms } = calculateLexicalScore(
      chunk,
      queryTerms,
      filter.mustContainKeywords || []
    );

    if (score >= minScore) {
      results.push({
        chunk,
        bm25Score: score,
        matchedTerms,
      });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.bm25Score - a.bm25Score);

  return results.slice(0, limit);
}

// ============================================
// Scoring Functions
// ============================================

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Extract query terms for lexical search
 */
function extractQueryTerms(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(term => term.length > 2)
    .filter(term => !isStopWord(term));
}

/**
 * Check if word is a stop word
 */
function isStopWord(word: string): boolean {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'can', 'need', 'dare', 'ought',
  ]);
  return stopWords.has(word.toLowerCase());
}

/**
 * Calculate BM25-like lexical score
 */
function calculateLexicalScore(
  chunk: KnowledgeChunk,
  queryTerms: string[],
  requiredTerms: string[]
): { score: number; matchedTerms: string[] } {
  const text = chunk.content.toLowerCase();
  const keywords = chunk.keywords.map(k => k.toLowerCase());
  const matchedTerms: string[] = [];

  // Required terms must all be present
  for (const term of requiredTerms) {
    if (!text.includes(term.toLowerCase())) {
      return { score: 0, matchedTerms: [] };
    }
  }

  let score = 0;

  // Score term matches
  for (const term of queryTerms) {
    // Exact match in content
    const contentMatches = (text.match(new RegExp(`\\b${term}\\b`, 'g')) || []).length;
    if (contentMatches > 0) {
      score += contentMatches * 1.0;
      matchedTerms.push(term);
    }

    // Keyword match (higher weight)
    if (keywords.includes(term)) {
      score += 2.0;
      if (!matchedTerms.includes(term)) {
        matchedTerms.push(term);
      }
    }

    // Title match
    const title = chunk.titlePath.join(' ').toLowerCase();
    if (title.includes(term)) {
      score += 1.5;
    }
  }

  // Title path exact match bonus
  for (const titlePart of chunk.titlePath) {
    const normalizedTitle = titlePart.toLowerCase();
    for (const term of queryTerms) {
      if (normalizedTitle.includes(term)) {
        score += 0.5;
      }
    }
  }

  // Jurisdiction match bonus
  if (queryTerms.some(t => t.includes(chunk.jurisdiction.toLowerCase()))) {
    score += 1.0;
  }

  return { score, matchedTerms };
}

/**
 * Check if chunk matches filter
 */
function matchesChunkFilter(chunk: KnowledgeChunk, filter: ChunkFilter): boolean {
  const docFilter = filter.documentFilter;

  // Tenant check
  if (chunk.tenantId !== docFilter.tenantId) {
    return false;
  }

  // Zone check
  if (docFilter.zones && !docFilter.zones.includes(chunk.knowledgeZone)) {
    return false;
  }

  // Jurisdiction check
  if (docFilter.jurisdiction && docFilter.jurisdiction !== 'any') {
    if (chunk.jurisdiction !== docFilter.jurisdiction && chunk.jurisdiction !== 'AU') {
      return false;
    }
  }

  // Current version check
  if (docFilter.isCurrentVersion && !chunk.isCurrentVersion) {
    return false;
  }

  // Approval status check
  if (docFilter.approvalStatus && !docFilter.approvalStatus.includes(chunk.approvalStatus)) {
    return false;
  }

  // Token count check
  if (filter.maxTokenCount && chunk.tokenCount > filter.maxTokenCount) {
    return false;
  }
  if (filter.minTokenCount && chunk.tokenCount < filter.minTokenCount) {
    return false;
  }

  return true;
}

// ============================================
// Hybrid Search Orchestration
// ============================================

/**
 * Execute hybrid retrieval (semantic + lexical)
 * 
 * This is the main entry point for Phase 2 retrieval.
 */
export async function executeHybridRetrieval(
  query: string,
  queryEmbedding: number[],
  classification: QueryClassification,
  context: AgentContext,
  config: Partial<HybridRetrievalConfig> = {},
  retrievalProfile?: RetrievalProfile
): Promise<RetrievalCandidate[]> {
  const fullConfig = { ...DEFAULT_RETRIEVAL_CONFIG, ...config };

  // Adjust limits based on retrieval profile
  let semanticLimit = fullConfig.semanticCandidateLimit;
  let lexicalLimit = fullConfig.lexicalCandidateLimit;
  let finalLimit = fullConfig.finalCandidateLimit;

  if (retrievalProfile) {
    semanticLimit = retrievalProfile.candidateLimit;
    lexicalLimit = retrievalProfile.candidateLimit;
    finalLimit = retrievalProfile.finalLimit;
  }

  // Build metadata filter
  const metadataFilter = buildMetadataFilter(
    classification,
    context.userId, // Using userId as tenant for POC
    context.role
  );

  const chunkFilter: ChunkFilter = {
    documentFilter: metadataFilter,
    maxTokenCount: retrievalProfile?.contextBudget
      ? Math.floor(retrievalProfile.contextBudget / 2)
      : undefined,
  };

  // Execute searches in parallel
  const [semanticResults, lexicalResults] = await Promise.all([
    semanticSearch(
      queryEmbedding,
      chunkFilter,
      semanticLimit,
      fullConfig.minSemanticScore
    ),
    lexicalSearch(
      query,
      chunkFilter,
      lexicalLimit,
      fullConfig.minLexicalScore
    ),
  ]);

  // Merge and deduplicate results
  const merged = mergeSearchResults(
    semanticResults,
    lexicalResults,
    fullConfig.semanticWeight,
    fullConfig.lexicalWeight,
    fullConfig.keywordMatchBoost,
    fullConfig.exactMatchBoost
  );

  // Convert to retrieval candidates
  const candidates: RetrievalCandidate[] = merged.slice(0, finalLimit).map(item => ({
    chunk: item.chunk,
    document: {} as unknown as import('./types').KnowledgeDocument, // TODO: Fetch document from repository
    semanticScore: item.semanticScore,
    lexicalScore: item.lexicalScore,
    combinedScore: item.combinedScore,
    matchDetails: {
      matchedKeywords: [],
      matchedPhrases: [],
      semanticDistance: 1 - item.semanticScore,
    },
  }));

  return candidates;
}

interface MergedResult {
  chunk: KnowledgeChunk;
  semanticScore: number;
  lexicalScore: number;
  combinedScore: number;
  source: 'semantic' | 'lexical' | 'hybrid';
}

/**
 * Merge semantic and lexical results
 */
function mergeSearchResults(
  semanticResults: SemanticResult[],
  lexicalResults: LexicalResult[],
  semanticWeight: number,
  lexicalWeight: number,
  keywordBoost: number,
  exactBoost: number
): MergedResult[] {
  const merged = new Map<string, MergedResult>();

  // Add semantic results
  for (const { chunk, similarity } of semanticResults) {
    merged.set(chunk.id, {
      chunk,
      semanticScore: similarity,
      lexicalScore: 0,
      combinedScore: similarity * semanticWeight,
      source: 'semantic',
    });
  }

  // Add/merge lexical results
  for (const { chunk, bm25Score, matchedTerms } of lexicalResults) {
    const existing = merged.get(chunk.id);

    // Normalize BM25 score to 0-1 range
    const normalizedLexicalScore = Math.min(bm25Score / 10, 1);

    // Apply keyword match boosts
    let boostedScore = normalizedLexicalScore;
    if (matchedTerms.length > 0) {
      boostedScore += keywordBoost * matchedTerms.length;
    }

    if (existing) {
      // Hybrid: chunk found in both
      existing.lexicalScore = boostedScore;
      existing.combinedScore += boostedScore * lexicalWeight;
      existing.source = 'hybrid';
    } else {
      merged.set(chunk.id, {
        chunk,
        semanticScore: 0,
        lexicalScore: boostedScore,
        combinedScore: boostedScore * lexicalWeight,
        source: 'lexical',
      });
    }
  }

  // Sort by combined score
  const results = Array.from(merged.values());
  results.sort((a, b) => b.combinedScore - a.combinedScore);

  return results;
}

// ============================================
// Utility Functions
// ============================================

/**
 * Generate a simple embedding for POC (random values)
 * Production: Uses OpenAI, Cohere, or similar embedding service
 */
export function generatePOCEmbedding(text: string, dimensions: number = 384): number[] {
  // Simple hash-based embedding for POC
  const embedding: number[] = [];
  let seed = 0;

  for (let i = 0; i < text.length; i++) {
    seed = ((seed << 5) - seed) + text.charCodeAt(i);
    seed = seed & seed;
  }

  for (let i = 0; i < dimensions; i++) {
    // Pseudo-random based on seed and position
    const value = Math.sin(seed * (i + 1)) * Math.cos(seed * (i + 2));
    embedding.push(value);
  }

  // Normalize
  const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
  return embedding.map(v => v / norm);
}

/**
 * Check if retrieval should use fast lane
 */
export function shouldUseFastLane(classification: QueryClassification): boolean {
  return classification.risk === 'low' &&
    classification.retrievalDepth === 'fast' &&
    !classification.allowedZones.includes('legal_playbook');
}

/**
 * Check if retrieval should use deep lane
 */
export function shouldUseDeepLane(classification: QueryClassification): boolean {
  return classification.risk === 'critical' ||
    classification.risk === 'high' ||
    classification.retrievalDepth === 'deep' ||
    ['termination', 'redundancy', 'misconduct', 'grievance'].includes(classification.domain);
}
