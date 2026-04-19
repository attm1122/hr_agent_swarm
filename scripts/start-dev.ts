#!/usr/bin/env tsx
/**
 * Development Server Starter
 * 
 * Starts the development server with proper environment checks
 * and helpful error messages.
 */

import { spawn, execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function log(message: string) {
  console.log(`\n🚀 ${message}`);
}

function success(message: string) {
  console.log(`  ✅ ${message}`);
}

function warn(message: string) {
  console.log(`  ⚠️  ${message}`);
}

async function checkEnvironment() {
  log('Checking development environment...');
  
  // Check .env.local exists
  if (!existsSync('.env.local')) {
    warn('.env.local not found');
    console.log('Creating from .env.example...');
    
    execSync('cp .env.example .env.local');
    success('Created .env.local');
    console.log('⚠️  Please edit .env.local and add your Supabase API keys');
  }
  
  // Check node_modules
  if (!existsSync('node_modules')) {
    warn('node_modules not found');
    console.log('Running npm install...');
    
    execSync('npm install', { stdio: 'inherit' });
    success('Dependencies installed');
  }
  
  // Read current config
  const envContent = readFileSync('.env.local', 'utf-8');
  const hasSupabaseKeys = !envContent.includes('NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key');
  const mockEnabled = envContent.includes('MOCK_AUTH_ENABLED=true');
  
  if (!hasSupabaseKeys && !mockEnabled) {
    warn('Supabase keys not configured, mock auth disabled');
    console.log('\nOptions:');
    console.log('1. Enable mock auth (development mode)');
    console.log('2. Add Supabase keys (production mode)');
    
    const choice = await new Promise<string>((resolve) => {
      rl.question('\nChoose (1/2): ', resolve);
    });
    
    if (choice === '1') {
      const updated = envContent.replace('MOCK_AUTH_ENABLED=false', 'MOCK_AUTH_ENABLED=true');
      writeFileSync('.env.local', updated);
      success('Mock auth enabled');
    } else {
      console.log('\nPlease add your Supabase keys to .env.local:');
      console.log('  NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key');
      console.log('  SUPABASE_SERVICE_ROLE_KEY=your-key');
      console.log('\nGet keys from: https://app.supabase.com/project/ycrvhfgcdygdjqzlglgt/settings/api');
    }
  }
  
  if (mockEnabled) {
    success('Running in MOCK mode (no Supabase required)');
    console.log('  Login with any email/password');
  } else if (hasSupabaseKeys) {
    success('Running with Supabase connection');
  }
}

async function startDevServer() {
  log('Starting development server...');
  console.log('  URL: http://localhost:3000');
  console.log('  Login: http://localhost:3000/auth/login');
  console.log('\nPress Ctrl+C to stop\n');
  
  const nextDev = spawn('npx', ['next', 'dev'], {
    stdio: 'inherit',
    env: { ...process.env, FORCE_COLOR: '1' }
  });
  
  nextDev.on('close', (code) => {
    console.log(`\nDev server exited with code ${code}`);
    process.exit(code || 0);
  });
}

async function main() {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║   HR Agent Swarm - Development Server         ║');
  console.log('╚════════════════════════════════════════════════╝');
  
  try {
    await checkEnvironment();
    await startDevServer();
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();
