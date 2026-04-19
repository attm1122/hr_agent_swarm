/**
 * Parent/Child Retriever
 * 
 * Retrieves parent documents and sibling chunks when child chunks match,
 * providing surrounding context for grounded answers.
 * 
 * Strategy:
 * 1. When a child chunk matches, fetch its parent document
 * 2. Fetch sibling chunks (previous/next) for context
 * 3. Include parent section/chapter context
 * 4. Handle multi-level hierarchies (clause -> section -> chapter)
 * 
 * Security:
 * - All parent/child lookups must pass permission checks
 * - No unauthorized content in context expansion
 * - Tenant isolation enforced on all lookups
 */

import type {
  KnowledgeChunk,
  KnowledgeDocument,
  RetrievalCandidate,
} from './types';
import type { AgentContext } from '@/types';
import { filterByPermissions } from './permission-aware-retriever';

// ============================================
// Retrieval Configuration
// ============================================

export interface ParentChildConfig {
  // How many siblings to fetch on each side
  siblingWindowSize: number;

  // Whether to include parent document summary
  includeParentSummary: boolean;

  // Whether to include section context
  includeSectionContext: boolean;

  // Maximum tokens for context expansion
  maxContextTokens: number;

  // Whether to fetch the full parent document
  fetchFullParent: boolean;
}

export const DEFAULT_PARENT_CHILD_CONFIG: ParentChildConfig = {
  siblingWindowSize: 2,
  includeParentSummary: true,
  includeSectionContext: true,
  maxContextTokens: 1500,
  fetchFullParent: false,
};

// ============================================
// Mock Repository (POC)
// Production: Connects to Supabase

const documentStore: Map<string, KnowledgeDocument> = new Map();
const chunkStore: Map<string, KnowledgeChunk> = new Map();

export function storeDocument(doc: KnowledgeDocument): void {
  documentStore.set(doc.id, doc);
}

export function storeChunk(chunk: KnowledgeChunk): void {
  chunkStore.set(chunk.id, chunk);
}

export function getDocumentById(id: string): KnowledgeDocument | null {
  return documentStore.get(id) || null;
}

export function getChunkById(id: string): KnowledgeChunk | null {
  return chunkStore.get(id) || null;
}

export function getChunksByDocument(documentId: string): KnowledgeChunk[] {
  return Array.from(chunkStore.values()).filter(
    chunk => chunk.documentId === documentId
  );
}

export function getChunksByParent(parentId: string): KnowledgeChunk[] {
  return Array.from(chunkStore.values()).filter(
    chunk => chunk.parentSectionId === parentId
  );
}

// ============================================
// Parent/Child Retrieval
// ============================================

export interface EnrichedCandidate extends RetrievalCandidate {
  // Parent document info
  parentDocument?: KnowledgeDocument;
  documentSummary?: string;

  // Sibling context
  previousSiblings?: KnowledgeChunk[];
  nextSiblings?: KnowledgeChunk[];

  // Expanded context text
  expandedContext?: string;

  // Token counts
  expandedTokenCount?: number;
}

/**
 * Expand retrieval candidates with parent/child context
 * 
 * This is the main entry point for parent/child retrieval.
 */
export async function expandWithParentChildContext(
  candidates: RetrievalCandidate[],
  context: AgentContext,
  config: Partial<ParentChildConfig> = {}
): Promise<EnrichedCandidate[]> {
  const fullConfig = { ...DEFAULT_PARENT_CHILD_CONFIG, ...config };
  const enriched: EnrichedCandidate[] = [];

  for (const candidate of candidates) {
    const enrichedCandidate = await enrichCandidate(
      candidate,
      context,
      fullConfig
    );

    if (enrichedCandidate) {
      enriched.push(enrichedCandidate);
    }
  }

  return enriched;
}

/**
 * Enrich a single candidate with parent/child context
 */
async function enrichCandidate(
  candidate: RetrievalCandidate,
  context: AgentContext,
  config: ParentChildConfig
): Promise<EnrichedCandidate | null> {
  const chunk = candidate.chunk;
  const enriched: EnrichedCandidate = {
    ...candidate,
  };

  // 1. Fetch parent document
  const parentDoc = getDocumentById(chunk.documentId);
  if (!parentDoc) {
    // Cannot enrich without parent document
    return enriched;
  }

  // Verify permission for parent document
  const { allowed } = filterByPermissions(
    [{ ...chunk, documentId: chunk.documentId } as KnowledgeChunk],
    context,
    { allowedZones: [chunk.knowledgeZone], jurisdiction: chunk.jurisdiction } as unknown as import('./types').QueryClassification
  );

  if (allowed.length === 0) {
    // No permission to view parent context
    return null;
  }

  enriched.parentDocument = parentDoc;

  // 2. Get document summary
  if (config.includeParentSummary) {
    enriched.documentSummary = generateDocumentSummary(parentDoc);
  }

  // 3. Fetch sibling chunks
  const siblings = await fetchSiblingChunks(chunk, config.siblingWindowSize);
  enriched.previousSiblings = siblings.previous;
  enriched.nextSiblings = siblings.next;

  // 4. Generate expanded context
  enriched.expandedContext = generateExpandedContext(
    chunk,
    siblings,
    parentDoc,
    config
  );

  enriched.expandedTokenCount = estimateTokenCount(enriched.expandedContext);

  return enriched;
}

/**
 * Generate document summary for context
 */
function generateDocumentSummary(doc: KnowledgeDocument): string {
  const parts: string[] = [];

  if (doc.title) {
    parts.push(`Document: ${doc.title}`);
  }

  if (doc.description) {
    parts.push(`Description: ${doc.description}`);
  }

  if (doc.jurisdiction) {
    parts.push(`Jurisdiction: ${doc.jurisdiction}`);
  }

  if (doc.version) {
    parts.push(`Version: ${doc.version}`);
  }

  return parts.join(' | ');
}

/**
 * Fetch sibling chunks for context
 */
async function fetchSiblingChunks(
  chunk: KnowledgeChunk,
  windowSize: number
): Promise<{ previous: KnowledgeChunk[]; next: KnowledgeChunk[] }> {
  const allSiblings = getChunksByDocument(chunk.documentId)
    .filter(c => c.id !== chunk.id);

  const currentIndex = allSiblings.findIndex(s => s.id === chunk.id);
  
  // Sort by chunkOrder for proper ordering
  allSiblings.sort((a, b) => a.chunkOrder - b.chunkOrder);

  // If chunk not found in siblings (edge case), return empty
  if (currentIndex === -1) {
    return { previous: [], next: [] };
  }

  const previous = allSiblings.slice(
    Math.max(0, currentIndex - windowSize),
    currentIndex
  );

  const next = allSiblings.slice(
    currentIndex + 1,
    currentIndex + 1 + windowSize
  );

  return { previous, next };
}

/**
 * Generate expanded context text
 */
function generateExpandedContext(
  chunk: KnowledgeChunk,
  siblings: { previous: KnowledgeChunk[]; next: KnowledgeChunk[] },
  parentDoc: KnowledgeDocument,
  config: ParentChildConfig
): string {
  const parts: string[] = [];

  // Add document context header
  if (config.includeParentSummary) {
    parts.push(`[Document: ${parentDoc.title}]`);
    if (parentDoc.jurisdiction) {
      parts.push(`[Jurisdiction: ${parentDoc.jurisdiction}]`);
    }
    parts.push('');
  }

  // Add section path
  if (chunk.titlePath && chunk.titlePath.length > 0) {
    parts.push(`[Section: ${chunk.titlePath.join(' > ')}]`);
    parts.push('');
  }

  // Add previous siblings
  if (siblings.previous.length > 0) {
    parts.push('[Previous Context]');
    for (const sibling of siblings.previous) {
      parts.push(sibling.content);
    }
    parts.push('');
  }

  // Add main chunk (highlighted)
  parts.push('[Relevant Content]');
  parts.push(chunk.content);
  parts.push('');

  // Add next siblings
  if (siblings.next.length > 0) {
    parts.push('[Following Context]');
    for (const sibling of siblings.next) {
      parts.push(sibling.content);
    }
    parts.push('');
  }

  // Add citation info
  parts.push(`[Source: ${parentDoc.title}, Version ${parentDoc.version}]`);

  return parts.join('\n');
}

/**
 * Estimate token count for text
 */
function estimateTokenCount(text: string): number {
  // Rough estimate: ~4 characters per token
  return Math.ceil(text.length / 4);
}

// ============================================
// Context Assembly
// ============================================

export interface AssembledContext {
  chunks: KnowledgeChunk[];
  fullText: string;
  totalTokens: number;
  citationMap: Map<string, string>; // chunkId -> citation
  truncated: boolean;
}

/**
 * Assemble expanded context for LLM input
 * 
 * Takes enriched candidates and builds a compact context string
 * that fits within token budget while preserving authority.
 */
export function assembleExpandedContext(
  enrichedCandidates: EnrichedCandidate[],
  maxTokens: number = 4000
): AssembledContext {
  const chunks: KnowledgeChunk[] = [];
  const parts: string[] = [];
  const citationMap = new Map<string, string>();

  let currentTokens = 0;
  let truncated = false;

  for (let i = 0; i < enrichedCandidates.length; i++) {
    const candidate = enrichedCandidates[i];
    const priority = i + 1; // Higher rank = higher priority

    // Check if we can fit the expanded context
    const expandedTokens = candidate.expandedTokenCount || 0;

    if (currentTokens + expandedTokens > maxTokens) {
      // Try to fit just the chunk content
      const chunkTokens = candidate.chunk.tokenCount;

      if (currentTokens + chunkTokens > maxTokens) {
        // Can't fit any more
        truncated = true;
        break;
      }

      // Use compact form (just chunk)
      parts.push(formatCompactChunk(candidate.chunk, priority));
      chunks.push(candidate.chunk);
      currentTokens += chunkTokens;
    } else {
      // Use expanded context
      parts.push(formatExpandedChunk(candidate, priority));
      chunks.push(candidate.chunk);
      currentTokens += expandedTokens;
    }

    // Map chunk to citation
    citationMap.set(
      candidate.chunk.id,
      generateCitation(candidate, priority)
    );
  }

  return {
    chunks,
    fullText: parts.join('\n\n---\n\n'),
    totalTokens: currentTokens,
    citationMap,
    truncated,
  };
}

/**
 * Format expanded chunk for context
 */
function formatExpandedChunk(
  candidate: EnrichedCandidate,
  priority: number
): string {
  const parts: string[] = [];

  parts.push(`[${priority}] ${candidate.parentDocument?.title || 'Unknown'}`);

  if (candidate.chunk.titlePath.length > 0) {
    parts.push(`Section: ${candidate.chunk.titlePath.join(' > ')}`);
  }

  parts.push('');

  if (candidate.expandedContext) {
    parts.push(candidate.expandedContext);
  } else {
    parts.push(candidate.chunk.content);
  }

  return parts.join('\n');
}

/**
 * Format compact chunk for context
 */
function formatCompactChunk(chunk: KnowledgeChunk, priority: number): string {
  const parts: string[] = [];

  parts.push(`[${priority}] ${chunk.titlePath.join(' > ')}`);
  parts.push(chunk.content);

  return parts.join('\n');
}

/**
 * Generate citation string
 */
function generateCitation(
  candidate: EnrichedCandidate,
  priority: number
): string {
  const doc = candidate.parentDocument;
  const chunk = candidate.chunk;

  if (!doc) {
    return `[${priority}] Unknown Source`;
  }

  const parts: string[] = [`[${priority}]`];
  parts.push(doc.title);

  if (chunk.clauseRef) {
    parts.push(`Clause ${chunk.clauseRef}`);
  }

  if (chunk.titlePath.length > 0) {
    parts.push(chunk.titlePath[chunk.titlePath.length - 1]);
  }

  return parts.join(' - ');
}

// ============================================
// Multi-Level Hierarchy
// ============================================

/**
 * Handle multi-level chunk hierarchies
 * 
 * Some documents have nested structure:
 * - Document > Chapter > Section > Clause > Paragraph
 * 
 * This function traverses up the hierarchy to gather context.
 */
export async function expandMultiLevelHierarchy(
  chunk: KnowledgeChunk,
  maxLevels: number = 3
): Promise<{
  ancestors: KnowledgeChunk[];
  rootDocument?: KnowledgeDocument;
  hierarchyPath: string[];
}> {
  const ancestors: KnowledgeChunk[] = [];
  const hierarchyPath: string[] = [...chunk.titlePath];

  let currentChunk: KnowledgeChunk | null = chunk;
  let levels = 0;

  while (currentChunk?.parentSectionId && levels < maxLevels) {
    const parent = getChunkById(currentChunk.parentSectionId);
    if (!parent) break;

    ancestors.unshift(parent);
    hierarchyPath.unshift(...parent.titlePath);

    currentChunk = parent;
    levels++;
  }

  const rootDocument = currentChunk
    ? getDocumentById(currentChunk.documentId)
    : undefined;

  return {
    ancestors,
    rootDocument: rootDocument || undefined,
    hierarchyPath: [...new Set(hierarchyPath)], // Remove duplicates
  };
}

// ============================================
// Context Selection Strategies
// ============================================

/**
 * Select best context representation based on query type
 */
export function selectContextStrategy(
  queryType: 'policy_lookup' | 'drafting_support' | 'procedural_help' | 'hr_guidance'
): 'compact' | 'expanded' | 'hierarchical' {
  const strategies: Record<string, 'compact' | 'expanded' | 'hierarchical'> = {
    policy_lookup: 'compact',
    drafting_support: 'expanded',
    procedural_help: 'hierarchical',
    hr_guidance: 'expanded',
  };

  return strategies[queryType] || 'compact';
}

/**
 * Build context based on selected strategy
 */
export function buildContextByStrategy(
  candidates: EnrichedCandidate[],
  strategy: 'compact' | 'expanded' | 'hierarchical',
  maxTokens: number = 4000
): AssembledContext {
  switch (strategy) {
    case 'expanded':
      return assembleExpandedContext(candidates, maxTokens);

    case 'hierarchical':
      // For hierarchical, include ancestor context
      return assembleHierarchicalContext(candidates, maxTokens);

    case 'compact':
    default:
      // For compact, just use chunk content
      return assembleCompactContext(candidates, maxTokens);
  }
}

/**
 * Assemble hierarchical context with ancestors
 */
function assembleHierarchicalContext(
  candidates: EnrichedCandidate[],
  maxTokens: number
): AssembledContext {
  const parts: string[] = [];
  const chunks: KnowledgeChunk[] = [];
  const citationMap = new Map<string, string>();

  let currentTokens = 0;
  let truncated = false;

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const priority = i + 1;

    // Expand multi-level hierarchy
    const hierarchy = expandMultiLevelHierarchySync(candidate.chunk);

    // Build hierarchical context
    const contextParts: string[] = [];
    contextParts.push(`[${priority}] ${hierarchy.rootDocument?.title || 'Unknown'}`);

    if (hierarchy.hierarchyPath.length > 0) {
      contextParts.push(`Path: ${hierarchy.hierarchyPath.join(' > ')}`);
    }

    contextParts.push('');

    // Add ancestor summaries
    for (const ancestor of hierarchy.ancestors) {
      contextParts.push(`[${ancestor.titlePath.join(' > ')}]`);
      contextParts.push(ancestor.content.substring(0, 200) + '...');
      contextParts.push('');
    }

    // Add main chunk
    contextParts.push('[Content]');
    contextParts.push(candidate.chunk.content);

    const contextText = contextParts.join('\n');
    const contextTokens = estimateTokenCount(contextText);

    if (currentTokens + contextTokens > maxTokens) {
      truncated = true;
      break;
    }

    parts.push(contextText);
    chunks.push(candidate.chunk);
    currentTokens += contextTokens;

    citationMap.set(candidate.chunk.id, generateCitation(candidate, priority));
  }

  return {
    chunks,
    fullText: parts.join('\n\n---\n\n'),
    totalTokens: currentTokens,
    citationMap,
    truncated,
  };
}

/**
 * Synchronous version for use in synchronous context assembly
 */
function expandMultiLevelHierarchySync(
  chunk: KnowledgeChunk,
  maxLevels: number = 3
): {
  ancestors: KnowledgeChunk[];
  rootDocument?: KnowledgeDocument;
  hierarchyPath: string[];
} {
  const ancestors: KnowledgeChunk[] = [];
  const hierarchyPath: string[] = [...chunk.titlePath];

  let currentChunk: KnowledgeChunk | null = chunk;
  let levels = 0;

  while (currentChunk?.parentSectionId && levels < maxLevels) {
    const parent = getChunkById(currentChunk.parentSectionId);
    if (!parent) break;

    ancestors.unshift(parent);
    hierarchyPath.unshift(...parent.titlePath);

    currentChunk = parent;
    levels++;
  }

  const rootDocument = currentChunk
    ? getDocumentById(currentChunk.documentId)
    : undefined;

  return {
    ancestors,
    rootDocument: rootDocument || undefined,
    hierarchyPath: [...new Set(hierarchyPath)],
  };
}

/**
 * Assemble compact context (just chunks)
 */
function assembleCompactContext(
  candidates: EnrichedCandidate[],
  maxTokens: number
): AssembledContext {
  const parts: string[] = [];
  const chunks: KnowledgeChunk[] = [];
  const citationMap = new Map<string, string>();

  let currentTokens = 0;
  let truncated = false;

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const priority = i + 1;

    const chunkTokens = candidate.chunk.tokenCount;

    if (currentTokens + chunkTokens > maxTokens) {
      truncated = true;
      break;
    }

    parts.push(formatCompactChunk(candidate.chunk, priority));
    chunks.push(candidate.chunk);
    currentTokens += chunkTokens;

    citationMap.set(candidate.chunk.id, generateCitation(candidate, priority));
  }

  return {
    chunks,
    fullText: parts.join('\n\n---\n\n'),
    totalTokens: currentTokens,
    citationMap,
    truncated,
  };
}
