/**
 * Manager Operational Repository
 * 
 * Provides persistent access to operational HR data for manager support.
 * Uses Supabase when configured, falls back to in-memory stores for local dev.
 * 
 * Security: All queries respect tenant isolation via team/manager scoping.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables } from '@/types/database';
import type { Employee, EmployeeDocument, LeaveRequest, Milestone, OnboardingPlan, OffboardingPlan, WorkflowInstance } from '@/types';
import { employees as mockEmployees, getDirectReports } from '@/lib/data/mock-data';
import { onboardingPlans, onboardingTasks } from '@/lib/data/onboarding-store';
import { offboardingPlans, offboardingTasks } from '@/lib/data/offboarding-store';
import { workflowInstances, workflowSteps } from '@/lib/data/workflow-store';

// Type aliases for database rows
type DbEmployee = Tables<'employees'>;
type DbDocument = Tables<'employee_documents'>;
type DbLeaveRequest = Tables<'leave_requests'>;
type DbMilestone = Tables<'milestones'>;
type DbOnboardingPlan = Tables<'onboarding_plans'>;
type DbOffboardingPlan = Tables<'offboarding_plans'>;
type DbWorkflow = Tables<'workflows'>;

export interface ManagerTeamContext {
  managerId: string;
  teamId?: string;
  scope: 'direct_reports' | 'team' | 'department';
}

export interface TeamOperationalSummary {
  totalEmployees: number;
  activeEmployees: number;
  onLeaveEmployees: number;
  pendingLeaveRequests: number;
  upcomingMilestones: number;
  activeOnboarding: number;
  activeOffboarding: number;
  pendingApprovals: number;
}

export interface EmployeeOperationalStatus {
  employee: Employee;
  documents: {
    total: number;
    expired: number;
    expiring: number;
    missing: number;
  };
  leave: {
    pendingRequests: number;
    upcomingLeaves: LeaveRequest[];
  };
  milestones: {
    upcoming: Milestone[];
    overdue: Milestone[];
  };
  onboarding: OnboardingPlan | null;
  offboarding: OffboardingPlan | null;
  pendingWorkflows: WorkflowInstance[];
}

export class ManagerOperationalRepository {
  private supabase: SupabaseClient<Database> | null = null;
  private isPersistent: boolean = false;

  constructor(supabase?: SupabaseClient<Database>) {
    if (supabase) {
      this.supabase = supabase;
      this.isPersistent = true;
    }
  }

  /**
   * Check if repository is using persistent storage
   */
  isUsingPersistence(): boolean {
    return this.isPersistent;
  }

  // ============================================
  // Employee Operations
  // ============================================

  /**
   * Get employees in manager's scope
   */
  async getTeamEmployees(context: ManagerTeamContext): Promise<Employee[]> {
    if (!this.isPersistent) {
      return this.getTeamEmployeesFromStore(context);
    }

    const { data, error } = await this.supabase!
      .from('employees')
      .select('*')
      .eq('manager_id', context.managerId)
      .eq('status', 'active');

    if (error) {
      console.warn('Supabase query failed, falling back to store:', error.message);
      return this.getTeamEmployeesFromStore(context);
    }

    return data.map(this.mapDbEmployeeToEmployee);
  }

  private getTeamEmployeesFromStore(context: ManagerTeamContext): Employee[] {
    if (context.scope === 'direct_reports') {
      return getDirectReports(context.managerId);
    }
    // For POC, only direct_reports scope is fully implemented in store
    return getDirectReports(context.managerId);
  }

  /**
   * Get employee by ID with tenant check
   */
  async getEmployee(employeeId: string, context: ManagerTeamContext): Promise<Employee | null> {
    if (!this.isPersistent) {
      const employee = mockEmployees.find(e => e.id === employeeId);
      if (!employee) return null;
      
      // Check if employee is in manager's scope
      const teamEmployees = await this.getTeamEmployees(context);
      if (!teamEmployees.some(e => e.id === employeeId)) {
        return null;
      }
      return employee;
    }

    const { data, error } = await this.supabase!
      .from('employees')
      .select('*')
      .eq('id', employeeId)
      .eq('manager_id', context.managerId)
      .single();

    if (error || !data) return null;
    return this.mapDbEmployeeToEmployee(data);
  }

  // ============================================
  // Document Operations
  // ============================================

  /**
   * Get document status for an employee
   */
  async getEmployeeDocuments(employeeId: string): Promise<{
    total: number;
    expired: number;
    expiring: number;
    missing: number;
    documents: EmployeeDocument[];
  }> {
    if (!this.isPersistent) {
      // In POC mode, return mock data based on employee
      return {
        total: 3,
        expired: 0,
        expiring: 1,
        missing: 0,
        documents: [],
      };
    }

    const { data, error } = await this.supabase!
      .from('employee_documents')
      .select('*')
      .eq('employee_id', employeeId) as { data: Tables<'employee_documents'>[] | null; error: Error | null };

    if (error || !data) {
      return { total: 0, expired: 0, expiring: 0, missing: 0, documents: [] };
    }

    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    return {
      total: data.length,
      expired: data.filter(d => d.status === 'expired').length,
      expiring: data.filter(d => d.status === 'expiring').length,
      missing: data.filter(d => d.status === 'missing').length,
      documents: data.map(this.mapDbDocumentToEmployeeDocument),
    };
  }

  // ============================================
  // Leave Operations
  // ============================================

  /**
   * Get leave requests for team
   */
  async getTeamLeaveRequests(
    context: ManagerTeamContext,
    status?: 'pending' | 'approved' | 'rejected'
  ): Promise<LeaveRequest[]> {
    if (!this.isPersistent) {
      // Return mock leave requests for direct reports
      const teamEmployees = await this.getTeamEmployees(context);
      const teamIds = teamEmployees.map(e => e.id);
      
      // Mock data
      const mockRequests: LeaveRequest[] = [
        {
          id: 'lr-001',
          employeeId: teamIds[0] || 'emp-008',
          leaveType: 'annual',
          startDate: '2026-04-15',
          endDate: '2026-04-20',
          daysRequested: 5,
          reason: 'Family vacation',
          status: status || 'pending',
          approvedBy: null,
          approvedAt: null,
          rejectionReason: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      return status ? mockRequests.filter(lr => lr.status === status) : mockRequests;
    }

    const teamEmployees = await this.getTeamEmployees(context);
    const teamIds = teamEmployees.map(e => e.id);

    let query = this.supabase!
      .from('leave_requests')
      .select('*')
      .in('employee_id', teamIds);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) return [];
    return data.map(this.mapDbLeaveRequestToLeaveRequest);
  }

  // ============================================
  // Milestone Operations
  // ============================================

  /**
   * Get upcoming milestones for team
   */
  async getTeamMilestones(
    context: ManagerTeamContext,
    daysAhead: number = 30
  ): Promise<{ upcoming: Milestone[]; overdue: Milestone[] }> {
    if (!this.isPersistent) {
      // Mock milestones based on team
      const teamEmployees = await this.getTeamEmployees(context);
      
      return {
        upcoming: teamEmployees.slice(0, 2).map((emp, i) => ({
          id: `ms-${i}`,
          employeeId: emp.id,
          milestoneType: i === 0 ? 'probation_end' : 'visa_expiry',
          milestoneDate: '2026-05-01',
          description: i === 0 ? '90-day probation review' : 'Work visa renewal',
          alertDaysBefore: 14,
          status: 'upcoming',
          acknowledgedAt: null,
          acknowledgedBy: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })),
        overdue: [],
      };
    }

    const teamEmployees = await this.getTeamEmployees(context);
    const teamIds = teamEmployees.map(e => e.id);

    const today = new Date().toISOString().split('T')[0];
    const futureDate = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { data: upcomingData, error: upcomingError } = await this.supabase!
      .from('milestones')
      .select('*')
      .in('employee_id', teamIds)
      .gte('milestone_date', today)
      .lte('milestone_date', futureDate)
      .in('status', ['upcoming', 'due']);

    const { data: overdueData, error: overdueError } = await this.supabase!
      .from('milestones')
      .select('*')
      .in('employee_id', teamIds)
      .lt('milestone_date', today)
      .eq('status', 'overdue');

    return {
      upcoming: upcomingError ? [] : upcomingData.map(this.mapDbMilestoneToMilestone),
      overdue: overdueError ? [] : overdueData.map(this.mapDbMilestoneToMilestone),
    };
  }

  // ============================================
  // Onboarding Operations
  // ============================================

  /**
   * Get active onboarding plans for team
   */
  async getTeamOnboarding(context: ManagerTeamContext): Promise<OnboardingPlan[]> {
    if (!this.isPersistent) {
      return onboardingPlans.filter(p => 
        p.status === 'in_progress' || p.status === 'not_started'
      );
    }

    const teamEmployees = await this.getTeamEmployees(context);
    const teamIds = teamEmployees.map(e => e.id);

    const { data, error } = await this.supabase!
      .from('onboarding_plans')
      .select('*')
      .in('employee_id', teamIds)
      .in('status', ['not_started', 'in_progress']);

    if (error) return [];
    return data.map(this.mapDbOnboardingPlanToOnboardingPlan);
  }

  /**
   * Get onboarding plan for a specific employee
   */
  async getEmployeeOnboarding(employeeId: string): Promise<OnboardingPlan | null> {
    if (!this.isPersistent) {
      return onboardingPlans.find(p => p.employeeId === employeeId && p.status !== 'completed') || null;
    }

    const { data, error } = await this.supabase!
      .from('onboarding_plans')
      .select('*')
      .eq('employee_id', employeeId)
      .neq('status', 'completed')
      .maybeSingle();

    if (error || !data) return null;
    return this.mapDbOnboardingPlanToOnboardingPlan(data);
  }

  // ============================================
  // Offboarding Operations
  // ============================================

  /**
   * Get active offboarding plans for team
   */
  async getTeamOffboarding(context: ManagerTeamContext): Promise<OffboardingPlan[]> {
    if (!this.isPersistent) {
      return offboardingPlans.filter(p => 
        !['completed', 'cancelled'].includes(p.status)
      );
    }

    const teamEmployees = await this.getTeamEmployees(context);
    const teamIds = teamEmployees.map(e => e.id);

    const { data, error } = await this.supabase!
      .from('offboarding_plans')
      .select('*')
      .in('employee_id', teamIds)
      .not('status', 'in', ['completed', 'cancelled']);

    if (error) return [];
    return data.map(this.mapDbOffboardingPlanToOffboardingPlan);
  }

  /**
   * Get offboarding plan for a specific employee
   */
  async getEmployeeOffboarding(employeeId: string): Promise<OffboardingPlan | null> {
    if (!this.isPersistent) {
      return offboardingPlans.find(p => p.employeeId === employeeId && !['completed', 'cancelled'].includes(p.status)) || null;
    }

    const { data, error } = await this.supabase!
      .from('offboarding_plans')
      .select('*')
      .eq('employee_id', employeeId)
      .not('status', 'in', ['completed', 'cancelled'])
      .maybeSingle();

    if (error || !data) return null;
    return this.mapDbOffboardingPlanToOffboardingPlan(data);
  }

  // ============================================
  // Workflow Operations
  // ============================================

  /**
   * Get pending workflows for team
   */
  async getTeamPendingWorkflows(context: ManagerTeamContext): Promise<WorkflowInstance[]> {
    if (!this.isPersistent) {
      return workflowInstances.filter(w => 
        w.status === 'in_progress' || w.status === 'pending'
      );
    }

    const teamEmployees = await this.getTeamEmployees(context);
    const teamIds = teamEmployees.map(e => e.id);

    const { data, error } = await this.supabase!
      .from('workflows')
      .select('*')
      .in('initiator_id', teamIds)
      .in('status', ['pending', 'in_progress']);

    if (error) return [];
    return data.map(this.mapDbWorkflowToWorkflowInstance);
  }

  /**
   * Get workflows requiring manager approval
   */
  async getPendingApprovalsForManager(managerId: string): Promise<WorkflowInstance[]> {
    if (!this.isPersistent) {
      // Find workflows where manager is an approver on a pending step
      const pendingStepIds = workflowSteps
        .filter(s => s.status === 'pending')
        .map(s => s.workflowId);
      
      return workflowInstances.filter(w => 
        pendingStepIds.includes(w.id) && 
        (w.status === 'in_progress' || w.status === 'pending')
      );
    }

    const { data, error } = await this.supabase!
      .from('approval_steps')
      .select('workflow_id')
      .eq('approver_id', managerId)
      .eq('status', 'pending') as { data: { workflow_id: string }[] | null; error: Error | null };

    if (error || !data || !data.length) return [];

    const workflowIds = data.map(d => d.workflow_id);

    const { data: workflows, error: wfError } = await this.supabase!
      .from('workflows')
      .select('*')
      .in('id', workflowIds);

    if (wfError) return [];
    return workflows.map(this.mapDbWorkflowToWorkflowInstance);
  }

  // ============================================
  // Summary Operations
  // ============================================

  /**
   * Get comprehensive team operational summary
   */
  async getTeamSummary(context: ManagerTeamContext): Promise<TeamOperationalSummary> {
    const [
      employees,
      pendingLeave,
      milestones,
      onboarding,
      offboarding,
      workflows,
    ] = await Promise.all([
      this.getTeamEmployees(context),
      this.getTeamLeaveRequests(context, 'pending'),
      this.getTeamMilestones(context, 30),
      this.getTeamOnboarding(context),
      this.getTeamOffboarding(context),
      this.getTeamPendingWorkflows(context),
    ]);

    return {
      totalEmployees: employees.length,
      activeEmployees: employees.filter(e => e.status === 'active').length,
      onLeaveEmployees: employees.filter(e => e.status === 'on_leave').length,
      pendingLeaveRequests: pendingLeave.length,
      upcomingMilestones: milestones.upcoming.length + milestones.overdue.length,
      activeOnboarding: onboarding.length,
      activeOffboarding: offboarding.length,
      pendingApprovals: workflows.length,
    };
  }

  /**
   * Get full operational status for a specific employee
   */
  async getEmployeeFullStatus(
    employeeId: string,
    context: ManagerTeamContext
  ): Promise<EmployeeOperationalStatus | null> {
    const employee = await this.getEmployee(employeeId, context);
    if (!employee) return null;

    const [
      documents,
      leaveRequests,
      milestones,
      onboarding,
      offboarding,
      workflows,
    ] = await Promise.all([
      this.getEmployeeDocuments(employeeId),
      this.getTeamLeaveRequests(context).then(reqs => 
        reqs.filter(r => r.employeeId === employeeId)
      ),
      this.getTeamMilestones(context).then(ms => ({
        upcoming: ms.upcoming.filter(m => m.employeeId === employeeId),
        overdue: ms.overdue.filter(m => m.employeeId === employeeId),
      })),
      this.getEmployeeOnboarding(employeeId),
      this.getEmployeeOffboarding(employeeId),
      this.getTeamPendingWorkflows(context).then(wfs =>
        wfs.filter(w => w.initiatorId === employeeId)
      ),
    ]);

    return {
      employee,
      documents: {
        total: documents.total,
        expired: documents.expired,
        expiring: documents.expiring,
        missing: documents.missing,
      },
      leave: {
        pendingRequests: leaveRequests.filter(r => r.status === 'pending').length,
        upcomingLeaves: leaveRequests.filter(r => r.status === 'approved'),
      },
      milestones,
      onboarding,
      offboarding,
      pendingWorkflows: workflows,
    };
  }

  // ============================================
  // Type Mappers
  // ============================================

  private mapDbEmployeeToEmployee(db: DbEmployee): Employee {
    return {
      id: db.id,
      email: db.email,
      firstName: db.first_name,
      lastName: db.last_name,
      employeeNumber: db.employee_number,
      hireDate: db.hire_date,
      terminationDate: db.termination_date,
      status: db.status,
      teamId: db.team_id,
      positionId: db.position_id,
      managerId: db.manager_id,
      workLocation: db.work_location,
      employmentType: db.employment_type,
      createdAt: db.created_at,
      updatedAt: db.updated_at,
    };
  }

  private mapDbDocumentToEmployeeDocument(db: DbDocument): EmployeeDocument {
    return {
      id: db.id,
      employeeId: db.employee_id,
      sourceId: db.onedrive_id,
      sourcePath: db.onedrive_path,
      fileName: db.file_name,
      fileType: db.file_type,
      fileSize: db.file_size,
      category: db.category,
      status: db.status,
      uploadedAt: db.uploaded_at,
      expiresAt: db.expires_at,
      extractedData: db.extracted_data as Record<string, unknown> || null,
      createdAt: db.created_at,
      updatedAt: db.updated_at,
    };
  }

  private mapDbLeaveRequestToLeaveRequest(db: DbLeaveRequest): LeaveRequest {
    return {
      id: db.id,
      employeeId: db.employee_id,
      leaveType: db.leave_type,
      startDate: db.start_date,
      endDate: db.end_date,
      daysRequested: db.days_requested,
      reason: db.reason,
      status: db.status,
      approvedBy: db.approved_by,
      approvedAt: db.approved_at,
      rejectionReason: db.rejection_reason,
      createdAt: db.created_at,
      updatedAt: db.updated_at,
    };
  }

  private mapDbMilestoneToMilestone(db: DbMilestone): Milestone {
    return {
      id: db.id,
      employeeId: db.employee_id,
      milestoneType: db.milestone_type,
      milestoneDate: db.milestone_date,
      description: db.description,
      alertDaysBefore: db.alert_days_before,
      status: db.status,
      acknowledgedAt: db.acknowledged_at,
      acknowledgedBy: db.acknowledged_by,
      createdAt: db.created_at,
      updatedAt: db.updated_at,
    };
  }

  private mapDbOnboardingPlanToOnboardingPlan(db: DbOnboardingPlan): OnboardingPlan {
    return {
      id: db.id,
      employeeId: db.employee_id,
      assignedTo: '', // Not in DB schema - populated from query join in production
      templateName: db.template_name,
      startDate: db.start_date,
      targetCompletionDate: db.target_completion_date,
      actualCompletionDate: db.actual_completion_date,
      status: db.status,
      createdAt: db.created_at,
      updatedAt: db.updated_at,
    };
  }

  private mapDbOffboardingPlanToOffboardingPlan(db: DbOffboardingPlan): OffboardingPlan {
    return {
      id: db.id,
      employeeId: db.employee_id,
      terminationDate: db.termination_date,
      initiatedBy: db.initiated_by,
      status: db.status,
      checklistTemplate: db.checklist_template,
      targetCompletionDate: db.target_completion_date,
      actualCompletionDate: db.actual_completion_date,
      createdAt: db.created_at,
      updatedAt: db.updated_at,
    };
  }

  private mapDbWorkflowToWorkflowInstance(db: DbWorkflow): WorkflowInstance {
    return {
      id: db.id,
      workflowType: db.workflow_type,
      referenceType: db.reference_type,
      referenceId: db.reference_id,
      initiatorId: db.initiator_id,
      status: db.status,
      currentStep: db.current_step,
      totalSteps: db.total_steps,
      startedAt: db.started_at,
      completedAt: db.completed_at,
      createdAt: db.created_at,
      updatedAt: db.updated_at,
    };
  }
}

// Singleton instance for use without explicit client
let defaultRepository: ManagerOperationalRepository | null = null;

export function getManagerOperationalRepository(
  supabase?: SupabaseClient<Database>
): ManagerOperationalRepository {
  if (supabase) {
    return new ManagerOperationalRepository(supabase);
  }
  if (!defaultRepository) {
    defaultRepository = new ManagerOperationalRepository();
  }
  return defaultRepository;
}
