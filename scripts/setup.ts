#!/usr/bin/env tsx
/**
 * Automated Setup Script for HR Agent Swarm
 * 
 * This script automates the entire setup process:
 * 1. Checks prerequisites
 * 2. Installs Supabase CLI if needed
 * 3. Links project
 * 4. Applies migrations
 * 5. Seeds data
 * 6. Creates admin user
 * 7. Verifies installation
 */

import { spawn, execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function log(step: string, message: string) {
  console.log(`\n${step} ${message}`);
}

function success(message: string) {
  console.log(`  ✅ ${message}`);
}

function error(message: string) {
  console.log(`  ❌ ${message}`);
}

function warn(message: string) {
  console.log(`  ⚠️  ${message}`);
}

async function runCommand(cmd: string, args: string[] = []): Promise<{stdout: string, stderr: string}> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: 'pipe' });
    let stdout = '';
    let stderr = '';
    
    proc.stdout.on('data', (data) => {
      stdout += data.toString();
      process.stdout.write(data);
    });
    
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
      process.stderr.write(data);
    });
    
    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });
  });
}

// ============================================
// STEP 1: Check Prerequisites
// ============================================
async function checkPrerequisites() {
  log('1️⃣', 'Checking Prerequisites');
  
  // Check Node version
  const nodeVersion = process.version;
  if (nodeVersion.startsWith('v20') || nodeVersion.startsWith('v21') || nodeVersion.startsWith('v22')) {
    success(`Node.js ${nodeVersion}`);
  } else {
    warn(`Node.js ${nodeVersion} - version 20+ recommended`);
  }
  
  // Check npm
  try {
    execSync('npm --version', { stdio: 'ignore' });
    success('npm installed');
  } catch {
    error('npm not found');
    throw new Error('npm is required');
  }
  
  // Check .env.local exists
  if (existsSync('.env.local')) {
    success('.env.local exists');
  } else {
    warn('.env.local not found, creating from template...');
    const envContent = `NEXT_PUBLIC_SUPABASE_URL=https://ycrvhfgcdygdjqzlglgt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_PRODUCTION_AUTH=false
MOCK_AUTH_ENABLED=true
MOCK_AUTH_USER_ID=user_dev_001
MOCK_AUTH_EMPLOYEE_ID=emp_dev_001
MOCK_AUTH_NAME=Dev Admin
MOCK_AUTH_EMAIL=dev@example.com
MOCK_AUTH_ROLE=admin
MOCK_AUTH_TITLE=System Administrator
MOCK_AUTH_TENANT_ID=00000000-0000-0000-0000-000000000000
`;
    writeFileSync('.env.local', envContent);
    success('Created .env.local');
  }
  
  // Check environment variables
  const envContent = readFileSync('.env.local', 'utf-8');
  const hasAnonKey = !envContent.includes('NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key');
  const hasServiceKey = !envContent.includes('SUPABASE_SERVICE_ROLE_KEY=your-service-role-key');
  
  if (hasAnonKey && hasServiceKey) {
    success('Supabase keys configured');
  } else {
    error('Supabase keys not configured');
    console.log('\n📋 To get your keys:');
    console.log('   1. Visit: https://app.supabase.com/project/ycrvhfgcdygdjqzlglgt/settings/api');
    console.log('   2. Copy "anon public" key');
    console.log('   3. Copy "service_role secret" key');
    console.log('   4. Paste them into .env.local');
    
    const proceed = await question('\nDo you want to proceed anyway? (yes/no): ');
    if (proceed.toLowerCase() !== 'yes') {
      process.exit(1);
    }
  }
}

// ============================================
// STEP 2: Install Supabase CLI
// ============================================
async function installSupabaseCLI() {
  log('2️⃣', 'Checking Supabase CLI');
  
  try {
    execSync('supabase --version', { stdio: 'ignore' });
    success('Supabase CLI already installed');
    return;
  } catch {
    warn('Supabase CLI not found');
    
    const install = await question('Install Supabase CLI now? (yes/no): ');
    if (install.toLowerCase() !== 'yes') {
      warn('Skipping CLI installation');
      return;
    }
    
    console.log('Installing Supabase CLI...');
    try {
      execSync('npm install -g supabase', { stdio: 'inherit' });
      success('Supabase CLI installed');
    } catch (e) {
      error('Failed to install Supabase CLI');
      console.log('Try installing manually: npm install -g supabase');
      throw e;
    }
  }
}

// ============================================
// STEP 3: Login to Supabase
// ============================================
async function loginToSupabase() {
  log('3️⃣', 'Supabase Login');
  
  try {
    // Check if already logged in
    execSync('supabase projects list', { stdio: 'ignore' });
    success('Already logged in to Supabase');
    return;
  } catch {
    console.log('Please login to Supabase:');
    try {
      execSync('supabase login', { stdio: 'inherit' });
      success('Logged in to Supabase');
    } catch (e) {
      error('Login failed');
      throw e;
    }
  }
}

// ============================================
// STEP 4: Link Project
// ============================================
async function linkProject() {
  log('4️⃣', 'Linking Supabase Project');
  
  const projectRef = 'ycrvhfgcdygdjqzlglgt';
  
  try {
    // Check if already linked
    const config = readFileSync('supabase/config.toml', 'utf-8');
    if (config.includes(projectRef)) {
      success('Project already linked');
      return;
    }
  } catch {
    // No config file yet
  }
  
  try {
    console.log(`Linking to project: ${projectRef}`);
    await runCommand('supabase', ['link', '--project-ref', projectRef]);
    success('Project linked');
  } catch (e) {
    error('Failed to link project');
    throw e;
  }
}

// ============================================
// STEP 5: Apply Migrations
// ============================================
async function applyMigrations() {
  log('5️⃣', 'Applying Database Migrations');
  
  try {
    console.log('This will create tables and RLS policies in your Supabase project.');
    const confirm = await question('Continue? (yes/no): ');
    
    if (confirm.toLowerCase() !== 'yes') {
      warn('Skipping migrations');
      return;
    }
    
    await runCommand('supabase', ['db', 'push']);
    success('Migrations applied');
  } catch (e) {
    error('Failed to apply migrations');
    console.log('\nTroubleshooting:');
    console.log('- Check your internet connection');
    console.log('- Verify you have permissions to modify the database');
    console.log('- Try manually: npx supabase db push');
    throw e;
  }
}

// ============================================
// STEP 6: Seed Data
// ============================================
async function seedData() {
  log('6️⃣', 'Seeding Sample Data');
  
  const seed = await question('Add sample employees and data? (yes/no): ');
  if (seed.toLowerCase() !== 'yes') {
    warn('Skipping seed data');
    return;
  }
  
  try {
    await runCommand('supabase', ['db', 'reset']);
    success('Database reset with seed data');
  } catch (e) {
    warn('Could not seed automatically');
    console.log('You can manually run: npx supabase db reset');
  }
}

// ============================================
// STEP 7: Create Admin User
// ============================================
async function createAdminUser() {
  log('7️⃣', 'Creating Admin User');
  
  const createAdmin = await question('Create an admin user now? (yes/no): ');
  if (createAdmin.toLowerCase() !== 'yes') {
    warn('Skipping admin creation');
    console.log('You can create an admin later with:');
    console.log('  npx tsx scripts/setup-admin.ts <email> <password>');
    return;
  }
  
  const email = await question('Admin email: ');
  const password = await question('Admin password (min 8 chars): ');
  const firstName = await question('First name: ') || 'Admin';
  const lastName = await question('Last name: ') || 'User';
  
  if (!email.includes('@') || password.length < 8) {
    error('Invalid email or password too short');
    return;
  }
  
  try {
    // Load environment variables
    const envContent = readFileSync('.env.local', 'utf-8');
    const url = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1];
    const key = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)?.[1];
    
    if (!url || !key || key.includes('your-service-role-key')) {
      error('Service role key not configured in .env.local');
      return;
    }
    
    const supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    
    // Create auth user
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
      throw new Error(authError.message);
    }
    
    const userId = authData.user!.id;
    
    // Create employee record
    const { error: empError } = await supabase.from('employees').insert({
      id: userId,
      tenant_id: '00000000-0000-0000-0000-000000000000',
      email,
      first_name: firstName,
      last_name: lastName,
      employee_number: `EMP-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
      hire_date: new Date().toISOString().split('T')[0],
      status: 'active',
      employment_type: 'full_time',
    });
    
    if (empError) {
      throw new Error(empError.message);
    }
    
    success(`Admin user created: ${email}`);
    console.log(`\nYou can now login at: http://localhost:3000/auth/login`);
    
  } catch (e) {
    error(`Failed to create admin: ${e instanceof Error ? e.message : e}`);
  }
}

// ============================================
// STEP 8: Verify Installation
// ============================================
async function verifyInstallation() {
  log('8️⃣', 'Verifying Installation');
  
  // Check build
  console.log('Building application...');
  try {
    execSync('npm run build', { stdio: 'pipe' });
    success('Build successful');
  } catch {
    error('Build failed');
    return false;
  }
  
  return true;
}

// ============================================
// Main
// ============================================
async function main() {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║   HR Agent Swarm - Automated Setup            ║');
  console.log('║   Project: ycrvhfgcdygdjqzlglgt               ║');
  console.log('╚════════════════════════════════════════════════╝');
  
  try {
    await checkPrerequisites();
    await installSupabaseCLI();
    await loginToSupabase();
    await linkProject();
    await applyMigrations();
    await seedData();
    await createAdminUser();
    const verified = await verifyInstallation();
    
    console.log('\n╔════════════════════════════════════════════════╗');
    if (verified) {
      console.log('║   ✅ Setup Complete!                          ║');
      console.log('╚════════════════════════════════════════════════╝');
      console.log('\nNext steps:');
      console.log('  1. npm run dev');
      console.log('  2. Open http://localhost:3000/auth/login');
      console.log('  3. Login with your admin credentials');
    } else {
      console.log('║   ⚠️  Setup completed with warnings           ║');
      console.log('╚════════════════════════════════════════════════╝');
    }
    
  } catch (error) {
    console.log('\n╔════════════════════════════════════════════════╗');
    console.log('║   ❌ Setup Failed                             ║');
    console.log('╚════════════════════════════════════════════════╝');
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();
