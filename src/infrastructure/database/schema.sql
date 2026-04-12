/*
 * HR Agent Swarm Database Schema
 * Supabase PostgreSQL with Row Level Security
 * 
 * This schema supports multi-tenant HR data with strict access controls.
 * All tables have RLS enabled with policies for:
 * - Self-service (employees see their own data)
 * - Manager access (managers see their direct reports)
 * - HR/Admin access (full access within tenant)
 */

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- TENANT ISOLATION
-- ============================================

-- Tenants table for multi-tenant support
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    settings JSONB DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CORE ENTITIES
-- ============================================

CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    parent_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    department TEXT NOT NULL,
    cost_center TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, code)
);

CREATE TABLE positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    level TEXT NOT NULL,
    department TEXT NOT NULL,
    job_family TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    employee_number TEXT NOT NULL,
    hire_date DATE NOT NULL,
    termination_date DATE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'on_leave', 'terminated', 'pending')),
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    position_id UUID REFERENCES positions(id) ON DELETE SET NULL,
    manager_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    work_location TEXT CHECK (work_location IN ('onsite', 'remote', 'hybrid')),
    employment_type TEXT NOT NULL DEFAULT 'full_time' CHECK (employment_type IN ('full_time', 'part_time', 'contract', 'intern')),
    auth_provider_id TEXT UNIQUE, -- Clerk user ID
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, email),
    UNIQUE(tenant_id, employee_number)
);

-- ============================================
-- DOCUMENT DOMAIN
-- ============================================

CREATE TABLE document_requirements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    employment_types TEXT[] NOT NULL DEFAULT '{full_time}',
    required BOOLEAN NOT NULL DEFAULT true,
    expires BOOLEAN NOT NULL DEFAULT false,
    expiration_warning_days INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE employee_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    onedrive_id TEXT NOT NULL,
    onedrive_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('contract', 'visa', 'certification', 'id', 'medical', 'tax', 'performance', 'other')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'expiring', 'missing')),
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at DATE,
    extracted_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- LEAVE DOMAIN
-- ============================================

CREATE TABLE leave_balances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    leave_type TEXT NOT NULL CHECK (leave_type IN ('annual', 'sick', 'personal', 'parental', 'bereavement', 'unpaid', 'other')),
    entitlement_days DECIMAL(5,2) NOT NULL DEFAULT 0,
    taken_days DECIMAL(5,2) NOT NULL DEFAULT 0,
    pending_days DECIMAL(5,2) NOT NULL DEFAULT 0,
    remaining_days DECIMAL(5,2) NOT NULL DEFAULT 0,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, employee_id, leave_type, period_start)
);

CREATE TABLE leave_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    leave_type TEXT NOT NULL CHECK (leave_type IN ('annual', 'sick', 'personal', 'parental', 'bereavement', 'unpaid', 'other')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    days_requested DECIMAL(5,2) NOT NULL,
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'cancelled')),
    approved_by UUID REFERENCES employees(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- COMPENSATION DOMAIN
-- ============================================

CREATE TABLE compensation_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    effective_date DATE NOT NULL,
    base_salary DECIMAL(12,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    salary_frequency TEXT NOT NULL DEFAULT 'annual' CHECK (salary_frequency IN ('annual', 'monthly', 'biweekly', 'weekly')),
    bonus_amount DECIMAL(12,2),
    bonus_type TEXT,
    total_compensation DECIMAL(12,2) NOT NULL,
    hr3_sync_id TEXT,
    hr3_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- COMPLIANCE DOMAIN
-- ============================================

CREATE TABLE milestones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    milestone_type TEXT NOT NULL CHECK (milestone_type IN ('service_anniversary', 'probation_end', 'visa_expiry', 'certification_expiry', 'contract_expiry', 'performance_review')),
    milestone_date DATE NOT NULL,
    description TEXT NOT NULL,
    alert_days_before INTEGER NOT NULL DEFAULT 30,
    status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'due', 'overdue', 'completed', 'acknowledged')),
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by UUID REFERENCES employees(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ONBOARDING DOMAIN
-- ============================================

CREATE TABLE onboarding_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    template_name TEXT NOT NULL,
    start_date DATE NOT NULL,
    target_completion_date DATE NOT NULL,
    actual_completion_date DATE,
    status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed', 'blocked')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE onboarding_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES onboarding_plans(id) ON DELETE CASCADE,
    task_name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL CHECK (category IN ('admin', 'it', 'hr', 'team', 'training', 'compliance')),
    assigned_to UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    due_date DATE NOT NULL,
    completed_at TIMESTAMPTZ,
    completed_by UUID REFERENCES employees(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    depends_on UUID[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- OFFBOARDING DOMAIN
-- ============================================

CREATE TABLE offboarding_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    termination_date DATE NOT NULL,
    initiated_by UUID NOT NULL REFERENCES employees(id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    checklist_template TEXT NOT NULL,
    target_completion_date DATE NOT NULL,
    actual_completion_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE offboarding_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES offboarding_plans(id) ON DELETE CASCADE,
    task_name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('access_removal', 'asset_return', 'knowledge_transfer', 'hr_exit', 'payroll_exit', 'compliance')),
    assigned_to UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    due_date DATE NOT NULL,
    completed_at TIMESTAMPTZ,
    completed_by UUID REFERENCES employees(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked')),
    priority TEXT NOT NULL DEFAULT 'high' CHECK (priority IN ('low', 'medium', 'high')),
    depends_on UUID[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- WORKFLOW DOMAIN
-- ============================================

CREATE TABLE workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    workflow_type TEXT NOT NULL CHECK (workflow_type IN ('leave_approval', 'salary_change', 'promotion', 'termination', 'onboarding', 'offboarding', 'document_approval', 'communication_approval', 'review')),
    reference_type TEXT NOT NULL,
    reference_id UUID NOT NULL,
    initiator_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'rejected', 'cancelled')),
    current_step INTEGER NOT NULL DEFAULT 1,
    total_steps INTEGER NOT NULL,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE approval_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    approver_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    approver_role TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'delegated', 'skipped')),
    comments TEXT,
    acted_at TIMESTAMPTZ,
    due_date DATE NOT NULL,
    escalated_to UUID REFERENCES employees(id) ON DELETE SET NULL,
    escalated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workflow_id, step_number)
);

-- ============================================
-- AUDIT & INTELLIGENCE
-- ============================================

CREATE TABLE audit_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    actor_id UUID,
    actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'agent', 'system')),
    action TEXT NOT NULL,
    previous_state JSONB,
    new_state JSONB,
    metadata JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE agent_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    agent_type TEXT NOT NULL,
    intent TEXT NOT NULL,
    input_payload JSONB NOT NULL,
    output_result JSONB,
    confidence DECIMAL(3,2),
    execution_time_ms INTEGER,
    success BOOLEAN NOT NULL DEFAULT false,
    error_message TEXT,
    context JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- REPORTING
-- ============================================

CREATE TABLE report_definitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL CHECK (category IN ('hr', 'compliance', 'leave', 'compensation', 'onboarding')),
    query_config JSONB NOT NULL,
    parameters JSONB,
    requires_approval BOOLEAN NOT NULL DEFAULT false,
    created_by UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE report_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    report_definition_id UUID NOT NULL REFERENCES report_definitions(id) ON DELETE CASCADE,
    parameters JSONB,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    result_data JSONB,
    row_count INTEGER,
    generated_by UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- KNOWLEDGE DOMAIN
-- ============================================

CREATE TABLE policy_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    version TEXT NOT NULL,
    effective_date DATE NOT NULL,
    source_url TEXT,
    content_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE policy_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES policy_documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding VECTOR(1536),
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(document_id, chunk_index)
);

-- ============================================
-- AUDIT LOGS (Security)
-- ============================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    event_id TEXT NOT NULL UNIQUE,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event_type TEXT NOT NULL CHECK (event_type IN (
        'agent_execute', 'data_access', 'permission_check', 'integration_call',
        'security_blocked', 'auth_failure', 'rate_limit_hit', 'csrf_violation', 'sensitive_action'
    )),
    user_id TEXT NOT NULL,
    role TEXT NOT NULL,
    session_id TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    intent TEXT,
    agent_type TEXT,
    success BOOLEAN NOT NULL DEFAULT false,
    error_message TEXT,
    resource_type TEXT,
    resource_id TEXT,
    action TEXT,
    fields_accessed TEXT[],
    sensitivity_level TEXT,
    risk_score INTEGER,
    requires_approval BOOLEAN DEFAULT false,
    approval_status TEXT CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    previous_hash TEXT,
    integrity_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_tenants_slug ON tenants(slug);

CREATE INDEX idx_teams_tenant ON teams(tenant_id);
CREATE INDEX idx_employees_tenant ON employees(tenant_id);
CREATE INDEX idx_employees_team ON employees(team_id);
CREATE INDEX idx_employees_manager ON employees(manager_id);
CREATE INDEX idx_employees_status ON employees(status);
CREATE INDEX idx_employees_hire_date ON employees(hire_date);
CREATE INDEX idx_employees_auth ON employees(auth_provider_id);

CREATE INDEX idx_documents_tenant ON employee_documents(tenant_id);
CREATE INDEX idx_documents_employee ON employee_documents(employee_id);
CREATE INDEX idx_documents_status ON employee_documents(status);
CREATE INDEX idx_documents_expires ON employee_documents(expires_at);

CREATE INDEX idx_leave_balances_tenant ON leave_balances(tenant_id);
CREATE INDEX idx_leave_balances_employee ON leave_balances(employee_id);
CREATE INDEX idx_leave_requests_tenant ON leave_requests(tenant_id);
CREATE INDEX idx_leave_requests_employee ON leave_requests(employee_id);
CREATE INDEX idx_leave_requests_status ON leave_requests(status);
CREATE INDEX idx_leave_requests_dates ON leave_requests(start_date, end_date);

CREATE INDEX idx_compensation_tenant ON compensation_records(tenant_id);
CREATE INDEX idx_compensation_employee ON compensation_records(employee_id);
CREATE INDEX idx_compensation_effective ON compensation_records(effective_date);

CREATE INDEX idx_milestones_tenant ON milestones(tenant_id);
CREATE INDEX idx_milestones_employee ON milestones(employee_id);
CREATE INDEX idx_milestones_date ON milestones(milestone_date);
CREATE INDEX idx_milestones_status ON milestones(status);

CREATE INDEX idx_onboarding_plans_tenant ON onboarding_plans(tenant_id);
CREATE INDEX idx_onboarding_plans_employee ON onboarding_plans(employee_id);
CREATE INDEX idx_onboarding_tasks_tenant ON onboarding_tasks(tenant_id);
CREATE INDEX idx_onboarding_tasks_plan ON onboarding_tasks(plan_id);
CREATE INDEX idx_onboarding_tasks_assigned ON onboarding_tasks(assigned_to);

CREATE INDEX idx_offboarding_plans_tenant ON offboarding_plans(tenant_id);
CREATE INDEX idx_offboarding_plans_employee ON offboarding_plans(employee_id);
CREATE INDEX idx_offboarding_tasks_tenant ON offboarding_tasks(tenant_id);

CREATE INDEX idx_workflows_tenant ON workflows(tenant_id);
CREATE INDEX idx_workflows_initiator ON workflows(initiator_id);
CREATE INDEX idx_workflows_status ON workflows(status);
CREATE INDEX idx_workflows_reference ON workflows(reference_type, reference_id);
CREATE INDEX idx_approval_steps_tenant ON approval_steps(tenant_id);
CREATE INDEX idx_approval_steps_workflow ON approval_steps(workflow_id);
CREATE INDEX idx_approval_steps_approver ON approval_steps(approver_id);

CREATE INDEX idx_audit_events_tenant ON audit_events(tenant_id);
CREATE INDEX idx_audit_events_entity ON audit_events(entity_type, entity_id);
CREATE INDEX idx_audit_events_created ON audit_events(created_at);
CREATE INDEX idx_audit_events_actor ON audit_events(actor_id);

CREATE INDEX idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX idx_audit_logs_success ON audit_logs(success);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_session ON audit_logs(session_id);

CREATE INDEX idx_agent_runs_tenant ON agent_runs(tenant_id);
CREATE INDEX idx_agent_runs_type ON agent_runs(agent_type);
CREATE INDEX idx_agent_runs_created ON agent_runs(created_at);

CREATE INDEX idx_policy_documents_tenant ON policy_documents(tenant_id);
CREATE INDEX idx_policy_chunks_tenant ON policy_chunks(tenant_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE compensation_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE offboarding_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE offboarding_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS HELPER FUNCTIONS
-- ============================================

-- Get current user from JWT claims
CREATE OR REPLACE FUNCTION current_user_id()
RETURNS UUID AS $$
BEGIN
    RETURN (current_setting('request.jwt.claims', true)::json->>'sub')::UUID;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get current user's tenant from JWT claims
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID AS $$
BEGIN
    RETURN (current_setting('request.jwt.claims', true)::json->>'tenant_id')::UUID;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get current user's role from JWT claims
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS TEXT AS $$
BEGIN
    RETURN current_setting('request.jwt.claims', true)::json->>'role';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN current_user_role() IN ('admin', 'hr_admin', 'super_admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if current user is manager of given employee
CREATE OR REPLACE FUNCTION is_manager_of(employee_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM employees e
        WHERE e.id = employee_uuid
        AND e.manager_id = current_user_id()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if current user is in same team
CREATE OR REPLACE FUNCTION is_same_team(employee_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM employees e1
        JOIN employees e2 ON e1.team_id = e2.team_id
        WHERE e1.id = current_user_id()
        AND e2.id = employee_uuid
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- TENANT POLICIES
-- ============================================

-- Tenants: Users can only see their own tenant
CREATE POLICY tenant_isolation ON tenants
    FOR ALL
    USING (id = current_tenant_id());

-- ============================================
-- EMPLOYEE POLICIES
-- ============================================

-- Employees: Self-service (see own record)
CREATE POLICY employee_self_service ON employees
    FOR SELECT
    USING (
        tenant_id = current_tenant_id()
        AND (
            id = current_user_id()
            OR is_admin()
            OR is_manager_of(id)
        )
    );

-- Employees: Admin can manage all in tenant
CREATE POLICY employee_admin_manage ON employees
    FOR ALL
    USING (
        tenant_id = current_tenant_id()
        AND is_admin()
    );

-- ============================================
-- DOCUMENT POLICIES
-- ============================================

-- Documents: Self-service (own documents)
CREATE POLICY document_self_service ON employee_documents
    FOR SELECT
    USING (
        tenant_id = current_tenant_id()
        AND (
            employee_id = current_user_id()
            OR is_admin()
            OR is_manager_of(employee_id)
        )
    );

-- Documents: Admin can manage
CREATE POLICY document_admin_manage ON employee_documents
    FOR ALL
    USING (
        tenant_id = current_tenant_id()
        AND is_admin()
    );

-- ============================================
-- LEAVE POLICIES
-- ============================================

-- Leave requests: Self-service
CREATE POLICY leave_request_self_service ON leave_requests
    FOR ALL
    USING (
        tenant_id = current_tenant_id()
        AND (
            employee_id = current_user_id()
            OR is_admin()
            OR is_manager_of(employee_id)
        )
    );

-- Leave balances: Self-service view
CREATE POLICY leave_balance_self_service ON leave_balances
    FOR SELECT
    USING (
        tenant_id = current_tenant_id()
        AND (
            employee_id = current_user_id()
            OR is_admin()
            OR is_manager_of(employee_id)
        )
    );

-- ============================================
-- COMPENSATION POLICIES (RESTRICTIVE)
-- ============================================

-- Compensation: Self-service (own records only)
CREATE POLICY compensation_self_service ON compensation_records
    FOR SELECT
    USING (
        tenant_id = current_tenant_id()
        AND employee_id = current_user_id()
    );

-- Compensation: Admin full access
CREATE POLICY compensation_admin_manage ON compensation_records
    FOR ALL
    USING (
        tenant_id = current_tenant_id()
        AND is_admin()
    );

-- Compensation: Managers cannot see direct report compensation
-- (Intentionally omitted - requires explicit payroll permission)

-- ============================================
-- WORKFLOW POLICIES
-- ============================================

-- Workflows: Self-service
CREATE POLICY workflow_self_service ON workflows
    FOR SELECT
    USING (
        tenant_id = current_tenant_id()
        AND (
            initiator_id = current_user_id()
            OR is_admin()
        )
    );

-- Approval steps: Approvers can see/update their steps
CREATE POLICY approval_step_approver ON approval_steps
    FOR ALL
    USING (
        tenant_id = current_tenant_id()
        AND (
            approver_id = current_user_id()
            OR escalated_to = current_user_id()
            OR is_admin()
        )
    );

-- ============================================
-- AUDIT POLICIES
-- ============================================

-- Audit logs: Admin read-only
CREATE POLICY audit_log_admin_read ON audit_logs
    FOR SELECT
    USING (
        tenant_id = current_tenant_id()
        AND is_admin()
    );

-- Agent runs: Admin read-only
CREATE POLICY agent_run_admin_read ON agent_runs
    FOR SELECT
    USING (
        tenant_id = current_tenant_id()
        AND is_admin()
    );

-- Audit events: Admin read-only
CREATE POLICY audit_event_admin_read ON audit_events
    FOR SELECT
    USING (
        tenant_id = current_tenant_id()
        AND is_admin()
    );

-- ============================================
-- POLICY DOCUMENTS
-- ============================================

-- Policy documents: All employees can read current policies
CREATE POLICY policy_document_read ON policy_documents
    FOR SELECT
    USING (
        tenant_id = current_tenant_id()
    );

-- Policy documents: Admin write
CREATE POLICY policy_document_admin_write ON policy_documents
    FOR ALL
    USING (
        tenant_id = current_tenant_id()
        AND is_admin()
    );

-- ============================================
-- TRIGGERS
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to all tables
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_positions_updated_at BEFORE UPDATE ON positions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON employee_documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leave_balances_updated_at BEFORE UPDATE ON leave_balances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leave_requests_updated_at BEFORE UPDATE ON leave_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_compensation_updated_at BEFORE UPDATE ON compensation_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_milestones_updated_at BEFORE UPDATE ON milestones
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_onboarding_plans_updated_at BEFORE UPDATE ON onboarding_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_onboarding_tasks_updated_at BEFORE UPDATE ON onboarding_tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_offboarding_plans_updated_at BEFORE UPDATE ON offboarding_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_offboarding_tasks_updated_at BEFORE UPDATE ON offboarding_tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON workflows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_approval_steps_updated_at BEFORE UPDATE ON approval_steps
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_report_definitions_updated_at BEFORE UPDATE ON report_definitions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_report_runs_updated_at BEFORE UPDATE ON report_runs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_policy_documents_updated_at BEFORE UPDATE ON policy_documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_policy_chunks_updated_at BEFORE UPDATE ON policy_chunks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
