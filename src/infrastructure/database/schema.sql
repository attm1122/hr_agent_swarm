-- HR Agent Swarm Database Schema
-- Supabase PostgreSQL

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CORE ENTITIES
-- ============================================

CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    parent_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    department TEXT NOT NULL,
    cost_center TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    level TEXT NOT NULL,
    department TEXT NOT NULL,
    job_family TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    employee_number TEXT UNIQUE NOT NULL,
    hire_date DATE NOT NULL,
    termination_date DATE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'on_leave', 'terminated', 'pending')),
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    position_id UUID REFERENCES positions(id) ON DELETE SET NULL,
    manager_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    work_location TEXT CHECK (work_location IN ('onsite', 'remote', 'hybrid')),
    employment_type TEXT NOT NULL DEFAULT 'full_time' CHECK (employment_type IN ('full_time', 'part_time', 'contract', 'intern')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- DOCUMENT DOMAIN
-- ============================================

CREATE TABLE document_requirements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    UNIQUE(employee_id, leave_type, period_start)
);

CREATE TABLE leave_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
-- WORKFLOW DOMAIN
-- ============================================

CREATE TABLE workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_type TEXT NOT NULL CHECK (workflow_type IN ('leave_approval', 'salary_change', 'promotion', 'termination', 'onboarding', 'offboarding', 'document_approval')),
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
-- INDEXES
-- ============================================

CREATE INDEX idx_employees_team ON employees(team_id);
CREATE INDEX idx_employees_manager ON employees(manager_id);
CREATE INDEX idx_employees_status ON employees(status);
CREATE INDEX idx_employees_hire_date ON employees(hire_date);

CREATE INDEX idx_documents_employee ON employee_documents(employee_id);
CREATE INDEX idx_documents_status ON employee_documents(status);
CREATE INDEX idx_documents_expires ON employee_documents(expires_at);

CREATE INDEX idx_leave_balances_employee ON leave_balances(employee_id);
CREATE INDEX idx_leave_requests_employee ON leave_requests(employee_id);
CREATE INDEX idx_leave_requests_status ON leave_requests(status);
CREATE INDEX idx_leave_requests_dates ON leave_requests(start_date, end_date);

CREATE INDEX idx_compensation_employee ON compensation_records(employee_id);
CREATE INDEX idx_compensation_effective ON compensation_records(effective_date);

CREATE INDEX idx_milestones_employee ON milestones(employee_id);
CREATE INDEX idx_milestones_date ON milestones(milestone_date);
CREATE INDEX idx_milestones_status ON milestones(status);

CREATE INDEX idx_onboarding_employee ON onboarding_plans(employee_id);
CREATE INDEX idx_onboarding_tasks_plan ON onboarding_tasks(plan_id);
CREATE INDEX idx_onboarding_tasks_assigned ON onboarding_tasks(assigned_to);

CREATE INDEX idx_workflows_initiator ON workflows(initiator_id);
CREATE INDEX idx_workflows_status ON workflows(status);
CREATE INDEX idx_workflows_reference ON workflows(reference_type, reference_id);
CREATE INDEX idx_approval_steps_workflow ON approval_steps(workflow_id);
CREATE INDEX idx_approval_steps_approver ON approval_steps(approver_id);

CREATE INDEX idx_audit_entity ON audit_events(entity_type, entity_id);
CREATE INDEX idx_audit_created ON audit_events(created_at);
CREATE INDEX idx_audit_actor ON audit_events(actor_id);

CREATE INDEX idx_agent_runs_type ON agent_runs(agent_type);
CREATE INDEX idx_agent_runs_created ON agent_runs(created_at);

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
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_positions_updated_at BEFORE UPDATE ON positions
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
CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON workflows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_approval_steps_updated_at BEFORE UPDATE ON approval_steps
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
