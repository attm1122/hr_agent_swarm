# Phase 1 — Discovery Report

**Project:** `hr-agent-swarm`  
**Date:** 2026-04-18  
**Analyzer:** Kimi Code CLI  

---

## 1. Application Classification

### App Type
**Full-stack web application** — Next.js 16 App Router with server-rendered pages, API routes, and a React 19 SPA frontend. Hybrid SSR/SSG with dynamic routing for admin, employee, and AI agent endpoints.

### Language & Framework Stack
| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js | 16.2.3 |
| UI | React | 19.2.4 |
| Language | TypeScript | 5.9.3 |
| Runtime | Node.js | ≥20.0.0 |
| Styling | Tailwind CSS | 4.2.2 |
| UI Components | @base-ui/react + shadcn/ui | 1.3.0 / 4.2.0 |
| Database | Supabase (PostgreSQL) | — |
| Cache | Redis | 5.11.0 (via `redis` pkg) |
| AI/LLM | OpenAI | 6.34.0 |
| Validation | Zod | 4.3.6 |

### Runtime Targets
- **Server:** Node.js 20+ (Alpine Linux in Docker)
- **Client:** Modern browsers (no explicit browser support matrix in config)
- **TypeScript target:** ES2017 (relatively conservative; could bump to ES2022)

### Deployment Model
- **Primary:** Docker container with `output: 'standalone'`
- **Secondary:** Vercel (static + serverless functions)
- **Infrastructure:** Supabase-hosted PostgreSQL, optional Redis
- **Build output:** 71MB `.next/`, 42MB standalone

### Scale Characteristics (Inferred)
- **Multi-tenant:** Every table has `tenant_id`; RLS policies enforce isolation
- **User model:** HR admins, managers, employees with RBAC
- **Data volume:** HR data (employees, leave, documents, policies) — moderate
- **Real-time needs:** Workflow approvals, notifications (event bus pattern)
- **AI load:** OpenAI API calls for agent swarm — cost-sensitive, latency-tolerant

### External Dependencies
| Service | Purpose | Integration Point |
|---------|---------|-------------------|
| Supabase | Auth, PostgreSQL DB, RLS | `@supabase/ssr`, `@supabase/supabase-js` |
| OpenAI | LLM completions, embeddings | `src/lib/infrastructure/llm/openai-adapter.ts` |
| Redis | Caching, rate limiting, CSRF | `src/lib/infrastructure/redis/redis-cache-adapter.ts` |

**Missing integrations (ports defined but no adapters):**
- Vector search (Pinecone/pgvector — SearchPort defined but no impl)
- File storage (OneDrive mentioned in README — FileStoragePort defined but no impl)
- Notifications (email/Slack/in-app — NotificationPort defined but no impl)

---

## 2. Baseline Health

### Test Suite
```
Test Files:  31 failed (31)
Tests:       no tests executed
Duration:    7.11s (transform 98ms, environment 35.19s)
```

**Root cause:** All 31 test files fail at import time due to missing peer dependency `@testing-library/dom`. The `@testing-library/react` package requires it but it is not installed.

**Test breakdown:**
| Category | Count | Notes |
|----------|-------|-------|
| Unit tests | 25 | Mostly `.test.ts` in `src/lib/` |
| Component tests | 4 | React Testing Library |
| Page tests | 2 | Next.js page render tests |
| E2E tests | 6 | Playwright specs in `e2e/` (not run in `npm test`) |

### Linter (ESLint)
```
✖ 173 problems (20 errors, 153 warnings)
  1 error and 0 warnings potentially fixable with --fix
```

**Error categories:**
- `no-explicit-any`: 6 instances in repository files (`src/lib/repositories/supabase/`)
- `prefer-const`: 1 in `src/lib/supabase/middleware.ts`
- Test file type errors: 13 (tests out of sync with implementation)

**Warning categories:**
- `no-unused-vars`: 147 (dead imports, unused locals, test helper functions)

### Type Checker (tsc --noEmit)
**~78 TypeScript errors**, almost entirely in test files. Core source code compiles clean.

Key type mismatches:
- `AgentContext.tenantId` became required but 8 test files still construct it as optional
- `SwarmCoordinator` constructor signature changed (3-4 args) but tests pass 0-1 args
- `Session` return type changed from object to Promise but tests destructure synchronously
- Database type fixtures missing newly-required fields (`tenant_id`, `due_date`, etc.)

### Build
```
✓ Build succeeded
Static pages:    2  (/auth/login, /_not-found)
Dynamic routes:  22
API routes:      6
Build output:    71MB (.next/), 42MB (standalone)
```

### Security Audit (npm audit)
```
3 vulnerabilities (1 moderate, 2 high)
- hono <4.12.14   (moderate, HTML injection in JSX SSR)
- tar ≤7.5.10     (high, path traversal — via supabase CLI dev dependency)
```

---

## 3. Inventory

### 3.1 Dependency Graph

**Direct dependencies (21):**
```
@base-ui/react      ^1.3.0      (used: 9 files)
@supabase/ssr       ^0.10.2     (used: 3 files)
@supabase/supabase-js ^2.103.0  (used: 11 files)
@tanstack/react-table ^8.21.3   (used: 0 files)
class-variance-authority ^0.7.1 (used: 2 files)
clsx                ^2.1.1      (used: 2 files)
date-fns            ^4.1.0      (used: 0 files)
framer-motion       ^12.38.0    (used: 0 files)
lucide-react        ^1.8.0      (used: 28 files)
next                16.2.3      (used: 89 files)
openai              ^6.34.0     (used: 1 file)
react               19.2.4      (used: 64 files)
react-dom           19.2.4      (used: 0 direct)
recharts            ^3.8.1      (used: 0 files)
redis               ^5.11.0     (used: 8 files)
shadcn              ^4.2.0      (used: 0 files — CLI tool, should be devDep)
tailwind-merge      ^3.5.0      (used: 1 file)
tw-animate-css      ^1.4.0      (used: 0 files)
zod                 ^4.3.6      (used: 2 files)
```

**Likely unused production deps:** `@tanstack/react-table`, `date-fns`, `framer-motion`, `recharts`, `tw-animate-css`

**Missing peer dependency:** `@testing-library/dom` (required by `@testing-library/react`)

**Extraneous transitive deps detected by npm:** `@emnapi/*`, `@napi-rs/wasm-runtime`, `@tybys/wasm-util`

### 3.2 Module / Package Structure

```
src/
├── app/                (42 files) — Next.js App Router pages + API routes
├── components/         (28 files) — React UI components
├── lib/
│   ├── agents/         (16 files, ~120KB) — AI agent implementations
│   ├── application/    (0 files, 0 LOC) — ⚠️ EMPTY (commands/queries)
│   ├── auth/           (7 files) — Session, authorization, team scope
│   ├── data/           (2 files) — Mock data + mock data tests
│   ├── domain/         (0 files, 0 LOC) — ⚠️ EMPTY (domain entities/values)
│   ├── infrastructure/ (8 files) — LLM, Redis, event bus adapters
│   ├── observability/  (2 files) — Telemetry, performance, health
│   ├── ports/          (4 files, 714 LOC) — Interface definitions
│   ├── rag/            (16 files, ~180KB) — RAG pipeline (chunking, retrieval)
│   ├── repositories/   (14 files) — Data access + Supabase implementations
│   ├── security/       (8 files) — Audit, rate limit, CSRF, sanitize
│   ├── services/       (4 files) — Business logic services
│   ├── supabase/       (3 files) — Client/middleware/server wrappers
│   ├── testing/        (1 file) — Test utilities
│   ├── utils/          (2 files) — General utilities + date-only
│   └── validation/     (2 files) — Zod schemas + idempotency
├── types/              (18 files, ~120KB) — TypeScript types (monolithic)
└── __tests__/          (1 file) — Vitest setup
```

**Total source:** 169 TS/TSX files, ~30,738 LOC  
**Total tests:** ~9,890 LOC across 31 test files

### 3.3 Dead Code

**Orphan test files** (test with no matching source file):
| Test File | Expected Source |
|-----------|-----------------|
| `src/components/layout/Sidebar.rbac.test.tsx` | `Sidebar.rbac.tsx` (does not exist) |
| `src/lib/security/security.test.ts` | `security.ts` (does not exist) |
| `src/lib/security/security-validation.test.ts` | `security-validation.ts` (does not exist) |
| `src/lib/auth/team-scope-consistency.test.ts` | `team-scope-consistency.ts` (does not exist) |
| `src/lib/auth/auth.integration.test.ts` | `auth.integration.ts` (does not exist) |
| `src/lib/agents/agents-rbac.test.ts` | `agents-rbac.ts` (does not exist) |
| `src/lib/agents/coordinator.persistence.test.ts` | `coordinator.persistence.ts` (does not exist) |
| `src/lib/agents/orchestration-security.test.ts` | `orchestration-security.ts` (does not exist) |

**Unused exports** (sample of confirmed dead code):
- `src/lib/date-only.ts`: `DateOnlyParts`, `parseDateOnly` (0 usages)
- `src/lib/auth/authorization.ts`: `hasSensitivityClearance`, `getScopeForRole`, `canEditEmployee`, `canViewCompensation`, `canEditCompensation`, `canViewReview`, `canEditReview`, `canViewPerformance`, `canViewReport`, `canSendCommunication`, `canAccessAdmin`, `canRunAgent`, `canViewAudit`, `canManageWorkflow`, `canManagePolicy` (0 usages each)
- `src/lib/auth/session.ts`: `SessionResolutionErrorCode`, `buildSession`, `verifyAuthConfiguration`, `getPermissionsForRole` (0 usages)
- `src/lib/utils/ids.ts`: `createSessionId`, `createIdempotencyKey` (0 usages)
- `src/lib/observability/performance.ts`: `recordMetric`, `monitorMemory`, `markPerformance`, `measurePerformance` (0 usages)
- `src/lib/observability/integration-health.ts`: `recordSyncResult`, `getSyncRecommendations` (0 usages)

### 3.4 Complexity Hotspots

**Largest files (LOC):**
| File | LOC | Concern |
|------|-----|---------|
| `src/lib/security/security-validation.test.ts` | 1,018 | Test file with dead code |
| `src/lib/auth/authorization.test.ts` | 942 | Test file out of sync |
| `src/types/rag.ts` | 939 | Monolithic type file |
| `src/lib/rag/chunking-service.ts` | 917 | Large service, single responsibility? |
| `src/lib/agents/agents-rbac.test.ts` | 807 | Orphan test |
| `src/lib/rag/parent-child-retriever.ts` | 691 | Complex retrieval logic |
| `src/lib/rag/document-governance-service.ts` | 688 | Governance + validation mixed |
| `src/lib/repositories/manager-operational-repository.ts` | 685 | Large repository |
| `src/types/index.ts` | 666 | Monolithic type barrel |
| `src/lib/rag/hr-reranker.ts` | 616 | ML/ranking logic |

**Most referenced internal modules:**
| Module | Import Count | Consumers |
|--------|-------------|-----------|
| `@/types` | 73 | Widespread |
| `@/lib/auth/authorization` | 19 | API routes, agents, components |
| `@/lib/ports` | 18 | Repositories, infrastructure |
| `@/lib/utils` | 15 | Components, utilities |
| `@/lib/data/mock-data` | 16 | Tests, stories, dev data |
| `lucide-react` | 28 | UI components |
| `next/server` | 14 | API routes |

### 3.5 Test Shape

| Aspect | Observation |
|--------|-------------|
| Unit:Integration:E2E ratio | ~25:0:6 (no pure integration tests) |
| Coverage thresholds | Statements 98%, Branches 95%, Functions 98%, Lines 98% — **unreachable** with current test failures |
| Slowest category | E2E (Playwright, not measured) |
| Flaky tests | Unknown — none execute currently |
| Test:source ratio | ~0.32 (9,890 test LOC / 30,738 source LOC) — reasonable |

**Critical finding:** Tests have not been run successfully since significant source changes. The test suite is entirely red, making it impossible to verify behavioral preservation during refactoring.

### 3.6 Observability

| Layer | Status | Notes |
|-------|--------|-------|
| Structured logging | ❌ Missing | 45 `console.*` calls scattered across codebase |
| Metrics | ❌ Missing | `src/lib/observability/performance.ts` defines functions but none are called |
| Traces | ❌ Missing | No distributed tracing |
| Health checks | ⚠️ Partial | `/api/health` exists, checks DB connectivity |
| Audit logging | ⚠️ Partial | `AuditLogPort` defined, in-memory fallback exists, no persistent adapter |

**Console usage breakdown:**
- `console.error`: 9 (API routes, auth, security)
- `console.warn`: 6 (security, rate limiting)
- `console.log`: 30 (audit flush, rate limit cleanup, integration logs)

### 3.7 Security Surface

| Boundary | Status | Notes |
|----------|--------|-------|
| Input validation | ⚠️ Partial | Zod schemas in `src/lib/validation/`, but `any` types in repositories |
| Authn | ✅ Good | Supabase Auth with session middleware |
| Authz | ✅ Good | RBAC with `AgentContext`, scope checks, sensitivity clearance |
| RLS | ✅ Good | Database-level tenant isolation |
| Secrets in code | ✅ Clean | `.env.local` ignored, no hardcoded keys found |
| Rate limiting | ⚠️ Partial | In-memory implementation; Redis adapter exists but may not be wired |
| CSRF | ⚠️ Partial | Port defined, Redis CSRF exists, but unclear if active |
| XSS/SQLi sanitization | ⚠️ Partial | `sanitize.ts` has helpers, limited evidence of usage |
| Dependency CVEs | ⚠️ 3 vulns | hono (moderate), tar via supabase CLI (2 high) |

---

## 4. Architecture Assessment

### Claimed vs. Actual Architecture

The README and docs claim **Hexagonal Architecture** with Domain → Ports → Adapters layering. The actual structure:

```
Claimed:                    Actual:
┌─────────┐                 ┌─────────┐
│  App    │                 │  App    │  ← Next.js pages, API routes
├─────────┤                 ├─────────┤
│Domain   │                 │Services │  ← Business logic in services + agents
│(empty!) │                 ├─────────┤
├─────────┤                 │  Agents │  ← AI logic directly in agents
│  Ports  │                 ├─────────┤
├─────────┤                 │  Ports  │  ← Well-defined (714 LOC)
│Adapters │                 ├─────────┤
└─────────┘                 │Adapters │  ← Supabase repos, OpenAI, Redis
                            │(infra)  │
                            └─────────┘
                            
        Domain Layer: 0 LOC  ← MISSING
        Application Layer: 0 LOC  ← MISSING
```

### Boundary Violations

1. **Direct Supabase import in agent layer:**
   - `src/lib/agents/manager-support.agent.ts:27` imports `@supabase/supabase-js` directly
   - Agents should depend on ports/factories, not concrete DB clients

2. **API routes mix patterns:**
   - `src/app/api/export/route.ts` uses `createSupabaseRepositoryFactory` (good)
   - `src/app/api/health/route.ts` calls `createAdminClient()` directly (acceptable for health check)

3. **Types monolith:**
   - `src/types/index.ts` (666 LOC) and `src/types/rag.ts` (939 LOC) are god files
   - Domain-specific types scattered in `src/types/{employee,leave,workflow,document}/`
   - Duplication between `src/types/` and `src/lib/domain/` (domain is empty)

4. **RAG subsystem is tightly coupled:**
   - 16 files in `src/lib/rag/` with deep internal interdependencies
   - No clear port boundary between RAG and the rest of the system
   - `SearchPort` defined but no implementation (Pinecone/pgvector missing)

### Dependency Direction

The repository layer correctly depends inward on ports. However:
- **Services layer** mixes business logic with data access concerns
- **Agents** contain business rules, orchestration, AND direct DB access
- **No pure domain layer** — no entities, value objects, or domain services
- **No application layer** — no command/query handlers, no use cases

### Coupling & Cohesion

**High cohesion (good):**
- `src/lib/repositories/supabase/` — all DB adapters in one place
- `src/lib/infrastructure/` — external service adapters grouped

**Low cohesion (problems):**
- `src/lib/agents/` — each agent mixes AI prompt engineering, business rules, and data access
- `src/types/` — monolithic barrel exports create false cohesion
- `src/lib/security/` — mixes audit logging, rate limiting, CSRF, sanitization, and secure adapter (5 different concerns)

---

## 5. Summary of Critical Findings

| # | Finding | Severity | Evidence |
|---|---------|----------|----------|
| 1 | **All tests fail** — missing `@testing-library/dom` | 🔴 Critical | 31/31 test suites fail at import |
| 2 | **Tests out of sync with source** — type signatures changed | 🔴 Critical | ~78 TS errors in tests, constructor arity mismatches |
| 3 | **Domain & Application layers empty** — hexagonal architecture is hollow | 🟡 High | `src/lib/domain/` and `src/lib/application/` have 0 files |
| 4 | **Unused dependencies** bloating bundle | 🟡 High | `date-fns`, `framer-motion`, `recharts`, `@tanstack/react-table`, `tw-animate-css` show 0 usages |
| 5 | **Dead exports** across auth, observability, utils | 🟡 Medium | ~40+ exported functions with 0 consumers |
| 6 | **Orphan test files** (8) with no source files | 🟡 Medium | `security.test.ts`, `agents-rbac.test.ts`, etc. |
| 7 | **Console logging instead of structured logs** | 🟡 Medium | 45 `console.*` calls in production code |
| 8 | **Duplicate scripts in package.json** | 🟢 Low | `setup` and `setup:admin` defined twice |
| 9 | **3 npm audit vulnerabilities** | 🟡 Medium | hono (moderate), tar (2 high via supabase CLI) |
| 10 | **ESLint 173 issues** (20 errors) | 🟡 Medium | `any` types in repos, unused vars |

---

## 6. Files Referenced

- `package.json` — dependency definitions, duplicate scripts
- `tsconfig.json` — ES2017 target
- `next.config.ts` — standalone output, security headers
- `vitest.config.ts` — test config with 98% coverage thresholds
- `eslint.config.mjs` — Next.js defaults only
- `src/middleware.ts` — auth session refresh
- `src/lib/domain/` — empty directory
- `src/lib/application/` — empty directory
- `src/lib/ports/` — well-defined interface contracts
- `src/lib/agents/manager-support.agent.ts` — direct Supabase import violation
- `src/lib/repositories/supabase/` — repository implementations with `any` types
- `src/lib/observability/performance.ts` — dead telemetry functions
- `src/lib/security/` — mixed concerns, console logging
- `src/types/index.ts`, `src/types/rag.ts` — monolithic type files
