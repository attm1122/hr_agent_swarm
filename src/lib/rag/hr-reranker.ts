/**
 * HR-Specific Reranker
 * 
 * Reorders retrieval candidates based on HR policy domain factors:
 * - Authority (zone priority)
 * - Recency (version, effective date)
 * - Jurisdiction match
 * - Audience relevance
 * - Keyword match quality
 * 
 * Unlike generic rerankers, this understands:
 * - Authoritative policy > workflow SOP > system help
 * - Current version > archived version
 * - Exact jurisdiction match > federal fallback
 * - Role-specific audience targeting
 * 
 * The reranker produces a final, ranked list for context assembly.
 */

import type {
  KnowledgeChunk,
  KnowledgeDocument,
  RetrievalCandidate,
  RerankedResult,
  QueryClassification,
  KnowledgeZone,
  Jurisdiction,
} from './types';
import type { Role } from '@/types';
import { getZonePriority, getRankingWeights } from './knowledge-zones';
import { differenceFromTodayInDateOnlyDays } from '@/lib/domain/shared/date-value';

// ============================================
// Reranker Configuration
// ============================================

export interface RerankerConfig {
  // Weights for scoring components (0-1)
  authorityWeight: number;
  recencyWeight: number;
  jurisdictionWeight: number;
  semanticWeight: number;
  lexicalWeight: number;
  audienceWeight: number;

  // Boosts
  exactJurisdictionBoost: number;
  currentVersionBoost: number;
  roleMatchBoost: number;
  keywordDensityBoost: number;

  // Penalties
  staleDocumentPenalty: number;
  wrongJurisdictionPenalty: number;
  lowAuthorityPenalty: number;
}

export const DEFAULT_RERANKER_CONFIG: RerankerConfig = {
  authorityWeight: 0.25,
  recencyWeight: 0.20,
  jurisdictionWeight: 0.20,
  semanticWeight: 0.20,
  lexicalWeight: 0.10,
  audienceWeight: 0.05,

  exactJurisdictionBoost: 0.3,
  currentVersionBoost: 0.2,
  roleMatchBoost: 0.15,
  keywordDensityBoost: 0.1,

  staleDocumentPenalty: -0.3,
  wrongJurisdictionPenalty: -0.4,
  lowAuthorityPenalty: -0.2,
};

// ============================================
// Main Rerank Function
// ============================================

/**
 * Rerank candidates based on HR-specific factors
 * 
 * This is the main entry point for Phase 2 reranking.
 */
export function rerankCandidates(
  candidates: RetrievalCandidate[],
  classification: QueryClassification,
  role: Role,
  config: Partial<RerankerConfig> = {}
): RerankedResult[] {
  const fullConfig = { ...DEFAULT_RERANKER_CONFIG, ...config };

  // Score all candidates
  const scored = candidates.map(candidate => {
    const score = calculateHRScore(candidate, classification, role, fullConfig);
    return {
      candidate,
      score,
      details: generateScoreDetails(candidate, classification, role, fullConfig),
    };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Convert to RerankedResult
  return scored.map((item, index) => {
    const chunk = item.candidate.chunk;
    const doc = item.candidate.document;
    const originalRank = chunk.chunkOrder;
    return {
      chunk,
      document: doc,
      originalScore: item.candidate.combinedScore,
      rerankedScore: item.score,
      rankChange: originalRank - (index + 1),
      authorityBonus: item.details.authorityScore,
      recencyBonus: item.details.recencyScore,
      jurisdictionMatch: chunk.jurisdiction === classification.jurisdiction,
      roleMatch: chunk.audience.includes(role),
      versionBoost: chunk.isCurrentVersion,
      zonePriority: getZonePriority(chunk.knowledgeZone),
      citation: {
        chunkId: chunk.id,
        documentId: doc.id,
        documentTitle: doc.title,
        version: doc.version,
        titlePath: chunk.titlePath,
        clauseRef: chunk.clauseRef || null,
        content: chunk.content.substring(0, 500),
        relevanceScore: item.score,
      },
    };
  });
}

// ============================================
// Scoring Components
// ============================================

interface ScoreDetails {
  authorityScore: number;
  recencyScore: number;
  jurisdictionScore: number;
  audienceScore: number;
  semanticScore: number;
  lexicalScore: number;
  totalScore: number;
}

function calculateHRScore(
  candidate: RetrievalCandidate,
  classification: QueryClassification,
  role: Role,
  config: RerankerConfig
): number {
  const chunk = candidate.chunk;

  // Base scores from retrieval
  let score =
    candidate.semanticScore * config.semanticWeight +
    candidate.lexicalScore * config.lexicalWeight;

  // Authority score
  score += calculateAuthorityScore(chunk, classification) * config.authorityWeight;

  // Recency score
  score += calculateRecencyScore(chunk) * config.recencyWeight;

  // Jurisdiction score
  score += calculateJurisdictionScore(chunk, classification.jurisdiction) * config.jurisdictionWeight;

  // Audience score
  score += calculateAudienceScore(chunk, role) * config.audienceWeight;

  // Apply boosts
  if (chunk.jurisdiction === classification.jurisdiction) {
    score += config.exactJurisdictionBoost;
  }

  if (chunk.isCurrentVersion) {
    score += config.currentVersionBoost;
  }

  if (chunk.audience.includes(role)) {
    score += config.roleMatchBoost;
  }

  // Keyword density boost
  const keywordDensity = chunk.keywords.length / chunk.tokenCount;
  score += keywordDensity * config.keywordDensityBoost;

  // Apply penalties
  if (!chunk.isCurrentVersion) {
    score += config.staleDocumentPenalty;
  }

  if (isWrongJurisdiction(chunk, classification.jurisdiction)) {
    score += config.wrongJurisdictionPenalty;
  }

  const authorityScore = calculateAuthorityScore(chunk, classification);
  if (authorityScore < 0.3) {
    score += config.lowAuthorityPenalty;
  }

  return Math.max(0, Math.min(1, score)); // Clamp to [0, 1]
}

/**
 * Calculate authority score based on knowledge zone
 */
function calculateAuthorityScore(
  chunk: KnowledgeChunk,
  classification: QueryClassification
): number {
  const zonePriority = getZonePriority(chunk.knowledgeZone);

  // Normalize to 0-1 (priority ranges from 50 to 100)
  const baseScore = (zonePriority - 50) / 50;

  // Boost for zones mentioned in classification
  if (classification.allowedZones.includes(chunk.knowledgeZone)) {
    return Math.min(1, baseScore + 0.1);
  }

  return baseScore;
}

/**
 * Calculate recency score
 */
function calculateRecencyScore(chunk: KnowledgeChunk): number {
  if (!chunk.isCurrentVersion) {
    return 0.3; // Significant penalty for non-current versions
  }

  // Calculate days since effective
  const daysSinceEffective = Math.max(0, -differenceFromTodayInDateOnlyDays(chunk.effectiveDate));

  // Score decreases slowly over time (half-life of 2 years)
  const halfLifeDays = 730;
  const recencyScore = Math.exp(-daysSinceEffective / halfLifeDays);

  return 0.7 + 0.3 * recencyScore; // Base 0.7 for current, up to 1.0 for very recent
}

/**
 * Calculate jurisdiction score
 */
function calculateJurisdictionScore(
  chunk: KnowledgeChunk,
  queryJurisdiction: Jurisdiction
): number {
  // Exact match
  if (chunk.jurisdiction === queryJurisdiction) {
    return 1.0;
  }

  // Federal fallback is acceptable
  if (chunk.jurisdiction === 'AU') {
    return 0.8;
  }

  // Other jurisdiction (potentially wrong)
  return 0.4;
}

/**
 * Check if chunk is in wrong jurisdiction
 */
function isWrongJurisdiction(
  chunk: KnowledgeChunk,
  queryJurisdiction: Jurisdiction
): boolean {
  if (queryJurisdiction === 'unknown') {
    return false;
  }

  // Wrong if not exact match and not federal
  return chunk.jurisdiction !== queryJurisdiction && chunk.jurisdiction !== 'AU';
}

/**
 * Calculate audience relevance score
 */
function calculateAudienceScore(chunk: KnowledgeChunk, role: Role): number {
  if (chunk.audience.includes(role)) {
    return 1.0;
  }

  // Partial match based on role hierarchy
  const roleHierarchy: Role[] = ['employee', 'team_lead', 'manager', 'payroll', 'admin'];
  const roleIndex = roleHierarchy.indexOf(role);

  for (let i = roleIndex + 1; i < roleHierarchy.length; i++) {
    if (chunk.audience.includes(roleHierarchy[i])) {
      // Content targets higher role - partially relevant
      return 0.6;
    }
  }

  for (let i = roleIndex - 1; i >= 0; i--) {
    if (chunk.audience.includes(roleHierarchy[i])) {
      // Content targets lower role - still somewhat relevant
      return 0.8;
    }
  }

  return 0.3; // No audience match
}

// ============================================
// Score Detail Generation
// ============================================

function generateScoreDetails(
  candidate: RetrievalCandidate,
  classification: QueryClassification,
  role: Role,
  config: RerankerConfig
): ScoreDetails {
  return {
    authorityScore: calculateAuthorityScore(candidate.chunk, classification),
    recencyScore: calculateRecencyScore(candidate.chunk),
    jurisdictionScore: calculateJurisdictionScore(candidate.chunk, classification.jurisdiction),
    audienceScore: calculateAudienceScore(candidate.chunk, role),
    semanticScore: candidate.semanticScore,
    lexicalScore: candidate.lexicalScore,
    totalScore: calculateHRScore(candidate, classification, role, config),
  };
}

function generateRerankReason(details: ScoreDetails, newRank: number): string {
  const reasons: string[] = [];

  if (details.authorityScore > 0.8) {
    reasons.push('high authority');
  }
  if (details.recencyScore > 0.9) {
    reasons.push('very recent');
  }
  if (details.jurisdictionScore === 1.0) {
    reasons.push('exact jurisdiction match');
  }
  if (details.audienceScore === 1.0) {
    reasons.push('audience match');
  }
  if (details.semanticScore > 0.8) {
    reasons.push('strong semantic match');
  }

  if (reasons.length === 0) {
    return `Ranked #${newRank} based on combined factors`;
  }

  return `Ranked #${newRank}: ${reasons.join(', ')}`;
}

// ============================================
// Specialized Reranking Strategies
// ============================================

/**
 * Rerank for policy lookup queries
 * Prioritizes: authority > jurisdiction > recency
 */
export function rerankForPolicyLookup(
  candidates: RetrievalCandidate[],
  classification: QueryClassification,
  role: Role
): RerankedResult[] {
  const config: Partial<RerankerConfig> = {
    authorityWeight: 0.35,
    jurisdictionWeight: 0.30,
    recencyWeight: 0.15,
    semanticWeight: 0.15,
    lexicalWeight: 0.05,
  };

  return rerankCandidates(candidates, classification, role, config);
}

/**
 * Rerank for drafting support queries
 * Prioritizes: templates > authority > recency
 */
export function rerankForDrafting(
  candidates: RetrievalCandidate[],
  classification: QueryClassification,
  role: Role
): RerankedResult[] {
  // Boost template precedents
  const boosted = candidates.map(c => {
    if (c.chunk.knowledgeZone === 'templates_precedents') {
      return {
        ...c,
        semanticScore: Math.min(1, c.semanticScore + 0.2),
      };
    }
    return c;
  });

  const config: Partial<RerankerConfig> = {
    authorityWeight: 0.30,
    recencyWeight: 0.25,
    semanticWeight: 0.25,
    lexicalWeight: 0.15,
    audienceWeight: 0.05,
  };

  return rerankCandidates(boosted, classification, role, config);
}

/**
 * Rerank for procedural help queries
 * Prioritizes: workflow SOPs > recency > semantic match
 */
export function rerankForProceduralHelp(
  candidates: RetrievalCandidate[],
  classification: QueryClassification,
  role: Role
): RerankedResult[] {
  // Boost workflow SOPs
  const boosted = candidates.map(c => {
    if (c.chunk.knowledgeZone === 'workflow_sop') {
      return {
        ...c,
        semanticScore: Math.min(1, c.semanticScore + 0.25),
      };
    }
    return c;
  });

  const config: Partial<RerankerConfig> = {
    authorityWeight: 0.20,
    recencyWeight: 0.30,
    semanticWeight: 0.30,
    lexicalWeight: 0.15,
    jurisdictionWeight: 0.05,
  };

  return rerankCandidates(boosted, classification, role, config);
}

/**
 * Rerank for high-risk ER queries
 * Prioritizes: legal playbooks > authority > exact jurisdiction
 */
export function rerankForHighRisk(
  candidates: RetrievalCandidate[],
  classification: QueryClassification,
  role: Role
): RerankedResult[] {
  // Boost legal playbooks and authoritative policy
  const boosted = candidates.map(c => {
    let boost = 0;
    if (c.chunk.knowledgeZone === 'legal_playbook') boost += 0.4;
    if (c.chunk.knowledgeZone === 'authoritative_policy') boost += 0.2;
    if (c.chunk.jurisdiction === classification.jurisdiction) boost += 0.2;

    return {
      ...c,
      semanticScore: Math.min(1, c.semanticScore + boost),
    };
  });

  const config: Partial<RerankerConfig> = {
    authorityWeight: 0.40,
    jurisdictionWeight: 0.30,
    recencyWeight: 0.15,
    semanticWeight: 0.10,
    lexicalWeight: 0.05,
  };

  return rerankCandidates(boosted, classification, role, config);
}

// ============================================
// Strategy Router
// ============================================

/**
 * Select and execute appropriate reranking strategy based on query type
 */
export function rerankWithStrategy(
  candidates: RetrievalCandidate[],
  classification: QueryClassification,
  role: Role
): RerankedResult[] {
  switch (classification.intent) {
    case 'policy_lookup':
      return rerankForPolicyLookup(candidates, classification, role);

    case 'drafting_support':
    case 'template_lookup':
      return rerankForDrafting(candidates, classification, role);

    case 'procedural_help':
      return rerankForProceduralHelp(candidates, classification, role);

    case 'high_risk_er':
      return rerankForHighRisk(candidates, classification, role);

    case 'hr_guidance':
      // HR guidance can be high-risk depending on domain
      if (['termination', 'redundancy', 'misconduct'].includes(classification.domain)) {
        return rerankForHighRisk(candidates, classification, role);
      }
      return rerankCandidates(candidates, classification, role);

    default:
      return rerankCandidates(candidates, classification, role);
  }
}

// ============================================
// Deduplication
// ============================================

/**
 * Deduplicate candidates based on content similarity
 */
export function deduplicateCandidates(
  candidates: RetrievalCandidate[],
  similarityThreshold: number = 0.85
): RetrievalCandidate[] {
  const deduplicated: RetrievalCandidate[] = [];

  for (const candidate of candidates) {
    let isDuplicate = false;

    for (const existing of deduplicated) {
      const similarity = calculateContentSimilarity(
        candidate.chunk.content,
        existing.chunk.content
      );

      if (similarity > similarityThreshold) {
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      deduplicated.push(candidate);
    }
  }

  return deduplicated;
}

/**
 * Calculate content similarity (simple Jaccard on keywords)
 */
function calculateContentSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 3));

  const intersection = new Set([...wordsA].filter(x => wordsB.has(x)));
  const union = new Set([...wordsA, ...wordsB]);

  if (union.size === 0) return 0;

  return intersection.size / union.size;
}

// ============================================
// Top-K Selection
// ============================================

/**
 * Select top-K results with diversity
 */
export function selectTopKWithDiversity(
  reranked: RerankedResult[],
  k: number,
  minDiversity: number = 0.5
): RerankedResult[] {
  const selected: RerankedResult[] = [];

  for (const result of reranked) {
    // Check diversity against already selected
    let isDiverse = true;
    for (const existing of selected) {
      const similarity = calculateContentSimilarity(
        result.chunk.content,
        existing.chunk.content
      );
      if (similarity > 1 - minDiversity) {
        isDiverse = false;
        break;
      }
    }

    if (isDiverse || selected.length === 0) {
      selected.push(result);
    }

    if (selected.length >= k) {
      break;
    }
  }

  // If we don't have enough due to diversity filter, fill with remaining
  if (selected.length < k) {
    for (const result of reranked) {
      if (!selected.find(s => s.chunk.id === result.chunk.id)) {
        selected.push(result);
        if (selected.length >= k) break;
      }
    }
  }

  return selected;
}
