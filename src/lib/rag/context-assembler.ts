/**
 * Context Assembler
 * 
 * Builds compact, authoritative context packs for LLM generation.
 * 
 * Key Responsibilities:
 * 1. Select best sources from reranked results
 * 2. Format context for LLM prompt
 * 3. Generate citation index
 * 4. Enforce token budget
 * 5. Preserve authority signals
 * 
 * Context Format:
 * ```
 * [Document: Title | Version | Jurisdiction]
 * [Section: Path > To > Section]
 * Content excerpt...
 * 
 * [Source: Title - Clause - Section]
 * ```
 * 
 * Security:
 * - All content verified through permission layer
 * - No unauthorized content in context
 * - Citations trackable for answer verification
 */

import type {
  ContextPack,
  RerankedResult,
  QueryClassification,
  Citation,
  KnowledgeChunk,
} from './types';

// ============================================
// Assembly Configuration
// ============================================

export interface AssemblyConfig {
  maxContextTokens: number;
  maxSources: number;
  includeJurisdiction: boolean;
  includeVersion: boolean;
  includeClauseRef: boolean;
  preserveFormatting: boolean;
  citationStyle: 'inline' | 'numbered' | 'footnote';
}

export const DEFAULT_ASSEMBLY_CONFIG: AssemblyConfig = {
  maxContextTokens: 4000,
  maxSources: 5,
  includeJurisdiction: true,
  includeVersion: true,
  includeClauseRef: true,
  preserveFormatting: true,
  citationStyle: 'numbered',
};

// ============================================
// Main Assembly Function
// ============================================

/**
 * Assemble context pack for LLM generation
 * 
 * This is the main entry point for Phase 2 context assembly.
 */
export function assembleContextPack(
  query: string,
  rerankedResults: RerankedResult[],
  classification: QueryClassification,
  config: Partial<AssemblyConfig> = {}
): ContextPack {
  const fullConfig = { ...DEFAULT_ASSEMBLY_CONFIG, ...config };

  // 1. Select top sources
  const selectedSources = selectSources(rerankedResults, fullConfig.maxSources);

  // 2. Build context text
  const contextText = buildContextText(selectedSources, fullConfig);

  // 3. Extract citations
  const citations = extractCitations(selectedSources);

  // 4. Build citation index
  const citationIndex = buildCitationIndex(citations);

  // 5. Calculate token count
  const tokenCount = estimateTokenCount(contextText);

  // 6. Truncate if needed
  let finalContext = contextText;
  let finalCitations = citations;

  if (tokenCount > fullConfig.maxContextTokens) {
    const truncated = truncateContext(selectedSources, fullConfig.maxContextTokens);
    finalContext = truncated.text;
    finalCitations = extractCitations(truncated.sources);
  }

  return {
    query,
    classification,
    sources: selectedSources,
    citations: finalCitations,
    totalTokens: estimateTokenCount(finalContext),
    tokenBudget: fullConfig.maxContextTokens,
    assemblyStrategy: 'authority_first',
    contextText: finalContext,
    citationIndex,
    highRiskMode: classification.risk === 'high' || classification.risk === 'critical',
    verificationRequired: classification.requiredVerification,
    sourcesByDocument: groupSourcesByDocument(selectedSources),
    sourcesByZone: groupSourcesByZone(selectedSources),
  };
}

// ============================================
// Source Selection
// ============================================

/**
 * Select best sources for context
 * 
 * Considers:
 * - Reranker score
 * - Diversity (different documents)
 * - Authority priority
 */
function selectSources(
  rerankedResults: RerankedResult[],
  maxSources: number
): RerankedResult[] {
  const selected: RerankedResult[] = [];
  const seenDocuments = new Set<string>();

  for (const result of rerankedResults) {
    // Skip if we have enough sources
    if (selected.length >= maxSources) {
      break;
    }

    // Prioritize diversity - prefer sources from different documents
    const docId = result.document.id;
    const alreadyHaveDoc = seenDocuments.has(docId);

    if (!alreadyHaveDoc || selected.length < maxSources / 2) {
      selected.push(result);
      seenDocuments.add(docId);
    }
  }

  return selected;
}

// ============================================
// Context Text Building
// ============================================

/**
 * Build formatted context text from sources
 */
function buildContextText(
  sources: RerankedResult[],
  config: AssemblyConfig
): string {
  const parts: string[] = [];

  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    const citationNum = i + 1;

    parts.push(formatSource(source, citationNum, config));
  }

  return parts.join('\n\n---\n\n');
}

/**
 * Format a single source for context
 */
function formatSource(
  source: RerankedResult,
  citationNum: number,
  config: AssemblyConfig
): string {
  const parts: string[] = [];
  const chunk = source.chunk;
  const doc = source.document;

  // Header with citation number
  parts.push(`[${citationNum}] ${doc.title}`);

  // Metadata line
  const metadata: string[] = [];

  if (config.includeVersion) {
    metadata.push(`Version: ${doc.version}`);
  }

  if (config.includeJurisdiction && chunk.jurisdiction !== 'unknown') {
    metadata.push(`Jurisdiction: ${chunk.jurisdiction}`);
  }

  if (metadata.length > 0) {
    parts.push(metadata.join(' | '));
  }

  // Section path
  if (chunk.titlePath.length > 0) {
    parts.push(`Section: ${chunk.titlePath.join(' > ')}`);
  }

  // Clause reference
  if (config.includeClauseRef && chunk.clauseRef) {
    parts.push(`Reference: ${chunk.clauseRef}`);
  }

  parts.push(''); // Empty line before content

  // Content
  if (config.preserveFormatting) {
    parts.push(chunk.content);
  } else {
    // Flatten formatting for LLM
    parts.push(flattenFormatting(chunk.content));
  }

  return parts.join('\n');
}

/**
 * Flatten formatting (remove markdown, etc.)
 */
function flattenFormatting(content: string): string {
  return content
    .replace(/^#+\s+/gm, '') // Remove markdown headings
    .replace(/\*\*/g, '')     // Remove bold markers
    .replace(/\*/g, '')       // Remove italic markers
    .replace(/^[-*]\s+/gm, '') // Remove list markers
    .trim();
}

// ============================================
// Citation Extraction
// ============================================

/**
 * Extract citations from sources
 */
function extractCitations(sources: RerankedResult[]): Citation[] {
  return sources.map(source => source.citation);
}

/**
 * Build citation index for quick lookup
 */
function buildCitationIndex(citations: Citation[]): Map<string, Citation> {
  const index = new Map<string, Citation>();

  for (const citation of citations) {
    index.set(citation.chunkId, citation);
  }

  return index;
}

// ============================================
// Token Management
// ============================================

/**
 * Estimate token count for text
 * Conservative: ~4 characters per token
 */
function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Truncate context to fit token budget
 */
function truncateContext(
  sources: RerankedResult[],
  maxTokens: number
): { text: string; sources: RerankedResult[] } {
  const parts: string[] = [];
  const keptSources: RerankedResult[] = [];
  let currentTokens = 0;

  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    const sourceText = formatSource(source, i + 1, DEFAULT_ASSEMBLY_CONFIG);
    const sourceTokens = estimateTokenCount(sourceText);

    // Check if we can fit this source
    if (currentTokens + sourceTokens > maxTokens) {
      // Try to fit truncated version
      const truncatedText = truncateSource(source, i + 1, maxTokens - currentTokens);
      if (truncatedText) {
        parts.push(truncatedText);
        keptSources.push(source);
        currentTokens += estimateTokenCount(truncatedText);
      }
      break;
    }

    parts.push(sourceText);
    keptSources.push(source);
    currentTokens += sourceTokens;
  }

  return {
    text: parts.join('\n\n---\n\n'),
    sources: keptSources,
  };
}

/**
 * Truncate a single source to fit remaining budget
 */
function truncateSource(
  source: RerankedResult,
  citationNum: number,
  remainingTokens: number
): string | null {
  const header = formatSourceHeader(source, citationNum);
  const headerTokens = estimateTokenCount(header);

  // Reserve 50 tokens for truncation indicator
  const contentBudget = remainingTokens - headerTokens - 50;

  if (contentBudget < 50) {
    return null; // Can't fit even truncated
  }

  const maxChars = contentBudget * 4;
  const truncatedContent = source.chunk.content.substring(0, maxChars) + '...';

  return `${header}\n${truncatedContent}`;
}

/**
 * Format just the header portion of a source
 */
function formatSourceHeader(source: RerankedResult, citationNum: number): string {
  const parts: string[] = [];
  const chunk = source.chunk;
  const doc = source.document;

  parts.push(`[${citationNum}] ${doc.title}`);

  if (chunk.jurisdiction !== 'unknown') {
    parts.push(`Jurisdiction: ${chunk.jurisdiction}`);
  }

  if (chunk.titlePath.length > 0) {
    parts.push(`Section: ${chunk.titlePath.join(' > ')}`);
  }

  return parts.join('\n');
}

// ============================================
// Prompt Formatting
// ============================================

/**
 * Format context pack for LLM prompt
 */
export function formatForPrompt(contextPack: ContextPack): string {
  const parts: string[] = [];

  // Query
  parts.push(`Query: ${contextPack.query}`);
  parts.push('');

  // Risk warning if high-risk
  if (contextPack.highRiskMode) {
    parts.push('⚠️ HIGH-RISK QUERY: Answer requires verification by HR professional.');
    parts.push('');
  }

  // Context header
  parts.push('Relevant Policy Context:');
  parts.push('');

  // Context content
  parts.push(contextPack.contextText);
  parts.push('');

  // Citation guide
  parts.push('Citations:');
  contextPack.citations.forEach((citation, i) => {
    parts.push(`[${i + 1}] ${citation.documentTitle}`);
    if (citation.clauseRef) {
      parts.push(`    Clause: ${citation.clauseRef}`);
    }
  });

  return parts.join('\n');
}

/**
 * Format for policy lookup (compact)
 */
export function formatForPolicyLookup(contextPack: ContextPack): string {
  // More compact format for simple lookups
  const parts: string[] = [];

  parts.push(`Q: ${contextPack.query}`);
  parts.push('');

  // Include only key facts
  for (const source of contextPack.sources.slice(0, 3)) {
    const chunk = source.chunk;
    parts.push(`[${source.citation.documentTitle}]`);

    if (chunk.clauseRef) {
      parts.push(`Ref: ${chunk.clauseRef}`);
    }

    parts.push(chunk.content);
    parts.push('');
  }

  return parts.join('\n');
}

/**
 * Format for drafting (expanded)
 */
export function formatForDrafting(contextPack: ContextPack): string {
  // More detailed format for drafting
  const parts: string[] = [];

  parts.push(`Drafting Request: ${contextPack.query}`);
  parts.push('');

  parts.push('TEMPLATE REFERENCES:');
  parts.push('');

  for (const source of contextPack.sources) {
    const chunk = source.chunk;
    const doc = source.document;

    parts.push(`Source: ${doc.title}`);
    parts.push(`Version: ${doc.version}`);

    if (chunk.clauseRef) {
      parts.push(`Template Ref: ${chunk.clauseRef}`);
    }

    parts.push('');
    parts.push(chunk.content);
    parts.push('');
    parts.push('---');
    parts.push('');
  }

  return parts.join('\n');
}

/**
 * Format for procedural help (checklist)
 */
export function formatForProceduralHelp(contextPack: ContextPack): string {
  // Step-by-step format
  const parts: string[] = [];

  parts.push(`Process: ${contextPack.query}`);
  parts.push('');

  let stepNum = 1;

  for (const source of contextPack.sources) {
    const chunk = source.chunk;

    // Extract steps from content
    const steps = extractSteps(chunk.content);

    for (const step of steps) {
      parts.push(`${stepNum}. ${step}`);
      stepNum++;
    }
  }

  parts.push('');
  parts.push('Sources:');
  contextPack.citations.forEach((c, i) => {
    parts.push(`- ${c.documentTitle}`);
  });

  return parts.join('\n');
}

/**
 * Extract steps from procedural content
 */
function extractSteps(content: string): string[] {
  const steps: string[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Look for numbered steps
    const stepMatch = trimmed.match(/^\d+\.\s*(.+)/);
    if (stepMatch) {
      steps.push(stepMatch[1]);
      continue;
    }

    // Look for bullet steps
    const bulletMatch = trimmed.match(/^[-*]\s*(.+)/);
    if (bulletMatch) {
      steps.push(bulletMatch[1]);
      continue;
    }
  }

  // If no steps found, treat whole content as one step
  if (steps.length === 0 && content.trim()) {
    steps.push(content.trim());
  }

  return steps;
}

// ============================================
// Format Router
// ============================================

/**
 * Route to appropriate formatter based on query type
 */
export function formatByQueryType(contextPack: ContextPack): string {
  const intent = contextPack.classification.intent;

  switch (intent) {
    case 'policy_lookup':
      return formatForPolicyLookup(contextPack);

    case 'drafting_support':
    case 'template_lookup':
      return formatForDrafting(contextPack);

    case 'procedural_help':
      return formatForProceduralHelp(contextPack);

    default:
      return formatForPrompt(contextPack);
  }
}

// ============================================
// Source Grouping Helpers
// ============================================

function groupSourcesByDocument(sources: RerankedResult[]): Map<string, RerankedResult[]> {
  const groups = new Map<string, RerankedResult[]>();

  for (const source of sources) {
    const docId = source.document.id;
    if (!groups.has(docId)) {
      groups.set(docId, []);
    }
    groups.get(docId)!.push(source);
  }

  return groups;
}

import type { KnowledgeZone } from './types';

function groupSourcesByZone(sources: RerankedResult[]): Map<KnowledgeZone, RerankedResult[]> {
  const groups = new Map<KnowledgeZone, RerankedResult[]>();

  for (const source of sources) {
    const zone = source.chunk.knowledgeZone as KnowledgeZone;
    if (!groups.has(zone)) {
      groups.set(zone, []);
    }
    groups.get(zone)!.push(source);
  }

  return groups;
}
