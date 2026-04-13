#!/usr/bin/env tsx
/**
 * Database Seed Script
 * 
 * Seeds the database with initial data for development and testing.
 * Uses Supabase service role for full access.
 * 
 * Usage:
 *   npm run db:seed
 *   
 * Or directly:
 *   SUPABASE_URL=xxx SUPABASE_SERVICE_ROLE_KEY=xxx tsx scripts/seed.ts
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Default tenant
const defaultTenant = {
  id: randomUUID(),
  name: 'Acme Corporation',
  slug: 'acme-corp',
  settings: {
    timezone: 'Australia/Sydney',
    currency: 'AUD',
    dateFormat: 'DD/MM/YYYY',
  },
};

// Teams
const teams = [
  { id: randomUUID(), name: 'Engineering', code: 'ENG', department: 'Technology', cost_center: 'CC-001' },
  { id: randomUUID(), name: 'Product', code: 'PROD', department: 'Technology', cost_center: 'CC-002' },
  { id: randomUUID(), name: 'Sales', code: 'SALES', department: 'Revenue', cost_center: 'CC-003' },
  { id: randomUUID(), name: 'Marketing', code: 'MKT', department: 'Revenue', cost_center: 'CC-004' },
  { id: randomUUID(), name: 'HR', code: 'HR', department: 'Operations', cost_center: 'CC-005' },
  { id: randomUUID(), name: 'Finance', code: 'FIN', department: 'Operations', cost_center: 'CC-006' },
];

// Positions
const positions = [
  { id: randomUUID(), title: 'Software Engineer', level: 'L3', department: 'Technology', job_family: 'Engineering' },
  { id: randomUUID(), title: 'Senior Software Engineer', level: 'L4', department: 'Technology', job_family: 'Engineering' },
  { id: randomUUID(), title: 'Engineering Manager', level: 'L5', department: 'Technology', job_family: 'Engineering' },
  { id: randomUUID(), title: 'Product Manager', level: 'L4', department: 'Technology', job_family: 'Product' },
  { id: randomUUID(), title: 'Sales Representative', level: 'L3', department: 'Revenue', job_family: 'Sales' },
  { id: randomUUID(), title: 'Marketing Specialist', level: 'L3', department: 'Revenue', job_family: 'Marketing' },
  { id: randomUUID(), title: 'HR Manager', level: 'L4', department: 'Operations', job_family: 'HR' },
  { id: randomUUID(), title: 'HR Generalist', level: 'L3', department: 'Operations', job_family: 'HR' },
  { id: randomUUID(), title: 'Finance Manager', level: 'L4', department: 'Operations', job_family: 'Finance' },
  { id: randomUUID(), title: 'CEO', level: 'L7', department: 'Executive', job_family: 'Leadership' },
];

// Employees (will be linked after creation)
const employeesData = [
  { first_name: 'Alice', last_name: 'Johnson', email: 'alice.johnson@acme.com', employee_number: 'EMP001', position_index: 9, team_index: null, manager_index: null, status: 'active' },
  { first_name: 'Bob', last_name: 'Smith', email: 'bob.smith@acme.com', employee_number: 'EMP002', position_index: 2, team_index: 0, manager_index: 0, status: 'active' },
  { first_name: 'Carol', last_name: 'Williams', email: 'carol.williams@acme.com', employee_number: 'EMP003', position_index: 3, team_index: 0, manager_index: 1, status: 'active' },
  { first_name: 'David', last_name: 'Brown', email: 'david.brown@acme.com', employee_number: 'EMP004', position_index: 0, team_index: 0, manager_index: 1, status: 'active' },
  { first_name: 'Eve', last_name: 'Davis', email: 'eve.davis@acme.com', employee_number: 'EMP005', position_index: 0, team_index: 0, manager_index: 1, status: 'active' },
  { first_name: 'Frank', last_name: 'Miller', email: 'frank.miller@acme.com', employee_number: 'EMP006', position_index: 3, team_index: 1, manager_index: 0, status: 'active' },
  { first_name: 'Grace', last_name: 'Wilson', email: 'grace.wilson@acme.com', employee_number: 'EMP007', position_index: 4, team_index: 2, manager_index: 0, status: 'active' },
  { first_name: 'Henry', last_name: 'Moore', email: 'henry.moore@acme.com', employee_number: 'EMP008', position_index: 4, team_index: 2, manager_index: 6, status: 'active' },
  { first_name: 'Ivy', last_name: 'Taylor', email: 'ivy.taylor@acme.com', employee_number: 'EMP009', position_index: 5, team_index: 3, manager_index: 0, status: 'active' },
  { first_name: 'Jack', last_name: 'Anderson', email: 'jack.anderson@acme.com', employee_number: 'EMP010', position_index: 6, team_index: 4, manager_index: 0, status: 'active' },
  { first_name: 'Kate', last_name: 'Thomas', email: 'kate.thomas@acme.com', employee_number: 'EMP011', position_index: 7, team_index: 4, manager_index: 9, status: 'active' },
  { first_name: 'Leo', last_name: 'Jackson', email: 'leo.jackson@acme.com', employee_number: 'EMP012', position_index: 8, team_index: 5, manager_index: 0, status: 'active' },
];

async function seed() {
  console.log('🌱 Starting database seed...\n');

  try {
    // 1. Create tenant
    console.log('Creating tenant...');
    const { error: tenantError } = await supabase
      .from('tenants')
      .insert(defaultTenant);
    
    if (tenantError) throw tenantError;
    console.log(`✅ Created tenant: ${defaultTenant.name}\n`);

    // 2. Create teams
    console.log('Creating teams...');
    const teamsWithTenant = teams.map(t => ({ ...t, tenant_id: defaultTenant.id }));
    const { error: teamsError } = await supabase.from('teams').insert(teamsWithTenant);
    if (teamsError) throw teamsError;
    console.log(`✅ Created ${teams.length} teams\n`);

    // 3. Create positions
    console.log('Creating positions...');
    const positionsWithTenant = positions.map(p => ({ ...p, tenant_id: defaultTenant.id }));
    const { error: positionsError } = await supabase.from('positions').insert(positionsWithTenant);
    if (positionsError) throw positionsError;
    console.log(`✅ Created ${positions.length} positions\n`);

    // 4. Create employees
    console.log('Creating employees...');
    const employeeRecords = employeesData.map((e, index) => ({
      id: randomUUID(),
      tenant_id: defaultTenant.id,
      first_name: e.first_name,
      last_name: e.last_name,
      email: e.email,
      employee_number: e.employee_number,
      hire_date: '2020-01-15',
      status: e.status,
      team_id: e.team_index !== null ? teams[e.team_index].id : null,
      position_id: positions[e.position_index].id,
      manager_id: e.manager_index !== null ? null : null, // Will update after
      employment_type: 'full_time',
    }));

    const { error: employeesError } = await supabase.from('employees').insert(employeeRecords);
    if (employeesError) throw employeesError;
    console.log(`✅ Created ${employeeRecords.length} employees\n`);

    // 5. Update manager relationships
    console.log('Updating manager relationships...');
    for (let i = 0; i < employeesData.length; i++) {
      const empData = employeesData[i];
      if (empData.manager_index !== null) {
        const managerId = employeeRecords[empData.manager_index].id;
        const { error: updateError } = await supabase
          .from('employees')
          .update({ manager_id: managerId })
          .eq('id', employeeRecords[i].id);
        
        if (updateError) throw updateError;
      }
    }
    console.log('✅ Updated manager relationships\n');

    // 6. Create leave balances
    console.log('Creating leave balances...');
    const leaveBalances = employeeRecords.flatMap(emp => [
      {
        tenant_id: defaultTenant.id,
        employee_id: emp.id,
        leave_type: 'annual',
        entitlement_days: 20,
        taken_days: 5,
        pending_days: 2,
        remaining_days: 13,
        period_start: '2024-01-01',
        period_end: '2024-12-31',
      },
      {
        tenant_id: defaultTenant.id,
        employee_id: emp.id,
        leave_type: 'sick',
        entitlement_days: 10,
        taken_days: 2,
        pending_days: 0,
        remaining_days: 8,
        period_start: '2024-01-01',
        period_end: '2024-12-31',
      },
    ]);

    const { error: balancesError } = await supabase.from('leave_balances').insert(leaveBalances);
    if (balancesError) throw balancesError;
    console.log(`✅ Created ${leaveBalances.length} leave balances\n`);

    // 7. Create sample leave requests
    console.log('Creating leave requests...');
    const leaveRequests = [
      {
        tenant_id: defaultTenant.id,
        employee_id: employeeRecords[3].id,
        leave_type: 'annual',
        start_date: '2024-12-23',
        end_date: '2024-12-27',
        days_requested: 5,
        reason: 'Christmas holiday',
        status: 'approved',
        approved_by: employeeRecords[1].id,
        approved_at: new Date().toISOString(),
      },
      {
        tenant_id: defaultTenant.id,
        employee_id: employeeRecords[4].id,
        leave_type: 'sick',
        start_date: '2024-11-15',
        end_date: '2024-11-15',
        days_requested: 1,
        reason: 'Doctor appointment',
        status: 'pending',
      },
    ];

    const { error: leaveError } = await supabase.from('leave_requests').insert(leaveRequests);
    if (leaveError) throw leaveError;
    console.log(`✅ Created ${leaveRequests.length} leave requests\n`);

    // 8. Create milestones
    console.log('Creating milestones...');
    const milestones = [
      {
        tenant_id: defaultTenant.id,
        employee_id: employeeRecords[3].id,
        milestone_type: 'probation_end',
        milestone_date: '2024-04-15',
        description: '90-day probation review due',
        alert_days_before: 14,
        status: 'upcoming',
      },
      {
        tenant_id: defaultTenant.id,
        employee_id: employeeRecords[0].id,
        milestone_type: 'service_anniversary',
        milestone_date: '2024-01-15',
        description: '4 year work anniversary',
        alert_days_before: 30,
        status: 'upcoming',
      },
    ];

    const { error: milestonesError } = await supabase.from('milestones').insert(milestones);
    if (milestonesError) throw milestonesError;
    console.log(`✅ Created ${milestones.length} milestones\n`);

    // 9. Create policy documents
    console.log('Creating policy documents...');
    const policies = [
      {
        tenant_id: defaultTenant.id,
        title: 'Employee Leave Policy',
        category: 'leave',
        version: '2.1',
        effective_date: '2024-01-01',
        content_hash: 'abc123',
      },
      {
        tenant_id: defaultTenant.id,
        title: 'Code of Conduct',
        category: 'compliance',
        version: '1.5',
        effective_date: '2024-06-01',
        content_hash: 'def456',
      },
      {
        tenant_id: defaultTenant.id,
        title: 'Remote Work Policy',
        category: 'workplace',
        version: '1.0',
        effective_date: '2024-03-01',
        content_hash: 'ghi789',
      },
    ];

    const { error: policiesError } = await supabase.from('policy_documents').insert(policies);
    if (policiesError) throw policiesError;
    console.log(`✅ Created ${policies.length} policy documents\n`);

    // 10. Create document requirements
    console.log('Creating document requirements...');
    const docRequirements = [
      {
        tenant_id: defaultTenant.id,
        category: 'contract',
        employment_types: ['full_time', 'part_time'],
        required: true,
        expires: false,
      },
      {
        tenant_id: defaultTenant.id,
        category: 'visa',
        employment_types: ['full_time', 'part_time'],
        required: true,
        expires: true,
        expiration_warning_days: 90,
      },
      {
        tenant_id: defaultTenant.id,
        category: 'tax',
        employment_types: ['full_time', 'part_time', 'contract'],
        required: true,
        expires: false,
      },
    ];

    const { error: docReqError } = await supabase.from('document_requirements').insert(docRequirements);
    if (docReqError) throw docReqError;
    console.log(`✅ Created ${docRequirements.length} document requirements\n`);

    console.log('✨ Seed completed successfully!');
    console.log(`\nTenant ID: ${defaultTenant.id}`);
    console.log('Use this tenant ID in your JWT claims for testing');

  } catch (error) {
    console.error('\n❌ Seed failed:', error);
    process.exit(1);
  }
}

seed();
