#!/usr/bin/env tsx
/**
 * Admin User Setup Script
 * 
 * Creates the first admin user in the system.
 * Run this after initial database setup.
 * 
 * Usage:
 *   npx tsx scripts/setup-admin.ts <email> <password> <first_name> <last_name>
 * 
 * Example:
 *   npx tsx scripts/setup-admin.ts admin@company.com SecurePass123! Admin User
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Error: Missing Supabase credentials');
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function setupAdmin(
  email: string,
  password: string,
  firstName: string,
  lastName: string
) {
  console.log(`Setting up admin user: ${email}`);

  try {
    // 1. Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role: 'admin',
        tenant_id: '00000000-0000-0000-0000-000000000000',
        first_name: firstName,
        last_name: lastName,
      },
    });

    if (authError) {
      throw new Error(`Auth user creation failed: ${authError.message}`);
    }

    const userId = authData.user!.id;
    console.log(`✓ Auth user created: ${userId}`);

    // 2. Check if employee record exists
    const { data: existingEmployee } = await supabase
      .from('employees')
      .select('id')
      .eq('id', userId)
      .single();

    if (existingEmployee) {
      console.log('✓ Employee record already exists');
    } else {
      // 3. Create employee record
      const employeeNumber = `EMP-${randomUUID().slice(0, 8).toUpperCase()}`;
      
      const { error: employeeError } = await supabase
        .from('employees')
        .insert({
          id: userId,
          tenant_id: '00000000-0000-0000-0000-000000000000',
          email,
          first_name: firstName,
          last_name: lastName,
          employee_number: employeeNumber,
          hire_date: new Date().toISOString().split('T')[0],
          status: 'active',
          employment_type: 'full_time',
          work_location: 'hybrid',
        });

      if (employeeError) {
        throw new Error(`Employee creation failed: ${employeeError.message}`);
      }

      console.log(`✓ Employee record created: ${employeeNumber}`);
    }

    // 4. Create leave balances
    const leaveTypes = [
      { type: 'annual', entitlement: 20 },
      { type: 'sick', entitlement: 10 },
      { type: 'personal', entitlement: 3 },
    ];

    for (const lt of leaveTypes) {
      const { error: balanceError } = await supabase
        .from('leave_balances')
        .upsert({
          tenant_id: '00000000-0000-0000-0000-000000000000',
          employee_id: userId,
          leave_type: lt.type as 'annual' | 'sick' | 'personal',
          entitlement_days: lt.entitlement,
          taken_days: 0,
          pending_days: 0,
          remaining_days: lt.entitlement,
          period_start: new Date().toISOString().split('T')[0],
          period_end: new Date(new Date().getFullYear(), 11, 31).toISOString().split('T')[0],
        }, {
          onConflict: 'tenant_id,employee_id,leave_type,period_start',
        });

      if (balanceError) {
        console.warn(`Warning: Could not create ${lt.type} leave balance: ${balanceError.message}`);
      }
    }

    console.log('✓ Leave balances created');

    console.log('\n========================================');
    console.log('Admin user setup complete!');
    console.log('========================================');
    console.log(`Email: ${email}`);
    console.log(`User ID: ${userId}`);
    console.log(`Tenant: Default Organization`);
    console.log('\nYou can now log in at: http://localhost:3000/auth/login');

  } catch (error) {
    console.error('\n✗ Setup failed:');
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length < 2) {
  console.log('Usage: npx tsx scripts/setup-admin.ts <email> <password> [first_name] [last_name]');
  console.log('');
  console.log('Example:');
  console.log('  npx tsx scripts/setup-admin.ts admin@company.com SecurePass123!');
  console.log('  npx tsx scripts/setup-admin.ts admin@company.com SecurePass123! John Doe');
  process.exit(1);
}

const [email, password, firstName = 'Admin', lastName = 'User'] = args;

// Validate email
if (!email.includes('@')) {
  console.error('Error: Invalid email address');
  process.exit(1);
}

// Validate password strength
if (password.length < 8) {
  console.error('Error: Password must be at least 8 characters');
  process.exit(1);
}

setupAdmin(email, password, firstName, lastName);
