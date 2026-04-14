-- ============================================================
-- AI-OS | Decision Traces + Artifacts
-- ============================================================
-- Stores one row per user request through the AI-OS pipeline:
-- intent, decision, agent calls, blocks composed, artifact refs, timing.
-- Surfaces in /admin/observability.
-- Idempotent.
-- ============================================================

create extension if not exists "pgcrypto";

create table if not exists public.ai_os_traces (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  user_id uuid not null,
  intent_id uuid not null,
  conversation_id uuid, -- optional link to conversations table
  raw_input text not null,
  intent jsonb not null,
  decision jsonb not null,
  mode text not null check (mode in ('AUTO_COMPLETE', 'WORKSPACE', 'ESCALATE')),
  agent_calls jsonb not null default '[]'::jsonb,
  blocks jsonb not null default '[]'::jsonb,
  artifact_ids uuid[] not null default array[]::uuid[],
  duration_ms integer not null default 0,
  success boolean not null default true,
  error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_os_traces_tenant_user
  on public.ai_os_traces (tenant_id, user_id, created_at desc);
create index if not exists idx_ai_os_traces_mode
  on public.ai_os_traces (mode, created_at desc);
create index if not exists idx_ai_os_traces_intent_id
  on public.ai_os_traces (intent_id);

create table if not exists public.ai_os_artifacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  user_id uuid not null,
  trace_id uuid references public.ai_os_traces(id) on delete set null,
  kind text not null check (kind in ('xlsx', 'docx', 'pdf', 'csv')),
  filename text not null,
  storage_path text not null,
  mime_type text not null,
  size_bytes bigint,
  row_count integer,
  signed_url_expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_os_artifacts_tenant_user
  on public.ai_os_artifacts (tenant_id, user_id, created_at desc);
create index if not exists idx_ai_os_artifacts_trace
  on public.ai_os_artifacts (trace_id);

-- -----------------------------------------------
-- RLS: ai_os_traces
-- -----------------------------------------------
alter table public.ai_os_traces enable row level security;

drop policy if exists ai_os_traces_user_read on public.ai_os_traces;
create policy ai_os_traces_user_read on public.ai_os_traces
  for select using (user_id = auth.uid());

drop policy if exists ai_os_traces_admin_read on public.ai_os_traces;
create policy ai_os_traces_admin_read on public.ai_os_traces
  for select using (
    exists (
      select 1 from public.employees e
      where e.auth_user_id = auth.uid()
        and e.role in ('admin')
    )
  );

-- Writes happen only through service-role client; no user-facing insert policy.

-- -----------------------------------------------
-- RLS: ai_os_artifacts
-- -----------------------------------------------
alter table public.ai_os_artifacts enable row level security;

drop policy if exists ai_os_artifacts_user_read on public.ai_os_artifacts;
create policy ai_os_artifacts_user_read on public.ai_os_artifacts
  for select using (user_id = auth.uid());

drop policy if exists ai_os_artifacts_admin_read on public.ai_os_artifacts;
create policy ai_os_artifacts_admin_read on public.ai_os_artifacts
  for select using (
    exists (
      select 1 from public.employees e
      where e.auth_user_id = auth.uid()
        and e.role in ('admin')
    )
  );

-- -----------------------------------------------
-- Storage bucket for generated artifacts.
-- Bucket: ai-os-artifacts (private). Server issues signed URLs.
-- Idempotent: only inserts if the bucket does not already exist.
-- -----------------------------------------------
insert into storage.buckets (id, name, public)
select 'ai-os-artifacts', 'ai-os-artifacts', false
where not exists (select 1 from storage.buckets where id = 'ai-os-artifacts');

-- Storage RLS: only the uploading user (by path prefix tenant/user/...)
-- can read their own artifacts. Admins can read everything via the
-- service-role client used server-side.
drop policy if exists ai_os_artifacts_storage_owner_read on storage.objects;
create policy ai_os_artifacts_storage_owner_read on storage.objects
  for select using (
    bucket_id = 'ai-os-artifacts'
    and (
      -- path = tenant/user/uuid/filename — match user segment to uid
      split_part(name, '/', 2) = auth.uid()::text
    )
  );
