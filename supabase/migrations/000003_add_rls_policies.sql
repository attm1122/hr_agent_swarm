-- Migration: Comprehensive Row Level Security Policies
-- These policies enforce tenant isolation and role-based access

-- ============================================
-- Helper Functions
-- ============================================

-- Check if current user is admin
CREATE OR REPLACE FUNCTION is_tenant_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN get_current_user_role() = 'admin';
END;
$$ LANGUAGE plpgsql STABLE;

-- Check if current user is manager
CREATE OR REPLACE FUNCTION is_tenant_manager()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN get_current_user_role() IN ('admin', 'manager');
END;
$$ LANGUAGE plpgsql STABLE;

-- Check if user owns the record (for self-service)
CREATE OR REPLACE FUNCTION is_record_owner(record_employee_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN get_current_user_id() = record_employee_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- Get employee's manager ID
CREATE OR REPLACE FUNCTION get_employee_manager_id(p_employee_id UUID)
RETURNS UUID AS $$
DECLARE
    manager_id UUID;
    v_tenant_id UUID;
BEGIN
    v_tenant_id := get_tenant_context();
    
    SELECT e.manager_id INTO manager_id
    FROM employees e
    WHERE e.id = p_employee_id
    AND e.tenant_id = v_tenant_id;
    
    RETURN manager_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- Check if current user manages the employee
CREATE OR REPLACE FUNCTION is_employees_manager(p_employee_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN get_current_user_id() = get_employee_manager_id(p_employee_id);
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- TENANTS (System-wide, minimal access)
-- ============================================

-- Tenants are viewable by all authenticated users in that tenant
DROP POLICY IF EXISTS tenant_view_own ON tenants;
CREATE POLICY tenant_view_own ON tenants
    FOR SELECT USING (
        id = get_tenant_context()
    );

-- Only admins can update tenant settings
DROP POLICY IF EXISTS tenant_admin_update ON tenants;
CREATE POLICY tenant_admin_update ON tenants
    FOR UPDATE USING (
        id = get_tenant_context() AND is_tenant_admin()
    );

-- ============================================
-- EMPLOYEES
-- ============================================

-- Employees can view their own record and their direct reports
-- Managers can view their team
-- Admins can view all
DROP POLICY IF EXISTS employees_select ON employees;
CREATE POLICY employees_select ON employees
    FOR SELECT USING (
        tenant_id = get_tenant_context()
        AND (
            is_tenant_admin()
            OR id = get_current_user_id()
            OR manager_id = get_current_user_id()
        )
    );

-- Only admins and managers can insert employees
DROP POLICY IF EXISTS employees_insert ON employees;
CREATE POLICY employees_insert ON employees
    FOR INSERT WITH CHECK (
        tenant_id = get_tenant_context()
        AND is_tenant_manager()
    );

-- Only admins, managers, or self can update
DROP POLICY IF EXISTS employees_update ON employees;
CREATE POLICY employees_update ON employees
    FOR UPDATE USING (
        tenant_id = get_tenant_context()
        AND (
            is_tenant_manager()
            OR id = get_current_user_id()
        )
    );

-- Only admins can delete employees
DROP POLICY IF EXISTS employees_delete ON employees;
CREATE POLICY employees_delete ON employees
    FOR DELETE USING (
        tenant_id = get_tenant_context()
        AND is_tenant_admin()
    );

-- ============================================
-- TEAMS
-- ============================================

-- All employees can view teams
DROP POLICY IF EXISTS teams_select ON teams;
CREATE POLICY teams_select ON teams
    FOR SELECT USING (
        tenant_id = get_tenant_context()
    );

-- Only managers and admins can modify teams
DROP POLICY IF EXISTS teams_modify ON teams;
CREATE POLICY teams_modify ON teams
    FOR ALL USING (
        tenant_id = get_tenant_context()
        AND is_tenant_manager()
    );

-- ============================================
-- LEAVE REQUESTS
-- ============================================

-- Employees can view their own requests
-- Managers can view requests from their reports
-- Admins can view all
DROP POLICY IF EXISTS leave_requests_select ON leave_requests;
CREATE POLICY leave_requests_select ON leave_requests
    FOR SELECT USING (
        tenant_id = get_tenant_context()
        AND (
            is_tenant_admin()
            OR employee_id = get_current_user_id()
            OR is_employees_manager(employee_id)
        )
    );

-- Employees can create their own requests
DROP POLICY IF EXISTS leave_requests_insert ON leave_requests;
CREATE POLICY leave_requests_insert ON leave_requests
    FOR INSERT WITH CHECK (
        tenant_id = get_tenant_context()
        AND employee_id = get_current_user_id()
    );

-- Employees can update their own pending requests
-- Managers can update to approve/reject
DROP POLICY IF EXISTS leave_requests_update ON leave_requests;
CREATE POLICY leave_requests_update ON leave_requests
    FOR UPDATE USING (
        tenant_id = get_tenant_context()
        AND (
            -- Self can update if still pending
            (employee_id = get_current_user_id() AND status = 'pending')
            -- Manager can approve/reject
            OR (is_employees_manager(employee_id) AND status = 'pending')
            -- Admin can update any
            OR is_tenant_admin()
        )
    );

-- Only admins can delete
DROP POLICY IF EXISTS leave_requests_delete ON leave_requests;
CREATE POLICY leave_requests_delete ON leave_requests
    FOR DELETE USING (
        tenant_id = get_tenant_context()
        AND is_tenant_admin()
    );

-- ============================================
-- LEAVE BALANCES
-- ============================================

-- View own balance or reports' balances (for managers)
DROP POLICY IF EXISTS leave_balances_select ON leave_balances;
CREATE POLICY leave_balances_select ON leave_balances
    FOR SELECT USING (
        tenant_id = get_tenant_context()
        AND (
            is_tenant_admin()
            OR employee_id = get_current_user_id()
            OR is_employees_manager(employee_id)
        )
    );

-- Only system (via triggers) or admins can modify balances
DROP POLICY IF EXISTS leave_balances_modify ON leave_balances;
CREATE POLICY leave_balances_modify ON leave_balances
    FOR ALL USING (
        tenant_id = get_tenant_context()
        AND is_tenant_admin()
    );

-- ============================================
-- WORKFLOWS
-- ============================================

-- View workflows you initiated or need to approve
DROP POLICY IF EXISTS workflows_select ON workflows;
CREATE POLICY workflows_select ON workflows
    FOR SELECT USING (
        tenant_id = get_tenant_context()
        AND (
            is_tenant_admin()
            OR initiated_by = get_current_user_id()
        )
    );

-- Only system or admins can create/modify workflows
DROP POLICY IF EXISTS workflows_modify ON workflows;
CREATE POLICY workflows_modify ON workflows
    FOR ALL USING (
        tenant_id = get_tenant_context()
        AND is_tenant_manager()
    );

-- ============================================
-- APPROVAL STEPS
-- ============================================

-- View steps you can approve or related to your workflows
DROP POLICY IF EXISTS approval_steps_select ON approval_steps;
CREATE POLICY approval_steps_select ON approval_steps
    FOR SELECT USING (
        tenant_id = get_tenant_context()
        AND (
            is_tenant_admin()
            OR approver_id = get_current_user_id()
        )
    );

-- Only system or admins can modify
DROP POLICY IF EXISTS approval_steps_modify ON approval_steps;
CREATE POLICY approval_steps_modify ON approval_steps
    FOR ALL USING (
        tenant_id = get_tenant_context()
        AND is_tenant_manager()
    );

-- ============================================
-- ONBOARDING/OFFBOARDING
-- ============================================

-- HR and admins can view all onboarding
-- Employees can view their own
DROP POLICY IF EXISTS onboarding_plans_select ON onboarding_plans;
CREATE POLICY onboarding_plans_select ON onboarding_plans
    FOR SELECT USING (
        tenant_id = get_tenant_context()
        AND (
            is_tenant_admin()
            OR employee_id = get_current_user_id()
            OR assigned_to = get_current_user_id()
        )
    );

DROP POLICY IF EXISTS onboarding_plans_modify ON onboarding_plans;
CREATE POLICY onboarding_plans_modify ON onboarding_plans
    FOR ALL USING (
        tenant_id = get_tenant_context()
        AND is_tenant_manager()
    );

-- Onboarding tasks
DROP POLICY IF EXISTS onboarding_tasks_select ON onboarding_tasks;
CREATE POLICY onboarding_tasks_select ON onboarding_tasks
    FOR SELECT USING (
        tenant_id = get_tenant_context()
        AND (
            is_tenant_admin()
            OR assigned_to = get_current_user_id()
        )
    );

DROP POLICY IF EXISTS onboarding_tasks_modify ON onboarding_tasks;
CREATE POLICY onboarding_tasks_modify ON onboarding_tasks
    FOR ALL USING (
        tenant_id = get_tenant_context()
        AND (
            is_tenant_manager()
            OR assigned_to = get_current_user_id()
        )
    );

-- ============================================
-- DOCUMENTS
-- ============================================

-- Employees can view their own documents
-- Managers can view reports' documents
DROP POLICY IF EXISTS employee_documents_select ON employee_documents;
CREATE POLICY employee_documents_select ON employee_documents
    FOR SELECT USING (
        tenant_id = get_tenant_context()
        AND (
            is_tenant_admin()
            OR employee_id = get_current_user_id()
            OR is_employees_manager(employee_id)
        )
    );

DROP POLICY IF EXISTS employee_documents_modify ON employee_documents;
CREATE POLICY employee_documents_modify ON employee_documents
    FOR ALL USING (
        tenant_id = get_tenant_context()
        AND is_tenant_manager()
    );

-- ============================================
-- AUDIT EVENTS (Read-only for most)
-- ============================================

-- Admins can view all audit events
DROP POLICY IF EXISTS audit_events_select ON audit_events;
CREATE POLICY audit_events_select ON audit_events
    FOR SELECT USING (
        tenant_id = get_tenant_context()
        AND is_tenant_admin()
    );

-- Only system can insert audit events
DROP POLICY IF EXISTS audit_events_insert ON audit_events;
CREATE POLICY audit_events_insert ON audit_events
    FOR INSERT WITH CHECK (
        tenant_id = get_tenant_context()
    );

-- ============================================
-- OUTBOX EVENTS (System only)
-- ============================================

DROP POLICY IF EXISTS outbox_events_select ON outbox_events;
CREATE POLICY outbox_events_select ON outbox_events
    FOR SELECT USING (
        tenant_id = get_tenant_context()
        AND is_tenant_admin()
    );

DROP POLICY IF EXISTS outbox_events_modify ON outbox_events;
CREATE POLICY outbox_events_modify ON outbox_events
    FOR ALL USING (
        tenant_id = get_tenant_context()
    );

-- ============================================
-- Enable RLS on remaining tables
-- ============================================

ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE compensation_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE offboarding_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE offboarding_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;

-- Add basic policies for these tables
DROP POLICY IF EXISTS positions_tenant_isolation ON positions;
CREATE POLICY positions_tenant_isolation ON positions
    FOR ALL USING (tenant_id = get_tenant_context());

DROP POLICY IF EXISTS milestones_tenant_isolation ON milestones;
CREATE POLICY milestones_tenant_isolation ON milestones
    FOR ALL USING (tenant_id = get_tenant_context());

DROP POLICY IF EXISTS compensation_records_tenant_isolation ON compensation_records;
CREATE POLICY compensation_records_tenant_isolation ON compensation_records
    FOR ALL USING (tenant_id = get_tenant_context());

-- Agent runs - admin only
DROP POLICY IF EXISTS agent_runs_admin ON agent_runs;
CREATE POLICY agent_runs_admin ON agent_runs
    FOR ALL USING (tenant_id = get_tenant_context() AND is_tenant_admin());

-- ============================================
-- Triggers for audit logging
-- ============================================

-- Function to log changes to audit_events
CREATE OR REPLACE FUNCTION log_audit_event()
RETURNS TRIGGER AS $$
DECLARE
    v_actor_id UUID := get_current_user_id();
    v_tenant_id UUID := get_tenant_context();
BEGIN
    IF TG_OP = 'DELETE' THEN
        INSERT INTO audit_events (
            tenant_id, event_type, entity_type, entity_id,
            actor_id, actor_type, action, previous_state
        ) VALUES (
            v_tenant_id, 'record_deleted', TG_TABLE_NAME, OLD.id,
            v_actor_id, 'user', 'DELETE', to_jsonb(OLD)
        );
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_events (
            tenant_id, event_type, entity_type, entity_id,
            actor_id, actor_type, action, previous_state, new_state
        ) VALUES (
            v_tenant_id, 'record_updated', TG_TABLE_NAME, NEW.id,
            v_actor_id, 'user', 'UPDATE', to_jsonb(OLD), to_jsonb(NEW)
        );
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO audit_events (
            tenant_id, event_type, entity_type, entity_id,
            actor_id, actor_type, action, new_state
        ) VALUES (
            v_tenant_id, 'record_created', TG_TABLE_NAME, NEW.id,
            v_actor_id, 'user', 'INSERT', to_jsonb(NEW)
        );
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Apply audit triggers to sensitive tables
CREATE TRIGGER audit_employees AFTER INSERT OR UPDATE OR DELETE ON employees
    FOR EACH ROW EXECUTE FUNCTION log_audit_event();

CREATE TRIGGER audit_leave_requests AFTER INSERT OR UPDATE OR DELETE ON leave_requests
    FOR EACH ROW EXECUTE FUNCTION log_audit_event();

CREATE TRIGGER audit_workflows AFTER INSERT OR UPDATE OR DELETE ON workflows
    FOR EACH ROW EXECUTE FUNCTION log_audit_event();

CREATE TRIGGER audit_compensation_records AFTER INSERT OR UPDATE OR DELETE ON compensation_records
    FOR EACH ROW EXECUTE FUNCTION log_audit_event();
