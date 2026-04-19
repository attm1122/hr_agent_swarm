-- Seed Data for HR Agent Swarm
-- Run this after migrations to populate initial data

-- ============================================
-- 1. Create Default Tenant
-- ============================================
INSERT INTO tenants (id, name, slug, status, settings)
VALUES (
    '00000000-0000-0000-0000-000000000000',
    'Default Organization',
    'default',
    'active',
    '{
        "timezone": "UTC",
        "currency": "USD",
        "date_format": "YYYY-MM-DD",
        "working_hours": {
            "start": "09:00",
            "end": "17:00"
        }
    }'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 2. Create Document Requirements
-- ============================================
INSERT INTO document_requirements (tenant_id, category, employment_types, required, expires, expiration_warning_days)
VALUES
    ('00000000-0000-0000-0000-000000000000', 'contract', ARRAY['full_time', 'part_time', 'contract'], true, false, null),
    ('00000000-0000-0000-0000-000000000000', 'visa', ARRAY['full_time', 'part_time'], true, true, 30),
    ('00000000-0000-0000-0000-000000000000', 'certification', ARRAY['full_time', 'part_time', 'contract'], false, true, 60),
    ('00000000-0000-0000-0000-000000000000', 'id', ARRAY['full_time', 'part_time', 'contract', 'intern'], true, false, null),
    ('00000000-0000-0000-0000-000000000000', 'medical', ARRAY['full_time', 'part_time'], true, true, 30),
    ('00000000-0000-0000-0000-000000000000', 'tax', ARRAY['full_time', 'part_time', 'contract'], true, true, 30),
    ('00000000-0000-0000-0000-000000000000', 'performance', ARRAY['full_time', 'part_time'], false, false, null)
ON CONFLICT DO NOTHING;

-- ============================================
-- 3. Create Sample Teams
-- ============================================
INSERT INTO teams (id, tenant_id, name, code, department, parent_team_id)
VALUES
    ('team-001', '00000000-0000-0000-0000-000000000000', 'Engineering', 'ENG', 'Technology', null),
    ('team-002', '00000000-0000-0000-0000-000000000000', 'Product', 'PROD', 'Technology', null),
    ('team-003', '00000000-0000-0000-0000-000000000000', 'Human Resources', 'HR', 'Operations', null),
    ('team-004', '00000000-0000-0000-0000-000000000000', 'Finance', 'FIN', 'Operations', null),
    ('team-005', '00000000-0000-0000-0000-000000000000', 'Sales', 'SALES', 'Revenue', null),
    ('team-006', '00000000-0000-0000-0000-000000000000', 'Marketing', 'MKT', 'Revenue', null),
    ('team-007', '00000000-0000-0000-0000-000000000000', 'Frontend Engineering', 'ENG-FE', 'Technology', 'team-001'),
    ('team-008', '00000000-0000-0000-0000-000000000000', 'Backend Engineering', 'ENG-BE', 'Technology', 'team-001')
ON CONFLICT DO NOTHING;

-- ============================================
-- 4. Create Positions
-- ============================================
INSERT INTO positions (id, tenant_id, title, level, department, job_family)
VALUES
    ('pos-001', '00000000-0000-0000-0000-000000000000', 'Software Engineer', 'L3', 'Technology', 'Engineering'),
    ('pos-002', '00000000-0000-0000-0000-000000000000', 'Senior Software Engineer', 'L4', 'Technology', 'Engineering'),
    ('pos-003', '00000000-0000-0000-0000-000000000000', 'Engineering Manager', 'L5', 'Technology', 'Engineering'),
    ('pos-004', '00000000-0000-0000-0000-000000000000', 'Product Manager', 'L4', 'Technology', 'Product'),
    ('pos-005', '00000000-0000-0000-0000-000000000000', 'HR Manager', 'L5', 'Operations', 'HR'),
    ('pos-006', '00000000-0000-0000-0000-000000000000', 'HR Generalist', 'L3', 'Operations', 'HR'),
    ('pos-007', '00000000-0000-0000-0000-000000000000', 'Sales Representative', 'L3', 'Revenue', 'Sales'),
    ('pos-008', '00000000-0000-0000-0000-000000000000', 'Marketing Specialist', 'L3', 'Revenue', 'Marketing'),
    ('pos-009', '00000000-0000-0000-0000-000000000000', 'Finance Analyst', 'L3', 'Operations', 'Finance'),
    ('pos-010', '00000000-0000-0000-0000-000000000000', 'Chief Technology Officer', 'L8', 'Technology', 'Engineering')
ON CONFLICT DO NOTHING;

-- ============================================
-- 5. Create Sample Employees (for development)
-- ============================================
-- Note: In production, employees are created via auth trigger
INSERT INTO employees (
    id, tenant_id, email, first_name, last_name, employee_number,
    hire_date, status, employment_type, team_id, position_id, manager_id,
    work_location, created_at, updated_at
) VALUES
    -- CEO
    ('emp-001', '00000000-0000-0000-0000-000000000000', 'ceo@company.com', 'Alice', 'Johnson', 'EMP-001',
     '2020-01-15', 'active', 'full_time', null, null, null,
     'hybrid', NOW(), NOW()),
    
    -- CTO
    ('emp-002', '00000000-0000-0000-0000-000000000000', 'cto@company.com', 'Bob', 'Smith', 'EMP-002',
     '2020-02-01', 'active', 'full_time', 'team-001', 'pos-010', 'emp-001',
     'hybrid', NOW(), NOW()),
    
    -- Engineering Manager
    ('emp-003', '00000000-0000-0000-0000-000000000000', 'eng.manager@company.com', 'Carol', 'Williams', 'EMP-003',
     '2021-03-15', 'active', 'full_time', 'team-001', 'pos-003', 'emp-002',
     'onsite', NOW(), NOW()),
    
    -- Senior Engineer 1
    ('emp-004', '00000000-0000-0000-0000-000000000000', 'senior.dev1@company.com', 'David', 'Brown', 'EMP-004',
     '2021-06-01', 'active', 'full_time', 'team-007', 'pos-002', 'emp-003',
     'remote', NOW(), NOW()),
    
    -- Senior Engineer 2
    ('emp-005', '00000000-0000-0000-0000-000000000000', 'senior.dev2@company.com', 'Eve', 'Davis', 'EMP-005',
     '2022-01-10', 'active', 'full_time', 'team-008', 'pos-002', 'emp-003',
     'hybrid', NOW(), NOW()),
    
    -- Software Engineer 1
    ('emp-006', '00000000-0000-0000-0000-000000000000', 'dev1@company.com', 'Frank', 'Miller', 'EMP-006',
     '2023-03-01', 'active', 'full_time', 'team-007', 'pos-001', 'emp-004',
     'remote', NOW(), NOW()),
    
    -- Software Engineer 2
    ('emp-007', '00000000-0000-0000-0000-000000000000', 'dev2@company.com', 'Grace', 'Wilson', 'EMP-007',
     '2023-06-15', 'active', 'full_time', 'team-008', 'pos-001', 'emp-005',
     'hybrid', NOW(), NOW()),
    
    -- HR Manager
    ('emp-008', '00000000-0000-0000-0000-000000000000', 'hr.manager@company.com', 'Henry', 'Moore', 'EMP-008',
     '2020-05-01', 'active', 'full_time', 'team-003', 'pos-005', 'emp-001',
     'onsite', NOW(), NOW()),
    
    -- HR Generalist
    ('emp-009', '00000000-0000-0000-0000-000000000000', 'hr@company.com', 'Ivy', 'Taylor', 'EMP-009',
     '2022-08-01', 'active', 'full_time', 'team-003', 'pos-006', 'emp-008',
     'hybrid', NOW(), NOW()),
    
    -- Product Manager
    ('emp-010', '00000000-0000-0000-0000-000000000000', 'pm@company.com', 'Jack', 'Anderson', 'EMP-010',
     '2021-09-01', 'active', 'full_time', 'team-002', 'pos-004', 'emp-002',
     'hybrid', NOW(), NOW())
ON CONFLICT DO NOTHING;

-- ============================================
-- 6. Create Leave Balances for Employees
-- ============================================
INSERT INTO leave_balances (
    tenant_id, employee_id, leave_type, entitlement_days, 
    taken_days, pending_days, remaining_days, period_start, period_end
)
SELECT 
    '00000000-0000-0000-0000-000000000000' as tenant_id,
    e.id as employee_id,
    lt.leave_type,
    lt.entitlement as entitlement_days,
    0 as taken_days,
    0 as pending_days,
    lt.entitlement as remaining_days,
    DATE_TRUNC('year', CURRENT_DATE) as period_start,
    DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '1 year' - INTERVAL '1 day' as period_end
FROM employees e
CROSS JOIN (
    VALUES 
        ('annual', 20),
        ('sick', 10),
        ('personal', 3)
) AS lt(leave_type, entitlement)
WHERE e.status = 'active'
ON CONFLICT DO NOTHING;

-- ============================================
-- 7. Create Sample Leave Requests
-- ============================================
INSERT INTO leave_requests (
    tenant_id, employee_id, leave_type, start_date, end_date,
    days_requested, reason, status, approved_by, approved_at
)
VALUES
    ('00000000-0000-0000-0000-000000000000', 'emp-004', 'annual', '2025-02-10', '2025-02-14', 5, 'Family vacation', 'approved', 'emp-003', NOW()),
    ('00000000-0000-0000-0000-000000000000', 'emp-006', 'sick', '2025-01-15', '2025-01-16', 2, 'Flu recovery', 'approved', 'emp-004', NOW()),
    ('00000000-0000-0000-0000-000000000000', 'emp-007', 'annual', '2025-03-20', '2025-03-21', 2, 'Personal time', 'pending', null, null),
    ('00000000-0000-0000-0000-000000000000', 'emp-009', 'personal', '2025-02-05', '2025-02-05', 1, 'Doctor appointment', 'approved', 'emp-008', NOW())
ON CONFLICT DO NOTHING;

-- ============================================
-- 8. Create Sample Milestones
-- ============================================
INSERT INTO milestones (
    tenant_id, employee_id, milestone_type, milestone_date, due_date,
    description, alert_days_before, status
)
VALUES
    ('00000000-0000-0000-0000-000000000000', 'emp-006', 'probation_end', '2025-06-01', '2025-06-01', '90-day probation review', 7, 'pending'),
    ('00000000-0000-0000-0000-000000000000', 'emp-007', 'probation_end', '2025-06-15', '2025-06-15', '90-day probation review', 7, 'pending'),
    ('00000000-0000-0000-0000-000000000000', 'emp-004', 'work_anniversary', '2025-06-01', '2025-06-01', '4-year work anniversary', 14, 'upcoming'),
    ('00000000-0000-0000-0000-000000000000', 'emp-008', 'performance_review', '2025-04-15', '2025-04-15', 'Annual performance review', 30, 'upcoming')
ON CONFLICT DO NOTHING;

-- ============================================
-- 9. Create Sample Workflows
-- ============================================
INSERT INTO workflows (
    tenant_id, workflow_type, entity_type, entity_id, status,
    initiated_by, current_step, total_steps, context
)
VALUES
    ('00000000-0000-0000-0000-000000000000', 'leave_approval', 'leave_request', 'lr-001', 'completed', 'emp-004', 2, 2, '{"leave_type": "annual", "days": 5}'::jsonb),
    ('00000000-0000-0000-0000-000000000000', 'leave_approval', 'leave_request', 'lr-002', 'in_progress', 'emp-007', 1, 2, '{"leave_type": "annual", "days": 2}'::jsonb)
ON CONFLICT DO NOTHING;

-- Update workflow IDs to match leave requests
UPDATE workflows 
SET entity_id = lr.id::text
FROM leave_requests lr
WHERE workflows.tenant_id = lr.tenant_id
AND workflows.initiated_by = lr.employee_id
AND workflows.status = 'in_progress';

-- ============================================
-- 10. Verify seed data
-- ============================================
SELECT 'Tenants' as table_name, COUNT(*) as count FROM tenants
UNION ALL
SELECT 'Employees', COUNT(*) FROM employees
UNION ALL
SELECT 'Teams', COUNT(*) FROM teams
UNION ALL
SELECT 'Positions', COUNT(*) FROM positions
UNION ALL
SELECT 'Leave Balances', COUNT(*) FROM leave_balances
UNION ALL
SELECT 'Leave Requests', COUNT(*) FROM leave_requests
UNION ALL
SELECT 'Milestones', COUNT(*) FROM milestones
UNION ALL
SELECT 'Workflows', COUNT(*) FROM workflows;
