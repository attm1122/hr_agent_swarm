/**
 * Composer rules for ESCALATE mode outcomes.
 */

import { randomUUID } from 'node:crypto';
import type { Intent } from '../../intent/types';
import type { DecisionTrace } from '../../decision/types';
import type { ExecutionResult } from '../../execution/types';
import type { UIBlock, RiskBannerBlock, TaskChecklistBlock, ApprovalPanelBlock } from '../types';

function pickPolicyAnswer(result: ExecutionResult): {
  answer?: string;
  citations?: Array<{ label: string; href?: string }>;
} {
  for (const r of result.swarmResponses) {
    if (r.intent === 'policy_answer') {
      const data = (r.result.data ?? {}) as Record<string, unknown>;
      const answer = (data.answer as string) ?? r.result.summary;
      // KnowledgeAgent emits citations on `data.citations` (audience-filtered)
      // and echoes them on the AgentResult metadata. Prefer the filtered copy.
      const dataCites = Array.isArray(data.citations)
        ? (data.citations as Array<{ source: string; reference: string }>)
        : [];
      const topCites = (r.result.citations ?? []) as Array<{
        source: string;
        reference: string;
      }>;
      const raw = dataCites.length > 0 ? dataCites : topCites;
      const citations = raw.map((c) => ({
        label: `${c.source} — ${c.reference}`.trim(),
      }));
      return { answer, citations };
    }
  }
  return {};
}

function pickEmployeeSummary(result: ExecutionResult): Record<string, unknown> | null {
  for (const r of result.swarmResponses) {
    if (r.intent === 'employee_summary') {
      const data = (r.result.data ?? {}) as Record<string, unknown>;
      return (data.employee as Record<string, unknown>) ?? data;
    }
  }
  return null;
}

export function composeEscalation(
  intent: Intent,
  decision: DecisionTrace,
  result: ExecutionResult,
): UIBlock[] {
  const blocks: UIBlock[] = [];

  // RiskBanner summarising the reason.
  const risk: RiskBannerBlock = {
    id: randomUUID(),
    kind: 'RiskBanner',
    severity: decision.risk.value,
    title:
      decision.risk.value === 'high'
        ? 'High-risk action — escalated for approval'
        : 'Additional review required',
    message: decision.risk.reasons.join('. ') || 'Decision engine routed this to escalation.',
    references: decision.risk.policyRefs.map((ref) => ({ label: ref })),
  };
  blocks.push(risk);

  // Policy guidance (if any).
  const policy = pickPolicyAnswer(result);
  if (policy.answer) {
    blocks.push({
      id: randomUUID(),
      kind: 'RecommendationPanel',
      title: 'Policy guidance',
      recommendations: [
        {
          id: 'policy-answer',
          title: 'What policy says',
          detail: policy.answer,
          severity: 'info',
        },
        ...(policy.citations ?? []).map((c, i) => ({
          id: `cite-${i}`,
          title: c.label,
          severity: 'info' as const,
        })),
      ],
    });
  }

  // Employee context (if resolved).
  const emp = pickEmployeeSummary(result);
  if (emp && (emp.firstName || emp.name)) {
    blocks.push({
      id: randomUUID(),
      kind: 'SummaryCard',
      title: `${emp.firstName ?? ''} ${emp.lastName ?? ''}`.trim() || String(emp.name ?? 'Employee'),
      body: [emp.jobTitle, emp.teamName, emp.managerName]
        .filter(Boolean)
        .join(' · ') as string,
      tone: 'neutral',
      metrics: [
        emp.hireDate ? { label: 'Hired', value: String(emp.hireDate) } : null,
        emp.status ? { label: 'Status', value: String(emp.status) } : null,
        emp.tenureMonths !== undefined
          ? { label: 'Tenure (months)', value: Number(emp.tenureMonths) }
          : null,
      ].filter(Boolean) as Array<{ label: string; value: string | number }>,
    });
  }

  // TaskChecklist — prerequisites for a safe termination.
  //
  // IMPORTANT: the HR Employee type does not carry performance-review,
  // warning-letter, or PIP state. Claiming "on file / not on file" from fields
  // that don't exist would be safety theatre. Instead we surface the
  // verifications the approver must perform, and pre-complete the items we
  // CAN verify (tenure + probation status) from real employee data.
  if (
    intent.rawInput.toLowerCase().includes('terminat') ||
    intent.rawInput.toLowerCase().includes('dismiss')
  ) {
    const employeeRecord = emp as Record<string, unknown> | null;
    const tenureMonths =
      typeof employeeRecord?.tenureMonths === 'number'
        ? (employeeRecord.tenureMonths as number)
        : null;
    const status = String(employeeRecord?.status ?? '');
    const onProbation = status === 'probation' || status === 'pending';

    const checklist: TaskChecklistBlock = {
      id: randomUUID(),
      kind: 'TaskChecklist',
      title: 'Pre-termination checklist',
      items: [
        {
          id: 'employee-resolved',
          label: 'Employee record resolved',
          done: Boolean(employeeRecord),
          blocker: true,
          detail: employeeRecord
            ? `Subject: ${(employeeRecord.firstName as string) ?? ''} ${
                (employeeRecord.lastName as string) ?? ''
              }`.trim()
            : 'Could not resolve the employee from the request. Provide an employee id or name.',
        },
        {
          id: 'probation-status',
          label: 'Probation status confirmed',
          done: Boolean(status),
          blocker: true,
          detail: status
            ? `Current status: ${status}${onProbation ? ' (on probation)' : ''}`
            : 'Employee status not available — refresh before proceeding.',
        },
        {
          id: 'tenure',
          label: 'Tenure consistent with claimed dismissal reason',
          done: tenureMonths !== null,
          blocker: false,
          detail:
            tenureMonths !== null
              ? `Tenure: ${tenureMonths} month${tenureMonths === 1 ? '' : 's'}`
              : 'Hire date not resolved.',
        },
        {
          id: 'performance-review',
          label: 'Most recent performance review attached to case',
          done: false,
          blocker: true,
          detail:
            'Approver must upload the review document before the workflow is signed off.',
        },
        {
          id: 'written-warnings',
          label: 'Documented warnings / PIP evidence attached to case',
          done: false,
          blocker: true,
          detail: 'Fair Work expects progressive discipline evidence on file.',
        },
        {
          id: 'hr-consulted',
          label: 'HR consulted on timing and notice period',
          done: false,
          blocker: true,
        },
        {
          id: 'legal-reviewed',
          label: 'Employment lawyer reviewed the decision',
          done: false,
          blocker: decision.risk.value === 'high',
        },
      ],
    };
    blocks.push(checklist);
  }

  // ApprovalPanel — the core escalation CTA.
  const workflow = (result.data as Record<string, unknown>).workflow as
    | { id?: string }
    | null
    | undefined;
  const approvers =
    decision.risk.value === 'high' ? ['HR', 'Legal'] : ['HR'];
  const panel: ApprovalPanelBlock = {
    id: randomUUID(),
    kind: 'ApprovalPanel',
    title: 'Requires human approval',
    requiredApprovers: approvers,
    workflowId: workflow?.id,
    // Never emit an empty reason — it fails schema validation. Prefer the
    // decision's rule-level reasons, fall back to risk reasons, finally a
    // deterministic phrase so the block always renders.
    reason:
      (decision.reasons.length > 0
        ? decision.reasons.join(' · ')
        : decision.risk.reasons.length > 0
        ? decision.risk.reasons.join(' · ')
        : 'Routed to human approval by decision engine.'),
    riskLevel: decision.risk.value,
    actions: [
      {
        id: 'start-pip',
        label: 'Start PIP workflow instead',
        variant: 'secondary',
        intent: {
          rawInput: `Start a performance improvement plan for ${
            intent.target.subjectId ?? 'this employee'
          }`,
        },
      },
      {
        id: 'draft-letter',
        label: 'Draft termination letter',
        variant: 'ghost',
        intent: {
          rawInput: `Draft a termination letter for ${
            intent.target.subjectId ?? 'this employee'
          }`,
        },
      },
    ],
  };
  blocks.push(panel);

  return blocks;
}
