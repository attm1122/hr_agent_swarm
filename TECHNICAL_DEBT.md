# Technical Debt Register

This document tracks known technical debt in the HR Agent Swarm codebase, prioritized by impact and effort to resolve.

## Debt Classification

| Severity | Description | Resolution Target |
|----------|-------------|-------------------|
| 🔴 Critical | Production blocker, security risk, or data loss potential | Immediate |
| 🟠 High | Significant impact on reliability or maintainability | Next sprint |
| 🟡 Medium | Affects developer experience or has workarounds | Within 30 days |
| 🟢 Low | Minor inconvenience, cosmetic issues | Backlog |

---

## 🔴 Critical Debt (Must Fix Before Production)

### CD-001: Production Authentication Not Implemented
**Location**: `src/lib/auth/session.ts:217-229`

```typescript
async function getProductionSession(): Promise<Session | null> {
  // TODO: Implement Clerk/Supabase Auth session resolution
  throw new Error('Production authentication is not implemented');
}
```

**Impact**: System cannot authenticate users in production.

**Acceptance Criteria**:
- [ ] Clerk or Supabase Auth integration complete
- [ ] JWT token validation implemented
- [ ] Session refresh handling
- [ ] Logout/session revocation
- [ ] Multi-factor authentication support

**Effort**: 3-5 days

---

### CD-002: Mock Data as Primary Data Source
**Location**: `src/lib/data/mock-data.ts` (entire file)

```typescript
export const employees: Employee[] = [
  { id: 'emp-001', firstName: 'Alice', /* ... */ },
  // 23 hardcoded employees
];
```

**Impact**: No data persistence. All changes lost on restart.

**Acceptance Criteria**:
- [ ] Employee repository implemented with Supabase
- [ ] Policy repository with document storage
- [ ] Workflow repository with state management
- [ ] Onboarding/Offboarding repository
- [ ] Audit log repository
- [ ] Data migration from mock to real database

**Effort**: 5-7 days

---

### CD-003: No Input Validation at API Boundaries
**Location**: All API routes

```typescript
// src/app/api/swarm/route.ts
const body = await req.json();
// ❌ No validation of body content
```

**Impact**: Injection attacks, type errors, corrupted data.

**Acceptance Criteria**:
- [ ] Zod schemas for all API inputs
- [ ] Centralized validation middleware
- [ ] Automatic error response generation
- [ ] OpenAPI spec generation from schemas

**Effort**: 2-3 days

---

### CD-004: In-Memory State Cannot Scale
**Location**: 
- `src/lib/security/rate-limit.ts:30`
- `src/lib/security/csrf.ts:23`

```typescript
const requestCounts = new Map<string, RequestCount>(); // ❌ Per-instance
const csrfTokens = new Map<string, CsrfToken>();       // ❌ Per-instance
```

**Impact**: Deploying multiple instances breaks rate limiting and CSRF protection.

**Acceptance Criteria**:
- [ ] Redis integration
- [ ] Rate limit store backed by Redis
- [ ] CSRF token store backed by Redis
- [ ] Session store backed by Redis (if not using JWT)

**Effort**: 2-3 days

---

### CD-005: No LLM Integration
**Location**: `src/lib/rag/index.ts` (interface only)

```typescript
export interface GenerationService {
  generate(context: ContextPack, options: GenerationOptions): Promise<GroundedAnswer>;
  // ❌ NO IMPLEMENTATION
}
```

**Impact**: No AI features functional.

**Acceptance Criteria**:
- [ ] OpenAI or Azure OpenAI client
- [ ] Structured output with Zod schemas
- [ ] Error handling and retries
- [ ] Token usage tracking
- [ ] Cost monitoring

**Effort**: 3-4 days

---

## 🟠 High Debt (Fix in Next Sprint)

### HD-001: No Transaction Boundaries
**Location**: `src/lib/agents/coordinator.ts`

```typescript
const result = await agent.execute(request.intent, request.payload, request.context);
// ❌ If audit log fails, agent execution is not rolled back
```

**Impact**: Data inconsistency on partial failures.

**Workaround**: None available.

**Effort**: 3-4 days

---

### HD-002: Missing Event Bus for Cross-Domain Communication
**Location**: N/A (missing infrastructure)

**Impact**: Cannot implement complex workflows across domains.

**Workaround**: Direct service calls (creates tight coupling).

**Effort**: 4-5 days

---

### HD-003: Vector Search Not Implemented
**Location**: `src/lib/rag/hybrid-retriever.ts:417`

```typescript
// ❌ PLACEHOLDER
const semanticResults: RetrievalCandidate[] = [];
```

**Impact**: RAG retrieval is non-functional.

**Workaround**: Keyword-only search.

**Effort**: 3-4 days

---

### HD-004: No Database Migration Strategy
**Location**: `src/infrastructure/database/schema.sql`

**Impact**: Schema changes require manual application.

**Workaround**: Manual SQL execution.

**Effort**: 1-2 days (Supabase CLI + GitHub Actions)

---

### HD-005: Silent Failures in Promise.allSettled
**Location**: `src/lib/agents/coordinator.ts:193-198`

```typescript
for (const outcome of settled) {
  if (outcome.status === 'fulfilled') {
    results[outcome.value.intent] = outcome.value.result;
  }
  // ❌ Rejected promises ignored
}
```

**Impact**: Partial system failures hidden from monitoring.

**Workaround**: None available.

**Effort**: 1 day

---

### HD-006: No API Idempotency
**Location**: All POST/PUT endpoints

**Impact**: Duplicate operations possible on retries.

**Workaround**: Client-side deduplication.

**Effort**: 2-3 days

---

## 🟡 Medium Debt (Within 30 Days)

### MD-001: Type Safety Issues (Explicit Any)
**Location**: 
- `src/lib/security/security-validation.test.ts:396`
- `src/lib/security/security-validation.test.ts:443`
- And 7 other locations

**Impact**: Reduced type safety, potential runtime errors.

**Workaround**: None needed (test files).

**Effort**: 1 day

---

### MD-002: No Loading States
**Location**: All dashboard pages

```typescript
// Blocking data fetch, no loading UI
const data = await getDashboardData();
```

**Impact**: Poor user experience on slow connections.

**Workaround**: None available.

**Effort**: 2-3 days

---

### MD-003: Hardcoded Routes
**Location**: `src/components/dashboard/ActionQueue.tsx:121`

```typescript
const routes: Record<string, string> = {
  onboarding: '/onboarding',
  offboarding: '/offboarding',
  // ❌ Hardcoded strings
};
```

**Impact**: Routes cannot be changed without code modification.

**Workaround**: None needed (internal tool).

**Effort**: 1 day

---

### MD-004: Missing Error Boundaries
**Location**: N/A (missing infrastructure)

**Impact**: Application crashes on unhandled errors.

**Workaround**: Global error handler.

**Effort**: 1-2 days

---

### MD-005: No Webhook Infrastructure
**Location**: N/A (missing infrastructure)

**Impact**: Cannot receive real-time updates from external systems.

**Workaround**: Polling.

**Effort**: 3-4 days

---

## 🟢 Low Debt (Backlog)

### LD-001: Code Duplication in Repositories
**Location**: All repository files

**Impact**: Maintenance overhead.

**Workaround**: None needed.

**Effort**: 2-3 days (refactor into base class)

---

### LD-002: Missing Integration Tests
**Location**: Test suite

**Impact**: Cannot verify full user flows.

**Workaround**: Manual testing.

**Effort**: 5-7 days

---

### LD-003: No Performance Budgets
**Location**: N/A

**Impact**: Performance regressions not caught early.

**Workaround**: Manual monitoring.

**Effort**: 1-2 days (add to CI)

---

## Debt Metrics

| Category | Count | Est. Effort (days) |
|----------|-------|-------------------|
| 🔴 Critical | 5 | 15-22 |
| 🟠 High | 6 | 14-19 |
| 🟡 Medium | 5 | 8-11 |
| 🟢 Low | 3 | 8-12 |
| **Total** | **19** | **45-64** |

---

## Debt Paydown Schedule

### Sprint 1 (Weeks 1-2): Critical Debt
- CD-001: Production Authentication
- CD-003: Input Validation
- CD-004: Redis Integration

### Sprint 2 (Weeks 3-4): Critical + High Debt
- CD-002: Real Data Layer
- CD-005: LLM Integration
- HD-004: Migration Strategy

### Sprint 3 (Weeks 5-6): High Debt
- HD-001: Transaction Boundaries
- HD-003: Vector Search
- HD-005: Error Handling

### Sprint 4 (Weeks 7-8): Medium Debt
- MD-001: Type Safety
- MD-002: Loading States
- HD-002: Event Bus

---

## How to Add New Debt

When discovering new technical debt:

1. **Create a ticket** with:
   - Location (file:line)
   - Impact description
   - Workaround (if any)
   - Suggested fix
   - Estimated effort

2. **Classify severity** based on:
   - Production impact
   - Security implications
   - Maintenance burden

3. **Update this document** with the new entry.

---

## Last Updated

2024-01-15 by Architecture Audit
