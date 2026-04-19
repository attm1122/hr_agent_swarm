# Phase 3 — Architecture Document

**Project:** `hr-agent-swarm`  
**Date:** 2026-04-18  
**App Type:** Full-stack Next.js web application (multi-tenant HR management with AI agents)

---

## Current Architecture Assessment

### The Four-Layer Reality

The codebase claims Hexagonal Architecture but currently has only **two functioning layers** with **two empty shells**:

```
┌─────────────────────────────────────────────┐
│  Layer 4: Presentation / Transport          │
│  (Next.js App Router, API routes, React)    │
│  Status: ✅ Active, ~15,000 LOC             │
├─────────────────────────────────────────────┤
│  Layer 3: Application                       │
│  (Commands, Queries, Use Cases, DTOs)       │
│  Status: ❌ EMPTY — 0 files, 0 LOC          │
├─────────────────────────────────────────────┤
│  Layer 2: Domain                            │
│  (Entities, Value Objects, Domain Services) │
│  Status: ❌ EMPTY — 0 files, 0 LOC          │
├─────────────────────────────────────────────┤
│  Layer 1: Infrastructure / Adapters         │
│  (Supabase repos, OpenAI, Redis, Event Bus) │
│  Status: ✅ Active, ~8,000 LOC              │
│  Ports: ✅ Defined, 714 LOC                 │
└─────────────────────────────────────────────┘
```

**What this means:** The app works — it ships features, it builds, it deploys. But the architecture is **inverted** at the center. Business rules are mixed with AI orchestration (agents) and data access (services). The "hexagon" is hollow.

---

## Architectural Evaluation

### 1. Boundaries

**Does the module structure reflect the domain?**

| Area | Verdict | Evidence |
|------|---------|----------|
| **Repository layer** | ✅ Good | `src/lib/repositories/supabase/` cleanly maps domain aggregates to DB tables |
| **Agent layer** | ⚠️ Mixed | Each agent is a vertical slice (good) but mixes AI prompts, business rules, and DB access (bad) |
| **RAG subsystem** | ❌ Poor | 16 tightly-coupled files with no external boundary. `SearchPort` exists but has no implementation |
| **Security layer** | ❌ Poor | Single directory holds audit logging, rate limiting, CSRF, sanitization, and secure adapters — 5 concerns |
| **Types** | ❌ Poor | Monolithic `src/types/index.ts` and `src/types/rag.ts` are imported by everything, creating a universal coupling point |

**Are business rules separated from I/O?**

No. Examples:
- `src/lib/agents/manager-support.agent.ts:27` imports `@supabase/supabase-js` directly
- `src/lib/services/employee.service.ts` mixes business logic (`canViewEmployee`) with repository calls
- `src/lib/agents/onboarding.agent.ts` contains both workflow orchestration AND policy validation logic

### 2. Dependency Direction

**Current direction:** Infrastructure ← Presentation ← Agents/Services (inward, but skipping the center)

```
App Router / API Routes
        ↓
    Agents / Services  ←── Business logic lives HERE (wrong layer)
        ↓
   Repositories / Infra
```

**Required direction:** Infrastructure ← Application ← Domain (inward, pure at center)

```
App Router / API Routes
        ↓
   Application Layer  ←── Command/Query handlers
        ↓
    Domain Layer      ←── Pure business rules
        ↓
   Ports (interfaces)
        ↓
   Repositories / Infra
```

**The ports are correct.** `src/lib/ports/` defines clean interfaces. The problem is that **nothing sits on top of them** — agents and services bypass the domain/application layers and talk directly to infrastructure.

### 3. Coupling and Cohesion

**High cohesion (keep as-is):**
- `src/lib/repositories/supabase/` — all DB adapters grouped by aggregate
- `src/lib/infrastructure/` — external service adapters grouped by service
- `src/lib/ports/` — interfaces grouped by responsibility

**Low cohesion (refactor):**
- `src/lib/security/` — 5 unrelated concerns in one directory
  - Audit logging (observability)
  - Rate limiting (infrastructure)
  - CSRF protection (infrastructure)
  - Input sanitization (domain/application boundary)
  - Secure adapter (infrastructure)
- `src/lib/agents/` — prompt engineering, business rules, and data access mixed
- `src/types/` — monolithic barrel file with no cohesion

**Coupling hotspots:**
- `src/types/index.ts` is imported 73 times — change one type, rebuild the world
- `src/lib/auth/authorization.ts` is imported 19 times — reasonable for a cross-cutting concern
- `src/lib/ports/` is imported 18 times — correct for a boundary layer

### 4. Cycles

**No import cycles detected at the package level.** The codebase uses Next.js path aliases (`@/lib/*`, `@/types`) which prevent most cyclic imports. However:
- `src/lib/agents/index.ts` creates a singleton coordinator that imports all agents, and agents import `AgentContext` from `src/types` — this is not a cycle but creates a dense dependency graph
- The RAG subsystem has deep internal interdependencies that were not fully traced

### 5. Duplication of Concept

| Concept | Duplicated How | Evidence |
|---------|---------------|----------|
| **Tenant isolation** | In DB (RLS) + in code (every repo method takes `tenantId`) + in auth context | Triple-checking; RLS is the source of truth, code-level checks are defense-in-depth but add noise |
| **Permission checks** | `authorization.ts` has 15 `canXxx` functions, but agents also do their own capability checks | `employee-profile.agent.ts:48` — "Defense-in-depth: verify capability even if coordinator already checked" |
| **Error handling** | Some API routes throw, some return `{ error }`, some use NextResponse | Inconsistent patterns across `src/app/api/` |
| **Date handling** | `src/lib/date-only.ts` exists but `date-fns` is also a dependency (unused) | `date-fns` shows 0 usages; custom `DateOnly` type is used instead |

### 6. Leaky Abstractions

| Leak | Where | Impact |
|------|-------|--------|
| **Supabase client in agent layer** | `manager-support.agent.ts` | Agent now knows about DB connection details |
| **Next.js `cookies()` in session layer** | `src/lib/auth/session.ts` | Domain auth logic depends on Next.js request API |
| **`any` types in repositories** | `leave-repository.ts`, `milestone-repository.ts`, `workflow-repository.ts` | Type safety voided at the data boundary |
| **Direct `console.log` in audit logger** | `audit-logger.ts` | Audit logger should use an injected log port, not global console |

### 7. Seams for Testing

**Current seams:**
- ✅ Repository ports can be mocked (well-defined interfaces)
- ✅ `InMemoryCacheAdapter` exists for testing
- ✅ `InMemoryEventBus` exists for testing
- ❌ Agents have no seam — they instantiate their own dependencies
- ❌ Services have no seam — they import repositories directly
- ❌ No application layer means no "use case" objects to test in isolation

**What this means:** To test an agent, you must mock OpenAI, Supabase, and Redis. To test a service, you must mock Supabase. There is no layer where pure business rules can be tested with just unit tests.

### 8. Scalability Limits

| Assumption | Breaks at | Why |
|------------|-----------|-----|
| **In-memory rate limiting** | Single instance | `src/lib/security/rate-limit.ts` uses a Map; won't work with multiple containers |
| **In-memory audit log buffer** | High volume | `audit-logger.ts` buffers in memory with periodic flush; memory grows unbounded under load |
| **Synchronous agent initialization** | Many agents | `src/lib/agents/index.ts` initializes all agents eagerly; startup time grows linearly |
| **Monolithic type file** | Team size > 3 | `src/types/index.ts` creates constant merge conflicts |
| **No caching on hot reads** | Read-heavy workloads | Employee lookups, policy searches hit DB on every request |
| **No queue for async work** | Workflow volume | All workflow steps processed synchronously in API request |

---

## Proposed Architectural Changes

### Guiding Principles

1. **Strangler-fig, not big-bang.** Each change is a small, test-verified extraction.
2. **Behavior preservation.** No feature changes. No API contract changes.
3. **Inside-out.** Start with the smallest, purest business rule. Extract it. Test it. Move to the next.
4. **Port-first.** Every new layer depends on existing ports, never on concrete infrastructure.

### Change Sequence

#### Move A1: Rename and Split the Security Directory
**What:** Split `src/lib/security/` into coherent modules.
**Why:** 5 unrelated concerns in one directory violates SRP and makes ownership unclear.
**How:**
```
src/lib/security/
  ├── audit-logger.ts      → src/lib/infrastructure/audit/audit-logger.ts
  ├── rate-limit.ts        → src/lib/infrastructure/rate-limit/
  ├── rate-limit-redis.ts  → src/lib/infrastructure/rate-limit/
  ├── csrf.ts              → src/lib/infrastructure/csrf/
  ├── csrf-redis.ts        → src/lib/infrastructure/csrf/
  ├── sanitize.ts          → src/lib/application/validation/sanitize.ts
  ├── secure-adapter.ts    → src/lib/infrastructure/adapters/secure-adapter.ts
  └── security-middleware.ts → src/lib/infrastructure/security-middleware.ts
```
**Risk:** Low. Files are moved, not changed. Import paths updated.
**Tests:** All existing tests must pass after path updates.
**Commit:** `refactor: split security monolith into infrastructure concerns`

---

#### Move A2: Extract Pure Date/Time Value Objects
**What:** Move `src/lib/date-only.ts` into `src/lib/domain/shared/date-value.ts` and add domain-specific date operations.
**Why:** Dates are a core domain concern (hire dates, leave periods, milestone dates). Currently handled ad-hoc.
**How:**
1. Move `DateOnly` type and operations to `src/lib/domain/shared/date-value.ts`
2. Ensure `parseDateOnly`, `isBefore`, `daysBetween` are pure functions
3. Update imports in `src/lib/` consumers
4. Keep `src/lib/date-only.ts` as a re-export barrel for backward compatibility (strangler-fig)
**Risk:** Low. Pure functions, no side effects.
**Tests:** Add characterization tests if none exist. All existing tests must pass.
**Commit:** `refactor: extract date value objects to domain layer`

---

#### Move A3: Extract Employee Status Domain Rule
**What:** Extract the business rule "can an employee's status transition from X to Y?" from `src/lib/services/employee.service.ts` into a pure domain function.
**Why:** This is a genuine business rule. It should be testable without Supabase.
**How:**
1. Identify status transition logic in `employee.service.ts`
2. Create `src/lib/domain/employee/employee-status.ts`:
   ```ts
   export function canTransitionStatus(
     from: EmployeeStatus,
     to: EmployeeStatus,
     context: { hasOpenLeaveRequests: boolean; hasIncompleteOnboarding: boolean }
   ): { allowed: boolean; reason?: string }
   ```
3. Write characterization tests pinning current behavior
4. Refactor `employee.service.ts` to delegate to the new function
5. Verify no behavior change
**Risk:** Low. Well-scoped extraction with clear boundary.
**Tests:** New unit tests for the pure function + existing service tests must pass.
**Commit:** `refactor: extract employee status transition rules to domain`

---

#### Move A4: Extract Leave Balance Calculation
**What:** Extract "remaining leave days = entitlement - taken - pending" from agents/services into a pure domain function.
**Why:** A classic domain calculation. Currently likely duplicated or embedded in repository queries.
**How:**
1. Create `src/lib/domain/leave/leave-calculation.ts`
2. Extract the formula from wherever it lives (likely `leave-repository.ts` or an agent)
3. Pure function: `(entitlement, taken, pending, carryOver?) => number`
4. Update consumers to call the domain function
**Risk:** Low. Pure math, no side effects.
**Tests:** Characterization tests + edge cases (negative values, zero, max cap).
**Commit:** `refactor: extract leave balance calculation to domain`

---

#### Move A5: Extract Workflow State Machine
**What:** Model workflow steps as a finite state machine in the domain layer.
**Why:** Workflow logic (`can approve?`, `who is next?`, `is complete?`) is currently procedural code. A state machine makes the rules explicit and testable.
**How:**
1. Create `src/lib/domain/workflow/workflow-state-machine.ts`
2. Define states: `pending` → `in_progress` → `approved` | `rejected` | `cancelled`
3. Define transitions with guards (e.g., "approver must have `canManageWorkflow` permission")
4. Extract from `workflow-repository.ts` and `workflow.agent.ts`
5. Keep the extraction small — only the core state transitions, not the DB persistence
**Risk:** Medium. Workflow logic may be more complex than visible at first glance. Must verify all edge cases.
**Tests:** Exhaustive state transition tests. Existing workflow tests must pass.
**Commit:** `refactor: model workflow steps as domain state machine`

---

#### Move A6: Create Application Command Handler (Template)
**What:** Introduce the first application-layer command handler as a template for others.
**Why:** API routes currently mix HTTP concerns with business orchestration. A command handler separates "what to do" from "how to receive the request."
**How:**
1. Create `src/lib/application/commands/hire-employee.ts`
2. Handler signature:
   ```ts
   export async function hireEmployee(
     command: HireEmployeeCommand,
     deps: { employeeRepo: EmployeeRepositoryPort; eventBus: EventBusPort; auditLog: AuditLogPort }
   ): Promise<Result<EmployeeId, HireEmployeeError>>
   ```
3. Move orchestration logic from the relevant API route into the handler
4. API route becomes thin:
   ```ts
   // In API route
   const result = await hireEmployee(command, { employeeRepo, eventBus, auditLog })
   if (result.isErr()) return NextResponse.json({ error: result.error }, { status: 400 })
   return NextResponse.json(result.value)
   ```
5. Start with ONE route only. Expand to others only after this pattern is proven.
**Risk:** Medium. Introduces a new pattern. Must be documented and reviewed by team.
**Tests:** Handler tested in isolation with mocked ports. API route tested with integration test.
**Commit:** `refactor: introduce application command handler pattern`

---

#### Move A7: Extract RAG Types to RAG Module
**What:** Move types from `src/types/rag.ts` into `src/lib/rag/types.ts`.
**Why:** 939 lines of RAG-specific types in a global types file creates universal coupling. RAG types should live with RAG code.
**How:**
1. Create `src/lib/rag/types.ts`
2. Move RAG types incrementally (not all at once)
3. Update `src/types/rag.ts` to re-export from new location (strangler-fig)
4. Update consumers one at a time
5. After all consumers updated, delete `src/types/rag.ts`
**Risk:** Low-Medium. Wide blast radius but mechanical. Path aliases make it tractable.
**Tests:** `npm run typecheck` must pass. Build must succeed.
**Commits:** Multiple small commits, one per type cluster (e.g., `refactor: move KnowledgeDocument types to rag module`).

---

#### Move A8: Break Up Types Monolith
**What:** Decompose `src/types/index.ts` into domain-cohesive type modules.
**Why:** 666-line god file. 73 imports. Every type change triggers a rebuild of the world.
**How:**
1. Create domain-specific type files:
   - `src/lib/domain/employee/types.ts`
   - `src/lib/domain/leave/types.ts`
   - `src/lib/domain/workflow/types.ts`
   - `src/lib/domain/document/types.ts`
2. Move entity types to their domain homes
3. Keep `src/types/index.ts` as a barrel that re-exports (strangler-fig)
4. Migrate consumers incrementally
5. Eventually `src/types/index.ts` becomes only shared/core types
**Risk:** Medium. Wide blast radius. Must be done in small steps.
**Tests:** `npm run typecheck` at every step. Build verification.
**Commits:** Multiple commits, one per domain cluster.

---

#### Move A9: Inject Dependencies into Agents
**What:** Replace the singleton coordinator pattern with explicit dependency injection.
**Why:** `src/lib/agents/index.ts` creates a global singleton with hardcoded dependencies. This makes testing impossible without module mocking and hides the dependency graph.
**How:**
1. Refactor `initializeCoordinator` to accept all dependencies as parameters (it partially does already)
2. Create a factory function in `src/lib/agents/factory.ts`
3. API routes call the factory with explicit dependencies:
   ```ts
   const coordinator = createCoordinator({
     agentRunRepo,
     eventBus,
     auditLog,
     llmProvider,
     cache,
   })
   ```
4. Remove the global singleton (`let coordinator: SwarmCoordinator | null = null`)
5. Update `src/app/api/swarm/route.ts` to use the factory
**Risk:** Medium. Changes the initialization pattern. Must verify no race conditions or double-initialization.
**Tests:** All agent tests + swarm API route tests.
**Commit:** `refactor: inject agent dependencies explicitly`

---

#### Move A10: Introduce Structured Logger Interface
**What:** Replace all `console.*` calls with an injected logger that supports structured JSON output.
**Why:** 45 `console.*` calls are not production-grade. No log levels, no correlation IDs, no component tagging.
**How:**
1. Define `src/lib/ports/logger-port.ts`:
   ```ts
   export interface LoggerPort {
     debug(message: string, meta?: Record<string, unknown>): void
     info(message: string, meta?: Record<string, unknown>): void
     warn(message: string, meta?: Record<string, unknown>): void
     error(message: string, meta?: Record<string, unknown>): void
   }
   ```
2. Create `src/lib/infrastructure/logging/console-logger.ts` (default, structured JSON)
3. Create `src/lib/infrastructure/logging/noop-logger.ts` (for tests)
4. Inject logger into all services, agents, and repositories
5. Replace `console.*` calls one file at a time
**Risk:** Low. Behaviorally equivalent. Only output format changes.
**Tests:** All tests must pass. Logger can be a no-op in test environment.
**Commits:** Multiple commits, one per module (`refactor: use structured logger in security layer`, etc.).

---

## Migration Order

The moves above are **sequenced by dependency** (not by priority from Phase 2):

```
Phase 4A: Foundation (no domain changes, safe to do anytime)
├── A1  Split security directory
├── A10 Introduce logger interface + replace console calls
└── A9  Inject agent dependencies

Phase 4B: Domain Layer (start with simplest, most stable rules)
├── A2  Extract date value objects
├── A3  Extract employee status rules
├── A4  Extract leave balance calculation
└── A5  Extract workflow state machine

Phase 4C: Application Layer (after domain has some substance)
└── A6  Create first command handler (template)

Phase 4D: Type Restructuring (after tests are green and domain exists)
├── A7  Extract RAG types
└── A8  Break up types monolith
```

**Rationale:**
- A1, A9, A10 are "scaffolding" moves — they improve the structure without changing business logic.
- A2-A5 build the missing domain layer. Start with A2 (dates) because it's the simplest and has no dependencies. A5 (workflow) is the most complex and comes last.
- A6 (application layer) requires A2-A5 to be in place first — application handlers orchestrate domain logic.
- A7-A8 (types) are wide-reaching refactors that should happen when the codebase is most stable (green tests, clear boundaries).

---

## What NOT to Change

| Item | Reason |
|------|--------|
| **Next.js App Router → Pages Router** | App Router is the current and future direction. No pain point. |
| **Supabase → Prisma/Drizzle** | Supabase works well. RLS and auth are deeply integrated. Migration would be months of work. |
| **Zod → io-ts/runtypes** | Zod 4 is current and well-supported. No type safety issues with Zod. |
| **Class-based agents → function-based** | Class-based agents are fine. The issue is what they contain, not their shape. |
| **Add new infrastructure adapters** | Out of scope (SearchPort, FileStoragePort, NotificationPort). Feature work, not refactoring. |
| **Replace in-memory rate limit with Redis** | The Redis adapter exists. Wiring it is an ops change, not architecture. |

---

## Verification Criteria for Each Move

Before any move is considered complete:

1. **Tests green:** `npm test` passes
2. **Types clean:** `npm run typecheck` passes
3. **Lint clean:** `npm run lint` passes (or no new issues)
4. **Build succeeds:** `npm run build` passes
5. **Behavior preserved:** If the move touches production code, a characterization test exists pinning the old behavior
6. **No new dependencies:** Unless explicitly justified
7. **Import paths updated:** No orphaned imports

---

## Risk Register

| Move | Risk | Mitigation |
|------|------|------------|
| A5 (Workflow state machine) | May miss edge cases in transition rules | Exhaustive characterization tests before extraction. Pair with domain expert if available. |
| A6 (Command handler) | New pattern may confuse team if not documented | Add ADR in `AGENTS.md`. Start with one handler, get team review before expanding. |
| A8 (Types monolith) | Wide blast radius, potential for missed imports | Do incrementally. `npm run typecheck` after every file move. Use IDE "find usages" before deleting. |
| A9 (Agent DI) | May break lazy initialization assumptions | Verify startup sequence. Test with `npm run build` and `npm run dev`. |
