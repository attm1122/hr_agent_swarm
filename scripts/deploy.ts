#!/usr/bin/env tsx
/**
 * Deployment Script
 * 
 * Automates deployment to Vercel with proper environment setup.
 * 
 * Usage:
 *   npx tsx scripts/deploy.ts [preview|production]
 */

import { spawn } from 'child_process';
import { existsSync, readFileSync } from 'fs';
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

function log(message: string) {
  console.log(`\n🚀 ${message}`);
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

async function runCommand(cmd: string, args: string[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: 'inherit' });
    
    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });
  });
}

async function checkPrerequisites() {
  log('Checking deployment prerequisites...');
  
  // Check Vercel CLI
  try {
    await runCommand('vercel', ['--version']);
    success('Vercel CLI installed');
  } catch {
    warn('Vercel CLI not found');
    const install = await question('Install Vercel CLI? (yes/no): ');
    if (install.toLowerCase() === 'yes') {
      await runCommand('npm', ['install', '-g', 'vercel']);
      success('Vercel CLI installed');
    } else {
      throw new Error('Vercel CLI required for deployment');
    }
  }
  
  // Check if logged in
  try {
    await runCommand('vercel', ['whoami']);
    success('Logged in to Vercel');
  } catch {
    log('Please login to Vercel:');
    await runCommand('vercel', ['login']);
  }
  
  // Check environment variables
  const envExists = existsSync('.env.local');
  if (!envExists) {
    error('.env.local not found');
    throw new Error('Environment file required');
  }
  
  const envContent = readFileSync('.env.local', 'utf-8');
  const hasProductionAuth = envContent.includes('NEXT_PUBLIC_PRODUCTION_AUTH=true');
  const hasMockDisabled = envContent.includes('MOCK_AUTH_ENABLED=false');
  
  if (!hasProductionAuth || !hasMockDisabled) {
    warn('Production auth not fully configured in .env.local');
    const proceed = await question('Continue anyway? (yes/no): ');
    if (proceed.toLowerCase() !== 'yes') {
      process.exit(1);
    }
  }
  
  success('Prerequisites check complete');
}

async function runTests() {
  log('Running tests...');
  try {
    await runCommand('npm', ['run', 'test']);
    success('All tests passed');
  } catch {
    error('Tests failed');
    const proceed = await question('Continue with deployment? (yes/no): ');
    if (proceed.toLowerCase() !== 'yes') {
      process.exit(1);
    }
  }
}

async function buildProject() {
  log('Building project...');
  try {
    await runCommand('npm', ['run', 'build']);
    success('Build successful');
  } catch (e) {
    error('Build failed');
    throw e;
  }
}

async function deploy(environment: string) {
  log(`Deploying to ${environment}...`);
  
  const args = environment === 'production' ? ['--prod'] : [];
  
  try {
    await runCommand('vercel', args);
    success(`Deployed to ${environment}`);
  } catch (e) {
    error(`Deployment to ${environment} failed`);
    throw e;
  }
}

async function configureEnvironment() {
  log('Configuring environment variables on Vercel...');
  
  const envContent = readFileSync('.env.local', 'utf-8');
  const envVars = envContent
    .split('\n')
    .filter(line => line.includes('=') && !line.startsWith('#'))
    .map(line => {
      const [key, ...valueParts] = line.split('=');
      return { key: key.trim(), value: valueParts.join('=').trim() };
    })
    .filter(({ key, value }) => key && value && !value.includes('your-'));
  
  for (const { key, value } of envVars) {
    try {
      await runCommand('vercel', ['env', 'add', key, 'production']);
    } catch {
      // Variable might already exist
    }
  }
  
  success('Environment variables configured');
}

async function main() {
  const environment = process.argv[2] || 'preview';
  
  if (!['preview', 'production'].includes(environment)) {
    console.error('Usage: npx tsx scripts/deploy.ts [preview|production]');
    process.exit(1);
  }
  
  console.log('╔════════════════════════════════════════════════╗');
  console.log(`║   Deploying to: ${environment.toUpperCase().padEnd(28)} ║`);
  console.log('╚════════════════════════════════════════════════╝');
  
  try {
    await checkPrerequisites();
    await runTests();
    await buildProject();
    
    if (environment === 'production') {
      const confirm = await question('\n⚠️  Deploy to PRODUCTION? (yes/no): ');
      if (confirm.toLowerCase() !== 'yes') {
        console.log('Deployment cancelled');
        process.exit(0);
      }
      await configureEnvironment();
    }
    
    await deploy(environment);
    
    console.log('\n╔════════════════════════════════════════════════╗');
    console.log('║   ✅ Deployment Complete!                     ║');
    console.log('╚════════════════════════════════════════════════╝');
    
    if (environment === 'production') {
      console.log('\nPost-deployment checklist:');
      console.log('  [ ] Test login flow');
      console.log('  [ ] Verify database connection');
      console.log('  [ ] Check tenant isolation');
      console.log('  [ ] Monitor error logs');
    }
    
  } catch (error) {
    console.log('\n╔════════════════════════════════════════════════╗');
    console.log('║   ❌ Deployment Failed                        ║');
    console.log('╚════════════════════════════════════════════════╝');
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();
