-- Migration: Add RPC Functions for Transactions and Utilities
-- These functions enable safe transaction handling from the application

-- Function to begin a transaction (used by application layer)
-- Note: Actual transaction control is managed by Supabase/postgrest
-- This is a placeholder for compatibility with transaction manager
CREATE OR REPLACE FUNCTION begin_transaction()
RETURNS VOID AS $$
BEGIN
    -- Transactions are automatically managed by postgrest
    -- This function exists for application compatibility
    NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to commit a transaction
CREATE OR REPLACE FUNCTION commit_transaction()
RETURNS VOID AS $$
BEGIN
    -- Transactions are automatically managed by postgrest
    -- This function exists for application compatibility
    NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to rollback a transaction
CREATE OR REPLACE FUNCTION rollback_transaction()
RETURNS VOID AS $$
BEGIN
    -- Transactions are automatically managed by postgrest
    -- This function exists for application compatibility
    NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to set current user context for RLS
CREATE OR REPLACE FUNCTION set_user_context(
    user_id UUID,
    user_role TEXT,
    tenant_id UUID
)
RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.current_user_id', user_id::text, false);
    PERFORM set_config('app.current_user_role', user_role, false);
    PERFORM set_config('app.current_tenant', tenant_id::text, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current user ID from context
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS UUID AS $$
BEGIN
    RETURN current_setting('app.current_user_id', true)::UUID;
EXCEPTION
    WHEN OTHERS THEN RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get current user role from context
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS TEXT AS $$
BEGIN
    RETURN current_setting('app.current_user_role', true);
EXCEPTION
    WHEN OTHERS THEN RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to check if user has admin role
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN get_current_user_role() = 'admin';
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get current timestamp in ISO format
CREATE OR REPLACE FUNCTION now_iso()
RETURNS TEXT AS $$
BEGIN
    RETURN to_json(now())#>>'{}';
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to generate a UUID
CREATE OR REPLACE FUNCTION generate_uuid()
RETURNS UUID AS $$
BEGIN
    RETURN gen_random_uuid();
END;
$$ LANGUAGE plpgsql;

-- Function to safely update with optimistic locking
CREATE OR REPLACE FUNCTION update_with_version_check(
    table_name TEXT,
    record_id UUID,
    tenant_id UUID,
    update_data JSONB,
    expected_version INTEGER
)
RETURNS JSONB AS $$
DECLARE
    current_version INTEGER;
    result JSONB;
BEGIN
    -- Get current version
    EXECUTE format('SELECT version FROM %I WHERE id = $1 AND tenant_id = $2', table_name)
    INTO current_version
    USING record_id, tenant_id;
    
    -- Check version
    IF current_version IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Record not found');
    END IF;
    
    IF current_version != expected_version THEN
        RETURN jsonb_build_object('success', false, 'error', 'Version conflict', 'current_version', current_version);
    END IF;
    
    -- Perform update
    EXECUTE format(
        'UPDATE %I SET data = $1, version = $2, updated_at = now() WHERE id = $3 AND tenant_id = $4 RETURNING to_jsonb(%I.*)',
        table_name, table_name
    )
    INTO result
    USING update_data, expected_version + 1, record_id, tenant_id;
    
    RETURN jsonb_build_object('success', true, 'data', result);
END;
$$ LANGUAGE plpgsql;

-- Function to process outbox events (can be called by pg_cron or edge function)
CREATE OR REPLACE FUNCTION process_outbox_events(batch_size INTEGER DEFAULT 100)
RETURNS TABLE(
    processed_count INTEGER,
    failed_count INTEGER
) AS $$
DECLARE
    v_processed INTEGER := 0;
    v_failed INTEGER := 0;
BEGIN
    -- This is a stub - actual processing happens in application layer
    -- or via Supabase Edge Functions for external event publishing
    SELECT COUNT(*)::INTEGER INTO v_processed
    FROM outbox_events
    WHERE status = 'pending'
    LIMIT batch_size;
    
    RETURN QUERY SELECT v_processed, v_failed;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old audit events
CREATE OR REPLACE FUNCTION cleanup_old_audit_events(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM audit_events
    WHERE created_at < now() - interval '1 day' * days_to_keep;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get employee by email (for auth lookup)
CREATE OR REPLACE FUNCTION get_employee_by_email(p_email TEXT)
RETURNS TABLE(
    id UUID,
    email TEXT,
    first_name TEXT,
    last_name TEXT,
    role TEXT,
    tenant_id UUID,
    status TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.id,
        e.email,
        e.first_name,
        e.last_name,
        'employee'::TEXT as role, -- Default role, customize as needed
        e.tenant_id,
        e.status
    FROM employees e
    WHERE e.email = p_email
    AND e.status = 'active'
    LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to create employee from auth user
CREATE OR REPLACE FUNCTION create_employee_from_auth(
    auth_user_id UUID,
    p_email TEXT,
    p_first_name TEXT,
    p_last_name TEXT,
    p_tenant_id UUID
)
RETURNS UUID AS $$
DECLARE
    new_employee_id UUID;
BEGIN
    INSERT INTO employees (
        id,
        email,
        first_name,
        last_name,
        tenant_id,
        employee_number,
        hire_date,
        status,
        employment_type
    ) VALUES (
        auth_user_id,
        p_email,
        p_first_name,
        p_last_name,
        p_tenant_id,
        'EMP-' || substring(gen_random_uuid()::text, 1, 8),
        CURRENT_DATE,
        'active',
        'full_time'
    )
    RETURNING id INTO new_employee_id;
    
    RETURN new_employee_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to all tables
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leave_requests_updated_at BEFORE UPDATE ON leave_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON workflows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_onboarding_plans_updated_at BEFORE UPDATE ON onboarding_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_offboarding_plans_updated_at BEFORE UPDATE ON offboarding_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
