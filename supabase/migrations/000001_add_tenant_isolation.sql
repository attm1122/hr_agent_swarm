-- Migration: Add Tenant Isolation
-- This migration adds tenant_id columns to all tables and creates RLS policies

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create tenants table first
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create outbox_events table for reliable event publishing
CREATE TABLE IF NOT EXISTS outbox_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    aggregate_type TEXT NOT NULL,
    aggregate_id TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    headers JSONB DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for outbox processing
CREATE INDEX idx_outbox_events_status ON outbox_events(status);
CREATE INDEX idx_outbox_events_created_at ON outbox_events(created_at);
CREATE INDEX idx_outbox_events_tenant ON outbox_events(tenant_id);

-- Function to add tenant_id to existing tables
CREATE OR REPLACE FUNCTION add_tenant_id_to_table(table_name TEXT)
RETURNS VOID AS $$
BEGIN
    -- Check if column already exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = $1 AND column_name = 'tenant_id'
    ) THEN
        EXECUTE format('ALTER TABLE %I ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE', table_name);
        EXECUTE format('CREATE INDEX idx_%I_tenant ON %I(tenant_id)', table_name, table_name);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Add tenant_id to all existing tables
SELECT add_tenant_id_to_table('employees');
SELECT add_tenant_id_to_table('teams');
SELECT add_tenant_id_to_table('positions');
SELECT add_tenant_id_to_table('employee_documents');
SELECT add_tenant_id_to_table('document_requirements');
SELECT add_tenant_id_to_table('leave_balances');
SELECT add_tenant_id_to_table('leave_requests');
SELECT add_tenant_id_to_table('compensation_records');
SELECT add_tenant_id_to_table('milestones');
SELECT add_tenant_id_to_table('onboarding_plans');
SELECT add_tenant_id_to_table('onboarding_tasks');
SELECT add_tenant_id_to_table('offboarding_plans');
SELECT add_tenant_id_to_table('offboarding_tasks');
SELECT add_tenant_id_to_table('offboarding_assets');
SELECT add_tenant_id_to_table('offboarding_access');
SELECT add_tenant_id_to_table('workflows');
SELECT add_tenant_id_to_table('approval_steps');
SELECT add_tenant_id_to_table('audit_events');
SELECT add_tenant_id_to_table('agent_runs');
SELECT add_tenant_id_to_table('report_definitions');
SELECT add_tenant_id_to_table('report_runs');
SELECT add_tenant_id_to_table('policy_documents');
SELECT add_tenant_id_to_table('policy_chunks');

-- Enable Row Level Security on all tables
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
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

-- Create RLS policies for tenant isolation
-- Each policy ensures users can only see data from their tenant

CREATE POLICY tenant_isolation_employees ON employees
    FOR ALL USING (tenant_id = current_setting('app.current_tenant')::UUID);

CREATE POLICY tenant_isolation_teams ON teams
    FOR ALL USING (tenant_id = current_setting('app.current_tenant')::UUID);

CREATE POLICY tenant_isolation_leave_requests ON leave_requests
    FOR ALL USING (tenant_id = current_setting('app.current_tenant')::UUID);

CREATE POLICY tenant_isolation_workflows ON workflows
    FOR ALL USING (tenant_id = current_setting('app.current_tenant')::UUID);

-- Function to set current tenant in session
CREATE OR REPLACE FUNCTION set_tenant_context(tenant_id UUID)
RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.current_tenant', tenant_id::text, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current tenant from session
CREATE OR REPLACE FUNCTION get_tenant_context()
RETURNS UUID AS $$
BEGIN
    RETURN current_setting('app.current_tenant', true)::UUID;
EXCEPTION
    WHEN OTHERS THEN RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Trigger function to enforce tenant_id on insert/update
CREATE OR REPLACE FUNCTION enforce_tenant_id()
RETURNS TRIGGER AS $$
BEGIN
    -- For INSERT, tenant_id must match the session context
    IF TG_OP = 'INSERT' THEN
        IF NEW.tenant_id IS NULL THEN
            NEW.tenant_id := get_tenant_context();
        ELSIF NEW.tenant_id != get_tenant_context() THEN
            RAISE EXCEPTION 'Tenant ID mismatch: cannot insert data for different tenant';
        END IF;
    END IF;
    
    -- For UPDATE, tenant_id cannot be changed
    IF TG_OP = 'UPDATE' AND NEW.tenant_id != OLD.tenant_id THEN
        RAISE EXCEPTION 'Cannot change tenant_id on existing records';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply tenant enforcement triggers
CREATE TRIGGER enforce_tenant_employees BEFORE INSERT OR UPDATE ON employees
    FOR EACH ROW EXECUTE FUNCTION enforce_tenant_id();

CREATE TRIGGER enforce_tenant_teams BEFORE INSERT OR UPDATE ON teams
    FOR EACH ROW EXECUTE FUNCTION enforce_tenant_id();

CREATE TRIGGER enforce_tenant_leave_requests BEFORE INSERT OR UPDATE ON leave_requests
    FOR EACH ROW EXECUTE FUNCTION enforce_tenant_id();

CREATE TRIGGER enforce_tenant_workflows BEFORE INSERT OR UPDATE ON workflows
    FOR EACH ROW EXECUTE FUNCTION enforce_tenant_id();

-- Clean up helper function
DROP FUNCTION add_tenant_id_to_table;

-- Insert default tenant for migration
INSERT INTO tenants (id, name, slug, status)
VALUES ('00000000-0000-0000-0000-000000000000', 'Default Tenant', 'default', 'active')
ON CONFLICT (id) DO NOTHING;

-- Update existing records to use default tenant
UPDATE employees SET tenant_id = '00000000-0000-0000-0000-000000000000' WHERE tenant_id IS NULL;
UPDATE teams SET tenant_id = '00000000-0000-0000-0000-000000000000' WHERE tenant_id IS NULL;
UPDATE leave_requests SET tenant_id = '00000000-0000-0000-0000-000000000000' WHERE tenant_id IS NULL;

-- Make tenant_id NOT NULL after migration
ALTER TABLE employees ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE teams ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE leave_requests ALTER COLUMN tenant_id SET NOT NULL;
