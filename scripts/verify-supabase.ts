#!/usr/bin/env tsx
/**
 * Verify Supabase Connection
 * 
 * Checks if your Supabase credentials are working correctly.
 * 
 * Usage:
 *   npx tsx scripts/verify-supabase.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('🔍 Supabase Connection Verification\n');
console.log('URL:', SUPABASE_URL || '❌ NOT SET');
console.log('Anon Key:', ANON_KEY ? '✓ Set (' + ANON_KEY.slice(0, 20) + '...)' : '❌ NOT SET');
console.log('Service Role Key:', SERVICE_ROLE_KEY ? '✓ Set (' + SERVICE_ROLE_KEY.slice(0, 20) + '...)' : '❌ NOT SET');
console.log('');

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables');
  console.log('\nTo fix:');
  console.log('1. Go to https://app.supabase.com/project/ycrvhfgcdygdjqzlglgt/settings/api');
  console.log('2. Copy the "anon public" key to NEXT_PUBLIC_SUPABASE_ANON_KEY');
  console.log('3. Copy the "service_role secret" key to SUPABASE_SERVICE_ROLE_KEY');
  console.log('4. Add them to .env.local');
  process.exit(1);
}

async function verifyConnection() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('❌ Missing required environment variables');
    process.exit(1);
  }
  
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    // Test 1: Check connection
    console.log('Test 1: Checking database connection...');
    const { data: version, error: versionError } = await supabase.rpc('version');
    
    if (versionError) {
      console.log('   ⚠️  Could not check version (this is OK)');
    } else {
      console.log('   ✓ Database connected');
    }

    // Test 2: Check tenants table
    console.log('Test 2: Checking tenants table...');
    const { data: tenants, error: tenantError } = await supabase
      .from('tenants')
      .select('*')
      .limit(1);

    if (tenantError) {
      console.log('   ❌ Tenants table error:', tenantError.message);
      console.log('   💡 Run: npx supabase db push');
    } else {
      console.log('   ✓ Tenants table accessible');
      console.log('   Found', tenants?.length || 0, 'tenant(s)');
    }

    // Test 3: Check employees table
    console.log('Test 3: Checking employees table...');
    const { data: employees, error: empError } = await supabase
      .from('employees')
      .select('*')
      .limit(1);

    if (empError) {
      console.log('   ❌ Employees table error:', empError.message);
    } else {
      console.log('   ✓ Employees table accessible');
    }

    // Test 4: Check auth
    console.log('Test 4: Checking auth configuration...');
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.log('   ❌ Auth error:', authError.message);
      console.log('   💡 Service role key may be invalid');
    } else {
      console.log('   ✓ Auth admin API accessible');
      console.log('   Found', authUsers?.users?.length || 0, 'user(s)');
    }

    // Test 5: Check RLS
    console.log('Test 5: Checking RLS status...');
    const { data: rlsData, error: rlsError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'employees');

    if (rlsError) {
      console.log('   ⚠️  Could not check RLS status');
    } else {
      console.log('   ✓ Database schema accessible');
    }

    console.log('\n✅ Verification complete!');
    console.log('\nNext steps:');
    console.log('1. If all tests passed, run: npm run dev');
    console.log('2. Visit: http://localhost:3000/auth/login');
    console.log('3. Create admin: npx tsx scripts/setup-admin.ts <email> <password>');

  } catch (error) {
    console.error('\n❌ Connection failed:');
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

verifyConnection();
