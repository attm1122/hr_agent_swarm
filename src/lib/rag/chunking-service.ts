/**
 * Structure-Aware Chunking Service
 * 
 * Implements intelligent document chunking that preserves semantic meaning
 * and structural relationships for HR/policy documents.
 * 
 * Architecture:
 * - Pure domain logic - no infrastructure dependencies
 * - Multiple chunking strategies based on document type
 * - Parent/child relationships maintained
 * - Metadata inheritance from document to chunks
 * 
 * Chunking Strategies:
 * - Policy documents: By section/clause
 * - SOPs: By procedure step
 * - FAQs: By question/answer pair
 * - Playbooks: By scenario/situation
 * - Templates: By template section
 * 
 * Performance:
 * - Token estimation without external calls
 * - Streaming-friendly for large documents
 * - Deduplication of overlapping content
 */

import type {
  KnowledgeDocument,
  KnowledgeChunk,
  DocumentStructure,
  DocumentType,
  KnowledgeZone,
} from './types';

// ============================================
// Chunking Configuration
// ============================================

interface ChunkingConfig {
  maxTokens: number;
  minTokens: number;
  overlapTokens: number;
  preserveHeadings: boolean;
  chunkBy: 'section' | 'paragraph' | 'sentence' | 'clause' | 'faq' | 'step';
}

// Strategy selection by document type
const CHUNKING_STRATEGIES: Record<DocumentType, ChunkingConfig> = {
  policy: {
    maxTokens: 500,
    minTokens: 100,
    overlapTokens: 50,
    preserveHeadings: true,
    chunkBy: 'clause',
  },
  procedure: {
    maxTokens: 400,
    minTokens: 80,
    overlapTokens: 40,
    preserveHeadings: true,
    chunkBy: 'step',
  },
  playbook: {
    maxTokens: 600,
    minTokens: 150,
    overlapTokens: 75,
    preserveHeadings: true,
    chunkBy: 'section',
  },
  template: {
    maxTokens: 450,
    minTokens: 100,
    overlapTokens: 50,
    preserveHeadings: true,
    chunkBy: 'section',
  },
  sop: {
    maxTokens: 400,
    minTokens: 80,
    overlapTokens: 40,
    preserveHeadings: true,
    chunkBy: 'step',
  },
  guide: {
    maxTokens: 500,
    minTokens: 100,
    overlapTokens: 50,
    preserveHeadings: true,
    chunkBy: 'section',
  },
  faq: {
    maxTokens: 350,
    minTokens: 80,
    overlapTokens: 0,  // FAQs are discrete
    preserveHeadings: true,
    chunkBy: 'faq',
  },
  form: {
    maxTokens: 400,
    minTokens: 100,
    overlapTokens: 50,
    preserveHeadings: true,
    chunkBy: 'section',
  },
  checklist: {
    maxTokens: 350,
    minTokens: 80,
    overlapTokens: 30,
    preserveHeadings: true,
    chunkBy: 'section',
  },
  legal_brief: {
    maxTokens: 700,
    minTokens: 200,
    overlapTokens: 100,
    preserveHeadings: true,
    chunkBy: 'clause',
  },
};

// Token estimation: ~4 characters per token (conservative)
const CHARS_PER_TOKEN = 4;

// ============================================
// Document Parsing
// ============================================

/**
 * Parse raw document text into structured format
 * Identifies headings, sections, lists, tables
 */
export function parseDocumentStructure(
  rawText: string,
  documentType: DocumentType
): DocumentStructure {
  const lines = rawText.split('\n');
  const headings: DocumentStructure['headings'] = [];
  const sections: DocumentStructure['sections'] = [];
  const tables: DocumentStructure['tables'] = [];
  const lists: DocumentStructure['lists'] = [];

  let currentSection: DocumentStructure['sections'][0] | null = null;
  let inTable = false;
  let tableBuffer: string[] = [];
  let inList = false;
  let listBuffer: string[] = [];
  let listType: 'ordered' | 'unordered' = 'unordered';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Detect headings (markdown style or numbered)
    const headingMatch = detectHeading(trimmed, i, lines);
    if (headingMatch) {
      // Save current section
      if (currentSection) {
        currentSection.lineEnd = i - 1;
        currentSection.content = lines
          .slice(currentSection.lineStart, currentSection.lineEnd + 1)
          .join('\n')
          .trim();
        sections.push(currentSection);
      }

      headings.push({
        level: headingMatch.level,
        title: headingMatch.title,
        lineStart: i,
        lineEnd: null,
      });

      currentSection = {
        id: `sec-${sections.length}`,
        headingRef: headingMatch.title,
        level: headingMatch.level,
        title: headingMatch.title,
        content: '',
        lineStart: i,
        lineEnd: null,
      };

      continue;
    }

    // Detect table start
    if (isTableRow(trimmed)) {
      if (!inTable) {
        inTable = true;
        tableBuffer = [];
      }
      tableBuffer.push(trimmed);
      continue;
    } else if (inTable && trimmed) {
      // End of table
      inTable = false;
      tables.push(parseTable(tableBuffer));
      tableBuffer = [];
    }

    // Detect list items
    const listMatch = detectListItem(trimmed);
    if (listMatch) {
      if (!inList) {
        inList = true;
        listType = listMatch.type;
        listBuffer = [];
      }
      listBuffer.push(listMatch.content);
    } else if (inList && trimmed) {
      // End of list
      inList = false;
      lists.push({ type: listType, items: [...listBuffer] });
      listBuffer = [];
    }
  }

  // Close final section
  if (currentSection) {
    currentSection.lineEnd = lines.length - 1;
    currentSection.content = lines
      .slice(currentSection.lineStart, currentSection.lineEnd + 1)
      .join('\n')
      .trim();
    sections.push(currentSection);
  }

  // Close any open structures
  if (inTable && tableBuffer.length > 0) {
    tables.push(parseTable(tableBuffer));
  }
  if (inList && listBuffer.length > 0) {
    lists.push({ type: listType, items: [...listBuffer] });
  }

  return {
    headings,
    sections,
    tables,
    lists,
  };
}

/**
 * Detect if line is a heading
 */
function detectHeading(
  line: string,
  lineIndex: number,
  allLines: string[]
): { level: number; title: string } | null {
  // Markdown headings (# ## ###)
  const mdMatch = line.match(/^(#{1,6})\s+(.+)$/);
  if (mdMatch) {
    return {
      level: mdMatch[1].length,
      title: mdMatch[2].trim(),
    };
  }

  // Numbered headings (1., 1.1, 1.1.1, etc.)
  const numberedMatch = line.match(/^(\d+(?:\.\d+)*)\s*[.)]\s*(.+)$/);
  if (numberedMatch) {
    const sectionNumbers = numberedMatch[1].split('.');
    return {
      level: sectionNumbers.length,
      title: numberedMatch[2].trim(),
    };
  }

  // ALL CAPS short lines (likely headings)
  if (line.length > 3 && line.length < 100 && line === line.toUpperCase()) {
    // Check if next line is content (not another heading)
    const nextLine = allLines[lineIndex + 1];
    if (nextLine && !detectHeading(nextLine.trim(), lineIndex + 1, allLines)) {
      return { level: 2, title: line };
    }
  }

  return null;
}

/**
 * Check if line is a table row
 */
function isTableRow(line: string): boolean {
  // Markdown table or simple pipe-separated
  return line.includes('|') && line.split('|').length >= 3;
}

/**
 * Parse table from buffer
 */
function parseTable(buffer: string[]): DocumentStructure['tables'][0] {
  const rows = buffer.map(row =>
    row.split('|').map(cell => cell.trim()).filter(cell => cell)
  );

  return {
    caption: null,
    headers: rows[0] || [],
    rows: rows.slice(1),
  };
}

/**
 * Detect list item
 */
function detectListItem(line: string): { type: 'ordered' | 'unordered'; content: string } | null {
  // Unordered list
  const unorderedMatch = line.match(/^[-*•]\s+(.+)$/);
  if (unorderedMatch) {
    return { type: 'unordered', content: unorderedMatch[1] };
  }

  // Ordered list
  const orderedMatch = line.match(/^(\d+[.)])\s+(.+)$/);
  if (orderedMatch) {
    return { type: 'ordered', content: orderedMatch[2] };
  }

  return null;
}

// ============================================
// Chunking Strategies
// ============================================

/**
 * Chunk document based on its type and structure
 * Returns chunks with parent/child relationships
 */
export function chunkDocument(
  document: KnowledgeDocument,
  structure: DocumentStructure
): KnowledgeChunk[] {
  const config = CHUNKING_STRATEGIES[document.documentType];
  const chunks: KnowledgeChunk[] = [];

  switch (config.chunkBy) {
    case 'clause':
      return chunkByClause(document, structure, config);
    case 'section':
      return chunkBySection(document, structure, config);
    case 'step':
      return chunkByStep(document, structure, config);
    case 'faq':
      return chunkByFaq(document, structure, config);
    case 'paragraph':
      return chunkByParagraph(document, config);
    default:
      return chunkBySection(document, structure, config);
  }
}

/**
 * Chunk by policy clause/section (for policies, legal briefs)
 */
function chunkByClause(
  document: KnowledgeDocument,
  structure: DocumentStructure,
  config: ChunkingConfig
): KnowledgeChunk[] {
  const chunks: KnowledgeChunk[] = [];

  for (let i = 0; i < structure.sections.length; i++) {
    const section = structure.sections[i];
    const content = section.content;
    const estimatedTokens = estimateTokens(content);

    // If section fits in one chunk, use it whole
    if (estimatedTokens <= config.maxTokens) {
      chunks.push(createChunk(
        document,
        content,
        i,
        [section.title],
        extractClauseRef(section.title),
        config,
        null
      ));
    } else {
      // Split large sections by paragraph
      const paragraphs = content.split('\n\n');
      let currentChunk = '';
      let chunkParagraphs: string[] = [];

      for (const paragraph of paragraphs) {
        const paraTokens = estimateTokens(paragraph);
        const currentTokens = estimateTokens(currentChunk);

        if (currentTokens + paraTokens > config.maxTokens && currentChunk) {
          // Save current chunk
          chunks.push(createChunk(
            document,
            currentChunk,
            chunks.length,
            [section.title],
            extractClauseRef(section.title),
            config,
            null
          ));

          // Start new chunk with overlap
          currentChunk = paragraph;
          chunkParagraphs = [paragraph];
        } else {
          currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
          chunkParagraphs.push(paragraph);
        }
      }

      // Save final chunk
      if (currentChunk) {
        chunks.push(createChunk(
          document,
          currentChunk,
          chunks.length,
          [section.title],
          extractClauseRef(section.title),
          config,
          null
        ));
      }
    }
  }

  return linkChunks(chunks);
}

/**
 * Chunk by section (for guides, templates, playbooks)
 */
function chunkBySection(
  document: KnowledgeDocument,
  structure: DocumentStructure,
  config: ChunkingConfig
): KnowledgeChunk[] {
  const chunks: KnowledgeChunk[] = [];

  for (let i = 0; i < structure.sections.length; i++) {
    const section = structure.sections[i];
    const content = section.content;
    const estimatedTokens = estimateTokens(content);

    if (estimatedTokens <= config.maxTokens) {
      // Section fits in one chunk
      const titlePath = buildTitlePath(structure, i);
      chunks.push(createChunk(
        document,
        content,
        i,
        titlePath,
        null,
        config,
        section.headingRef
      ));
    } else {
      // Split large section
      const subChunks = splitContent(
        content,
        config,
        document,
        i,
        buildTitlePath(structure, i),
        section.headingRef
      );
      chunks.push(...subChunks);
    }
  }

  return linkChunks(chunks);
}

/**
 * Chunk by procedure step (for SOPs)
 */
function chunkByStep(
  document: KnowledgeDocument,
  structure: DocumentStructure,
  config: ChunkingConfig
): KnowledgeChunk[] {
  const chunks: KnowledgeChunk[] = [];

  for (let i = 0; i < structure.sections.length; i++) {
    const section = structure.sections[i];
    const titlePath = buildTitlePath(structure, i);

    // Try to identify steps within section
    const stepPattern = /(?:^|\n)(?:Step\s+\d+[.:]|\d+[.)]\s+|[-*]\s+Action:)/gi;
    const steps = section.content.split(stepPattern).filter(s => s.trim());

    if (steps.length > 1) {
      // Multiple steps identified
      for (let j = 0; j < steps.length; j++) {
        const stepContent = steps[j].trim();
        if (estimateTokens(stepContent) >= config.minTokens) {
          chunks.push(createChunk(
            document,
            stepContent,
            chunks.length,
            [...titlePath, `Step ${j + 1}`],
            null,
            config,
            null
          ));
        }
      }
    } else {
      // No clear steps - chunk by section
      chunks.push(createChunk(
        document,
        section.content,
        i,
        titlePath,
        null,
        config,
        null
      ));
    }
  }

  return linkChunks(chunks);
}

/**
 * Chunk by FAQ pair (for FAQ documents)
 */
function chunkByFaq(
  document: KnowledgeDocument,
  structure: DocumentStructure,
  config: ChunkingConfig
): KnowledgeChunk[] {
  const chunks: KnowledgeChunk[] = [];
  const text = document.rawText;

  // Look for Q: / A: patterns or numbered questions
  const faqPattern = /(?:^|\n)(?:Q[:.]\s*|Question\s*\d*[.:]?\s*|\d+[.)]\s*)(.+?)(?:\n|$)(?:A[:.]\s*|Answer[:.]?\s*|\n)([\s\S]*?)(?=\n(?:Q[:.]\s*|Question\s*\d*[.:]?\s*|\d+[.)]\s*|\n{2,}))/gi;

  let match;
  let chunkIndex = 0;

  while ((match = faqPattern.exec(text)) !== null) {
    const question = match[1].trim();
    const answer = match[2].trim();
    const content = `Q: ${question}\n\nA: ${answer}`;

    chunks.push(createChunk(
      document,
      content,
      chunkIndex++,
      [question],
      null,
      config,
      null
    ));
  }

  // If no FAQs matched, fall back to section chunking
  if (chunks.length === 0) {
    return chunkBySection(document, structure, config);
  }

  return linkChunks(chunks);
}

/**
 * Chunk by paragraph (fallback for unstructured content)
 */
function chunkByParagraph(
  document: KnowledgeDocument,
  config: ChunkingConfig
): KnowledgeChunk[] {
  const paragraphs = document.rawText.split('\n\n').filter(p => p.trim());
  const chunks: KnowledgeChunk[] = [];

  let currentChunk = '';
  let chunkIndex = 0;

  for (const paragraph of paragraphs) {
    const paraTokens = estimateTokens(paragraph);
    const currentTokens = estimateTokens(currentChunk);

    if (currentTokens + paraTokens > config.maxTokens && currentChunk) {
      chunks.push(createChunk(
        document,
        currentChunk,
        chunkIndex++,
        [],
        null,
        config,
        null
      ));
      currentChunk = paragraph;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    }
  }

  if (currentChunk) {
    chunks.push(createChunk(
      document,
      currentChunk,
      chunkIndex,
      [],
      null,
      config,
      null
    ));
  }

  return linkChunks(chunks);
}

// ============================================
// Helper Functions
// ============================================

/**
 * Create a knowledge chunk with inherited metadata
 */
function createChunk(
  document: KnowledgeDocument,
  content: string,
  chunkOrder: number,
  titlePath: string[],
  clauseRef: string | null,
  config: ChunkingConfig,
  parentSectionId: string | null
): KnowledgeChunk {
  const now = new Date().toISOString();
  const tokenCount = estimateTokens(content);

  // Extract keywords and entities
  const keywords = extractKeywords(content);
  const keyPhrases = extractKeyPhrases(content);
  const entities = extractEntities(content);

  return {
    id: `chunk-${crypto.randomUUID()}`,
    documentId: document.id,
    tenantId: document.tenantId,
    parentSectionId,
    rootDocumentId: document.id,
    chunkOrder,
    chunkLevel: titlePath.length,
    titlePath,
    clauseRef,
    content: content.trim(),
    tokenCount,
    surroundingContext: null,  // Set during linking
    // Inherited metadata
    knowledgeZone: document.knowledgeZone,
    documentType: document.documentType,
    topic: document.topic,
    topics: document.topics,
    audience: document.audience,
    jurisdiction: document.jurisdiction,
    confidentiality: document.confidentiality,
    approvalStatus: document.approvalStatus,
    isCurrentVersion: document.isCurrentVersion,
    effectiveDate: document.effectiveDate,
    version: document.version,
    // Embeddings (to be populated later)
    embeddingVector: null,
    embeddingModel: null,
    embeddingUpdatedAt: null,
    // Extracted features
    keywords,
    keyPhrases,
    entities,
    // Audit
    createdAt: now,
    updatedAt: now,
    indexedAt: null,
  };
}

/**
 * Split content that exceeds max tokens
 */
function splitContent(
  content: string,
  config: ChunkingConfig,
  document: KnowledgeDocument,
  baseOrder: number,
  titlePath: string[],
  parentSectionId: string | null
): KnowledgeChunk[] {
  const chunks: KnowledgeChunk[] = [];
  const paragraphs = content.split('\n\n');

  let currentChunk = '';
  let chunkIndex = 0;

  for (const paragraph of paragraphs) {
    const paraTokens = estimateTokens(paragraph);
    const currentTokens = estimateTokens(currentChunk);

    if (currentTokens + paraTokens > config.maxTokens && currentChunk) {
      chunks.push(createChunk(
        document,
        currentChunk,
        baseOrder * 100 + chunkIndex,
        titlePath,
        null,
        config,
        parentSectionId
      ));
      chunkIndex++;

      // Start new chunk with overlap if configured
      if (config.overlapTokens > 0) {
        const overlapText = getOverlapText(currentChunk, config.overlapTokens);
        currentChunk = overlapText + '\n\n' + paragraph;
      } else {
        currentChunk = paragraph;
      }
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    }
  }

  if (currentChunk) {
    chunks.push(createChunk(
      document,
      currentChunk,
      baseOrder * 100 + chunkIndex,
      titlePath,
      null,
      config,
      parentSectionId
    ));
  }

  return chunks;
}

/**
 * Get overlap text from end of previous chunk
 */
function getOverlapText(text: string, overlapTokens: number): string {
  const overlapChars = overlapTokens * CHARS_PER_TOKEN;
  const sentences = text.split(/(?<=[.!?])\s+/);

  let overlap = '';
  for (let i = sentences.length - 1; i >= 0; i--) {
    const candidate = sentences[i] + ' ' + overlap;
    if (candidate.length > overlapChars) break;
    overlap = candidate;
  }

  return overlap.trim();
}

/**
 * Link chunks with adjacency references
 */
function linkChunks(chunks: KnowledgeChunk[]): KnowledgeChunk[] {
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const siblingChunkIds = chunks
      .filter((c, idx) => idx !== i && c.parentSectionId === chunk.parentSectionId)
      .map(c => c.id);

    chunk.surroundingContext = {
      previousChunkId: i > 0 ? chunks[i - 1].id : null,
      nextChunkId: i < chunks.length - 1 ? chunks[i + 1].id : null,
      parentChunkId: chunk.parentSectionId,
      siblingChunkIds,
    };
  }

  return chunks;
}

/**
 * Build title path from structure
 */
function buildTitlePath(structure: DocumentStructure, sectionIndex: number): string[] {
  const section = structure.sections[sectionIndex];
  const path: string[] = [];

  // Find parent headings based on level
  for (let i = sectionIndex - 1; i >= 0; i--) {
    const prevSection = structure.sections[i];
    if (prevSection.level < section.level) {
      path.unshift(prevSection.title);
      if (prevSection.level === 1) break;
    }
  }

  path.push(section.title);
  return path;
}

/**
 * Extract clause reference from title (e.g., "3.2(a)", "Section 4")
 */
function extractClauseRef(title: string): string | null {
  // Match patterns like "3.2", "3.2(a)", "Section 4", "Clause 5.1"
  const patterns = [
    /^(\d+(?:\.\d+)*[a-z]?)/,           // 1, 1.2, 1.2.3, 1.2a
    /^(?:Clause|Section)\s+(\d+(?:\.\d+)*)/i,
    /^(?:Schedule)\s+(\d+)/i,
  ];

  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) {
      return match[1] || match[0];
    }
  }

  return null;
}

/**
 * Estimate token count (conservative)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Extract keywords from content (simple TF-like approach)
 */
function extractKeywords(content: string): string[] {
  const words = content.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3);

  const frequency: Record<string, number> = {};
  for (const word of words) {
    frequency[word] = (frequency[word] || 0) + 1;
  }

  // Return top keywords by frequency
  return Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

/**
 * Extract key phrases (bigrams and trigrams)
 */
function extractKeyPhrases(content: string): string[] {
  const words = content.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2);

  const phrases: string[] = [];

  // Extract bigrams
  for (let i = 0; i < words.length - 1; i++) {
    phrases.push(`${words[i]} ${words[i + 1]}`);
  }

  // Extract trigrams
  for (let i = 0; i < words.length - 2; i++) {
    phrases.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
  }

  // Count and return top phrases
  const frequency: Record<string, number> = {};
  for (const phrase of phrases) {
    frequency[phrase] = (frequency[phrase] || 0) + 1;
  }

  return Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([phrase]) => phrase);
}

/**
 * Extract named entities (simplified - HR domain focused)
 */
function extractEntities(content: string): string[] {
  const entities: string[] = [];

  // Policy/Procedure patterns
  const policyMatches = content.match(/(?:Annual Leave|Sick Leave|Parental Leave|Personal Leave|Annual leave|sick leave)/gi);
  if (policyMatches) entities.push(...policyMatches);

  // Role patterns
  const roleMatches = content.match(/(?:Employee|Manager|HR|Supervisor|Team Lead|Executive)/gi);
  if (roleMatches) entities.push(...roleMatches);

  // Department patterns
  const deptMatches = content.match(/(?:HR|Payroll|IT|Finance|Operations|Legal)/gi);
  if (deptMatches) entities.push(...deptMatches);

  // Time patterns
  const timeMatches = content.match(/(?:days?|weeks?|months?|years?)\s+(?:notice|leave|probation)/gi);
  if (timeMatches) entities.push(...timeMatches);

  return [...new Set(entities)];  // Deduplicate
}

// ============================================
// Export for testing
// ============================================

export const TEST_EXPORTS = {
  estimateTokens,
  extractKeywords,
  extractKeyPhrases,
  extractEntities,
  extractClauseRef,
  detectHeading,
  detectListItem,
  buildTitlePath,
  CHUNKING_STRATEGIES,
};
