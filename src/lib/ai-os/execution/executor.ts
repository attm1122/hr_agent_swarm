/**
 * AI-OS Executor.
 *
 * Dispatches an Intent + DecisionTrace into real execution. The executor is
 * authoritative — it is the ONLY module that performs side effects. Errors
 * anywhere inside are captured in the ExecutionResult.error field so the
 * UIComposer can still render a sane "something went wrong" state.
 *
 * Mode playbook:
 *   AUTO_COMPLETE → single write adapter OR single swarm call + confirmation
 *   WORKSPACE     → fan out swarm calls + optional artifact generation
 *   ESCALATE      → call policy/employee agents in parallel for context,
 *                   create workflow approval via WorkflowAgent
 */

import type { AgentContext, SwarmResponse } from '@/types';
import type { ToolCallTrace } from '@/lib/ai/orchestrator';
import type { Intent } from '../intent/types';
import type { DecisionTrace } from '../decision/types';
import type { ExecutionResult } from './types';
import type { ArtifactRef, AiOsEmit } from '../orchestrator/events';

import {
  planSwarmCalls,
  runSwarmCalls,
} from './adapters/swarm-adapter';
import { updateOwnAddress, RecordsWriteError } from './adapters/records-write-adapter';
import { executeLeaveDecision, LeaveWriteError } from './adapters/leave-write-adapter';
import { buildXlsxArtifact } from './adapters/artifact-xlsx-adapter';
import { sendNotification } from './adapters/notification-adapter';
import { buildIdempotencyKey, getIdempotent, setIdempotent } from './idempotency';
import { getCoordinator } from '@/lib/agents';
import { randomUUID } from 'node:crypto';

// -----------------------------------------------------------------
// helpers
// -----------------------------------------------------------------

function emptyResult(mode: ExecutionResult['mode']): ExecutionResult {
  return {
    mode,
    swarmResponses: [],
    agentCalls: [],
    artifacts: [],
    data: {},
  };
}

/**
 * LeaveMilestonesAgent.milestone_list returns `data` as the array itself
 * (see `createAgentResult(enriched, ...)`). Defensive fallback: also accept
 * `{ milestones: [...] }` or `{ items: [...] }` in case an upstream wrapper
 * ever changes.
 */
function findMilestoneRows(
  responses: SwarmResponse[],
): Array<Record<string, string | number | Date | null>> {
  for (const res of responses) {
    if (res.intent === 'milestone_list' && res.result.success) {
      const data = res.result.data as unknown;
      let milestones: Array<Record<string, unknown>> = [];
      if (Array.isArray(data)) {
        milestones = data as Array<Record<string, unknown>>;
      } else if (data && typeof data === 'object') {
        const obj = data as Record<string, unknown>;
        const candidate =
          (Array.isArray(obj.milestones) && (obj.milestones as unknown[])) ||
          (Array.isArray(obj.items) && (obj.items as unknown[])) ||
          [];
        milestones = candidate as Array<Record<string, unknown>>;
      }

      return milestones.map((m) => {
        // Derive years-of-service from milestone description/type where possible.
        const description = (m.description as string) ?? '';
        const yearsMatch = /(\d+)\s*year/i.exec(description);
        const years =
          typeof m.years === 'number'
            ? (m.years as number)
            : yearsMatch
            ? Number(yearsMatch[1])
            : null;
        return {
          employee:
            (m.employeeName as string) ?? (m.employee as string) ?? '',
          type: (m.milestoneType as string) ?? (m.type as string) ?? 'anniversary',
          date: (m.dueDate as string) ?? (m.date as string) ?? '',
          years,
          team: (m.teamName as string) ?? (m.team as string) ?? '',
          manager: (m.managerName as string) ?? (m.manager as string) ?? '',
        };
      });
    }
  }
  return [];
}

// -----------------------------------------------------------------
// per-mode executors
// -----------------------------------------------------------------

async function executeAutoComplete(
  intent: Intent,
  ctx: AgentContext,
  emit: AiOsEmit,
): Promise<ExecutionResult> {
  const out = emptyResult('AUTO_COMPLETE');

  // Example 1 — self address update.
  if (
    intent.action === 'UPDATE' &&
    intent.entity === 'address' &&
    intent.target.scope === 'self'
  ) {
    // SECURITY: Verify the intent actually targets the current user.
    if (intent.target.subjectId && intent.target.subjectId !== ctx.employeeId) {
      const selfOut = emptyResult('AUTO_COMPLETE');
      selfOut.error = {
        message: `Identity mismatch: intent targets '${intent.target.subjectId}' but authenticated user is '${ctx.employeeId}'. Self-scoped writes must target the current user.`,
        code: 'IDENTITY_MISMATCH',
      };
      return selfOut;
    }

    // IDEMPOTENCY: Prevent duplicate address updates from retries.
    const addrKey = buildIdempotencyKey({
      userId: ctx.userId,
      action: 'address_update',
      rawInput: intent.rawInput,
    });
    const cachedAddr = getIdempotent<ExecutionResult>(addrKey);
    if (cachedAddr) return cachedAddr;

    try {
      const start = Date.now();
      const result = await updateOwnAddress(intent, ctx);
      const trace: ToolCallTrace = {
        toolName: 'records.update_address',
        intent: 'address_update_self',
        input: (intent.payload ?? {}) as Record<string, unknown>,
        success: true,
        summary: `Updated home address (${result.changedFields.join(', ')})`,
        executionTimeMs: Date.now() - start,
        auditId: randomUUID(),
        data: { before: result.before, after: result.after },
      };
      out.agentCalls.push(trace);
      emit({ kind: 'agent_call', call: trace });
      out.data = {
        kind: 'address_update',
        before: result.before,
        after: result.after,
        changedFields: result.changedFields,
      };
      setIdempotent(addrKey, out);
      return out;
    } catch (err) {
      const message =
        err instanceof RecordsWriteError
          ? err.message
          : err instanceof Error
          ? err.message
          : 'Unknown write error';
      out.error = {
        message,
        code: err instanceof RecordsWriteError ? err.code : 'WRITE_FAILED',
      };
      return out;
    }
  }

  // Example 2 — leave approval / rejection.
  if (
    (intent.action === 'TRIGGER' || intent.action === 'UPDATE') &&
    intent.entity === 'leave'
  ) {
    // SECURITY: The leave-write-adapter enforces capability gate + separation
    // of duties. Verify the actor has an authenticated identity before proceeding.
    if (!ctx.employeeId) {
      const leaveOut = emptyResult('AUTO_COMPLETE');
      leaveOut.error = {
        message: 'Leave decisions require an authenticated employee identity.',
        code: 'IDENTITY_REQUIRED',
      };
      return leaveOut;
    }

    // IDEMPOTENCY: Prevent duplicate leave approvals from retries.
    const leaveKey = buildIdempotencyKey({
      userId: ctx.userId,
      action: 'leave_decision',
      rawInput: intent.rawInput,
    });
    const cachedLeave = getIdempotent<ExecutionResult>(leaveKey);
    if (cachedLeave) return cachedLeave;

    try {
      const start = Date.now();
      const result = await executeLeaveDecision(intent, ctx);
      const trace: ToolCallTrace = {
        toolName: 'leave.decision',
        intent: `leave_${result.action}`,
        input: { leaveRequestId: result.leaveRequestId, action: result.action },
        success: true,
        summary: `${result.action === 'approved' ? 'Approved' : 'Rejected'} ${result.leaveType} leave (${result.daysRequested} days) — request ${result.leaveRequestId}`,
        executionTimeMs: Date.now() - start,
        auditId: randomUUID(),
        data: { before: result.before, after: result.after },
      };
      out.agentCalls.push(trace);
      emit({ kind: 'agent_call', call: trace });
      out.data = {
        kind: 'leave_decision',
        leaveRequestId: result.leaveRequestId,
        action: result.action,
        before: result.before,
        after: result.after,
        leaveType: result.leaveType,
        daysRequested: result.daysRequested,
      };
      setIdempotent(leaveKey, out);
      return out;
    } catch (err) {
      const message =
        err instanceof LeaveWriteError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Unknown leave write error';
      out.error = {
        message,
        code: err instanceof LeaveWriteError ? err.code : 'WRITE_FAILED',
      };
      return out;
    }
  }

  // Fallback: no specialised AUTO adapter — degrade to WORKSPACE.
  return executeWorkspace(intent, ctx, emit, 'AUTO_COMPLETE');
}

async function executeWorkspace(
  intent: Intent,
  ctx: AgentContext,
  emit: AiOsEmit,
  modeOverride: ExecutionResult['mode'] = 'WORKSPACE',
): Promise<ExecutionResult> {
  const out = emptyResult(modeOverride);

  const plan = planSwarmCalls(intent);
  if (plan.length === 0) {
    out.data = { kind: 'no_plan', rationale: intent.rationale };
    return out;
  }

  const { responses, traces } = await runSwarmCalls(plan, ctx);
  out.swarmResponses = responses;
  out.agentCalls = traces;
  traces.forEach((t) => emit({ kind: 'agent_call', call: t }));

  // Example 2 — anniversaries XLSX.
  if (
    intent.entity === 'milestone' &&
    intent.outputFormat === 'spreadsheet'
  ) {
    const rows = findMilestoneRows(responses);
    try {
      const artifact: ArtifactRef = await buildXlsxArtifact({
        filename: `anniversaries-${new Date().toISOString().slice(0, 10)}`,
        sheetName: 'Anniversaries',
        columns: [
          { key: 'employee', header: 'Employee', width: 28 },
          { key: 'type', header: 'Milestone', width: 16 },
          { key: 'date', header: 'Date', width: 14 },
          { key: 'years', header: 'Years', width: 8 },
          { key: 'team', header: 'Team', width: 20 },
          { key: 'manager', header: 'Manager', width: 24 },
        ],
        rows,
        tenantId: ctx.tenantId ?? 'default',
        userId: ctx.userId,
      });
      out.artifacts.push(artifact);
      emit({ kind: 'artifact_ready', artifact });
      out.data = {
        kind: 'milestones',
        rows,
        rowCount: rows.length,
        artifactId: artifact.id,
      };
    } catch (err) {
      out.error = {
        message: err instanceof Error ? err.message : 'XLSX build failed',
        code: 'ARTIFACT_FAILED',
      };
    }
    return out;
  }

  out.data = { kind: 'swarm_data', responses: responses.map((r) => r.result) };
  return out;
}

async function executeEscalate(
  intent: Intent,
  ctx: AgentContext,
  decision: DecisionTrace,
  emit: AiOsEmit,
): Promise<ExecutionResult> {
  const out = emptyResult('ESCALATE');

  // 1. Gather context from relevant agents (best-effort).
  const plan = planSwarmCalls(intent);
  if (plan.length > 0) {
    const { responses, traces } = await runSwarmCalls(plan, ctx);
    out.swarmResponses = responses;
    out.agentCalls.push(...traces);
    traces.forEach((t) => emit({ kind: 'agent_call', call: t }));
  }

  // 2. Create a workflow row for human approval via WorkflowAgent.
  try {
    const coordinator = getCoordinator();
    const workflowResponse = await coordinator.route({
      intent: 'workflow_create',
      query: intent.rawInput,
      payload: {
        workflowType: 'custom_review',
        referenceType: 'ai_os_escalation',
        referenceId: intent.id,
        metadata: {
          risk: decision.risk.value,
          policyRefs: decision.risk.policyRefs,
          rationale: intent.rationale,
          rawInput: intent.rawInput,
        },
      },
      context: ctx,
    });
    const trace: ToolCallTrace = {
      toolName: 'workflow_create',
      intent: 'workflow_create',
      input: { referenceId: intent.id, risk: decision.risk.value },
      success: workflowResponse.result.success,
      summary:
        workflowResponse.result.summary ??
        'Escalation workflow queued for human approval',
      executionTimeMs: workflowResponse.executionTimeMs,
      auditId: workflowResponse.auditId,
      data: workflowResponse.result.data,
    };
    out.agentCalls.push(trace);
    emit({ kind: 'agent_call', call: trace });
    out.data = {
      kind: 'escalation',
      workflow: workflowResponse.result.data,
      risk: decision.risk,
      subjectId: intent.target.subjectId,
    };

    // Side-effect: notify approvers. In dev/stub this logs structured payload
    // to the server console; a real notification transport plugs in here.
    const approvers = decision.risk.value === 'high' ? ['HR', 'Legal'] : ['HR'];
    try {
      const notifyStart = Date.now();
      const delivery = await sendNotification(
        {
          channel: 'email',
          subject: `[AI-OS] ${decision.risk.value.toUpperCase()} risk action needs approval`,
          body: `User ${ctx.userId} asked: "${intent.rawInput}". Risk reasons: ${decision.risk.reasons.join('; ')}.`,
          recipients: approvers.map((a) => `${a.toLowerCase()}@example.invalid`),
          metadata: {
            intentId: intent.id,
            workflowId:
              (workflowResponse.result.data as { id?: string } | null | undefined)?.id ??
              null,
            policyRefs: decision.risk.policyRefs,
          },
        },
        ctx,
      );
      const notifTrace: ToolCallTrace = {
        toolName: 'notify.approvers',
        intent: 'notify',
        input: { recipients: approvers },
        success: delivery.delivered || delivery.channel === 'email',
        summary: delivery.delivered
          ? `Notified ${approvers.join(', ')}`
          : `Notification queued (stub) for ${approvers.join(', ')}`,
        executionTimeMs: Date.now() - notifyStart,
        auditId: randomUUID(),
        data: { delivered: delivery.delivered, channel: delivery.channel },
      };
      out.agentCalls.push(notifTrace);
      emit({ kind: 'agent_call', call: notifTrace });
    } catch {
      // Notification failure must never block an escalation.
    }
  } catch {
    // If workflow creation fails we still render the escalation UI —
    // operators can re-trigger from the ApprovalPanel.
    out.data = {
      kind: 'escalation',
      workflow: null,
      risk: decision.risk,
      subjectId: intent.target.subjectId,
    };
  }

  return out;
}

// -----------------------------------------------------------------
// public entry
// -----------------------------------------------------------------

export async function executeDecision(
  intent: Intent,
  decision: DecisionTrace,
  ctx: AgentContext,
  emit: AiOsEmit,
): Promise<ExecutionResult> {
  switch (decision.mode) {
    case 'AUTO_COMPLETE':
      return executeAutoComplete(intent, ctx, emit);
    case 'WORKSPACE':
      return executeWorkspace(intent, ctx, emit);
    case 'ESCALATE':
      return executeEscalate(intent, ctx, decision, emit);
  }
}
