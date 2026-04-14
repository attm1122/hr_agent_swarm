-- ============================================================
-- AI-OS | Core Employees + Addresses
-- ============================================================
-- Canonical employee + address tables used by the RecordsAgent write path.
-- RLS enforces:
--   - employees read own row
--   - managers read team (via manager_id chain)
--   - HR/admin full access
--   - employee_addresses is self-managed; HR/admin override
-- Idempotent.
-- ============================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------
-- employees
-- -----------------------------------------------
create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  auth_user_id uuid unique, -- maps to auth.users.id
  email text not null,
  first_name text not null,
  last_name text not null,
  preferred_name text,
  hire_date date not null,
  termination_date date,
  status text not null default 'active'
    check (status in ('active', 'inactive', 'on_leave', 'terminated', 'pending')),
  team_id uuid,
  manager_id uuid references public.employees(id) on delete set null,
  work_location text,
  employment_type text
    check (employment_type in ('full_time', 'part_time', 'casual', 'contractor', 'intern')),
  role text not null default 'employee'
    check (role in ('admin', 'manager', 'team_lead', 'employee', 'payroll')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_employees_tenant_email
  on public.employees (tenant_id, lower(email));
create index if not exists idx_employees_tenant
  on public.employees (tenant_id);
create index if not exists idx_employees_manager
  on public.employees (manager_id);
create index if not exists idx_employees_team
  on public.employees (team_id);

-- -----------------------------------------------
-- employee_addresses
-- -----------------------------------------------
create table if not exists public.employee_addresses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  employee_id uuid not null references public.employees(id) on delete cascade,
  type text not null default 'home'
    check (type in ('home', 'postal', 'emergency')),
  street text not null,
  suburb text,
  state text,
  postcode text,
  country text not null default 'AU',
  is_current boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_addresses_employee
  on public.employee_addresses (employee_id, is_current);
create index if not exists idx_addresses_tenant
  on public.employee_addresses (tenant_id);

-- -----------------------------------------------
-- updated_at triggers
-- -----------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_employees_updated_at on public.employees;
create trigger trg_employees_updated_at
  before update on public.employees
  for each row execute function public.set_updated_at();

drop trigger if exists trg_employee_addresses_updated_at on public.employee_addresses;
create trigger trg_employee_addresses_updated_at
  before update on public.employee_addresses
  for each row execute function public.set_updated_at();

-- -----------------------------------------------
-- helpers (rely on JWT helpers from existing project)
-- current_user_id() and current_tenant_id() must already exist.
-- If they don't, you can use auth.uid() directly.
-- -----------------------------------------------
create or replace function public.ai_os_current_user_id()
returns uuid language sql stable as $$
  select auth.uid()
$$;

create or replace function public.ai_os_is_admin_or_hr()
returns boolean language sql stable as $$
  select exists (
    select 1 from public.employees e
    where e.auth_user_id = auth.uid()
      and e.role in ('admin')
  )
$$;

-- -----------------------------------------------
-- RLS: employees
-- -----------------------------------------------
alter table public.employees enable row level security;

drop policy if exists employees_self_read on public.employees;
create policy employees_self_read on public.employees
  for select using (auth_user_id = auth.uid());

drop policy if exists employees_team_read on public.employees;
create policy employees_team_read on public.employees
  for select using (
    manager_id in (
      select id from public.employees where auth_user_id = auth.uid()
    )
  );

drop policy if exists employees_admin_all on public.employees;
create policy employees_admin_all on public.employees
  for all using (public.ai_os_is_admin_or_hr())
  with check (public.ai_os_is_admin_or_hr());

-- Employees may NOT update their own row directly — structural fields (team,
-- manager, role, status) are admin-only. Address changes go through
-- employee_addresses with its own RLS.

-- -----------------------------------------------
-- RLS: employee_addresses
-- -----------------------------------------------
alter table public.employee_addresses enable row level security;

drop policy if exists employee_addresses_self_rw on public.employee_addresses;
create policy employee_addresses_self_rw on public.employee_addresses
  for all using (
    employee_id in (
      select id from public.employees where auth_user_id = auth.uid()
    )
  ) with check (
    employee_id in (
      select id from public.employees where auth_user_id = auth.uid()
    )
  );

drop policy if exists employee_addresses_admin_all on public.employee_addresses;
create policy employee_addresses_admin_all on public.employee_addresses
  for all using (public.ai_os_is_admin_or_hr())
  with check (public.ai_os_is_admin_or_hr());

-- -----------------------------------------------
-- Service role bypasses RLS automatically. Server-side writes via the
-- service role client are unaffected; the AI-OS write adapter performs its
-- own capability check before calling into Supabase.
-- -----------------------------------------------
