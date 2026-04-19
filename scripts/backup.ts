#!/usr/bin/env tsx
/**
 * Database Backup Script
 * 
 * Creates backups of critical tables for disaster recovery.
 * 
 * Usage:
 *   npx tsx scripts/backup.ts [full|partial]
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const TABLES = {
  full: [
    'employees',
    'teams',
    'positions',
    'leave_requests',
    'leave_balances',
    'workflows',
    'approval_steps',
    'milestones',
    'onboarding_plans',
    'onboarding_tasks',
    'offboarding_plans',
    'offboarding_tasks',
    'employee_documents',
    'audit_events',
  ],
  partial: [
    'employees',
    'leave_requests',
    'workflows',
  ]
};

async function backupTable(table: string) {
  console.log(`Backing up ${table}...`);
  
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .limit(10000);
  
  if (error) {
    console.error(`  ❌ Error backing up ${table}:`, error.message);
    return null;
  }
  
  console.log(`  ✓ Backed up ${data?.length || 0} rows`);
  return data;
}

async function main() {
  const mode = process.argv[2] || 'partial';
  const tablesToBackup = TABLES[mode as keyof typeof TABLES] || TABLES.partial;
  
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║   Database Backup                              ║');
  console.log(`║   Mode: ${mode.padEnd(39)} ║`);
  console.log('╚════════════════════════════════════════════════╝\n');
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = join(process.cwd(), 'backups', timestamp);
  
  if (!existsSync(backupDir)) {
    mkdirSync(backupDir, { recursive: true });
  }
  
  const backup: { timestamp: string; mode: string; tables: Record<string, unknown[]> } = {
    timestamp: new Date().toISOString(),
    mode,
    tables: {}
  };
  
  for (const table of tablesToBackup) {
    const data = await backupTable(table);
    if (data) {
      backup.tables[table] = data;
    }
  }
  
  const backupPath = join(backupDir, 'backup.json');
  writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  
  console.log(`\n✅ Backup complete: ${backupPath}`);
  console.log(`   Tables: ${Object.keys(backup.tables).length}`);
  console.log(`   Total rows: ${Object.values(backup.tables).reduce((sum: number, arr) => sum + (arr?.length || 0), 0)}`);
}

main().catch(console.error);
