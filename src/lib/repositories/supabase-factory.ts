/**
 * Supabase Repository Factory
 * 
 * Creates repository instances backed by Supabase.
 */

import type { RepositoryFactory } from '@/lib/ports';
import { SupabaseEmployeeRepository } from './supabase/employee-repository';
import { SupabaseLeaveRepository } from './supabase/leave-repository';
import { SupabasePolicyRepository } from './supabase/policy-repository';
import { SupabaseWorkflowRepository } from './supabase/workflow-repository';
import { SupabaseOnboardingRepository } from './supabase/onboarding-repository';
import { SupabaseOffboardingRepository } from './supabase/offboarding-repository';
import { SupabaseMilestoneRepository } from './supabase/milestone-repository';
import { SupabaseDocumentRepository } from './supabase/document-repository';
import { SupabaseAgentRunRepository } from './supabase/agent-run-repository';
import { SupabaseExportApprovalRepository } from './supabase/export-approval-repository';
import { createAdminClient } from '@/infrastructure/database/client';

export function createSupabaseRepositoryFactory(): RepositoryFactory {
  const supabase = createAdminClient();
  
  return {
    employee: () => new SupabaseEmployeeRepository(supabase),
    leave: () => new SupabaseLeaveRepository(supabase),
    policy: () => new SupabasePolicyRepository(supabase),
    workflow: () => new SupabaseWorkflowRepository(supabase),
    onboarding: () => new SupabaseOnboardingRepository(supabase),
    offboarding: () => new SupabaseOffboardingRepository(supabase),
    milestone: () => new SupabaseMilestoneRepository(supabase),
    document: () => new SupabaseDocumentRepository(supabase),
    agentRun: () => new SupabaseAgentRunRepository(supabase),
    exportApproval: () => new SupabaseExportApprovalRepository(supabase),
  };
}
