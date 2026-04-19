/**
 * Repository Ports - Interfaces for data access
 * 
 * Domain layer depends on these interfaces, not concrete implementations.
 */

import type {
  Employee,
  EmployeeSummary,
} from '@/lib/domain/employee/types';
import type {
  LeaveBalance,
  LeaveRequest,
} from '@/lib/domain/leave/types';
import type {
  PolicyDocument,
  PolicyChunk,
} from '@/lib/domain/document/types';
import type {
  WorkflowInstance,
  WorkflowStep,
} from '@/lib/domain/workflow/types';
import type { AgentRunRecord } from '@/lib/domain/audit/types';
import type {
  OnboardingPlan,
  OnboardingTask,
  OffboardingPlan,
  OffboardingTask,
  Milestone,
  EmployeeDocument,
  ExportApproval,
  AgentContext,
} from '@/types';

// ============================================================================
// Employee Repository Port
// ============================================================================

export interface EmployeeRepositoryPort {
  findById(id: string, tenantId: string): Promise<Employee | null>;
  findByIds(ids: string[], tenantId: string): Promise<Employee[]>;
  findByTeam(teamId: string, tenantId: string): Promise<Employee[]>;
  findByManager(managerId: string, tenantId: string): Promise<Employee[]>;
  findDirectReports(managerId: string, tenantId: string): Promise<Employee[]>;
  findAll(params: {
    tenantId: string;
    status?: string;
    department?: string;
    limit?: number;
    offset?: number;
  }): Promise<Employee[]>;
  search(params: {
    tenantId: string;
    query: string;
    filters?: Record<string, unknown>;
  }): Promise<Employee[]>;
  save(employee: Employee, tenantId: string): Promise<void>;
  update(id: string, data: Partial<Employee>, tenantId: string): Promise<void>;
  delete(id: string, tenantId: string): Promise<void>;
}

// ============================================================================
// Leave Repository Port
// ============================================================================

export interface LeaveRepositoryPort {
  findBalance(employeeId: string, leaveType: string, tenantId: string): Promise<LeaveBalance | null>;
  findBalances(employeeId: string, tenantId: string): Promise<LeaveBalance[]>;
  findRequests(params: {
    tenantId: string;
    employeeId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<LeaveRequest[]>;
  findPendingRequestsForApprover(approverId: string, tenantId: string): Promise<LeaveRequest[]>;
  saveRequest(request: LeaveRequest, tenantId: string): Promise<void>;
  updateRequest(id: string, data: Partial<LeaveRequest>, tenantId: string): Promise<void>;
  approveRequest(id: string, approverId: string, tenantId: string): Promise<void>;
  rejectRequest(id: string, approverId: string, reason: string, tenantId: string): Promise<void>;
  updateBalance(employeeId: string, leaveType: string, delta: number, tenantId: string): Promise<void>;
}

// ============================================================================
// Policy/Document Repository Port
// ============================================================================

export interface PolicyRepositoryPort {
  findById(id: string, tenantId: string): Promise<PolicyDocument | null>;
  findByIds(ids: string[], tenantId: string): Promise<PolicyDocument[]>;
  findAll(params: {
    tenantId: string;
    category?: string;
    jurisdiction?: string;
    status?: string;
  }): Promise<PolicyDocument[]>;
  findChunks(params: {
    tenantId: string;
    documentId?: string;
    zone?: string;
    jurisdiction?: string;
    audience?: string;
  }): Promise<PolicyChunk[]>;
  searchContent(params: {
    tenantId: string;
    query: string;
    filters?: {
      zone?: string;
      jurisdiction?: string;
      audience?: string;
    };
    limit?: number;
  }): Promise<Array<{ chunk: PolicyChunk; score: number }>>;
  save(document: PolicyDocument, tenantId: string): Promise<void>;
  saveChunk(chunk: PolicyChunk, tenantId: string): Promise<void>;
  update(id: string, data: Partial<PolicyDocument>, tenantId: string): Promise<void>;
  delete(id: string, tenantId: string): Promise<void>;
}

// ============================================================================
// Workflow Repository Port
// ============================================================================

export interface WorkflowRepositoryPort {
  findInstanceById(id: string, tenantId: string): Promise<WorkflowInstance | null>;
  findInstances(params: {
    tenantId: string;
    referenceId?: string;
    employeeId?: string;
    type?: string;
    status?: string;
  }): Promise<WorkflowInstance[]>;
  findPendingForApprover(approverId: string, tenantId: string): Promise<WorkflowInstance[]>;
  findSteps(workflowId: string, tenantId: string): Promise<WorkflowStep[]>;
  findStepById(stepId: string, tenantId: string): Promise<WorkflowStep | null>;
  saveInstance(instance: WorkflowInstance, tenantId: string): Promise<void>;
  saveStep(step: WorkflowStep, tenantId: string): Promise<void>;
  updateInstance(id: string, data: Partial<WorkflowInstance>, tenantId: string): Promise<void>;
  updateStep(id: string, data: Partial<WorkflowStep>, tenantId: string): Promise<void>;
  approveStep(stepId: string, approverId: string, tenantId: string): Promise<void>;
  rejectStep(stepId: string, approverId: string, reason: string, tenantId: string): Promise<void>;
}

// ============================================================================
// Onboarding Repository Port
// ============================================================================

export interface OnboardingRepositoryPort {
  findPlanById(id: string, tenantId: string): Promise<OnboardingPlan | null>;
  findPlansByEmployee(employeeId: string, tenantId: string): Promise<OnboardingPlan[]>;
  findPendingPlans(tenantId: string): Promise<OnboardingPlan[]>;
  findTasks(planId: string, tenantId: string): Promise<OnboardingTask[]>;
  findTaskById(taskId: string, tenantId: string): Promise<OnboardingTask | null>;
  savePlan(plan: OnboardingPlan, tenantId: string): Promise<void>;
  saveTask(task: OnboardingTask, tenantId: string): Promise<void>;
  updatePlan(id: string, data: Partial<OnboardingPlan>, tenantId: string): Promise<void>;
  updateTask(id: string, data: Partial<OnboardingTask>, tenantId: string): Promise<void>;
  completeTask(taskId: string, completedBy: string, tenantId: string): Promise<void>;
}

// ============================================================================
// Offboarding Repository Port
// ============================================================================

export interface OffboardingRepositoryPort {
  findPlanById(id: string, tenantId: string): Promise<OffboardingPlan | null>;
  findPlansByEmployee(employeeId: string, tenantId: string): Promise<OffboardingPlan[]>;
  findPendingPlans(tenantId: string): Promise<OffboardingPlan[]>;
  findTasks(planId: string, tenantId: string): Promise<OffboardingTask[]>;
  savePlan(plan: OffboardingPlan, tenantId: string): Promise<void>;
  saveTask(task: OffboardingTask, tenantId: string): Promise<void>;
  updatePlan(id: string, data: Partial<OffboardingPlan>, tenantId: string): Promise<void>;
  updateTask(id: string, data: Partial<OffboardingTask>, tenantId: string): Promise<void>;
  completeTask(taskId: string, completedBy: string, tenantId: string): Promise<void>;
}

// ============================================================================
// Milestone Repository Port
// ============================================================================

export interface MilestoneRepositoryPort {
  findById(id: string, tenantId: string): Promise<Milestone | null>;
  findByEmployee(employeeId: string, tenantId: string): Promise<Milestone[]>;
  findUpcoming(params: {
    tenantId: string;
    days: number;
    types?: string[];
  }): Promise<Milestone[]>;
  findOverdue(tenantId: string): Promise<Milestone[]>;
  save(milestone: Milestone, tenantId: string): Promise<void>;
  update(id: string, data: Partial<Milestone>, tenantId: string): Promise<void>;
  acknowledge(id: string, acknowledgedBy: string, tenantId: string): Promise<void>;
}

// ============================================================================
// Document Repository Port
// ============================================================================

export interface DocumentRepositoryPort {
  findById(id: string, tenantId: string): Promise<EmployeeDocument | null>;
  findByEmployee(employeeId: string, tenantId: string): Promise<EmployeeDocument[]>;
  findExpiring(params: {
    tenantId: string;
    days: number;
    category?: string;
  }): Promise<EmployeeDocument[]>;
  save(document: EmployeeDocument, tenantId: string): Promise<void>;
  update(id: string, data: Partial<EmployeeDocument>, tenantId: string): Promise<void>;
  delete(id: string, tenantId: string): Promise<void>;
}

// ============================================================================
// Agent Run Repository Port
// ============================================================================

export interface AgentRunRepositoryPort {
  save(record: AgentRunRecord, tenantId: string): Promise<void>;
  findById(id: string, tenantId: string): Promise<AgentRunRecord | null>;
  findBySession(sessionId: string, tenantId: string): Promise<AgentRunRecord[]>;
  findByAgent(agentType: string, tenantId: string, limit?: number): Promise<AgentRunRecord[]>;
  findByIntent(intent: string, tenantId: string, limit?: number): Promise<AgentRunRecord[]>;
  query(params: {
    tenantId: string;
    agentType?: string;
    intent?: string;
    success?: boolean;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<AgentRunRecord[]>;
  getStats(tenantId: string, params?: {
    agentType?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{
    total: number;
    successful: number;
    failed: number;
    averageExecutionTime: number;
  }>;
}

// ============================================================================
// Export Approval Repository Port
// ============================================================================

export interface ExportApprovalRepositoryPort {
  create(approval: ExportApproval, tenantId: string): Promise<void>;
  findById(id: string, tenantId: string): Promise<ExportApproval | null>;
  findPendingForApprover(approverId: string, tenantId: string): Promise<ExportApproval[]>;
  findPendingForRequester(requesterId: string, tenantId: string): Promise<ExportApproval[]>;
  approve(id: string, approverId: string, tenantId: string): Promise<void>;
  reject(id: string, approverId: string, reason: string, tenantId: string): Promise<void>;
  complete(id: string, downloadUrl: string, tenantId: string): Promise<void>;
  cancel(id: string, tenantId: string): Promise<void>;
}

// ============================================================================
// Repository Factory
// ============================================================================

export interface RepositoryFactory {
  employee(): EmployeeRepositoryPort;
  leave(): LeaveRepositoryPort;
  policy(): PolicyRepositoryPort;
  workflow(): WorkflowRepositoryPort;
  onboarding(): OnboardingRepositoryPort;
  offboarding(): OffboardingRepositoryPort;
  milestone(): MilestoneRepositoryPort;
  document(): DocumentRepositoryPort;
  agentRun(): AgentRunRepositoryPort;
  exportApproval(): ExportApprovalRepositoryPort;
}
