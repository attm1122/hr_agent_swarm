# Phase 2 — Priorities Document

**Project:** `hr-agent-swarm`  
**Date:** 2026-04-18  
**App Type:** Full-stack web application (Next.js 16 App Router + React 19, SSR/SSG hybrid)  

---

## How Priorities Were Derived

For a **full-stack Next.js HR management app**, the optimization matrix prioritizes:

1. **Testability** — Must be green before any refactoring (rule #4)
2. **Type safety** — Prevents runtime errors in auth/security boundaries
3. **Bundle/dependency hygiene** — Directly affects deploy time and cold-start latency
4. **Security boundaries** — Authn/authz, input validation, audit logging
5. **Architectural alignment** — Hexagonal claims must match reality for maintainability
6. **Observability** — Structured logs required for production debugging

Items are ranked by **impact × effort** (highest ROI first).

---

## Priority 1: Restore Test Suite (Critical — Foundation)

| | |
|---|---|
| **Observed Problem** | All 31 test suites fail at import time. `@testing-library/react` requires `@testing-library/dom` as a peer dependency, which is not installed. Additionally, source code evolved (constructor signatures, required fields, return types) while tests were left stale. |
| **Evidence** | `npm test` output: `Error: Cannot find module '@testing-library/dom'`. 78 TypeScript errors in test files: `SwarmCoordinator` now takes 3-4 args (tests pass 0-1), `AgentContext.tenantId` is now required (tests omit it), `Session` return type changed (tests destructure synchronously). See `src/lib/agents/coordinator.persistence.test.ts:214`, `src/lib/auth/session.test.ts:41`, `src/types/database.test.ts:63`. |
| **Proposed Fix** | 1. `npm install -D @testing-library/dom`. 2. Fix constructor call arity in `coordinator.persistence.test.ts` and `orchestration-security.test.ts`. 3. Add `tenantId` to all `AgentContext` fixtures. 4. Fix `session.test.ts` to await async returns. 5. Update database type fixtures to include newly-required fields (`tenant_id`, `due_date`, etc.). 6. Remove/adjust tests for removed methods (`queryAgentRuns`, `getAuditLog`, `isUsingPersistence`). |
| **Expected Improvement** | 31 → 0 import failures. Tests become a safety net for all subsequent refactors. Coverage thresholds (98%) become meaningful again. |
| **Risk** | Low. Only touches test files and dev dependencies. No production behavior changes. |
| **Effort** | Medium (~2-4 hours). Mechanical but spread across 8+ test files. |

---

## Priority 2: Prune Unused Dependencies

| | |
|---|---|
| **Observed Problem** | 5+ production dependencies appear completely unused in source code, bloating `node_modules`, install time, and the Docker image. `shadcn` is a CLI scaffolding tool and should be a dev dependency. |
| **Evidence** | Source grep shows 0 usages for: `@tanstack/react-table`, `date-fns`, `framer-motion`, `recharts`, `tw-animate-css`. `shadcn` (CLI) in `dependencies`. `package.json` lines: `dependencies` block. |
| **Proposed Fix** | 1. Remove confirmed unused deps from `dependencies`: `@tanstack/react-table`, `date-fns`, `framer-motion`, `recharts`, `tw-animate-css`. 2. Move `shadcn` to `devDependencies`. 3. Run `npm test`, `npm run build`, `npm run typecheck` to verify no hidden imports. 4. Update `package-lock.json`. |
| **Expected Improvement** | Smaller `node_modules` (est. 15-30MB reduction), faster `npm ci` in Docker, smaller attack surface, clearer dependency graph. |
| **Risk** | Low-Medium. Must verify no dynamic imports or runtime requires hide usage. Build + typecheck + test pass is sufficient proof. |
| **Effort** | Low (~15 minutes). |

---

## Priority 3: Fix ESLint Errors and Reduce Warning Noise

| | |
|---|---|
| **Observed Problem** | 20 ESLint errors block CI (or would, if CI ran lint). 153 warnings create noise that hides real issues. `any` types in repositories undermine type safety at data boundaries. |
| **Evidence** | `src/lib/repositories/supabase/leave-repository.ts:105` and `:118` — `Unexpected any`. `src/lib/repositories/supabase/milestone-repository.ts:101` — `Unexpected any`. `src/lib/repositories/supabase/workflow-repository.ts:130` and `:148` — `Unexpected any`. `src/lib/supabase/middleware.ts:9` — `prefer-const`. `security-validation.test.ts` — 2 `any` usages. |
| **Proposed Fix** | 1. Replace `any` in repositories with proper Supabase-generated types or `unknown` with runtime validation. 2. Fix `prefer-const` in middleware. 3. Fix `any` in test files with proper mock types. 4. Consider suppressing `no-unused-vars` in test files (vitest globals) via ESLint config override. |
| **Expected Improvement** | 20 errors → 0. Type safety restored at repository boundaries. Cleaner CI output. |
| **Risk** | Low. Type-only changes; no runtime behavior change if types are correct. |
| **Effort** | Low (~30-45 minutes). |

---

## Priority 4: Replace Console Logging with Structured Observability

| | |
|---|---|
| **Observed Problem** | 45 `console.*` calls scattered across production code. No correlation IDs, no log levels, no structured format. Audit logs, security events, and rate-limiting stats are indistinguishable from each other. Production log aggregation will be painful. |
| **Evidence** | `src/lib/security/audit-logger.ts`: `console.log('[AUDIT_FLUSH]', ...)`, `console.error('[CRITICAL AUDIT FAILURE]', ...)`. `src/lib/security/rate-limit.ts`: `console.log('[RATE_LIMIT] Cleaned...')`. `src/app/api/*`: `console.error('...error:', error)`. Full list in `docs/refactor/01-discovery.md` §3.6. |
| **Proposed Fix** | 1. Introduce a lightweight logger interface (`src/lib/observability/logger.ts`) with `debug/info/warn/error` levels and structured JSON output. 2. Replace all `console.*` calls with the logger. 3. Include `correlationId`, `tenantId`, and `component` fields. 4. For API routes, extract or generate correlation ID from request headers. 5. Use `NODE_ENV` to control log level (debug in dev, info in prod). |
| **Expected Improvement** | Production logs become queryable and filterable. Security audit events are machine-parseable. Debugging production issues becomes possible. |
| **Risk** | Low. Behaviorally equivalent — still writes to stdout. Risk is only in log format change affecting any external log parsers (none known). |
| **Effort** | Medium (~1-2 hours). Mechanical replacement across ~15 files. |

---

## Priority 5: Fix Security Vulnerabilities

| | |
|---|---|
| **Observed Problem** | `npm audit` reports 3 vulnerabilities: 1 moderate (`hono` HTML injection), 2 high (`tar` path traversal via `supabase` CLI). The `tar` vulns are in a dev dependency (Supabase CLI) but still appear in audit reports and could concern security reviewers. |
| **Evidence** | `npm audit --audit-level=moderate` output. `hono` is a transitive dependency (likely via `next` or `eslint-config-next`). `tar` is pulled in by `supabase@1.226.4`. |
| **Proposed Fix** | 1. Run `npm audit fix` for `hono` (non-breaking). 2. Evaluate whether `supabase` CLI can be updated to a version with patched `tar` (may be breaking; test first). 3. If Supabase CLI update is too risky, document the vulnerability as a dev-only exposure and plan for a future upgrade. |
| **Expected Improvement** | Clean audit report. Reduced security review friction. |
| **Risk** | Low for `hono` fix. Medium for `supabase` CLI update (breaking change potential). |
| **Effort** | Low (~15-30 minutes). |

---

## Priority 6: Consolidate Type Monoliths

| | |
|---|---|
| **Observed Problem** | `src/types/index.ts` (666 LOC) and `src/types/rag.ts` (939 LOC) are "god files" that every module imports. This creates tight coupling, slow type-checking, and merge conflicts. Domain-specific types are further split into `src/types/{employee,leave,workflow,document}/` subdirectories, creating a confusing dual structure. |
| **Evidence** | 73 imports of `@/types` across the codebase. `src/types/index.ts` exports everything. `src/types/rag.ts` is nearly 1000 lines of RAG-specific types that could live with the RAG module. |
| **Proposed Fix** | **Strangler-fig approach:** 1. Move RAG types from `src/types/rag.ts` into `src/lib/rag/types.ts`. 2. Move domain entity types from `src/types/index.ts` into `src/lib/domain/` subdirectories (create the missing domain layer incrementally). 3. Update barrel exports in `src/types/index.ts` to re-export from new locations. 4. Update imports in consuming modules. 5. After all consumers migrate, remove the old monolithic files. |
| **Expected Improvement** | Faster type-checking. Better cohesion (types live with their domain). Reduced merge conflicts. Establishes the missing domain layer incrementally. |
| **Risk** | Medium. Wide blast radius (73 imports). Must be done in small, test-verified steps. Import path aliases (`@/types`) make the migration feasible. |
| **Effort** | Medium-High (~3-4 hours, but can be split across multiple commits). |

---

## Priority 7: Remove Dead Code

| | |
|---|---|
| **Observed Problem** | ~40 exported functions/types have 0 usages outside their defining file. 8 test files are "orphans" (no corresponding source). Dead code increases cognitive load, bundle size (though tree-shaking helps), and maintenance surface. |
| **Evidence** | See `docs/refactor/01-discovery.md` §3.3 for full list. Notable: `src/lib/auth/authorization.ts` exports 15 permission helpers none of which are imported. `src/lib/observability/performance.ts` defines 4 metrics functions that are never called. Orphan tests: `Sidebar.rbac.test.tsx`, `security.test.ts`, `agents-rbac.test.ts`, etc. |
| **Proposed Fix** | 1. Delete 8 orphan test files. 2. For each dead export, verify with `grep -r` that it truly has 0 consumers. 3. Remove dead exports. 4. If any are intended for future use, move to a `__future__/` directory or document in an issue instead of keeping in source. |
| **Expected Improvement** | Smaller codebase, faster grep/search, less confusion for new contributors. |
| **Risk** | Low. Only remove code with confirmed 0 usages. Git history preserves everything if we need it back. |
| **Effort** | Low (~30-45 minutes). |

---

## Priority 8: Establish Application Layer (Architectural)

| | |
|---|---|
| **Observed Problem** | The README claims "Hexagonal Architecture" but `src/lib/domain/` and `src/lib/application/` are completely empty (0 LOC). Business logic is split between agents (AI orchestration + business rules) and services (data + business rules). The domain has no pure entities, value objects, or domain services. The application has no command/query handlers or use cases. This means the architecture is not actually hexagonal — it's a layered architecture with a well-defined infrastructure layer but missing its core. |
| **Evidence** | `find src/lib/domain -type f | wc -l` → 0. `find src/lib/application -type f | wc -l` → 0. Business logic visible in `src/lib/agents/*.agent.ts` and `src/lib/services/*.service.ts`. `src/lib/agents/manager-support.agent.ts:27` imports `@supabase/supabase-js` directly — a boundary violation. |
| **Proposed Fix** | **Strangler-fig, not big-bang:** 1. Identify the smallest, most stable business rule (e.g., leave balance calculation or employee status transitions). 2. Extract it from its current location (likely an agent or service) into a pure function in `src/lib/domain/leave/` or `src/lib/domain/employee/`. 3. Write characterization tests pinning the current behavior. 4. Refactor the agent/service to call the new domain function. 5. Repeat for the next rule. 6. Once domain functions exist, wrap them in command/query handlers in `src/lib/application/`. 7. Over time, API routes call application handlers, which call domain logic, which uses ports — restoring the dependency direction. |
| **Expected Improvement** | Business rules become testable without spinning up Supabase or OpenAI. Domain logic becomes reusable across agents and API routes. New developers can understand "what the system does" by reading `src/lib/domain/` without wading through AI prompts and DB queries. |
| **Risk** | High if done as a big-bang. Low if done incrementally. Each extraction is a small, testable change. Risk of over-engineering: we must only extract *genuine* business rules, not data access or AI orchestration. |
| **Effort** | High overall, but split into ~10-15 small commits of 30-60 min each. Not a single PR. |

---

## Priority 9: Clean Up package.json

| | |
|---|---|
| **Observed Problem** | `setup` and `setup:admin` scripts are defined twice in `package.json` (lines 22/25 and 23/26). The duplicate keys mean the second definition silently overwrites the first — it works, but it's a smell that suggests manual editing or merge errors. |
| **Evidence** | `grep -n '"setup"' package.json` shows duplicates at lines 22 and 25. Same for `setup:admin` at 23 and 26. |
| **Proposed Fix** | Remove duplicate script entries. Verify with `node -e "console.log(Object.keys(require('./package.json').scripts))"` that each script name appears once. |
| **Expected Improvement** | Clean `package.json`. Eliminates confusion about which script definition is active. |
| **Risk** | None. |
| **Effort** | Trivial (~2 minutes). |

---

## Priority 10: Add Integration Test Coverage for Critical Flows

| | |
|---|---|
| **Observed Problem** | The test pyramid is inverted: 25 unit tests, 0 integration tests, 6 E2E tests. Unit tests mock everything; E2E tests are expensive and flaky. There's no middle layer testing API routes with real (test) database interactions, which means the repository → port → adapter wiring is never verified in CI. |
| **Evidence** | `vitest.config.ts` includes only `src/**/*.test.{ts,tsx}`. No integration test directory. API routes (`src/app/api/`) have unit tests but those tests likely mock the repository factory. |
| **Proposed Fix** | 1. After tests are green (Priority 1), add a lightweight integration test for one critical flow: e.g., `POST /api/swarm` → coordinator → agent → repository → Supabase (using a test tenant). 2. Use `supabase` test helpers or an in-memory stub for the database. 3. This is Phase 5 work — only tackle after Priorities 1-7 are done. |
| **Expected Improvement** | Confidence that the port/adapter wiring works end-to-end. Faster feedback than E2E. Catches "it compiles but doesn't run" bugs. |
| **Risk** | Low, but effort is medium. Defer to Phase 5. |
| **Effort** | Medium (~2-3 hours). |

---

## Execution Sequence

The priorities above are **intentionally ordered as a dependency chain**:

```
Priority 1 (Tests green)
    ↓
Priority 2 (Deps pruned) ─┬─→ Priority 3 (Lint clean)
    ↓                     │
Priority 4 (Logging)      │     Priority 5 (Audit clean)
    ↓                     │         ↓
Priority 6 (Types) ←──────┘     Priority 7 (Dead code)
    ↓                                 ↓
Priority 8 (Domain layer) ←───────────┘
    ↓
Priority 9 (package.json) — can happen anytime
    ↓
Priority 10 (Integration tests) — Phase 5
```

**Rationale:** We cannot safely refactor types (Priority 6) or extract domain logic (Priority 8) without tests. We cannot safely remove dead code (Priority 7) until we know tests don't reference it. The domain layer extraction (Priority 8) depends on understanding which code is actually dead vs. just untested.

---

## What We Are NOT Doing (And Why)

| Item | Reason |
|------|--------|
| **Next.js 15→16 migration** | Already on 16.2.3. No upgrade needed. |
| **React 18→19 migration** | Already on 19.2.4. |
| **Switch to App Router** | Already using App Router. |
| **Add caching layer (Redis)** | Redis adapter exists but may not be wired. Adding caching without metrics/observability first is premature optimization. |
| **Implement missing ports** (SearchPort, FileStoragePort, NotificationPort) | These are feature gaps, not refactor targets. Out of scope. |
| **Add CI/CD pipeline** | No CI config detected. Important but out of scope for codebase refactoring. |
| **Database schema changes** | No schema issues identified. RLS and tenant isolation are well-designed. |
| **Replace Zod with another validator** | Zod 4 is current and working fine. No pain point. |
| **Bundle splitting / code splitting** | Build is 71MB which is reasonable for a full-stack Docker image. No perf complaints. |
