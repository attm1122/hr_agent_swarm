/**
 * Manager Support Repository
 * 
 * High-level repository for manager-focused summaries, briefs, and insights.
 * Aggregates data from operational repository and provides manager-centric views.
 * 
 * Features:
 * - Team summaries with key metrics
 * - Employee briefs for 1:1s and reviews
 * - Risk identification and escalation flags
 * - Action item generation
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { Employee } from '@/lib/domain/employee/types';
import type { LeaveRequest } from '@/lib/domain/leave/types';
import type { Milestone, ActionItem, ProposedAction, AgentResult } from '@/types';
import {
  ManagerOperationalRepository,
  ManagerTeamContext,
  TeamOperationalSummary,
  EmployeeOperationalStatus,
  getManagerOperationalRepository,
} from './manager-operational-repository';

export interface TeamBrief {
  summary: TeamOperationalSummary;
  highlights: {
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    employeeId?: string;
    actionType?: string;
  }[];
  actionsRequired: ProposedAction[];
  generatedAt: string;
  dataSource: 'supabase' | 'local';
}

export interface EmployeeBrief {
  employee: Employee;
  status: 'green' | 'yellow' | 'red';
  summary: string;
  keyMetrics: {
    label: string;
    value: string;
    trend?: 'up' | 'down' | 'neutral';
  }[];
  upcomingEvents: {
    type: 'milestone' | 'leave' | 'review' | 'deadline';
    date: string;
    description: string;
  }[];
  concerns: string[];
  recommendations: string[];
  actionItems: ActionItem[];
  generatedAt: string;
  dataSource: 'supabase' | 'local';
}

export interface ManagerDashboardData {
  myTeam: TeamBrief;
  criticalItems: ActionItem[];
  pendingMyAction: {
    type: 'approval' | 'task' | 'review';
    count: number;
    items: { id: string; title: string; dueDate?: string }[];
  };
  teamHealth: {
    overall: 'healthy' | 'attention' | 'at_risk';
    factors: { name: string; status: 'good' | 'warning' | 'critical' }[];
  };
}

export class ManagerSupportRepository {
  private operationalRepo: ManagerOperationalRepository;

  constructor(operationalRepo?: ManagerOperationalRepository) {
    this.operationalRepo = operationalRepo || getManagerOperationalRepository();
  }

  /**
   * Generate a comprehensive team brief for manager review
   */
  async generateTeamBrief(context: ManagerTeamContext): Promise<TeamBrief> {
    const startTime = Date.now();
    const isPersistent = this.operationalRepo.isUsingPersistence();

    const [summary, employees, milestones, pendingLeave, pendingWorkflows] = await Promise.all([
      this.operationalRepo.getTeamSummary(context),
      this.operationalRepo.getTeamEmployees(context),
      this.operationalRepo.getTeamMilestones(context, 30),
      this.operationalRepo.getTeamLeaveRequests(context, 'pending'),
      this.operationalRepo.getPendingApprovalsForManager(context.managerId),
    ]);

    const highlights = this.generateHighlights(summary, employees, milestones, pendingLeave);
    const actionsRequired = this.generateTeamActions(summary, pendingLeave, pendingWorkflows as import('@/types').WorkflowInstance[]);

    return {
      summary,
      highlights,
      actionsRequired,
      generatedAt: new Date().toISOString(),
      dataSource: isPersistent ? 'supabase' : 'local',
    };
  }

  /**
   * Generate a focused brief for a specific employee
   */
  async generateEmployeeBrief(
    employeeId: string,
    context: ManagerTeamContext
  ): Promise<EmployeeBrief | null> {
    const status = await this.operationalRepo.getEmployeeFullStatus(employeeId, context);
    if (!status) return null;

    const isPersistent = this.operationalRepo.isUsingPersistence();
    const { employee, documents, leave, milestones, onboarding, offboarding, pendingWorkflows } = status;

    // Determine overall status
    let overallStatus: 'green' | 'yellow' | 'red' = 'green';
    const concerns: string[] = [];

    if (documents.expired > 0) {
      overallStatus = 'red';
      concerns.push(`${documents.expired} expired document(s)`);
    } else if (documents.expiring > 0) {
      overallStatus = 'yellow';
      concerns.push(`${documents.expiring} document(s) expiring soon`);
    }

    if (milestones.overdue.length > 0) {
      overallStatus = 'red';
      concerns.push(`${milestones.overdue.length} overdue milestone(s)`);
    } else if (milestones.upcoming.length > 0) {
      if (overallStatus === 'green') overallStatus = 'yellow';
    }

    if (offboarding) {
      overallStatus = 'yellow';
      concerns.push('Employee has active offboarding plan');
    }

    // Build key metrics
    const keyMetrics: { label: string; value: string; trend?: 'up' | 'down' | 'neutral' }[] = [
      {
        label: 'Leave Balance',
        value: `${leave.upcomingLeaves.reduce((acc, l) => acc + l.daysRequested, 0)} days upcoming`,
        trend: leave.pendingRequests > 0 ? 'up' : 'neutral',
      },
      {
        label: 'Documents',
        value: `${documents.total} total`,
        trend: documents.expired > 0 ? 'down' : 'neutral',
      },
      {
        label: 'Milestones',
        value: `${milestones.upcoming.length} upcoming`,
        trend: milestones.overdue.length > 0 ? 'down' : 'neutral',
      },
    ];

    // Build upcoming events
    const upcomingEvents: EmployeeBrief['upcomingEvents'] = [
      ...milestones.upcoming.slice(0, 3).map(m => ({
        type: 'milestone' as const,
        date: m.milestoneDate,
        description: m.description,
      })),
      ...leave.upcomingLeaves.slice(0, 2).map(l => ({
        type: 'leave' as const,
        date: l.startDate,
        description: `${l.leaveType} leave: ${l.daysRequested} days`,
      })),
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Generate recommendations
    const recommendations: string[] = [];
    if (milestones.upcoming.some(m => m.milestoneType === 'probation_end')) {
      recommendations.push('Schedule probation review before due date');
    }
    if (documents.expiring > 0) {
      recommendations.push('Follow up on expiring documents');
    }
    if (onboarding && onboarding.status === 'in_progress') {
      recommendations.push('Check onboarding progress and address any blockers');
    }
    if (leave.pendingRequests > 0) {
      recommendations.push('Review pending leave request(s)');
    }

    // Generate action items
    const actionItems: ActionItem[] = [];
    if (milestones.overdue.length > 0) {
      actionItems.push({
        id: `action-${employeeId}-milestones`,
        type: 'milestone_review',
        title: 'Address overdue milestones',
        description: `${milestones.overdue.length} overdue milestone(s) require attention`,
        priority: 'high',
        dueDate: new Date().toISOString().split('T')[0],
        assignee: context.managerId,
        entityType: 'employee',
        entityId: employeeId,
      });
    }

    // Build summary text
    let summary = `${employee.firstName} ${employee.lastName} is ${employee.status}`;
    if (onboarding) summary += ` and currently in onboarding (${onboarding.status})`;
    if (offboarding) summary += ` with offboarding in progress`;
    summary += '.';

    return {
      employee,
      status: overallStatus,
      summary,
      keyMetrics,
      upcomingEvents,
      concerns,
      recommendations,
      actionItems,
      generatedAt: new Date().toISOString(),
      dataSource: isPersistent ? 'supabase' : 'local',
    };
  }

  /**
   * Generate full manager dashboard data
   */
  async generateManagerDashboard(context: ManagerTeamContext): Promise<ManagerDashboardData> {
    const [teamBrief, pendingApprovals] = await Promise.all([
      this.generateTeamBrief(context),
      this.operationalRepo.getPendingApprovalsForManager(context.managerId),
    ]);

    // Collect all action items from team brief
    const criticalItems: ActionItem[] = [];
    
    // Add high-priority items from team highlights
    teamBrief.highlights
      .filter(h => h.priority === 'high' || h.priority === 'critical')
      .forEach(h => {
        criticalItems.push({
          id: `highlight-${h.title}`,
          type: h.actionType || 'review',
          title: h.title,
          description: h.description,
          priority: h.priority,
          entityType: 'employee',
          entityId: h.employeeId || 'team',
        });
      });

    // Determine team health
    const healthFactors: { name: string; status: 'good' | 'warning' | 'critical' }[] = [];
    
    healthFactors.push({
      name: 'Documentation',
      status: teamBrief.summary.pendingLeaveRequests === 0 ? 'good' : 
              teamBrief.summary.pendingLeaveRequests < 3 ? 'warning' : 'critical',
    });
    
    healthFactors.push({
      name: 'Milestones',
      status: teamBrief.summary.upcomingMilestones === 0 ? 'good' :
              teamBrief.summary.upcomingMilestones < 3 ? 'warning' : 'critical',
    });
    
    healthFactors.push({
      name: 'Workflows',
      status: teamBrief.summary.pendingApprovals === 0 ? 'good' :
              teamBrief.summary.pendingApprovals < 5 ? 'warning' : 'critical',
    });

    const criticalCount = healthFactors.filter(f => f.status === 'critical').length;
    const warningCount = healthFactors.filter(f => f.status === 'warning').length;
    
    const overallHealth = criticalCount > 0 ? 'at_risk' :
                          warningCount > 0 ? 'attention' : 'healthy';

    return {
      myTeam: teamBrief,
      criticalItems,
      pendingMyAction: {
        type: 'approval',
        count: pendingApprovals.length,
        items: pendingApprovals.map(w => ({
          id: w.id,
          title: `${w.workflowType}: ${w.referenceType}`,
          dueDate: w.startedAt ?? undefined,
        })),
      },
      teamHealth: {
        overall: overallHealth,
        factors: healthFactors,
      },
    };
  }

  /**
   * Generate highlights from team data
   */
  private generateHighlights(
    summary: TeamOperationalSummary,
    employees: Employee[],
    milestones: { upcoming: Milestone[]; overdue: Milestone[] },
    pendingLeave: LeaveRequest[]
  ): TeamBrief['highlights'] {
    const highlights: TeamBrief['highlights'] = [];

    // Critical: Overdue milestones
    if (milestones.overdue.length > 0) {
      highlights.push({
        title: 'Overdue Milestones',
        description: `${milestones.overdue.length} milestone(s) are overdue and require immediate attention`,
        priority: 'critical',
        actionType: 'milestone_review',
      });
    }

    // High: Pending leave requests
    if (pendingLeave.length > 0) {
      highlights.push({
        title: 'Pending Leave Requests',
        description: `${pendingLeave.length} leave request(s) awaiting your approval`,
        priority: 'high',
        actionType: 'leave_approve',
      });
    }

    // Medium: Upcoming milestones
    if (milestones.upcoming.length > 0) {
      highlights.push({
        title: 'Upcoming Milestones',
        description: `${milestones.upcoming.length} milestone(s) in the next 30 days`,
        priority: 'medium',
        actionType: 'milestone_review',
      });
    }

    // Medium: Active onboarding
    if (summary.activeOnboarding > 0) {
      highlights.push({
        title: 'Active Onboarding',
        description: `${summary.activeOnboarding} employee(s) currently onboarding`,
        priority: 'medium',
        actionType: 'onboarding_review',
      });
    }

    // Medium: Active offboarding
    if (summary.activeOffboarding > 0) {
      highlights.push({
        title: 'Active Offboarding',
        description: `${summary.activeOffboarding} employee(s) in offboarding process`,
        priority: 'medium',
        actionType: 'offboarding_review',
      });
    }

    return highlights;
  }

  /**
   * Generate recommended actions based on team state
   */
  private generateTeamActions(
    summary: TeamOperationalSummary,
    pendingLeave: LeaveRequest[],
    pendingWorkflows: import('@/types').WorkflowInstance[]
  ): ProposedAction[] {
    const actions: ProposedAction[] = [];

    if (pendingLeave.length > 0) {
      actions.push({
        type: 'review_approvals',
        label: 'Review Pending Leave',
        payload: { count: pendingLeave.length, type: 'leave' },
      });
    }

    if (pendingWorkflows.length > 0) {
      actions.push({
        type: 'review_workflows',
        label: 'Review Pending Approvals',
        payload: { count: pendingWorkflows.length },
      });
    }

    if (summary.activeOnboarding > 0) {
      actions.push({
        type: 'review_onboarding',
        label: 'Check Onboarding Progress',
        payload: { count: summary.activeOnboarding },
      });
    }

    if (summary.upcomingMilestones > 0) {
      actions.push({
        type: 'review_milestones',
        label: 'Review Upcoming Milestones',
        payload: { count: summary.upcomingMilestones },
      });
    }

    return actions;
  }

  /**
   * Quick status check for an employee
   */
  async getEmployeeStatusIndicator(
    employeeId: string,
    context: ManagerTeamContext
  ): Promise<{ status: 'green' | 'yellow' | 'red'; reason: string } | null> {
    const status = await this.operationalRepo.getEmployeeFullStatus(employeeId, context);
    if (!status) return null;

    const { documents, milestones, offboarding } = status;

    if (documents.expired > 0 || milestones.overdue.length > 0) {
      return { status: 'red', reason: 'Critical items require attention' };
    }

    if (documents.expiring > 0 || milestones.upcoming.length > 0 || offboarding) {
      return { status: 'yellow', reason: 'Items need attention soon' };
    }

    return { status: 'green', reason: 'All clear' };
  }
}

// Singleton instance
let defaultRepository: ManagerSupportRepository | null = null;

export function getManagerSupportRepository(
  operationalRepo?: ManagerOperationalRepository
): ManagerSupportRepository {
  if (!defaultRepository) {
    defaultRepository = new ManagerSupportRepository(operationalRepo);
  }
  return defaultRepository;
}

// Re-export types for convenience
export type { ManagerTeamContext, TeamOperationalSummary, EmployeeOperationalStatus };
