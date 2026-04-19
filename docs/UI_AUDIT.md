# UI Audit — Brutal Review

**Project:** HR Agent Swarm  
**Date:** 2026-04-19  
**Auditor:** Kimi Code CLI  
**Scope:** All pages, components, layouts, and design tokens

---

## Executive Summary

| Category | Score | Verdict |
|----------|-------|---------|
| Visual Design | C+ | Clean but generic, no personality, inconsistent spacing |
| UX / Usability | C | Major navigation gaps, missing states, confusing hierarchy |
| Accessibility | D+ | ARIA largely absent, focus states missing, color-only indicators |
| Responsive Design | D | Sidebar breaks mobile, no hamburger menu, tables overflow |
| Loading States | C- | Skeletons exist but are crude, no progressive enhancement |
| Information Architecture | C+ | Logical grouping but deep nesting issues |
| Component Consistency | B- | Shadcn base is solid, custom overrides are messy |
| Copy / Microcopy | C | Generic HR-speak, no personality, some confusing labels |

**Overall Grade: C** — Functional but forgettable. Looks like a generic admin template that shipped before a designer ever saw it.

---

## 🔴 Critical Issues (Fix Immediately)

### 1. Mobile Is Completely Broken

**Evidence:** `src/components/layout/Sidebar.tsx` — fixed `w-64` sidebar with zero mobile adaptation.

**Problems:**
- No hamburger menu, no overlay drawer, no collapse behavior
- On a phone (< 640px), the sidebar takes up the entire viewport
- The header search bar is `w-80` — wider than most phone screens
- Employee table uses `grid-cols-12` with `col-span-3` columns that become unreadable
- Metric cards on the dashboard are 4-across with no wrapping strategy

**Fix:** Implement a responsive sidebar pattern:
```tsx
// Mobile: hamburger → overlay drawer
// Tablet: collapsed icon-only sidebar (w-16)
// Desktop: full sidebar (w-64)
```

### 2. The Login Page Is Embarrassing

**Evidence:** `src/app/auth/login/page.tsx`

**Problems:**
- Default browser autofill is broken — no `name` or `autoComplete` attributes on inputs
- Password field has no "show/hide" toggle
- No "Forgot password?" link (a dead end for users)
- The `useState` import is **below** the component that uses it (line 115) — this works by accident due to hoisting but is a code smell
- Generic title "HR Agent Swarm" with subtitle "Sign in to access your dashboard" — zero brand personality
- "Protected by enterprise-grade security" is patronizing copy that means nothing
- No loading state on the submit button beyond the spinner text
- No success animation or transition after login

**Fix:**
- Add `autoComplete="email"` and `autoComplete="current-password"`
- Add password visibility toggle
- Add "Forgot password?" flow
- Move `useState` import to the top
- Redesign with actual branding (logo, color, illustration)

### 3. No Toast / Notification System

**Evidence:** Zero toast/notification imports found in the codebase.

**Problems:**
- User actions (approving leave, exporting data) happen silently or inline
- No feedback for "Export started" or "Settings saved"
- Error messages only appear in-page, not as dismissible notifications
- The Action Queue items have "Review" buttons that navigate away with no confirmation

**Fix:** Install `sonner` or similar. Every mutating action needs toast confirmation.

### 4. Accessibility Is an Afterthought

**Evidence:** `src/app/(dashboard)/employees/page.tsx`, `src/components/layout/Header.tsx`

**Problems:**
- **0 ARIA labels** on icon-only buttons (the `MoreHorizontal` menu, filter button, notification bell)
- **0 focus-visible rings** on custom-styled elements
- Color is the **only** indicator for status badges (red/green/amber) — no text or icon differentiation for colorblind users
- The `StatusBadge` component doesn't expose an `aria-label`
- Employee table headers are `div`s with `span`s, not actual `<th>` elements
- The search input in the header has no `aria-label` or `role="search"`
- Dropdown menu trigger is a `<Button>` inside `<DropdownMenuTrigger>` but the avatar+name combo is confusing for screen readers

**Fix:**
- Add `aria-label` to every icon-only button
- Ensure all status indicators have both color AND icon/text
- Convert table layouts to semantic `<table>` elements or add proper `role="row"`, `role="columnheader"`
- Add `aria-live="polite"` regions for dynamic content updates

---

## 🟠 Major Issues (Fix This Sprint)

### 5. Every Page Looks Identical

**Evidence:** Every dashboard page follows the exact same template:
```
<div className="space-y-6">
  <div className="flex items-center justify-between">
    <div><h1 className="text-xl font-semibold">...</h1><p className="text-sm text-slate-500">...</p></div>
    <Button size="sm" className="h-9 bg-emerald-600">...</Button>
  </div>
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">{stat cards}</div>
  <Card className="border shadow-sm">{main content}</Card>
</div>
```

**Problems:**
- Zero visual hierarchy variation — users can't distinguish page types at a glance
- Every primary action button is identical emerald green
- No tabbed navigation, no breadcrumbs beyond "Back to Directory"
- The dashboard has a 3-column layout, but inner pages are just stacked cards

**Fix:** Introduce page-type variations:
- **Dashboard:** dense, metric-heavy, multi-column
- **Detail pages (employee profile):** hero section + tabbed content
- **List pages (employees):** table-focused with filters sticky at top
- **Action pages (approvals):** card-per-item with clear CTAs

### 6. The Employee Profile Is a Wall of Text

**Evidence:** `src/app/(dashboard)/employees/[id]/page.tsx`

**Problems:**
- Everything is dumped into a single scrollable column
- No tabs for "Overview / Leave / Documents / Compensation"
- Direct reports are shown as a simple list with no hierarchy visualization
- Salary/compensation data (if shown) is mixed with contact info with no visual separation
- The "Edit Profile" button does nothing (no modal, no navigation)
- Missing actions: "Send message", "Initiate offboarding", "View org chart"

**Fix:**
- Add tabbed navigation for sub-sections
- Add a visual org-chart mini-view for manager/direct reports
- Group sensitive data behind a "Reveal" button with audit logging
- Make actions actually functional

### 7. Search Is Everywhere and Nowhere

**Evidence:** `src/components/layout/Header.tsx` (global search), `src/app/(dashboard)/employees/page.tsx` (local search)

**Problems:**
- Global search in header is a **fake input** — it has no `onSubmit`, no `onChange`, no search functionality
- Local employee search is also a fake input — no `onChange` handler, no filtering logic
- Two search paradigms with no clear distinction (global vs. local)
- The header search placeholder says "Search employees, documents, policies..." but does nothing

**Fix:**
- Implement global search with CMD+K shortcut (use `cmdk` library)
- Make local search functional with real-time filtering
- Remove search from header if it's not implemented

### 8. Empty States Are Depressing

**Evidence:** `src/components/dashboard/ActionQueue.tsx`

**Problems:**
- Empty state: "All caught up!" with a green checkmark — okay but generic
- Most other pages have NO empty states at all
- If there are no employees, the directory shows a blank card
- If there are no reports, the reports page probably crashes or shows nothing

**Fix:** Every list/table needs a designed empty state with:
- Illustration or icon
- Contextual headline (not just "No data")
- Action CTA (e.g., "Add your first employee" + button)

### 9. The Sidebar Has Visual Bugs

**Evidence:** `src/components/layout/Sidebar.tsx`

**Problems:**
- The logo area has "HR Agent" on line 1 and "Swarm" on line 2, making it look like two separate products
- Active state uses `bg-emerald-50 text-emerald-700` but the icon color uses `isActive && 'text-emerald-600'` — inconsistent green shades
- Badge on active item uses `bg-emerald-600` which is darker than the nav background, creating a muddy contrast
- Bottom nav items (Settings) don't have badge support but use the same component structure
- The "Knowledge" nav item has no `requiredPermission` but all others do — inconsistent gating

**Fix:**
- Single-line logo or better branding
- Unify active state colors
- Add proper permission gating for all items

### 10. Forms Are Unvalidated

**Evidence:** `src/app/auth/login/page.tsx`, `src/app/(dashboard)/leave/page.tsx`

**Problems:**
- Login form only uses HTML5 `required` — no email format validation
- Leave request form (if it exists) has no visible validation
- No inline error messages per field
- No character limits, no sanitization feedback
- The "New Leave Request" button exists but there's no modal or form for it

**Fix:**
- Add Zod schemas for all forms
- Show inline validation errors
- Add character counters for text areas

---

## 🟡 Medium Issues (Fix Next Sprint)

### 11. Typography Is Unconsidered

**Evidence:** `src/app/globals.css`, various pages

**Problems:**
- Every heading is `font-semibold` — no weight hierarchy
- Page titles are `text-xl` (20px) which is too small for H1s
- Body text is consistently `text-sm` (14px) — too small for dense dashboards
- No line-height tuning — everything uses Tailwind defaults
- The `text-balance` utility exists but is never used

**Fix:**
- H1: `text-2xl font-bold` (24px)
- H2: `text-xl font-semibold` (20px)
- Body: `text-base` (16px) for readability
- Use `leading-relaxed` for paragraphs

### 12. Color System Is Messy

**Evidence:** `src/app/globals.css`, `src/components/dashboard/MetricCard.tsx`

**Problems:**
- Custom CSS variables (`--emerald-50` through `--emerald-900`) override shadcn's OKLCH system
- Some components use `bg-emerald-50`, others use the CSS var, others use `bg-slate-100`
- The `navy` palette is actually just Tailwind's slate — why create custom vars?
- `MetricCard` has a `navy` variant that renders dark text on dark background incorrectly
- Chart colors (`--chart-1` through `--chart-5`) are OKLCH but never used in charts

**Fix:**
- Pick ONE color system: either shadcn OKLCH or Tailwind palette
- Remove unused CSS variables
- Audit every component for color contrast (WCAG AA minimum)

### 13. Animation Is Either Missing or Crude

**Evidence:** `src/app/globals.css`

**Problems:**
- Only animation is `fadeInUp` which is never used
- Page transitions are instant — feels jarring
- Skeleton loaders are just `animate-pulse` blocks with no shimmer effect
- No hover micro-interactions on cards or buttons
- The Action Queue items have `hover:bg-slate-50` but no transition duration

**Fix:**
- Add page transition wrapper
- Use `animate-shimmer` for skeletons
- Add `transition-all duration-200` to interactive elements
- Consider `framer-motion` for list animations (it was removed from deps)

### 14. The Error Boundary Looks Like a Different App

**Evidence:** `src/components/error/ErrorBoundary.tsx`

**Problems:**
- Uses `bg-gray-50` and `text-gray-900` while the rest of the app uses `slate`
- Button styles are custom inline Tailwind, not the project's `Button` component
- "Something went wrong" is generic — no error code, no "Report this issue" action
- The home link is a raw `<a>` tag, not a Next.js `Link`
- In dev mode, the stack trace is dumped into a red box with no syntax highlighting or collapsible sections

**Fix:**
- Use the app's color palette and components
- Add error ID display for support tickets
- Use Next.js `Link` component

### 15. Date Formatting Is Inconsistent

**Evidence:** Multiple pages using `formatDateOnly`

**Problems:**
- Some dates show as "Apr 19, 2026" (short), others as full ISO strings
- The anniversaries card uses `{ month: 'short', day: 'numeric' }` but no year
- Probation reviews show relative days ("3d") but leave requests show full dates
- No timezone indication anywhere

**Fix:**
- Standardize on one format: "Apr 19, 2026" for dates, "3 days ago" for recency
- Show timezone for absolute timestamps

---

## 🟢 Minor Issues (Polish)

### 16. Missing Hover States
- Table rows have `hover:bg-slate-50` but cards don't
- Buttons have hover states but stat cards don't
- Avatar initials have no hover feedback

### 17. Inconsistent Border Radius
- Cards use `rounded-xl` (from shadcn)
- Badges use default (no explicit radius)
- Avatar uses default (fully rounded)
- Metric cards have no radius override

### 18. Missing Keyboard Shortcuts
- No CMD+K for search
- No `/` to focus search
- No `Escape` to close modals (no modals exist)
- No `j/k` navigation for lists

### 19. The Settings Page Is Placeholder City

**Evidence:** `src/app/(dashboard)/admin/page.tsx`

**Problems:**
- Every settings row says "Configured" or "3 active" but nothing is clickable
- No actual forms, no toggles, no inputs
- It's a static list pretending to be a settings page

### 20. Footer Missing
- No footer on any page
- No version number, no support link, no privacy policy
- The security.txt exists but there's no UI link to it

---

## What Works Well ✅

1. **Shadcn component foundation** — solid base, good defaults
2. **RBAC-aware UI** — permissions actually hide/show elements correctly
3. **Skeleton loading states** — exist on major pages (crude but present)
4. **Icon consistency** — Lucide icons used throughout
5. **Dark mode tokens** — CSS variables support it, though not exposed in UI
6. **Suspense boundaries** — pages use `<Suspense>` correctly

---

## Recommended Priority Order

### Week 1: Critical
1. Add responsive sidebar with mobile hamburger menu
2. Fix login page (autocomplete, forgot password, branding)
3. Install toast/notification system (`sonner`)
4. Add ARIA labels to all icon-only buttons

### Week 2: Major
5. Implement global search (CMD+K)
6. Add empty states to all list views
7. Redesign employee profile with tabs
8. Add form validation with Zod

### Week 3: Medium
9. Standardize typography scale
10. Clean up color system
11. Add animations and transitions
12. Fix error boundary styling

### Week 4: Polish
13. Add keyboard shortcuts
14. Implement actual settings forms
15. Add footer with links
16. Conduct contrast audit

---

## Tools for Validation

```bash
# Check for missing aria-labels on buttons
npx eslint src/ --rule 'jsx-a11y/accessible-emoji: error'

# Check color contrast
npx pa11y http://localhost:3000

# Check responsive breakpoints
# Resize to 320px, 768px, 1024px, 1440px and verify usability

# Lighthouse CI
npx lighthouse http://localhost:3000 --output=json --chrome-flags="--headless"
```
