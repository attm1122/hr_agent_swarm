/**
 * Database Types
 * TypeScript definitions for Supabase schema
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// Individual table row types
export interface Employee {
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

export interface Team {
  id: string;
  name: string;
  code: string;
  parent_team_id: string | null;
  department: string;
  cost_center: string | null;
  created_at: string;
  updated_at: string;
}

export interface Position {
  id: string;
  title: string;
  level: string;
  department: string;
  job_family: string;
  created_at: string;
  updated_at: string;
}

export interface EmployeeDocument {
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

export interface DocumentRequirement {
  id: string;
  category: string;
  employment_types: string[];
  required: boolean;
  expires: boolean;
  expiration_warning_days: number | null;
  created_at: string;
  updated_at: string;
}

export interface LeaveBalance {
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

export interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type: 'annual' | 'sick' | 'personal' | 'parental' | 'bereavement' | 'unpaid' | 'other';
  start_date: string;
  end_date: string;
  days_requested: number;
  reason: string | null;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'cancelled';
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompensationRecord {
  id: string;
  employee_id: string;
  effective_date: string;
  base_salary: number;
  currency: string;
  salary_frequency: 'annual' | 'monthly' | 'biweekly' | 'weekly';
  bonus_amount: number | null;
  bonus_type: string | null;
  total_compensation: number;
  hr3_sync_id: string | null;
  hr3_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Milestone {
  id: string;
  employee_id: string;
  milestone_type: 'service_anniversary' | 'probation_end' | 'visa_expiry' | 'certification_expiry' | 'contract_expiry' | 'performance_review';
  milestone_date: string;
  description: string;
  alert_days_before: number;
  status: 'upcoming' | 'due' | 'overdue' | 'completed' | 'acknowledged';
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OnboardingPlan {
  id: string;
  employee_id: string;
  template_name: string;
  start_date: string;
  target_completion_date: string;
  actual_completion_date: string | null;
  status: 'not_started' | 'in_progress' | 'completed' | 'blocked';
  created_at: string;
  updated_at: string;
}

export interface OnboardingTask {
  id: string;
  plan_id: string;
  task_name: string;
  description: string | null;
  category: 'admin' | 'it' | 'hr' | 'team' | 'training' | 'compliance';
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

export interface Workflow {
  id: string;
  workflow_type: 'leave_approval' | 'salary_change' | 'promotion' | 'termination' | 'onboarding' | 'offboarding' | 'document_approval';
  reference_type: string;
  reference_id: string;
  initiator_id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'rejected' | 'cancelled';
  current_step: number;
  total_steps: number;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApprovalStep {
  id: string;
  workflow_id: string;
  step_number: number;
  approver_id: string;
  approver_role: string;
  status: 'pending' | 'approved' | 'rejected' | 'delegated' | 'skipped';
  comments: string | null;
  acted_at: string | null;
  due_date: string;
  escalated_to: string | null;
  escalated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditEvent {
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

export interface AgentRun {
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
  metadata: Json | null;
  tenant_id: string;
  created_at: string;
}

export interface ReportDefinition {
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

export interface ReportRun {
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

export interface PolicyDocument {
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

export interface PolicyChunk {
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
export interface OffboardingPlan {
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

export interface OffboardingTask {
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

export interface OffboardingAsset {
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

export interface OffboardingAccess {
  id: string;
  plan_id: string;
  system_name: string;
  removal_status: 'pending' | 'scheduled' | 'completed' | 'na';
  scheduled_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

// Database interface
export interface Database {
  public: {
    Tables: {
      employees: { Row: Employee; Insert: Omit<Employee, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Employee, 'id' | 'created_at' | 'updated_at'>>; Relationships: [] };
      teams: { Row: Team; Insert: Omit<Team, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Team, 'id' | 'created_at' | 'updated_at'>>; Relationships: [] };
      positions: { Row: Position; Insert: Omit<Position, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Position, 'id' | 'created_at' | 'updated_at'>>; Relationships: [] };
      employee_documents: { Row: EmployeeDocument; Insert: Omit<EmployeeDocument, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<EmployeeDocument, 'id' | 'created_at' | 'updated_at'>>; Relationships: [] };
      document_requirements: { Row: DocumentRequirement; Insert: Omit<DocumentRequirement, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<DocumentRequirement, 'id' | 'created_at' | 'updated_at'>>; Relationships: [] };
      leave_balances: { Row: LeaveBalance; Insert: Omit<LeaveBalance, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<LeaveBalance, 'id' | 'created_at' | 'updated_at'>>; Relationships: [] };
      leave_requests: { Row: LeaveRequest; Insert: Omit<LeaveRequest, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<LeaveRequest, 'id' | 'created_at' | 'updated_at'>>; Relationships: [] };
      compensation_records: { Row: CompensationRecord; Insert: Omit<CompensationRecord, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<CompensationRecord, 'id' | 'created_at' | 'updated_at'>>; Relationships: [] };
      milestones: { Row: Milestone; Insert: Omit<Milestone, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Milestone, 'id' | 'created_at' | 'updated_at'>>; Relationships: [] };
      onboarding_plans: { Row: OnboardingPlan; Insert: Omit<OnboardingPlan, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<OnboardingPlan, 'id' | 'created_at' | 'updated_at'>>; Relationships: [] };
      onboarding_tasks: { Row: OnboardingTask; Insert: Omit<OnboardingTask, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<OnboardingTask, 'id' | 'created_at' | 'updated_at'>>; Relationships: [] };
      workflows: { Row: Workflow; Insert: Omit<Workflow, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Workflow, 'id' | 'created_at' | 'updated_at'>>; Relationships: [] };
      approval_steps: { Row: ApprovalStep; Insert: Omit<ApprovalStep, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<ApprovalStep, 'id' | 'created_at' | 'updated_at'>>; Relationships: [] };
      audit_events: { Row: AuditEvent; Insert: Omit<AuditEvent, 'id' | 'created_at'>; Update: Partial<Omit<AuditEvent, 'id' | 'created_at'>>; Relationships: [] };
      agent_runs: { Row: AgentRun; Insert: AgentRun; Update: Partial<Omit<AgentRun, 'id'>>; Relationships: [] };
      report_definitions: { Row: ReportDefinition; Insert: Omit<ReportDefinition, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<ReportDefinition, 'id' | 'created_at' | 'updated_at'>>; Relationships: [] };
      report_runs: { Row: ReportRun; Insert: Omit<ReportRun, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<ReportRun, 'id' | 'created_at' | 'updated_at'>>; Relationships: [] };
      policy_documents: { Row: PolicyDocument; Insert: Omit<PolicyDocument, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<PolicyDocument, 'id' | 'created_at' | 'updated_at'>>; Relationships: [] };
      policy_chunks: { Row: PolicyChunk; Insert: Omit<PolicyChunk, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<PolicyChunk, 'id' | 'created_at' | 'updated_at'>>; Relationships: [] };
      offboarding_plans: { Row: OffboardingPlan; Insert: Omit<OffboardingPlan, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<OffboardingPlan, 'id' | 'created_at' | 'updated_at'>>; Relationships: [] };
      offboarding_tasks: { Row: OffboardingTask; Insert: Omit<OffboardingTask, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<OffboardingTask, 'id' | 'created_at' | 'updated_at'>>; Relationships: [] };
      offboarding_assets: { Row: OffboardingAsset; Insert: Omit<OffboardingAsset, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<OffboardingAsset, 'id' | 'created_at' | 'updated_at'>>; Relationships: [] };
      offboarding_access: { Row: OffboardingAccess; Insert: Omit<OffboardingAccess, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<OffboardingAccess, 'id' | 'created_at' | 'updated_at'>>; Relationships: [] };
    };
    Views: {};
    Functions: {};
    Enums: {};
  };
}

// Helper types for table access
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type Insertable<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type Updatable<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];
