/**
 * Policy & Knowledge Data Store
 *
 * A thin abstraction that gives agents a single read API over either the
 * Supabase `policy_documents` / `policy_chunks` tables (in production) or
 * the in-memory mock data (in dev / when Supabase isn't configured yet).
 *
 * Usage:
 *   const store = getPolicyStore();
 *   const docs = await store.getAllDocuments('tenant-leap');
 *
 * The search / answer / filterChunksByAudience helpers are pure functions
 * re-exported from this module for backward compatibility.
 */

import type { PolicyDocument, PolicyChunk } from '@/lib/domain/document/types';
import type { PolicySearchResult, PolicyAnswer } from '@/types';

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000000';

// ==========================================
// Pure helpers (used in both mock and agent)
// ==========================================

export function searchPolicyChunks(query: string, documents: PolicyDocument[], chunks: PolicyChunk[]): PolicySearchResult[] {
  const searchTerms = query.toLowerCase().split(' ').filter(t => t.length > 2);
  const results: PolicySearchResult[] = [];

  chunks.forEach(chunk => {
    const content = chunk.content.toLowerCase();
    let relevanceScore = 0;

    searchTerms.forEach(term => {
      if (content.includes(term)) {
        relevanceScore += 1;
        if (content.includes(term + ' ')) relevanceScore += 0.5;
      }
    });

    if (relevanceScore > 0) {
      const document = documents.find(d => d.id === chunk.document_id);
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

export function generatePolicyAnswer(query: string, documents: PolicyDocument[], chunks: PolicyChunk[]): PolicyAnswer {
  const results = searchPolicyChunks(query, documents, chunks);

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

export function filterChunksByAudience(chunks: PolicyChunk[], role: string): PolicyChunk[] {
  return chunks.filter(chunk => {
    const audience = (chunk.metadata as { audience?: string[] })?.audience;
    if (!audience || audience.includes('all')) return true;
    return audience.includes(role);
  });
}

// ==========================================
// In-memory mock data
// ==========================================

export const policyDocuments: PolicyDocument[] = [];
export const policyChunks: PolicyChunk[] = [];

function seedMockData(): void {
  if (policyDocuments.length > 0) return; // already seeded
  const now = new Date().toISOString();

  // Sample leave policy
  const leavePolicyId = 'pd-001';
  policyDocuments.push({
    id: leavePolicyId,
    tenant_id: DEFAULT_TENANT_ID,
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
      tenant_id: DEFAULT_TENANT_ID,
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
      tenant_id: DEFAULT_TENANT_ID,
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
      tenant_id: DEFAULT_TENANT_ID,
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
    tenant_id: DEFAULT_TENANT_ID,
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
      tenant_id: DEFAULT_TENANT_ID,
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
      tenant_id: DEFAULT_TENANT_ID,
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
      tenant_id: DEFAULT_TENANT_ID,
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
    tenant_id: DEFAULT_TENANT_ID,
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
      tenant_id: DEFAULT_TENANT_ID,
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
      tenant_id: DEFAULT_TENANT_ID,
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
      tenant_id: DEFAULT_TENANT_ID,
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
    tenant_id: DEFAULT_TENANT_ID,
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
      tenant_id: DEFAULT_TENANT_ID,
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
      tenant_id: DEFAULT_TENANT_ID,
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

// ==========================================
// Store interface
// ==========================================

export interface PolicyStore {
  readonly backend: 'supabase' | 'mock';
  getAllDocuments(tenantId: string): Promise<PolicyDocument[]>;
  getDocumentById(id: string, tenantId: string): Promise<PolicyDocument | null>;
  getDocumentsByCategory(category: string, tenantId: string): Promise<PolicyDocument[]>;
  getChunksByDocument(documentId: string, tenantId: string): Promise<PolicyChunk[]>;
  getAllChunks(tenantId: string): Promise<PolicyChunk[]>;
}

// ==========================================
// Mock-backed implementation
// ==========================================

const mockStore: PolicyStore = {
  backend: 'mock',

  async getAllDocuments() {
    seedMockData();
    return [...policyDocuments];
  },
  async getDocumentById(id: string) {
    seedMockData();
    return policyDocuments.find(d => d.id === id) ?? null;
  },
  async getDocumentsByCategory(category: string) {
    seedMockData();
    return policyDocuments.filter(d => d.category === category);
  },
  async getChunksByDocument(documentId: string) {
    seedMockData();
    return policyChunks
      .filter(c => c.document_id === documentId)
      .sort((a, b) => a.chunk_index - b.chunk_index);
  },
  async getAllChunks() {
    seedMockData();
    return [...policyChunks];
  },
};

// ==========================================
// Supabase-backed implementation
// ==========================================

function createSupabaseStore(): PolicyStore {
  const adminClientPromise = import('@/infrastructure/database/client').then(
    (m) => m.createAdminClient(),
  );

  const table = async (name: string) => {
    const client = await adminClientPromise;
    return (client as unknown as { from: (n: string) => unknown }).from(name);
  };

  return {
    backend: 'supabase',

    async getAllDocuments(tenantId: string) {
      const t = (await table('policy_documents')) as {
        select: (c: string) => {
          eq: (c: string, v: string) => Promise<{ data: unknown[]; error: unknown }>;
        };
      };
      const { data, error } = await t.select('*').eq('tenant_id', tenantId);
      if (error) throw error;
      // PolicyDocument is already snake_case — no mapper needed
      return (data ?? []) as unknown as PolicyDocument[];
    },

    async getDocumentById(id: string, tenantId: string) {
      const t = (await table('policy_documents')) as {
        select: (c: string) => {
          eq: (c: string, v: string) => {
            eq: (c: string, v: string) => {
              maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
            };
          };
        };
      };
      const { data, error } = await t
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data ? (data as unknown as PolicyDocument) : null;
    },

    async getDocumentsByCategory(category: string, tenantId: string) {
      const t = (await table('policy_documents')) as {
        select: (c: string) => {
          eq: (c: string, v: string) => {
            eq: (c: string, v: string) => Promise<{ data: unknown[]; error: unknown }>;
          };
        };
      };
      const { data, error } = await t
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('category', category);
      if (error) throw error;
      return (data ?? []) as unknown as PolicyDocument[];
    },

    async getChunksByDocument(documentId: string, tenantId: string) {
      const t = (await table('policy_chunks')) as {
        select: (c: string) => {
          eq: (c: string, v: string) => {
            eq: (c: string, v: string) => {
              order: (c: string, o: { ascending: boolean }) => Promise<{ data: unknown[]; error: unknown }>;
            };
          };
        };
      };
      const { data, error } = await t
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('document_id', documentId)
        .order('chunk_index', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as PolicyChunk[];
    },

    async getAllChunks(tenantId: string) {
      const t = (await table('policy_chunks')) as {
        select: (c: string) => {
          eq: (c: string, v: string) => Promise<{ data: unknown[]; error: unknown }>;
        };
      };
      const { data, error } = await t.select('*').eq('tenant_id', tenantId);
      if (error) throw error;
      return (data ?? []) as unknown as PolicyChunk[];
    },
  };
}

// ==========================================
// Resolver
// ==========================================

function isSupabaseConfigured(): boolean {
  return (
    typeof window === 'undefined' &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );
}

let cachedStore: PolicyStore | null = null;

export function getPolicyStore(): PolicyStore {
  if (cachedStore) return cachedStore;
  cachedStore = isSupabaseConfigured() ? createSupabaseStore() : mockStore;
  return cachedStore;
}

/** For tests: reset the cached singleton so env changes take effect. */
export function __resetPolicyStore(): void {
  cachedStore = null;
}

// ==========================================
// Backward-compat exports
// ==========================================

/** @deprecated Use `getPolicyStore()` instead. */
export function getPolicyDocumentById(id: string): PolicyDocument | undefined {
  seedMockData();
  return policyDocuments.find(d => d.id === id);
}

/** @deprecated Use `getPolicyStore()` instead. */
export function getPolicyChunksByDocument(documentId: string): PolicyChunk[] {
  seedMockData();
  return policyChunks
    .filter(c => c.document_id === documentId)
    .sort((a, b) => a.chunk_index - b.chunk_index);
}

/** @deprecated Use `getPolicyStore()` instead. */
export function getPolicyCategories(): string[] {
  seedMockData();
  return [...new Set(policyDocuments.map(d => d.category))];
}

/** @deprecated Use `getPolicyStore()` instead. */
export function getPoliciesByCategory(category: string): PolicyDocument[] {
  seedMockData();
  return policyDocuments.filter(d => d.category === category);
}

/** @deprecated Kept for backward compatibility only. */
export function initializePolicyStore(): void {
  seedMockData();
}

/** @deprecated Kept for backward compatibility only. */
export function ensurePolicyStoreInitialized(): void {
  seedMockData();
}

// Auto-seed on module load for backward compat
seedMockData();
