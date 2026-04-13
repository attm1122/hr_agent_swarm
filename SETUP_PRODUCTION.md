# LEAP HR — Production Setup Runbook

This is the checklist to take the app from "deployed with mock data" to "LEAP
employees can sign in and use it with their real M365 accounts."

Work through the phases in order. Each phase has exit criteria — confirm they
pass before moving on.

---

## Phase 1 — Supabase schema

**Goal:** Have all HR tables live in Supabase project `ycrvhfgcdygdjqzlglgt`.

1. Open [Supabase Dashboard → SQL Editor](https://supabase.com/dashboard/project/ycrvhfgcdygdjqzlglgt/sql/new).
2. Copy the contents of `src/infrastructure/database/schema.sql` and paste into
   the editor.
3. Click **Run**.
4. Verify tables exist: Dashboard → Table Editor. You should see `tenants`,
   `employees`, `teams`, `positions`, `leave_requests`, `workflows`, etc.
5. Seed the LEAP tenant row:
   ```sql
   insert into tenants (id, name, slug) values
     ('leap', 'LEAP Legal Software', 'leap')
   on conflict (id) do nothing;
   ```

**Alternative (CLI):**
```bash
# Get a personal access token at https://supabase.com/dashboard/account/tokens
export SUPABASE_ACCESS_TOKEN=<your-token>
supabase link --project-ref ycrvhfgcdygdjqzlglgt
supabase db push --file src/infrastructure/database/schema.sql
```

**Exit criteria:** `select count(*) from employees` returns 0 (table exists,
is empty, ready for sync).

---

## Phase 2 — Azure AD app registration

**Goal:** A single app registration that powers both Supabase SSO (user
delegated) and Graph API background sync (application permissions).

1. [Azure Portal → App registrations → New registration](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade).
   - Name: `LEAP HR`
   - Supported account types: **Accounts in this organizational directory only**
   - Redirect URI (Web):
     `https://ycrvhfgcdygdjqzlglgt.supabase.co/auth/v1/callback`
2. Under **Certificates & secrets**, create a new client secret. Copy the
   **Value** (it's only shown once).
3. Under **API permissions**, add:

   | Permission             | Type        | Purpose                          |
   |-----------------------|-------------|----------------------------------|
   | User.Read             | Delegated   | Sign-in (profile)                |
   | email, openid, offline_access | Delegated | Sign-in (OIDC)            |
   | User.Read.All         | Application | Directory sync (employees)       |
   | Group.Read.All        | Application | Team/group structure             |
   | Directory.Read.All    | Application | Manager chains                   |
   | Mail.Send             | Application | Notification email               |
   | Files.Read.All        | Application | OneDrive / SharePoint documents  |
   | Sites.Read.All        | Application | SharePoint libraries             |

   Click **Grant admin consent for LEAP**.

4. Copy the following IDs:
   - **Application (client) ID** → `AZURE_AD_CLIENT_ID` + `AZURE_CLIENT_ID`
   - **Directory (tenant) ID** → `AZURE_AD_TENANT_ID` + `AZURE_TENANT_ID`
   - **Client secret value** → `AZURE_AD_CLIENT_SECRET` + `AZURE_CLIENT_SECRET`

**Exit criteria:** In Azure portal, the app shows 8 permissions, all with a
green "Granted for LEAP" status.

---

## Phase 3 — Connect Azure AD to Supabase Auth

**Goal:** Clicking "Continue with Microsoft" redirects to LEAP's login and
returns a Supabase session.

1. [Supabase Dashboard → Authentication → Providers](https://supabase.com/dashboard/project/ycrvhfgcdygdjqzlglgt/auth/providers).
2. Enable **Azure (Microsoft)**.
3. Paste:
   - Client ID: *from Phase 2*
   - Secret: *from Phase 2*
   - Azure Tenant URL: `https://login.microsoftonline.com/<AZURE_TENANT_ID>/v2.0`
4. Under **URL Configuration** (Authentication → URL Configuration):
   - Site URL: `https://my-app-seven-kappa-64.vercel.app`
   - Additional redirect URLs:
     ```
     https://my-app-seven-kappa-64.vercel.app/auth/callback
     https://*.vercel.app/auth/callback  (optional, for preview deploys)
     http://localhost:3000/auth/callback (for local dev)
     ```
5. Click **Save**.

**Exit criteria:** On `/auth/signin`, clicking the Microsoft button navigates
to `login.microsoftonline.com/<tenant>/...` and then back to
`/auth/callback?code=...`.

---

## Phase 4 — Vercel environment variables

**Goal:** All secrets set on production.

```bash
# Supabase secrets (get from Supabase Dashboard → Settings → API)
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add SUPABASE_DB_URL production

# Azure AD / Graph (from Phase 2)
vercel env add AZURE_AD_TENANT_ID production
vercel env add AZURE_AD_CLIENT_ID production
vercel env add AZURE_AD_CLIENT_SECRET production
vercel env add AZURE_TENANT_ID production
vercel env add AZURE_CLIENT_ID production
vercel env add AZURE_CLIENT_SECRET production

# Notification sender (must be a real mailbox with Mail.Send permission)
vercel env add NOTIFICATION_FROM_ADDRESS production   # e.g. hr@leap.com.au

# Optional: Teams channel webhook
vercel env add TEAMS_WEBHOOK_URL production

# Optional: Redis (Upstash) for distributed rate-limit / CSRF / audit
vercel env add REDIS_URL production
```

Then redeploy:
```bash
vercel --prod --yes
```

**Exit criteria:** `vercel env ls production` shows all of the above.

---

## Phase 5 — Verify Graph connectivity

**Goal:** Confirm the background-job credentials work before running a sync.

```bash
# Sign in as an admin user in the deployed app, grab cookies, then:
curl https://my-app-seven-kappa-64.vercel.app/api/admin/graph-health \
  -H "Cookie: <session cookies>"
```

Expected response:
```json
{
  "configured": true,
  "tokenIssued": true,
  "directoryReachable": true,
  "tenantSampleUpn": "someone@leap.com.au"
}
```

If `tokenIssued: false` → double-check client secret / tenant id.
If `directoryReachable: false` → check admin consent was granted for
`User.Read.All`.

**Exit criteria:** all three flags `true`.

---

## Phase 6 — Initial employee sync

**Goal:** Populate `employees` table from Azure AD.

```bash
# Dry run first to verify counts
curl -X POST https://my-app-seven-kappa-64.vercel.app/api/admin/sync/employees \
  -H "Content-Type: application/json" \
  -H "Cookie: <session cookies>" \
  -d '{"upnDomain":"leap.com.au","dryRun":true}'

# Then run for real
curl -X POST https://my-app-seven-kappa-64.vercel.app/api/admin/sync/employees \
  -H "Content-Type: application/json" \
  -H "Cookie: <session cookies>" \
  -d '{"upnDomain":"leap.com.au","dryRun":false}'
```

Response includes per-user error list — zero errors is the goal.

**Exit criteria:**
- `select count(*) from employees where tenant_id = 'leap'` matches active
  LEAP headcount (±disabled accounts).
- Manager chain populated: `select email, manager_id from employees where manager_id is null` shows only the CEO / top-of-chain users.

---

## Phase 6b — Initial document sync (optional)

**Goal:** Index employees' HR documents from OneDrive so the Document
Compliance agent can flag missing / expiring files.

```bash
# Dry-run first
curl -X POST https://my-app-seven-kappa-64.vercel.app/api/admin/sync/documents \
  -H "Content-Type: application/json" \
  -H "Cookie: <session cookies>" \
  -d '{"folderPath":"/HR","upnDomain":"leap.com.au","dryRun":true}'

# Run for real
curl -X POST https://my-app-seven-kappa-64.vercel.app/api/admin/sync/documents \
  -H "Content-Type: application/json" \
  -H "Cookie: <session cookies>" \
  -d '{"folderPath":"/HR","upnDomain":"leap.com.au","dryRun":false}'
```

Only indexes file **metadata** — no bytes are copied. The agent links back
to OneDrive via `webUrl`. Classifier is keyword-based (filename → category);
expiry dates are pulled from file names matching `YYYY-MM-DD`.

**Exit criteria:** `select count(*) from employee_documents` > 0.

---

## Phase 7 — Smoke test end-to-end

Sign in with a LEAP account at `/auth/signin`:
1. Click "Continue with Microsoft" → redirects to Microsoft → back to `/hr`.
2. `/employees` should list real LEAP employees (not mock data).
3. `/hr` dashboard should render action items based on real milestones.

If `/employees` still shows 23 mock employees, either:
- `SUPABASE_SERVICE_ROLE_KEY` is not set (agents fall back to mock mode), or
- The employees table is empty (run Phase 6 sync).

---

## What still isn't wired yet

These agents are still reading from `mock-data.ts` / in-memory stores. The
employee-profile agent has been migrated as the template — copy the same
pattern for:

- `leave-milestones.agent.ts` — use a new `LeaveStore` (SupabaseLeaveRepository + mock fallback)
- `document-compliance.agent.ts` — use a `DocumentStore` backed by
  `SupabaseDocumentRepository` + OneDrive sync
- `onboarding.agent.ts` / `offboarding.agent.ts` — migrate
  `onboarding-store.ts` / `offboarding-store.ts` from in-memory Maps to
  `SupabaseOnboarding/OffboardingRepository`
- `workflow.agent.ts` — migrate `workflow-store.ts` similarly
- `knowledge.agent.ts` — wire `SupabasePolicyRepository` + document chunking

Production-hardening that's still open:
- **Redis connection** — security middleware now detects `REDIS_URL` and
  switches CSRF + rate-limit to the distributed KV store automatically.
  Just set `REDIS_URL` in Vercel envs. Audit log writes to Supabase when
  `SUPABASE_SERVICE_ROLE_KEY` is set.
- **Scheduled document ingestion** — `/api/admin/sync/documents` indexes
  OneDrive files, but there's no cron yet. Add to `vercel.json`:
  ```json
  { "crons": [{ "path": "/api/admin/sync/documents", "schedule": "0 2 * * *" }] }
  ```
- **Workflow approval persistence** — workflow agent still writes to an
  in-memory store. Needs migration to `SupabaseWorkflowRepository`.
- **Error boundaries + request timeouts** on the frontend (open from the
  original code review).

---

## Quick reference — URLs

- Production: https://my-app-seven-kappa-64.vercel.app
- Vercel dashboard: https://vercel.com/leap-people-and-culture/my-app
- Supabase dashboard: https://supabase.com/dashboard/project/ycrvhfgcdygdjqzlglgt
- Azure portal: https://portal.azure.com/
