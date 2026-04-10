/**
 * Knowledge & Policy Agent
 * Handles policy document search, grounded answers with citations.
 * Data source: policy-store.ts (POC; production: Supabase)
 * Deterministic logic only — no AI reasoning.
 */

import type { AgentResult, AgentContext, AgentIntent, PolicyDocument } from '@/types';
import type { Agent } from './base';
import { createAgentResult, createErrorResult } from './base';
import {
  policyDocuments,
  getPolicyDocumentById,
  getPolicyChunksByDocument,
  searchPolicyChunks,
  generatePolicyAnswer,
  filterChunksByAudience,
  initializePolicyStore,
} from '@/lib/data/policy-store';
import {
  canViewPolicy,
} from '@/lib/auth/authorization';

// Ensure store is initialized
initializePolicyStore();

export class KnowledgeAgent implements Agent {
  readonly type = 'knowledge_policy' as const;
  readonly name = 'Knowledge & Policy Agent';
  readonly supportedIntents: AgentIntent[] = [
    'policy_search',
    'policy_answer',
    'policy_citations',
  ];
  readonly requiredPermissions = ['policy:read'];

  canHandle(intent: AgentIntent): boolean {
    return this.supportedIntents.includes(intent);
  }

  async execute(
    intent: AgentIntent,
    payload: Record<string, unknown>,
    context: AgentContext
  ): Promise<AgentResult> {
    switch (intent) {
      case 'policy_search':
        return this.search(payload, context);
      case 'policy_answer':
        return this.answer(payload, context);
      case 'policy_citations':
        return this.citations(payload, context);
      default:
        return createErrorResult(`Unsupported intent: ${intent}`);
    }
  }

  private async search(
    payload: Record<string, unknown>,
    context: AgentContext
  ): Promise<AgentResult> {
    if (!canViewPolicy(context)) {
      return createErrorResult('Not authorized to search policies', ['RBAC violation']);
    }

    const query = payload.query as string;
    const category = payload.category as string | undefined;

    if (!query) {
      return createErrorResult('Search query is required');
    }

    let results = searchPolicyChunks(query);

    // Filter by category if specified
    if (category && category !== 'all') {
      const docsInCategory = policyDocuments.filter(d => d.category === category).map(d => d.id);
      results = results.filter(r => docsInCategory.includes(r.documentId));
    }

    // Filter by role-based audience access
    const accessibleDocIds = policyDocuments
      .filter(d => {
        const chunks = getPolicyChunksByDocument(d.id);
        const accessible = filterChunksByAudience(chunks, context.role);
        return accessible.length > 0;
      })
      .map(d => d.id);

    results = results.filter(r => accessibleDocIds.includes(r.documentId));

    return createAgentResult(results, {
      summary: `Found ${results.length} relevant policy section${results.length !== 1 ? 's' : ''}`,
      confidence: results.length > 0 ? Math.max(...results.map(r => r.relevanceScore)) : 0,
    });
  }

  private async answer(
    payload: Record<string, unknown>,
    context: AgentContext
  ): Promise<AgentResult> {
    if (!canViewPolicy(context)) {
      return createErrorResult('Not authorized to query policies', ['RBAC violation']);
    }

    const question = payload.question as string;

    if (!question) {
      return createErrorResult('Question is required');
    }

    // Generate answer from policy content
    const answer = generatePolicyAnswer(question);

    // Filter citations to only include accessible documents
    const accessibleCitations = answer.citations.filter(c => {
      const doc = policyDocuments.find(d => d.title === c.source);
      if (!doc) return true; // Keep if source not found (external refs)
      const chunks = getPolicyChunksByDocument(doc.id);
      const accessible = filterChunksByAudience(chunks, context.role);
      return accessible.length > 0;
    });

    // Check if answer requires escalation and user has permission
    if (answer.requiresEscalation && !canViewPolicy(context)) {
      return createAgentResult(
        {
          answer: 'This question requires review by HR. Please contact your HR representative.',
          confidence: 0,
          citations: [],
          requiresEscalation: true,
          escalationReason: answer.escalationReason,
        },
        {
          summary: 'Answer requires HR review',
          confidence: 0,
        }
      );
    }

    return createAgentResult(
      {
        ...answer,
        citations: accessibleCitations,
      },
      {
        summary: answer.confidence > 0.7
          ? 'High confidence answer from policy documents'
          : answer.confidence > 0.4
            ? 'Moderate confidence answer - verify with HR if needed'
            : 'Low confidence - please consult HR for accurate information',
        confidence: answer.confidence,
        citations: accessibleCitations,
      }
    );
  }

  private async citations(
    payload: Record<string, unknown>,
    context: AgentContext
  ): Promise<AgentResult> {
    if (!canViewPolicy(context)) {
      return createErrorResult('Not authorized to view policy citations', ['RBAC violation']);
    }

    const documentId = payload.documentId as string | undefined;

    if (!documentId) {
      return createErrorResult('Document ID is required');
    }

    const document = getPolicyDocumentById(documentId);
    if (!document) {
      return createErrorResult('Policy document not found');
    }

    let chunks = getPolicyChunksByDocument(documentId);
    chunks = filterChunksByAudience(chunks, context.role);

    if (chunks.length === 0) {
      return createErrorResult('Access denied: cannot view this document', ['RBAC violation']);
    }

    return createAgentResult(
      {
        citations: chunks.map(c => ({
          chunkId: c.id,
          content: c.content,
          index: c.chunk_index,
        })),
        document: {
          id: document.id,
          title: document.title,
          version: document.version,
          category: document.category,
        },
      },
      {
        summary: `${chunks.length} citation${chunks.length !== 1 ? 's' : ''} from ${document.title}`,
        confidence: 1.0,
      }
    );
  }
}
