/**
 * Workflow Service
 * 
 * Provides workflow management with:
 * - Escalation logic for overdue steps
 * - Event history tracking
 * - Approval inbox management
 * - Consistent workflow operations
 * 
 * Governance:
 * - Deterministic logic for escalation
 * - Audit trail for all workflow actions
 * - RBAC enforcement at service layer
 */

import type { WorkflowInstance, WorkflowStep, AgentContext } from '@/types';
import { 
  workflowInstances, 
  workflowSteps, 
  getWorkflowById, 
  identifyOverdueSteps,
} from '@/lib/data/workflow-store';
import { hasCapability } from '@/lib/auth/authorization';
import { logSensitiveAction } from '@/lib/security/audit-logger';

// Workflow event types for history
export type WorkflowEventType = 
  | 'workflow_created'
  | 'step_assigned'
  | 'step_approved'
  | 'step_rejected'
  | 'step_escalated'
  | 'step_reminder_sent'
  | 'workflow_completed'
  | 'workflow_cancelled';

export interface WorkflowEvent {
  id: string;
  workflowId: string;
  stepId?: string;
  eventType: WorkflowEventType;
  actorId: string;
  actorRole: string;
  timestamp: string;
  details: Record<string, unknown>;
}

// In-memory event store (replace with database in production)
const workflowEvents: WorkflowEvent[] = [];

// In-memory escalation tracking
const escalatedSteps = new Set<string>();

/**
 * Get user's approval inbox with full context
 */
export function getApprovalInbox(
  context: AgentContext
): Array<{
  step: WorkflowStep;
  workflow: WorkflowInstance;
  isEscalated: boolean;
  isOverdue: boolean;
  daysPending: number;
}> {
  const { employeeId } = context;

  if (!employeeId) return [];

  // Find all pending steps assigned to this user
  const pendingSteps = workflowSteps.filter(
    step => step.status === 'pending' && step.approverId === employeeId
  );

  return pendingSteps.map(step => {
    const workflow = getWorkflowById(step.workflowId);
    if (!workflow) return null;

    const isEscalated = escalatedSteps.has(step.id);
    // Calculate days based on workflow creation (approximation since no assignedAt)
    const daysPending = Math.floor(
      (Date.now() - new Date(workflow.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    const isOverdue = daysPending > 3; // 3 days threshold

    return {
      step,
      workflow,
      isEscalated,
      isOverdue,
      daysPending,
    };
  }).filter(Boolean) as Array<{
    step: WorkflowStep;
    workflow: WorkflowInstance;
    isEscalated: boolean;
    isOverdue: boolean;
    daysPending: number;
  }>;
}

/**
 * Process workflow escalations
 * 
 * Escalation rules:
 * - Step pending > 3 days: escalate to manager
 * - Step pending > 7 days: escalate to admin
 * - Escalated steps are marked and logged
 */
export function processEscalations(context: AgentContext): {
  escalated: number;
  events: WorkflowEvent[];
} {
  const events: WorkflowEvent[] = [];
  let escalatedCount = 0;

  // Check for overdue steps
  const overdueSteps = identifyOverdueSteps(); // Uses internal dueDate comparison

  for (const step of overdueSteps) {
    // Skip already escalated steps
    if (escalatedSteps.has(step.id)) continue;

    const workflow = getWorkflowById(step.workflowId);
    if (!workflow) continue;

    // Calculate days overdue based on workflow creation
    const daysOverdue = Math.floor(
      (Date.now() - new Date(workflow.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );

    // Determine escalation level
    let escalationTarget: string;
    let escalationRole: string;

    if (daysOverdue > 7) {
      // Escalate to admin after 7 days
      escalationTarget = 'admin';
      escalationRole = 'admin';
    } else {
      // Escalate to manager after 3 days
      escalationTarget = workflow.initiatorId; // Original approver's manager
      escalationRole = 'manager';
    }

    // Mark as escalated
    escalatedSteps.add(step.id);
    escalatedCount++;

    // Create escalation event
    const event: WorkflowEvent = {
      id: crypto.randomUUID(),
      workflowId: workflow.id,
      stepId: step.id,
      eventType: 'step_escalated',
      actorId: 'system',
      actorRole: 'system',
      timestamp: new Date().toISOString(),
      details: {
        originalApproverId: step.approverId,
        escalationTarget,
        escalationRole,
        daysOverdue,
        reason: `Step overdue by ${daysOverdue} days`,
      },
    };

    workflowEvents.push(event);
    events.push(event);

    // Log to audit system
    logSensitiveAction(
      context,
      'workflow_step_escalated',
      'workflow_step',
      step.id,
      false
    );
  }

  return { escalated: escalatedCount, events };
}

/**
 * Get workflow event history
 */
export function getWorkflowHistory(
  workflowId: string,
  context: AgentContext
): WorkflowEvent[] {
  // RBAC check: only participants can see history
  const workflow = getWorkflowById(workflowId);
  if (!workflow) return [];

  const isAuthorized = 
    context.role === 'admin' ||
    context.employeeId === workflow.initiatorId ||
    hasCapability(context.role, 'workflow:read');

  if (!isAuthorized) return [];

  return workflowEvents
    .filter(e => e.workflowId === workflowId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

/**
 * Record workflow event
 */
export function recordWorkflowEvent(
  workflowId: string,
  eventType: WorkflowEventType,
  context: AgentContext,
  stepId?: string,
  details?: Record<string, unknown>
): WorkflowEvent {
  const event: WorkflowEvent = {
    id: crypto.randomUUID(),
    workflowId,
    stepId,
    eventType,
    actorId: context.employeeId || 'system',
    actorRole: context.role,
    timestamp: new Date().toISOString(),
    details: details || {},
  };

  workflowEvents.push(event);
  return event;
}

/**
 * Get escalated workflow statistics
 */
export function getEscalationStats(): {
  totalEscalated: number;
  byWorkflowType: Record<string, number>;
  avgDaysOverdue: number;
} {
  const escalated = Array.from(escalatedSteps);
  const byType: Record<string, number> = {};
  let totalDaysOverdue = 0;

  for (const stepId of escalated) {
    const step = workflowSteps.find(s => s.id === stepId);
    if (!step) continue;

    const workflow = getWorkflowById(step.workflowId);
    if (!workflow) continue;

    byType[workflow.workflowType] = (byType[workflow.workflowType] || 0) + 1;

    // Calculate days based on workflow creation
    const daysOverdue = Math.floor(
      (Date.now() - new Date(workflow.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    totalDaysOverdue += Math.max(0, daysOverdue);
  }

  return {
    totalEscalated: escalated.length,
    byWorkflowType: byType,
    avgDaysOverdue: escalated.length > 0 ? Math.round(totalDaysOverdue / escalated.length) : 0,
  };
}

/**
 * Bulk approval capability (for admins only)
 */
export function bulkApproveSteps(
  stepIds: string[],
  context: AgentContext,
  comments?: string
): {
  approved: number;
  failed: number;
  errors: string[];
} {
  // Only admins can bulk approve
  if (!hasCapability(context.role, 'workflow:manage:all')) {
    return {
      approved: 0,
      failed: stepIds.length,
      errors: ['Only admins can perform bulk approvals'],
    };
  }

  let approved = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const stepId of stepIds) {
    const step = workflowSteps.find(s => s.id === stepId);
    if (!step) {
      failed++;
      errors.push(`Step ${stepId} not found`);
      continue;
    }

    if (step.status !== 'pending') {
      failed++;
      errors.push(`Step ${stepId} is not pending`);
      continue;
    }

    // Perform approval
    step.status = 'approved';
    step.actedAt = new Date().toISOString();
    step.comments = comments || null;

    // Record event
    recordWorkflowEvent(
      step.workflowId,
      'step_approved',
      context,
      stepId,
      { bulk: true, comments }
    );

    approved++;
  }

  return { approved, failed, errors };
}
