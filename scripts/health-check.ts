#!/usr/bin/env tsx
/**
 * Health Check Script
 * 
 * Verifies the deployed application is healthy.
 * 
 * Usage:
 *   npx tsx scripts/health-check.ts [url]
 */

const DEFAULT_URL = process.env.HEALTH_CHECK_URL || 'http://localhost:3000';

async function healthCheck(baseUrl: string) {
  console.log(`🔍 Health Check: ${baseUrl}\n`);
  
  const checks = [
    { name: 'API Health', path: '/api/health' },
    { name: 'Login Page', path: '/auth/login' },
    { name: 'Dashboard', path: '/' },
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const check of checks) {
    const url = `${baseUrl}${check.path}`;
    try {
      const response = await fetch(url);
      if (response.ok) {
        console.log(`  ✅ ${check.name}: OK (${response.status})`);
        passed++;
      } else {
        console.log(`  ❌ ${check.name}: Failed (${response.status})`);
        failed++;
      }
    } catch (error) {
      console.log(`  ❌ ${check.name}: Error - ${error instanceof Error ? error.message : 'Unknown'}`);
      failed++;
    }
  }
  
  console.log(`\n${passed} passed, ${failed} failed`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

const url = process.argv[2] || DEFAULT_URL;
healthCheck(url);
