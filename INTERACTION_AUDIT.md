# Interaction Audit Report

## Critical Issues (Fix Now)

### 1. Header Search Bar — Non-Interactive
- **Location:** `Header.tsx:35-43`
- **Issue:** The search bar is a styled `<div>` with no click handler. Users can't open the command palette.
- **Fix:** Integrate `<CommandMenu />` or add an `onClick` to open it.

### 2. PromptBar — Missing Enter-to-Submit
- **Location:** `PromptBar.tsx:26-31`
- **Issue:** Only `⌘+Enter` submits. Standard `Enter` does nothing.
- **Fix:** `Enter` should submit; `Shift+Enter` should insert newline.

### 3. Streaming — No Stop Button
- **Location:** `CommandWorkspace.tsx:59, 67`
- **Issue:** `abortRef` exists but no UI exposes abort. Users can't cancel an in-progress AI request.
- **Fix:** Show a "Stop" button (spinner becomes X) during `isStreaming`.

### 4. MobileNav — Hydration Mismatch
- **Location:** `MobileNav.tsx:32-34`
- **Issue:** `typeof window` check during SSR causes React hydration mismatch.
- **Fix:** Use `useState` + `useEffect` with a resize listener.

### 5. Notification Bell — No Click Handler
- **Location:** `Header.tsx:47-56`
- **Issue:** Bell button has no `onClick`. The red dot is always visible (hardcoded).
- **Fix:** Add click handler (toggle panel or navigate). Make dot conditional.

### 6. CommandMenu — Quick Actions are Stubs
- **Location:** `CommandMenu.tsx:33-37`
- **Issue:** Three quick actions have `/* TODO */` — they do nothing.
- **Fix:** Wire them to real intents or remove them.

---

## Medium Issues

### 7. Metric Cards Look Clickable But Do Nothing
- **Location:** `CommandWorkspace.tsx:232-252`
- **Issue:** `MetricCard` accepts `onClick` but parent never passes one. Hover effects imply interactivity.
- **Fix:** Either pass a handler (navigate to detail page) or remove hover click styling.

### 8. ActionCard Has Dead Props
- **Location:** `ActionCard.tsx:6-12`
- **Issue:** `description`, `assignee`, `assigneeInitials`, `dueDate` are in interface but never rendered.
- **Fix:** Remove from interface or render them.

### 9. CorrectionPrompt Never Appears
- **Location:** `CommandWorkspace.tsx:56-57`
- **Issue:** `correction` state is never populated. No code path calls `setCorrection()`.
- **Fix:** Wire to SSE `clarification_required` event or remove the component.

### 10. ErrorBoundary "Go Home" Redirects
- **Location:** `ErrorBoundary.tsx:77`
- **Issue:** Link points to `/hr` which redirects to `/`.
- **Fix:** Link directly to `/`.

---

## Accessibility Issues

### 11. PromptBar Textarea Missing `aria-label`
- **Fix:** Add `aria-label="Ask the AI assistant"`.

### 12. Metric Label Color Contrast Fails WCAG AA
- **Location:** `MetricCard.tsx:67`
- **Issue:** `#9C9C9C` on `#FFFFFF` = 2.9:1 (needs 4.5:1).
- **Fix:** Darken to `#757575`.

### 13. Mobile Sidebar No Escape-to-Close
- **Fix:** Add `Escape` key listener when `mobileOpen === true`.

### 14. Streaming Blocks Missing `aria-busy`
- **Location:** `CommandWorkspace.tsx:381-391`
- **Issue:** `aria-live="polite"` without `aria-busy` causes partial announcements.
- **Fix:** Add `aria-busy={isStreaming}`.

---

## Performance / Code Quality

### 15. Sidebar `NavLink` Defined Inside Component
- **Location:** `Sidebar.tsx:122`
- **Issue:** Re-creates on every render, causes re-mounts.
- **Fix:** Define outside `Sidebar` or wrap in `useMemo`.

### 16. PromptBar `suggestions` Prop Is Dead Code
- **Location:** `PromptBar.tsx:10`
- **Issue:** Prop accepted but internal rendering removed.
- **Fix:** Remove from interface.
