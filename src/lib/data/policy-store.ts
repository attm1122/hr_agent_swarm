/**
 * Policy & Knowledge Data Store
 * In-memory store for policy documents and chunks (POC).
 * Production: Replace with Supabase database calls.
 */

import type { PolicyDocument, PolicyChunk, PolicySearchResult, PolicyAnswer } from '@/types';

// In-memory stores
export const policyDocuments: PolicyDocument[] = [];
export const policyChunks: PolicyChunk[] = [];

// Initialize with sample policy data
export function initializePolicyStore(): void {
  const now = new Date().toISOString();

  // Sample leave policy
  const leavePolicyId = 'pd-001';
  policyDocuments.push({
    id: leavePolicyId,
    title: 'Employee Leave Policy',
    category: 'leave',
    version: '2.1',
    effective_date: '2024-01-01',
    source_url: null,
    content_hash: 'abc123',
    created_at: now,
    updated_at: now,
  });

  policyChunks.push(
    {
      id: 'pc-001',
      document_id: leavePolicyId,
      chunk_index: 0,
      content: 'Annual leave entitlement: Full-time employees receive 20 days of annual leave per year. Leave accrues monthly at 1.67 days per month.',
      embedding: null,
      metadata: { audience: ['all'] },
      created_at: now,
      updated_at: now,
    },
    {
      id: 'pc-002',
      document_id: leavePolicyId,
      chunk_index: 1,
      content: 'Leave approval process: All leave requests must be submitted through the HR system and approved by your direct manager at least 2 weeks in advance for planned leave.',
      embedding: null,
      metadata: { audience: ['all'] },
      created_at: now,
      updated_at: now,
    },
    {
      id: 'pc-003',
      document_id: leavePolicyId,
      chunk_index: 2,
      content: 'Sick leave: Employees are entitled to 10 days of sick leave per year. Sick leave does not accumulate. A medical certificate is required for absences of 3 or more consecutive days.',
      embedding: null,
      metadata: { audience: ['all'] },
      created_at: now,
      updated_at: now,
    }
  );

  // Sample onboarding policy
  const onboardingPolicyId = 'pd-002';
  policyDocuments.push({
    id: onboardingPolicyId,
    title: 'Employee Onboarding Guide',
    category: 'onboarding',
    version: '1.5',
    effective_date: '2024-06-01',
    source_url: null,
    content_hash: 'def456',
    created_at: now,
    updated_at: now,
  });

  policyChunks.push(
    {
      id: 'pc-004',
      document_id: onboardingPolicyId,
      chunk_index: 0,
      content: 'Onboarding timeline: New employees must complete all onboarding tasks within their first 14 days. The onboarding plan is created by HR and assigned to the hiring manager.',
      embedding: null,
      metadata: { audience: ['admin', 'manager'] },
      created_at: now,
      updated_at: now,
    },
    {
      id: 'pc-005',
      document_id: onboardingPolicyId,
      chunk_index: 1,
      content: 'Required documents: New hires must provide proof of identity, tax forms, bank details, and emergency contact information before their first day.',
      embedding: null,
      metadata: { audience: ['all'] },
      created_at: now,
      updated_at: now,
    },
    {
      id: 'pc-006',
      document_id: onboardingPolicyId,
      chunk_index: 2,
      content: 'IT setup: IT department will provision laptop, email account, and system access. This must be completed by day 1 of employment.',
      embedding: null,
      metadata: { audience: ['all'] },
      created_at: now,
      updated_at: now,
    }
  );

  // Sample offboarding policy
  const offboardingPolicyId = 'pd-003';
  policyDocuments.push({
    id: offboardingPolicyId,
    title: 'Employee Exit and Offboarding Policy',
    category: 'offboarding',
    version: '1.2',
    effective_date: '2024-03-01',
    source_url: null,
    content_hash: 'ghi789',
    created_at: now,
    updated_at: now,
  });

  policyChunks.push(
    {
      id: 'pc-007',
      document_id: offboardingPolicyId,
      chunk_index: 0,
      content: 'Notice period: Standard notice period is 4 weeks for permanent employees. Notice must be submitted in writing to your manager and HR.',
      embedding: null,
      metadata: { audience: ['all'] },
      created_at: now,
      updated_at: now,
    },
    {
      id: 'pc-008',
      document_id: offboardingPolicyId,
      chunk_index: 1,
      content: 'Exit checklist: All employees must complete an exit interview, return company assets (laptop, badge, credit card), and complete knowledge transfer documentation.',
      embedding: null,
      metadata: { audience: ['all'] },
      created_at: now,
      updated_at: now,
    },
    {
      id: 'pc-009',
      document_id: offboardingPolicyId,
      chunk_index: 2,
      content: 'Final paycheck: Final pay will be processed on the next regular payroll cycle. Any unused annual leave will be paid out in accordance with local labor laws.',
      embedding: null,
      metadata: { audience: ['all'] },
      created_at: now,
      updated_at: now,
    }
  );

  // Performance review policy
  const performancePolicyId = 'pd-004';
  policyDocuments.push({
    id: performancePolicyId,
    title: 'Performance Review Process',
    category: 'performance',
    version: '3.0',
    effective_date: '2024-01-01',
    source_url: null,
    content_hash: 'jkl012',
    created_at: now,
    updated_at: now,
  });

  policyChunks.push(
    {
      id: 'pc-010',
      document_id: performancePolicyId,
      chunk_index: 0,
      content: 'Review cycle: Performance reviews are conducted annually in Q4. Mid-year check-ins are encouraged but not mandatory.',
      embedding: null,
      metadata: { audience: ['all'] },
      created_at: now,
      updated_at: now,
    },
    {
      id: 'pc-011',
      document_id: performancePolicyId,
      chunk_index: 1,
      content: 'Probation reviews: New employees have a 90-day probation period. A formal review must be conducted before day 90 to confirm employment or extend probation.',
      embedding: null,
      metadata: { audience: ['manager', 'admin'] },
      created_at: now,
      updated_at: now,
    }
  );
}

// Helper functions
export function getPolicyDocumentById(id: string): PolicyDocument | undefined {
  return policyDocuments.find(d => d.id === id);
}

export function getPolicyChunksByDocument(documentId: string): PolicyChunk[] {
  return policyChunks
    .filter(c => c.document_id === documentId)
    .sort((a, b) => a.chunk_index - b.chunk_index);
}

export function searchPolicyChunks(query: string): PolicySearchResult[] {
  const searchTerms = query.toLowerCase().split(' ').filter(t => t.length > 2);
  const results: PolicySearchResult[] = [];

  policyChunks.forEach(chunk => {
    const content = chunk.content.toLowerCase();
    let relevanceScore = 0;

    searchTerms.forEach(term => {
      if (content.includes(term)) {
        relevanceScore += 1;
        // Boost score for exact phrase matches
        if (content.includes(term + ' ')) relevanceScore += 0.5;
      }
    });

    if (relevanceScore > 0) {
      const document = getPolicyDocumentById(chunk.document_id);
      results.push({
        chunkId: chunk.id,
        documentId: chunk.document_id,
        documentTitle: document?.title || 'Unknown',
        chunkIndex: chunk.chunk_index,
        content: chunk.content,
        relevanceScore: Math.min(relevanceScore / searchTerms.length, 1),
        citations: [{ source: document?.title || 'Policy', reference: `v${document?.version || '1.0'}` }],
      });
    }
  });

  return results
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 5);
}

export function generatePolicyAnswer(query: string): PolicyAnswer {
  const results = searchPolicyChunks(query);

  if (results.length === 0) {
    return {
      answer: 'I could not find any relevant policy information for your question. Please contact HR for assistance.',
      confidence: 0,
      citations: [],
      relatedQuestions: [],
      requiresEscalation: true,
      escalationReason: 'No relevant policy content found',
    };
  }

  // Simple answer generation based on top result
  const topResult = results[0];
  const confidence = topResult.relevanceScore;

  let answer: string;
  if (confidence > 0.7) {
    answer = `Based on the ${topResult.documentTitle}: ${topResult.content}`;
  } else if (confidence > 0.4) {
    answer = `I found some relevant information from ${topResult.documentTitle}: ${topResult.content}. For complete details, please refer to the full policy document.`;
  } else {
    answer = `I found limited information that may be relevant: ${topResult.content}. I recommend reviewing the full policy or contacting HR for clarification.`;
  }

  // Generate related questions
  const relatedQuestions = results
    .slice(1, 3)
    .map(r => `What does the policy say about ${r.documentTitle.toLowerCase()}?`);

  return {
    answer,
    confidence,
    citations: results.slice(0, 3).flatMap(r => r.citations),
    relatedQuestions,
    requiresEscalation: confidence < 0.5,
    escalationReason: confidence < 0.5 ? 'Low confidence match - manual review recommended' : undefined,
  };
}

export function getPolicyCategories(): string[] {
  return [...new Set(policyDocuments.map(d => d.category))];
}

export function getPoliciesByCategory(category: string): PolicyDocument[] {
  return policyDocuments.filter(d => d.category === category);
}

export function filterChunksByAudience(chunks: PolicyChunk[], role: string): PolicyChunk[] {
  return chunks.filter(chunk => {
    const audience = (chunk.metadata as { audience?: string[] })?.audience;
    if (!audience || audience.includes('all')) return true;
    return audience.includes(role);
  });
}

// Initialize on module load
initializePolicyStore();
