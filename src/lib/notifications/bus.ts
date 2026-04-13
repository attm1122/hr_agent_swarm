/**
 * Notification bus subscriber.
 *
 * Wires HR domain events (leave requested, workflow step approved, onboarding
 * task completed, etc.) to outbound notifications (email + Teams).
 *
 * This is the glue that turns an in-app action into a real-world ping. Keep
 * the handlers thin — template rendering belongs in `templates.ts`, delivery
 * belongs in `email.ts` / `teams.ts`.
 *
 * To activate, call `registerNotificationHandlers(eventBus)` once at
 * application startup, then `eventBus.publish(...)` anywhere in the domain.
 */

import type {
  EventBusPort,
  EventHandler,
  LeaveRequestedEvent,
  LeaveApprovedEvent,
  WorkflowStepApprovedEvent,
  OnboardingTaskCompletedEvent,
  DocumentExpiredEvent,
} from '@/lib/ports/event-bus-port';
import { sendEmail } from './email';
import { sendTeamsMessage, isTeamsConfigured } from './teams';
import {
  leaveRequestedTemplate,
  leaveApprovedTemplate,
  workflowStepAssignedTemplate,
  documentExpiringTemplate,
} from './templates';

interface NotificationDeps {
  /**
   * Look up an employee's email + display name. Allows the bus to work
   * regardless of whether we're reading from Supabase or mock data.
   */
  lookupEmployee: (
    employeeId: string,
  ) => Promise<{ email: string; name: string } | null>;
  /** Optional: provide the public app URL for deep-linked CTA buttons. */
  appUrl?: string;
  /** Optional override — defaults to safe console-only logging. */
  logger?: (message: string, meta?: Record<string, unknown>) => void;
}

const noopLogger = (msg: string, meta?: Record<string, unknown>) => {
  console.log(`[notifications] ${msg}`, meta ?? {});
};

/**
 * Subscribes notification handlers to the given event bus. Idempotent-ish:
 * calling twice will register duplicate handlers, so only call once at
 * startup.
 */
export function registerNotificationHandlers(
  eventBus: EventBusPort,
  deps: NotificationDeps,
): void {
  const log = deps.logger ?? noopLogger;

  // --- leave.requested -> email approver ---
  const leaveRequested: EventHandler<LeaveRequestedEvent> = {
    eventType: 'leave.requested',
    async handle(event) {
      try {
        const employee = await deps.lookupEmployee(event.payload.employeeId);
        if (!employee) {
          log('leave.requested: employee not found', { eventId: event.id });
          return;
        }
        // Approver lookup is workflow-specific; for now notify HR/approvers
        // via the shared channel. Replace with per-manager lookup once team
        // assignments are in Supabase.
        const template = leaveRequestedTemplate({
          employeeName: employee.name,
          leaveType: event.payload.leaveType,
          startDate: event.payload.startDate,
          endDate: event.payload.endDate,
          days: event.payload.daysRequested,
          approverName: 'Approver',
          appUrl: deps.appUrl,
        });

        if (isTeamsConfigured()) {
          await sendTeamsMessage({
            title: template.subject,
            summary: template.subject,
            text: `${employee.name} requested ${event.payload.daysRequested} day(s) of ${event.payload.leaveType} leave (${event.payload.startDate} → ${event.payload.endDate}).`,
            facts: [
              { name: 'Employee', value: employee.name },
              { name: 'Type', value: event.payload.leaveType },
              {
                name: 'Dates',
                value: `${event.payload.startDate} → ${event.payload.endDate}`,
              },
            ],
            actions: deps.appUrl
              ? [{ label: 'Review in LEAP HR', url: `${deps.appUrl}/approvals` }]
              : [],
          });
        }
      } catch (err) {
        log('leave.requested handler failed', {
          eventId: event.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };

  // --- leave.approved -> email employee ---
  const leaveApproved: EventHandler<LeaveApprovedEvent> = {
    eventType: 'leave.approved',
    async handle(event) {
      try {
        const employee = await deps.lookupEmployee(event.payload.employeeId);
        if (!employee) return;
        const template = leaveApprovedTemplate({
          employeeName: employee.name,
          leaveType: 'annual', // Payload doesn't carry type; enrich later.
          startDate: '',
          endDate: '',
          days: 0,
          approverName: event.payload.approvedBy,
        });
        await sendEmail({
          to: employee.email,
          subject: template.subject,
          htmlBody: template.htmlBody,
        });
      } catch (err) {
        log('leave.approved handler failed', {
          eventId: event.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };

  // --- workflow.step_approved -> notify next approver ---
  const workflowStepApproved: EventHandler<WorkflowStepApprovedEvent> = {
    eventType: 'workflow.step_approved',
    async handle(event) {
      try {
        if (!event.payload.nextStepId) return; // final step
        // TODO: look up the next step's approver + workflow title from the
        // workflow repository once it's wired into Supabase. For now just
        // surface on Teams so the queue doesn't go silent.
        if (isTeamsConfigured()) {
          const template = workflowStepAssignedTemplate({
            approverName: 'Approver',
            workflowTitle: `Workflow ${event.payload.workflowId}`,
            requesterName: event.payload.approvedBy,
            stepNumber: event.payload.stepNumber + 1,
            appUrl: deps.appUrl,
          });
          await sendTeamsMessage({
            title: template.subject,
            summary: template.subject,
            text: `Step ${event.payload.stepNumber} approved. Step ${event.payload.stepNumber + 1} now awaiting review.`,
            actions: deps.appUrl
              ? [{ label: 'Open approvals', url: `${deps.appUrl}/approvals` }]
              : [],
          });
        }
      } catch (err) {
        log('workflow.step_approved handler failed', {
          eventId: event.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };

  // --- onboarding.task_completed -> surface progress on Teams ---
  const onboardingTaskCompleted: EventHandler<OnboardingTaskCompletedEvent> = {
    eventType: 'onboarding.task_completed',
    async handle(event) {
      try {
        if (!isTeamsConfigured()) return;
        const employee = await deps.lookupEmployee(event.payload.employeeId);
        const name = employee?.name ?? event.payload.employeeId;
        await sendTeamsMessage({
          title: event.payload.allTasksComplete
            ? `Onboarding complete: ${name}`
            : `Onboarding task completed for ${name}`,
          summary: `Onboarding update for ${name}`,
          text: event.payload.allTasksComplete
            ? `All onboarding tasks for ${name} are complete.`
            : `"${event.payload.taskName}" marked complete by ${event.payload.completedBy}.`,
        });
      } catch (err) {
        log('onboarding.task_completed handler failed', {
          eventId: event.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };

  // --- document.expired -> email affected employee ---
  const documentExpired: EventHandler<DocumentExpiredEvent> = {
    eventType: 'document.expired',
    async handle(event) {
      try {
        const employee = await deps.lookupEmployee(event.payload.employeeId);
        if (!employee) return;
        const template = documentExpiringTemplate({
          employeeName: employee.name,
          documentType: event.payload.documentType,
          expiresAt: event.payload.expiredAt,
          appUrl: deps.appUrl,
        });
        await sendEmail({
          to: employee.email,
          subject: template.subject,
          htmlBody: template.htmlBody,
        });
      } catch (err) {
        log('document.expired handler failed', {
          eventId: event.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };

  eventBus.subscribe('leave.requested', leaveRequested);
  eventBus.subscribe('leave.approved', leaveApproved);
  eventBus.subscribe('workflow.step_approved', workflowStepApproved);
  eventBus.subscribe('onboarding.task_completed', onboardingTaskCompleted);
  eventBus.subscribe('document.expired', documentExpired);
}
