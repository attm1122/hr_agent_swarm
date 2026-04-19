#!/usr/bin/env tsx
/**
 * Local Development Seed
 * 
 * Seeds mock data for local development without Supabase.
 * This works with MOCK_AUTH_ENABLED=true.
 */

import { writeFileSync } from 'fs';

const mockData = {
  employees: [
    {
      id: 'emp-001',
      tenant_id: '00000000-0000-0000-0000-000000000000',
      email: 'ceo@company.com',
      first_name: 'Alice',
      last_name: 'Johnson',
      employee_number: 'EMP-001',
      hire_date: '2020-01-15',
      status: 'active',
      employment_type: 'full_time',
      team_id: null,
      position_id: null,
      manager_id: null,
      work_location: 'hybrid',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'emp-002',
      tenant_id: '00000000-0000-0000-0000-000000000000',
      email: 'dev@company.com',
      first_name: 'Bob',
      last_name: 'Smith',
      employee_number: 'EMP-002',
      hire_date: '2021-03-01',
      status: 'active',
      employment_type: 'full_time',
      team_id: 'team-001',
      position_id: 'pos-001',
      manager_id: 'emp-001',
      work_location: 'remote',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'emp-003',
      tenant_id: '00000000-0000-0000-0000-000000000000',
      email: 'hr@company.com',
      first_name: 'Carol',
      last_name: 'Williams',
      employee_number: 'EMP-003',
      hire_date: '2020-06-15',
      status: 'active',
      employment_type: 'full_time',
      team_id: 'team-002',
      position_id: 'pos-002',
      manager_id: 'emp-001',
      work_location: 'onsite',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
  teams: [
    {
      id: 'team-001',
      tenant_id: '00000000-0000-0000-0000-000000000000',
      name: 'Engineering',
      code: 'ENG',
      department: 'Technology',
      parent_team_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'team-002',
      tenant_id: '00000000-0000-0000-0000-000000000000',
      name: 'Human Resources',
      code: 'HR',
      department: 'Operations',
      parent_team_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
  leave_requests: [
    {
      id: 'lr-001',
      tenant_id: '00000000-0000-0000-0000-000000000000',
      employee_id: 'emp-002',
      leave_type: 'annual',
      start_date: '2026-05-01',
      end_date: '2026-05-05',
      days_requested: 5,
      reason: 'Family vacation',
      status: 'approved',
      approved_by: 'emp-001',
      approved_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'lr-002',
      tenant_id: '00000000-0000-0000-0000-000000000000',
      employee_id: 'emp-003',
      leave_type: 'sick',
      start_date: '2026-04-10',
      end_date: '2026-04-11',
      days_requested: 2,
      reason: 'Flu',
      status: 'pending',
      approved_by: null,
      approved_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
};

console.log('🌱 Local Development Seed\n');

// Save to JSON for reference
writeFileSync('mock-data.json', JSON.stringify(mockData, null, 2));

console.log('✅ Mock data structure created');
console.log('   Employees:', mockData.employees.length);
console.log('   Teams:', mockData.teams.length);
console.log('   Leave Requests:', mockData.leave_requests.length);
console.log('\n📄 Saved to: mock-data.json');
console.log('\nTo use this data:');
console.log('  1. Set MOCK_AUTH_ENABLED=true in .env.local');
console.log('  2. Run: npm run dev');
console.log('  3. Login with any credentials');
console.log('\nNote: This mock data works with the in-memory store.');
console.log('For full functionality, connect to Supabase with: npm run setup');
