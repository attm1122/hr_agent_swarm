/**
 * Manager Support Agent
 * 
 * Provides manager-focused insights, team summaries, and employee briefs.
 * Uses persistent operational data when available, falls back to local stores.
 * 
 * Supported Intents:
 * - manager_team_summary: High-level team health and metrics
 * - manager_employee_brief: Detailed brief for a specific employee
 * - manager_dashboard: Full manager dashboard data
 * - manager_action_items: Prioritized list of action items
 * - manager_status_check: Quick status check for employees
 */

import type { AgentResult, AgentContext, AgentIntent } from '@/types';
import type { Agent } from './base';
import { createAgentResult, createErrorResult } from './base';
import {
  ManagerSupportRepository,
  getManagerSupportRepository,
  ManagerTeamContext,
  TeamBrief,
  EmployeeBrief,
  ManagerDashboardData,
} from '@/lib/repositories/manager-support-repository';
import { getManagerOperationalRepository } from '@/lib/repositories/manager-operational-repository';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export class ManagerSupportAgent implements Agent {
  readonly type = 'manager_support' as const;
  readonly name = 'Manager Support Agent';
  readonly supportedIntents: AgentIntent[] = [
    'manager_team_summary',
    'manager_employee_brief',
    'manager_dashboard',
    'manager_action_items',
    'manager_status_check',
  ];
  readonly requiredPermissions = ['manager:read', 'team:view'];

  private repository: ManagerSupportRepository;

  constructor(repository?: ManagerSupportRepository) {
    this.repository = repository || this.initializeRepository();
  }

  /**
   * Initialize repository with Supabase if credentials are available
   */
  private initializeRepository(): ManagerSupportRepository {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && supabaseKey) {
      try {
        const supabase = createClient<Database>(supabaseUrl, supabaseKey);
        const operationalRepo = getManagerOperationalRepository(supabase);
        return getManagerSupportRepository(operationalRepo);
      } catch (err) {
        console.warn('Failed to initialize Supabase client, using local fallback:', err);
      }
    }

    // Fallback to local stores
    return getManagerSupportRepository();
  }

  canHandle(intent: AgentIntent): boolean {
    return this.supportedIntents.includes(intent);
  }

  async execute(
    intent: AgentIntent,
    payload: Record<string, unknown>,
    context: AgentContext
  ): Promise<AgentResult> {
    const teamContext: ManagerTeamContext = {
      managerId: context.managerId || context.userId,
      teamId: context.teamId,
      scope: 'direct_reports',
    };

    try {
      switch (intent) {
        case 'manager_team_summary':
          return await this.handleTeamSummary(teamContext);
        case 'manager_employee_brief':
          return await this.handleEmployeeBrief(payload, teamContext);
        case 'manager_dashboard':
          return await this.handleDashboard(teamContext);
        case 'manager_action_items':
          return await this.handleActionItems(teamContext);
        case 'manager_status_check':
          return await this.handleStatusCheck(payload, teamContext);
        default:
          return createErrorResult(`Unsupported intent: ${intent}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createErrorResult(`Manager support operation failed: ${message}`);
    }
  }

  /**
   * Handle manager_team_summary intent
   */
  private async handleTeamSummary(context: ManagerTeamContext): Promise<AgentResult> {
    const brief = await this.repository.generateTeamBrief(context);

    // Build natural language summary
    const summaryParts: string[] = [];
    summaryParts.push(`Team overview: ${brief.summary.totalEmployees} employees`);
    
    if (brief.summary.activeEmployees < brief.summary.totalEmployees) {
      summaryParts.push(`(${brief.summary.activeEmployees} active, ${brief.summary.totalEmployees - brief.summary.activeEmployees} inactive/on leave)`);
    }

    if (brief.summary.pendingLeaveRequests > 0) {
      summaryParts.push(`${brief.summary.pendingLeaveRequests} leave request(s) pending your approval`);
    }

    if (brief.summary.upcomingMilestones > 0) {
      summaryParts.push(`${brief.summary.upcomingMilestones} milestone(s) in the next 30 days`);
    }

    if (brief.summary.activeOnboarding > 0) {
      summaryParts.push(`${brief.summary.activeOnboarding} employee(s) onboarding`);
    }

    if (brief.summary.activeOffboarding > 0) {
      summaryParts.push(`${brief.summary.activeOffboarding} employee(s) offboarding`);
    }

    // Identify risks
    const risks: string[] = [];
    brief.highlights
      .filter(h => h.priority === 'critical')
      .forEach(h => risks.push(h.description));

    const criticalHighlights = brief.highlights.filter(
      h => h.priority === 'critical' || h.priority === 'high'
    );

    return createAgentResult(brief, {
      summary: summaryParts.join('. '),
      risks,
      proposedActions: brief.actionsRequired,
      requiresApproval: criticalHighlights.length > 0,
    });
  }

  /**
   * Handle manager_employee_brief intent
   */
  private async handleEmployeeBrief(
    payload: Record<string, unknown>,
    context: ManagerTeamContext
  ): Promise<AgentResult> {
    const employeeId = payload.employeeId as string;
    if (!employeeId) {
      return createErrorResult('Missing required parameter: employeeId');
    }

    const brief = await this.repository.generateEmployeeBrief(employeeId, context);
    if (!brief) {
      return createErrorResult(`Employee not found or not in your team: ${employeeId}`);
    }

    // Build summary
    const summaryParts: string[] = [brief.summary];

    if (brief.concerns.length > 0) {
      summaryParts.push(`Concerns: ${brief.concerns.join(', ')}`);
    }

    if (brief.recommendations.length > 0) {
      summaryParts.push(`Recommendations: ${brief.recommendations.join(', ')}`);
    }

    return createAgentResult(brief, {
      summary: summaryParts.join(' '),
      risks: brief.concerns,
      proposedActions: brief.actionItems.map(item => ({
        type: item.type,
        label: item.title,
        payload: { 
          employeeId: item.entityId, 
          actionId: item.id,
          priority: item.priority,
        },
      })),
      requiresApproval: brief.status === 'red',
    });
  }

  /**
   * Handle manager_dashboard intent
   */
  private async handleDashboard(context: ManagerTeamContext): Promise<AgentResult> {
    const dashboard = await this.repository.generateManagerDashboard(context);

    // Build summary
    const summaryParts: string[] = [];
    summaryParts.push(`Dashboard for your team of ${dashboard.myTeam.summary.totalEmployees}`);
    
    if (dashboard.criticalItems.length > 0) {
      summaryParts.push(`${dashboard.criticalItems.length} critical item(s) require immediate attention`);
    }

    if (dashboard.pendingMyAction.count > 0) {
      summaryParts.push(`${dashboard.pendingMyAction.count} item(s) pending your approval`);
    }

    summaryParts.push(`Team health: ${dashboard.teamHealth.overall}`);

    // Build risks from team health
    const risks: string[] = [];
    dashboard.teamHealth.factors
      .filter(f => f.status === 'critical')
      .forEach(f => risks.push(`${f.name} is in critical state`));

    return createAgentResult(dashboard, {
      summary: summaryParts.join('. '),
      risks,
      proposedActions: [
        ...dashboard.criticalItems.map(item => ({
          type: item.type,
          label: item.title,
          payload: { actionId: item.id, entityId: item.entityId },
        })),
        ...(dashboard.pendingMyAction.count > 0 ? [{
          type: 'review_approvals',
          label: `Review ${dashboard.pendingMyAction.count} pending approval(s)`,
          payload: { count: dashboard.pendingMyAction.count },
        }] : []),
      ],
      requiresApproval: dashboard.criticalItems.length > 0,
    });
  }

  /**
   * Handle manager_action_items intent
   */
  private async handleActionItems(context: ManagerTeamContext): Promise<AgentResult> {
    const dashboard = await this.repository.generateManagerDashboard(context);

    // Combine and prioritize all action items
    const allActions = [
      ...dashboard.criticalItems.map(item => ({
        ...item,
        source: 'critical',
        priorityScore: item.priority === 'critical' ? 100 : item.priority === 'high' ? 50 : 25,
      })),
      ...dashboard.pendingMyAction.items.map(item => ({
        id: item.id,
        type: 'approval',
        title: item.title,
        description: 'Pending your approval',
        priority: 'high' as const,
        dueDate: item.dueDate,
        assignee: context.managerId,
        entityType: 'workflow',
        entityId: item.id,
        source: 'approval',
        priorityScore: 75,
      })),
    ];

    // Sort by priority score
    allActions.sort((a, b) => b.priorityScore - a.priorityScore);

    return createAgentResult(
      { actions: allActions },
      {
        summary: `You have ${allActions.length} action item(s): ${dashboard.criticalItems.length} critical, ${dashboard.pendingMyAction.count} pending approvals`,
        proposedActions: allActions.slice(0, 5).map(action => ({
          type: action.type,
          label: action.title,
          payload: { 
            actionId: action.id, 
            entityId: action.entityId,
            priority: action.priority,
          },
        })),
        requiresApproval: dashboard.criticalItems.some(i => i.priority === 'critical'),
      }
    );
  }

  /**
   * Handle manager_status_check intent
   */
  private async handleStatusCheck(
    payload: Record<string, unknown>,
    context: ManagerTeamContext
  ): Promise<AgentResult> {
    const employeeId = payload.employeeId as string;
    const checkAll = payload.checkAll as boolean;

    if (!employeeId && !checkAll) {
      return createErrorResult('Missing required parameter: employeeId or checkAll');
    }

    if (checkAll) {
      // Check all team members
      const operationalRepo = this.repository['operationalRepo'];
      const employees = await operationalRepo.getTeamEmployees(context);
      
      const results = await Promise.all(
        employees.map(async emp => {
          const status = await this.repository.getEmployeeStatusIndicator(emp.id, context);
          return {
            employeeId: emp.id,
            name: `${emp.firstName} ${emp.lastName}`,
            status: status?.status || 'unknown',
            reason: status?.reason || 'Unknown',
          };
        })
      );

      const redCount = results.filter(r => r.status === 'red').length;
      const yellowCount = results.filter(r => r.status === 'yellow').length;
      const greenCount = results.filter(r => r.status === 'green').length;

      return createAgentResult(
        { results },
        {
          summary: `Team status check: ${greenCount} green, ${yellowCount} yellow, ${redCount} red`,
          risks: redCount > 0 ? [`${redCount} employee(s) have critical issues`] : [],
          proposedActions: redCount > 0 ? [{
            type: 'review_critical',
            label: `Review ${redCount} critical employee(s)`,
            payload: { 
              criticalEmployees: results.filter(r => r.status === 'red').map(r => r.employeeId) 
            },
          }] : [],
          requiresApproval: redCount > 0,
        }
      );
    }

    // Check single employee
    const status = await this.repository.getEmployeeStatusIndicator(employeeId, context);
    if (!status) {
      return createErrorResult(`Employee not found: ${employeeId}`);
    }

    return createAgentResult(
      { employeeId, ...status },
      {
        summary: `Status for ${employeeId}: ${status.status} - ${status.reason}`,
        risks: status.status === 'red' ? [status.reason] : [],
        requiresApproval: status.status === 'red',
        proposedActions: status.status !== 'green' ? [{
          type: 'review_employee',
          label: `Review employee details`,
          payload: { employeeId },
        }] : [],
      }
    );
  }
}

// Factory function for coordinator registration
export function createManagerSupportAgent(repository?: ManagerSupportRepository): ManagerSupportAgent {
  return new ManagerSupportAgent(repository);
}
