/**
 * Database Types
 * TypeScript definitions for Supabase schema with tenant isolation
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// Base interface with tenant isolation
interface TenantBase {
  tenant_id: string;
}

// Individual table row types with tenant isolation
export interface Employee extends TenantBase {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  employee_number: string;
  hire_date: string;
  termination_date: string | null;
  status: 'active' | 'inactive' | 'on_leave' | 'terminated' | 'pending';
  team_id: string | null;
  position_id: string | null;
  manager_id: string | null;
  work_location: 'onsite' | 'remote' | 'hybrid' | null;
  employment_type: 'full_time' | 'part_time' | 'contract' | 'intern';
  created_at: string;
  updated_at: string;
}

export interface Team extends TenantBase {
  id: string;
  name: string;
  code: string;
  parent_team_id: string | null;
  department: string;
  cost_center: string | null;
  created_at: string;
  updated_at: string;
}

export interface Position extends TenantBase {
  id: string;
  title: string;
  level: string;
  department: string;
  job_family: string;
  created_at: string;
  updated_at: string;
}

export interface EmployeeDocument extends TenantBase {
  id: string;
  employee_id: string;
  onedrive_id: string;
  onedrive_path: string;
  file_name: string;
  file_type: string;
  file_size: number;
  category: 'contract' | 'visa' | 'certification' | 'id' | 'medical' | 'tax' | 'performance' | 'other';
  status: 'active' | 'expired' | 'expiring' | 'missing';
  uploaded_at: string;
  expires_at: string | null;
  extracted_data: Json | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentRequirement extends TenantBase {
  id: string;
  category: string;
  employment_types: string[];
  required: boolean;
  expires: boolean;
  expiration_warning_days: number | null;
  created_at: string;
  updated_at: string;
}

export interface LeaveBalance extends TenantBase {
  id: string;
  employee_id: string;
  leave_type: 'annual' | 'sick' | 'personal' | 'parental' | 'bereavement' | 'unpaid' | 'other';
  entitlement_days: number;
  taken_days: number;
  pending_days: number;
  remaining_days: number;
  period_start: string;
  period_end: string;
  created_at: string;
  updated_at: string;
}

export interface LeaveRequest extends TenantBase {
  id: string;
  employee_id: string;
  leave_type: 'annual' | 'sick' | 'personal' | 'parental' | 'bereavement' | 'unpaid' | 'other';
  start_date: string;
  end_date: string;
  days_requested: number;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompensationRecord extends TenantBase {
  id: string;
  employee_id: string;
  base_salary: number;
  currency: string;
  effective_date: string;
  end_date: string | null;
  pay_frequency: 'monthly' | 'biweekly' | 'weekly';
  created_at: string;
  updated_at: string;
}

export interface Milestone extends TenantBase {
  id: string;
  employee_id: string;
  milestone_type: 'probation_end' | 'work_anniversary' | 'promotion' | 'role_change' | 'team_change' | 'performance_review' | 'visa_expiry' | 'certification_expiry' | 'contract_expiry';
  milestone_date: string;
  due_date: string;
  status: 'pending' | 'acknowledged' | 'completed' | 'overdue' | 'upcoming' | 'due';
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  description: string | null;
  alert_days_before: number;
  created_at: string;
  updated_at: string;
}

export interface OnboardingPlan extends TenantBase {
  id: string;
  employee_id: string;
  start_date: string;
  initiated_by: string;
  assigned_to: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'not_started' | 'blocked';
  checklist_template: string;
  template_name: string;
  target_completion_date: string;
  actual_completion_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface OnboardingTask extends TenantBase {
  id: string;
  plan_id: string;
  task_name: string;
  category: 'hr_setup' | 'it_setup' | 'access_provisioning' | 'training' | 'orientation' | 'compliance';
  assigned_to: string;
  due_date: string;
  completed_at: string | null;
  completed_by: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  priority: 'low' | 'medium' | 'high';
  depends_on: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface Workflow extends TenantBase {
  id: string;
  workflow_type: 'leave_approval' | 'salary_change' | 'promotion' | 'termination' | 'onboarding' | 'offboarding' | 'document_approval' | 'communication_approval' | 'review';
  entity_type: string;
  entity_id: string;
  reference_type: string;
  reference_id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'rejected';
  initiated_by: string;
  initiator_id: string;
  current_step: number;
  total_steps: number;
  started_at: string | null;
  completed_at: string | null;
  context: Json | null;
  created_at: string;
  updated_at: string;
}

export interface ApprovalStep extends TenantBase {
  id: string;
  workflow_id: string;
  step_number: number;
  step_name: string;
  approver_role: string;
  approver_id: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'skipped';
  approved_at: string | null;
  rejection_reason: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditEvent extends TenantBase {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  actor_id: string | null;
  actor_type: 'user' | 'agent' | 'system';
  action: string;
  previous_state: Json | null;
  new_state: Json | null;
  metadata: Json | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface AgentRun extends TenantBase {
  id: string;
  agent_type: string;
  intent: string;
  input_payload: Json;
  output_result: Json | null;
  confidence: number | null;
  execution_time_ms: number | null;
  success: boolean;
  error_message: string | null;
  context: Json | null;
  created_at: string;
}

export interface ReportDefinition extends TenantBase {
  id: string;
  name: string;
  description: string | null;
  category: 'hr' | 'compliance' | 'leave' | 'compensation' | 'onboarding';
  query_config: Json;
  parameters: Json | null;
  requires_approval: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ReportRun extends TenantBase {
  id: string;
  report_definition_id: string;
  parameters: Json | null;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result_data: Json | null;
  row_count: number | null;
  generated_by: string;
  generated_at: string;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface PolicyDocument extends TenantBase {
  id: string;
  title: string;
  category: string;
  version: string;
  effective_date: string;
  source_url: string | null;
  content_hash: string;
  created_at: string;
  updated_at: string;
}

export interface PolicyChunk extends TenantBase {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  embedding: string | null;
  metadata: Json | null;
  created_at: string;
  updated_at: string;
}

// Offboarding domain tables
export interface OffboardingPlan extends TenantBase {
  id: string;
  employee_id: string;
  termination_date: string;
  initiated_by: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  checklist_template: string;
  target_completion_date: string;
  actual_completion_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface OffboardingTask extends TenantBase {
  id: string;
  plan_id: string;
  task_name: string;
  category: 'access_removal' | 'asset_return' | 'knowledge_transfer' | 'hr_exit' | 'payroll_exit' | 'compliance';
  assigned_to: string;
  due_date: string;
  completed_at: string | null;
  completed_by: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  priority: 'low' | 'medium' | 'high';
  depends_on: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface OffboardingAsset extends TenantBase {
  id: string;
  plan_id: string;
  asset_type: 'laptop' | 'phone' | 'badge' | 'credit_card' | 'other';
  description: string;
  expected_return_date: string;
  returned_at: string | null;
  condition_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OffboardingAccess extends TenantBase {
  id: string;
  plan_id: string;
  system_name: string;
  removal_status: 'pending' | 'scheduled' | 'completed' | 'na';
  scheduled_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

// Outbox pattern for reliable event publishing
export interface OutboxEvent extends TenantBase {
  id: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  payload: Json;
  headers: Json | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  retry_count: number;
  error_message: string | null;
  processed_at: string | null;
  created_at: string;
}

// Tenants table
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'inactive' | 'suspended';
  settings: Json | null;
  created_at: string;
  updated_at: string;
}

// Database interface
export interface Database {
  public: {
    Tables: {
      tenants: { Row: Tenant; Insert: Omit<Tenant, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Tenant, 'id' | 'created_at' | 'updated_at'>> };
      employees: { Row: Employee; Insert: Omit<Employee, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Employee, 'id' | 'created_at' | 'updated_at'>> };
      teams: { Row: Team; Insert: Omit<Team, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Team, 'id' | 'created_at' | 'updated_at'>> };
      positions: { Row: Position; Insert: Omit<Position, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Position, 'id' | 'created_at' | 'updated_at'>> };
      employee_documents: { Row: EmployeeDocument; Insert: Omit<EmployeeDocument, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<EmployeeDocument, 'id' | 'created_at' | 'updated_at'>> };
      document_requirements: { Row: DocumentRequirement; Insert: Omit<DocumentRequirement, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<DocumentRequirement, 'id' | 'created_at' | 'updated_at'>> };
      leave_balances: { Row: LeaveBalance; Insert: Omit<LeaveBalance, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<LeaveBalance, 'id' | 'created_at' | 'updated_at'>> };
      leave_requests: { Row: LeaveRequest; Insert: Omit<LeaveRequest, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<LeaveRequest, 'id' | 'created_at' | 'updated_at'>> };
      compensation_records: { Row: CompensationRecord; Insert: Omit<CompensationRecord, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<CompensationRecord, 'id' | 'created_at' | 'updated_at'>> };
      milestones: { Row: Milestone; Insert: Omit<Milestone, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Milestone, 'id' | 'created_at' | 'updated_at'>> };
      onboarding_plans: { Row: OnboardingPlan; Insert: Omit<OnboardingPlan, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<OnboardingPlan, 'id' | 'created_at' | 'updated_at'>> };
      onboarding_tasks: { Row: OnboardingTask; Insert: Omit<OnboardingTask, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<OnboardingTask, 'id' | 'created_at' | 'updated_at'>> };
      workflows: { Row: Workflow; Insert: Omit<Workflow, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Workflow, 'id' | 'created_at' | 'updated_at'>> };
      approval_steps: { Row: ApprovalStep; Insert: Omit<ApprovalStep, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<ApprovalStep, 'id' | 'created_at' | 'updated_at'>> };
      audit_events: { Row: AuditEvent; Insert: Omit<AuditEvent, 'id' | 'created_at'>; Update: Partial<Omit<AuditEvent, 'id' | 'created_at'>> };
      agent_runs: { Row: AgentRun; Insert: Omit<AgentRun, 'id' | 'created_at'>; Update: Partial<Omit<AgentRun, 'id' | 'created_at'>> };
      report_definitions: { Row: ReportDefinition; Insert: Omit<ReportDefinition, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<ReportDefinition, 'id' | 'created_at' | 'updated_at'>> };
      report_runs: { Row: ReportRun; Insert: Omit<ReportRun, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<ReportRun, 'id' | 'created_at' | 'updated_at'>> };
      policy_documents: { Row: PolicyDocument; Insert: Omit<PolicyDocument, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<PolicyDocument, 'id' | 'created_at' | 'updated_at'>> };
      policy_chunks: { Row: PolicyChunk; Insert: Omit<PolicyChunk, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<PolicyChunk, 'id' | 'created_at' | 'updated_at'>> };
      offboarding_plans: { Row: OffboardingPlan; Insert: Omit<OffboardingPlan, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<OffboardingPlan, 'id' | 'created_at' | 'updated_at'>> };
      offboarding_tasks: { Row: OffboardingTask; Insert: Omit<OffboardingTask, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<OffboardingTask, 'id' | 'created_at' | 'updated_at'>> };
      offboarding_assets: { Row: OffboardingAsset; Insert: Omit<OffboardingAsset, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<OffboardingAsset, 'id' | 'created_at' | 'updated_at'>> };
      offboarding_access: { Row: OffboardingAccess; Insert: Omit<OffboardingAccess, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<OffboardingAccess, 'id' | 'created_at' | 'updated_at'>> };
      outbox_events: { Row: OutboxEvent; Insert: Omit<OutboxEvent, 'id' | 'created_at' | 'processed_at'>; Update: Partial<Omit<OutboxEvent, 'id' | 'created_at'>> };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

// Helper types for table access
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type Insertable<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type Updatable<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];
