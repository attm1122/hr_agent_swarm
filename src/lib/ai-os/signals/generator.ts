/**
 * Signal generator.
 *
 * Deterministically derives `RiskSignal[]` from the current store state. This
 * is the intelligence layer's "ingest events → produce signals" step. It is
 * pure-ish: given the same store state and the same `now`, it produces the
 * same signals with the same ids. That stability matters for de-dup, caching,
 * and the audit trail.
 *
 * Today the inputs are the mock stores. The moment we flip stores to Supabase
 * this function keeps working unchanged.
 */

import type { Employee, LeaveBalance, LeaveRequest, Milestone, EmployeeDocument } from '@/types';
import {
  employees as mockEmployees,
  milestones as mockMilestones,
  documents as mockDocuments,
  leaveRequests as mockLeaveRequests,
  getEmployeeById,
  getEmployeeFullName,
} from '@/lib/data/mock-data';
import { getLeaveStore } from '@/lib/data/leave-store';
import type {
  RiskSignal,
  SignalSet,
  PolicyBasis,
  LegalBasis,
  ActionOption,
  Severity,
} from './types';

// ---------------------------------------------------------------------------
// Defensibility reference tables (declarative, so policy changes are diffable)
// ---------------------------------------------------------------------------

const POLICY: Record<string, PolicyBasis> = {
  probationReview: {
    id: 'policy.probation.review-before-day-80',
    title: 'Probation review must be completed before day 80',
    clauseRef: 'HR-POL-003 §4.2',
  },
  leaveUsage: {
    id: 'policy.leave.annual-balance-cap',
    title: 'Excessive accrued leave balances must be actioned above 20 days',
    clauseRef: 'HR-POL-012 §3.1',
  },
  visaCompliance: {
    id: 'policy.visa.expiry-90-day-window',
    title: 'Visa-dependent employees must be reviewed at 90 days to expiry',
    clauseRef: 'HR-POL-021 §2.3',
  },
  documentRetention: {
    id: 'policy.documents.expiry-30-day-window',
    title: 'Certifications/credentials must be renewed before expiry',
    clauseRef: 'HR-POL-015 §5.4',
  },
  onboarding: {
    id: 'policy.onboarding.day-30-complete',
    title: 'Onboarding tasks must be completed by day 30',
    clauseRef: 'HR-POL-001 §2.1',
  },
  selfService: {
    id: 'policy.self-service.personal-details',
    title: 'Employees maintain their own personal contact details',
    clauseRef: 'HR-POL-007 §1.1',
  },
  leaveApproval: {
    id: 'policy.leave.manager-approval-sla',
    title: 'Managers approve/reject leave within 3 business days',
    clauseRef: 'HR-POL-012 §4.2',
  },
};

const LAW: Record<string, LegalBasis> = {
  fairWorkProbation: {
    jurisdiction: 'AU',
    statute: 'Fair Work Act 2009 (Cth) s 383 — minimum employment period',
    note: 'Probation dismissal outside the minimum period gives unfair-dismissal exposure.',
  },
  fairWorkLeave: {
    jurisdiction: 'AU',
    statute: 'Fair Work Act 2009 (Cth) s 87 — annual leave entitlement',
  },
  migrationAct: {
    jurisdiction: 'AU',
    statute: 'Migration Act 1958 (Cth) s 245AC — employer sanctions',
    note: 'Employing a non-citizen without work authority is a strict-liability offence.',
  },
  privacyAct: {
    jurisdiction: 'AU',
    statute: 'Privacy Act 1988 (Cth), APP 11 — security of personal information',
  },
};

// ---------------------------------------------------------------------------
// Inputs / helpers
// ---------------------------------------------------------------------------

export interface GeneratorInputs {
  now?: Date;
  employees?: Employee[];
  milestones?: Milestone[];
  documents?: EmployeeDocument[];
  leaveRequests?: LeaveRequest[];
  /** Optional override so tests can bypass the store lookup. */
  loadBalances?: (employeeId: string) => Promise<LeaveBalance[]>;
}

function daysBetween(a: Date, b: Date): number {
  const MS = 1000 * 60 * 60 * 24;
  return Math.floor((b.getTime() - a.getTime()) / MS);
}

function iso(d: Date): string {
  return d.toISOString();
}

function severityFromDays(
  daysUntil: number,
  thresholds: { critical: number; high: number; medium: number },
): Severity {
  if (daysUntil <= thresholds.critical) return 'critical';
  if (daysUntil <= thresholds.high) return 'high';
  if (daysUntil <= thresholds.medium) return 'medium';
  return 'low';
}

function fullNameOf(empId: string): string {
  const e = getEmployeeById(empId);
  return e ? getEmployeeFullName(e) : 'Unknown employee';
}

// ---------------------------------------------------------------------------
// Individual signal builders
// ---------------------------------------------------------------------------

function buildProbationSignals(
  milestones: Milestone[],
  now: Date,
): RiskSignal[] {
  const out: RiskSignal[] = [];
  for (const m of milestones) {
    if (m.milestoneType !== 'probation_end') continue;
    if (m.status === 'completed') continue;
    const end = new Date(m.milestoneDate);
    if (Number.isNaN(end.getTime())) continue;
    const daysUntil = daysBetween(now, end);
    if (daysUntil > 60 || daysUntil < -30) continue; // within a relevant window
    const emp = getEmployeeById(m.employeeId);
    const name = emp ? getEmployeeFullName(emp) : 'Unknown';

    const severity = severityFromDays(daysUntil, {
      critical: 7,
      high: 21,
      medium: 45,
    });

    const actions: ActionOption[] = [
      {
        id: 'schedule-review',
        label: 'Schedule probation review',
        kind: 'intent',
        variant: 'primary',
        intent: {
          rawInput: `Schedule the probation review for ${name} before ${m.milestoneDate}.`,
        },
      },
      {
        id: 'open-file',
        label: 'Open employee file',
        kind: 'intent',
        variant: 'secondary',
        intent: { rawInput: `Show me ${name}'s record` },
      },
      {
        id: 'draft-feedback',
        label: 'Draft review notes',
        kind: 'intent',
        variant: 'ghost',
        intent: {
          rawInput: `Draft probation review notes for ${name} based on the last 90 days.`,
        },
      },
    ];

    out.push({
      id: `probation-${m.employeeId}-${m.milestoneDate}`,
      kind: 'probation_review_due',
      title: `Probation review due for ${name}`,
      summary:
        daysUntil >= 0
          ? `Probation ends in ${daysUntil} day${daysUntil === 1 ? '' : 's'} (${m.milestoneDate}).`
          : `Probation ended ${Math.abs(daysUntil)} day${Math.abs(daysUntil) === 1 ? '' : 's'} ago — review is overdue.`,
      severity,
      confidence: 0.95,
      recommendation:
        'Complete the probation review before the end date. Confirm or extend in writing.',
      rationale:
        'Probation decisions made after the minimum-employment window expose the organisation to unfair-dismissal claims.',
      policy_basis: [POLICY.probationReview],
      legal_basis: [LAW.fairWorkProbation],
      owner_role: emp?.managerId ? 'manager' : 'admin',
      visibility_roles: ['manager', 'admin', 'team_lead'],
      subjectEmployeeId: m.employeeId,
      action_options: actions,
      escalation_required: severity === 'critical' || daysUntil < 0,
      dueDate: m.milestoneDate,
      status: 'open',
      createdAt: iso(now),
      updatedAt: iso(now),
      sensitivity: 'confidential',
    });
  }
  return out;
}

function buildVisaSignals(milestones: Milestone[], now: Date): RiskSignal[] {
  const out: RiskSignal[] = [];
  for (const m of milestones) {
    if (m.milestoneType !== 'visa_expiry') continue;
    const end = new Date(m.milestoneDate);
    if (Number.isNaN(end.getTime())) continue;
    const daysUntil = daysBetween(now, end);
    if (daysUntil > 120 || daysUntil < -7) continue;
    const name = fullNameOf(m.employeeId);

    const severity = severityFromDays(daysUntil, {
      critical: 14,
      high: 45,
      medium: 90,
    });

    out.push({
      id: `visa-${m.employeeId}-${m.milestoneDate}`,
      kind: 'visa_expiry_soon',
      title: `Work visa expiring for ${name}`,
      summary: `Work authority expires ${m.milestoneDate} (${daysUntil} day${daysUntil === 1 ? '' : 's'} away).`,
      severity,
      confidence: 0.97,
      recommendation:
        'Confirm renewal evidence on file or initiate offboarding before expiry.',
      rationale:
        'Continuing to employ someone past their work-authority expiry is a strict-liability offence under the Migration Act.',
      policy_basis: [POLICY.visaCompliance],
      legal_basis: [LAW.migrationAct],
      owner_role: 'admin',
      visibility_roles: ['admin', 'manager'],
      subjectEmployeeId: m.employeeId,
      action_options: [
        {
          id: 'request-evidence',
          label: 'Request renewal evidence',
          kind: 'intent',
          variant: 'primary',
          intent: {
            rawInput: `Email ${name} requesting updated work authority evidence before ${m.milestoneDate}.`,
          },
        },
        {
          id: 'escalate-legal',
          label: 'Escalate to legal',
          kind: 'intent',
          variant: 'destructive',
          confirmCopy: 'This will start a compliance escalation workflow. Continue?',
          intent: {
            rawInput: `Escalate the expiring work visa for ${name} to legal for review.`,
          },
        },
      ],
      escalation_required: severity === 'critical' || severity === 'high',
      dueDate: m.milestoneDate,
      status: 'open',
      createdAt: iso(now),
      updatedAt: iso(now),
      sensitivity: 'restricted',
    });
  }
  return out;
}

function buildExpiringDocSignals(
  docs: EmployeeDocument[],
  now: Date,
): RiskSignal[] {
  const out: RiskSignal[] = [];
  for (const d of docs) {
    if (!d.expiresAt) continue;
    const end = new Date(d.expiresAt);
    if (Number.isNaN(end.getTime())) continue;
    const daysUntil = daysBetween(now, end);
    if (daysUntil > 60 || daysUntil < -14) continue;
    const name = fullNameOf(d.employeeId);

    const severity = severityFromDays(daysUntil, {
      critical: 7,
      high: 21,
      medium: 45,
    });

    out.push({
      id: `doc-${d.id}-${d.expiresAt}`,
      kind: 'expiring_document',
      title: `${d.fileName} expiring for ${name}`,
      summary: `${d.category} expires ${d.expiresAt}.`,
      severity,
      confidence: 0.92,
      recommendation: 'Request an updated copy from the employee before expiry.',
      rationale:
        'Lapsed credentials can breach certification-dependent contracts and audit requirements.',
      policy_basis: [POLICY.documentRetention],
      legal_basis: [LAW.privacyAct],
      owner_role: 'admin',
      visibility_roles: ['admin', 'manager'],
      subjectEmployeeId: d.employeeId,
      action_options: [
        {
          id: 'request-renewal',
          label: 'Request renewal',
          kind: 'intent',
          variant: 'primary',
          intent: {
            rawInput: `Ask ${name} to upload an updated ${d.category} before ${d.expiresAt}.`,
          },
        },
      ],
      escalation_required: false,
      dueDate: d.expiresAt,
      status: 'open',
      createdAt: iso(now),
      updatedAt: iso(now),
      sensitivity: 'confidential',
    });
  }
  return out;
}

function buildPendingLeaveSignals(
  requests: LeaveRequest[],
  now: Date,
): RiskSignal[] {
  const out: RiskSignal[] = [];
  for (const r of requests) {
    if (r.status !== 'pending') continue;
    const created = new Date(r.createdAt);
    const ageDays = daysBetween(created, now);
    const emp = getEmployeeById(r.employeeId);
    if (!emp) continue;
    const name = getEmployeeFullName(emp);

    const severity: Severity = ageDays >= 3 ? 'high' : ageDays >= 1 ? 'medium' : 'low';

    out.push({
      id: `leave-req-${r.id}`,
      kind: 'pending_leave_request',
      title: `Leave request awaiting decision — ${name}`,
      summary: `${r.leaveType} leave ${r.startDate} → ${r.endDate} (${r.daysRequested} day${r.daysRequested === 1 ? '' : 's'}). Submitted ${ageDays} day${ageDays === 1 ? '' : 's'} ago.`,
      severity,
      confidence: 1.0,
      recommendation:
        severity === 'high'
          ? 'Approve or reject now — SLA exceeded.'
          : 'Approve or reject within 3 business days.',
      rationale:
        'Employees are entitled to a timely decision on leave. Delays beyond 3 business days breach the internal SLA.',
      policy_basis: [POLICY.leaveApproval],
      legal_basis: [LAW.fairWorkLeave],
      owner_role: 'manager',
      visibility_roles: ['manager', 'admin', 'employee'],
      subjectEmployeeId: r.employeeId,
      action_options: [
        {
          id: 'approve',
          label: 'Approve',
          kind: 'intent',
          variant: 'primary',
          intent: { rawInput: `Approve leave request ${r.id}.` },
        },
        {
          id: 'reject',
          label: 'Reject',
          kind: 'intent',
          variant: 'destructive',
          confirmCopy: `Reject ${name}'s ${r.leaveType} leave? This cannot be undone without re-request.`,
          intent: { rawInput: `Reject leave request ${r.id}.` },
        },
      ],
      escalation_required: false,
      dueDate: r.startDate,
      status: 'open',
      createdAt: iso(now),
      updatedAt: iso(now),
      sensitivity: 'internal',
    });
  }
  return out;
}

async function buildLeaveBalanceSignals(
  employees: Employee[],
  now: Date,
  loadBalances: (employeeId: string) => Promise<LeaveBalance[]>,
): Promise<RiskSignal[]> {
  // Fan out balance lookups in parallel. Each call is an independent store
  // read, so sequential `await` was O(n) wall-time for a pure-fanout workload.
  const actives = employees.filter((e) => e.status === 'active');
  const results = await Promise.all(
    actives.map(async (emp) => {
      try {
        return { emp, balances: await loadBalances(emp.id) };
      } catch {
        return { emp, balances: [] as LeaveBalance[] };
      }
    }),
  );

  const out: RiskSignal[] = [];
  for (const { emp, balances } of results) {
    const annual = balances.find((b) => b.leaveType === 'annual');
    if (!annual) continue;
    if (annual.remainingDays < 20) continue;

    const severity: Severity =
      annual.remainingDays >= 30
        ? 'high'
        : annual.remainingDays >= 25
          ? 'medium'
          : 'low';

    out.push({
      id: `leave-balance-${emp.id}-annual`,
      kind: 'high_leave_balance',
      title: `High annual leave balance — ${getEmployeeFullName(emp)}`,
      summary: `${annual.remainingDays} days of annual leave remaining.`,
      severity,
      confidence: 0.9,
      recommendation:
        'Encourage a leave plan for the next 90 days to reduce accrued liability and burnout risk.',
      rationale:
        'Balances above 20 days carry monetary liability and increase burnout / retention risk.',
      policy_basis: [POLICY.leaveUsage],
      legal_basis: [LAW.fairWorkLeave],
      owner_role: 'manager',
      visibility_roles: ['employee', 'manager', 'admin'],
      subjectEmployeeId: emp.id,
      subjectTeamId: emp.teamId ?? undefined,
      action_options: [
        {
          id: 'plan-leave',
          label: 'Plan leave',
          kind: 'intent',
          variant: 'primary',
          intent: {
            rawInput: `Create an annual leave request for ${getEmployeeFullName(emp)} for the next available window.`,
          },
        },
        {
          id: 'view-balance',
          label: 'View balance',
          kind: 'intent',
          variant: 'secondary',
          intent: {
            rawInput: `How much annual leave does ${getEmployeeFullName(emp)} have left?`,
          },
        },
      ],
      escalation_required: false,
      status: 'open',
      createdAt: iso(now),
      updatedAt: iso(now),
      sensitivity: 'internal',
    });
  }
  return out;
}

function buildOnboardingSignals(
  employees: Employee[],
  now: Date,
): RiskSignal[] {
  const out: RiskSignal[] = [];
  for (const emp of employees) {
    const hire = new Date(emp.hireDate);
    if (Number.isNaN(hire.getTime())) continue;
    const tenureDays = daysBetween(hire, now);
    // Brand new joiners (< 30 days) are still onboarding; pending = not started.
    if (emp.status === 'pending' || (emp.status === 'active' && tenureDays >= 0 && tenureDays <= 30)) {
      const severity: Severity =
        emp.status === 'pending' ? 'high' : tenureDays > 21 ? 'medium' : 'low';
      out.push({
        id: `onboarding-${emp.id}`,
        kind: 'incomplete_onboarding',
        title:
          emp.status === 'pending'
            ? `Onboarding not started — ${getEmployeeFullName(emp)}`
            : `Onboarding in progress — ${getEmployeeFullName(emp)}`,
        summary:
          emp.status === 'pending'
            ? `Start date ${emp.hireDate}. Onboarding plan not yet kicked off.`
            : `Day ${tenureDays} of 30. Confirm remaining onboarding tasks.`,
        severity,
        confidence: 0.88,
        recommendation:
          emp.status === 'pending'
            ? 'Generate the onboarding plan for this new hire now.'
            : 'Confirm onboarding tasks are on track; close out anything blocked.',
        rationale:
          'Onboarding completion correlates with 90-day retention and day-30 productivity.',
        policy_basis: [POLICY.onboarding],
        legal_basis: [],
        owner_role: emp.managerId ? 'manager' : 'admin',
        visibility_roles: ['employee', 'manager', 'admin'],
        subjectEmployeeId: emp.id,
        subjectTeamId: emp.teamId ?? undefined,
        action_options: [
          {
            id: 'open-plan',
            label: 'Open onboarding plan',
            kind: 'intent',
            variant: 'primary',
            intent: { rawInput: `Show me the onboarding plan for ${getEmployeeFullName(emp)}.` },
          },
          {
            id: 'generate-plan',
            label: 'Generate plan',
            kind: 'intent',
            variant: 'secondary',
            intent: { rawInput: `Create an onboarding plan for ${getEmployeeFullName(emp)}.` },
          },
        ],
        escalation_required: false,
        dueDate: (() => {
          const d = new Date(hire);
          d.setDate(d.getDate() + 30);
          return d.toISOString().slice(0, 10);
        })(),
        status: 'open',
        createdAt: iso(now),
        updatedAt: iso(now),
        sensitivity: 'internal',
      });
    }
  }
  return out;
}

function buildAnniversarySignals(
  milestones: Milestone[],
  now: Date,
): RiskSignal[] {
  const out: RiskSignal[] = [];
  for (const m of milestones) {
    if (m.milestoneType !== 'service_anniversary') continue;
    if (m.status === 'completed') continue;
    const end = new Date(m.milestoneDate);
    if (Number.isNaN(end.getTime())) continue;
    const daysUntil = daysBetween(now, end);
    if (daysUntil < 0 || daysUntil > 90) continue;
    const name = fullNameOf(m.employeeId);
    out.push({
      id: `anniversary-${m.id}`,
      kind: 'upcoming_anniversary',
      title: `Service anniversary — ${name}`,
      summary: `${m.description} on ${m.milestoneDate}.`,
      severity: 'info',
      confidence: 1.0,
      recommendation: 'Acknowledge milestone; consider a recognition note.',
      rationale: 'Celebrating tenure correlates with engagement and retention.',
      policy_basis: [],
      legal_basis: [],
      owner_role: 'manager',
      visibility_roles: ['employee', 'manager', 'admin'],
      subjectEmployeeId: m.employeeId,
      action_options: [
        {
          id: 'draft-note',
          label: 'Draft recognition note',
          kind: 'intent',
          variant: 'secondary',
          intent: { rawInput: `Draft a recognition note for ${name}'s ${m.description}.` },
        },
      ],
      escalation_required: false,
      dueDate: m.milestoneDate,
      status: 'open',
      createdAt: iso(now),
      updatedAt: iso(now),
      sensitivity: 'public',
    });
  }
  return out;
}

function buildSelfServiceSignals(
  employees: Employee[],
  now: Date,
): RiskSignal[] {
  // A soft nudge every user sees at least once: "please confirm your personal
  // details are up to date". Concrete, low-severity, always-visible to the
  // employee. Keeps the employee home from ever being empty.
  return employees
    .filter((e) => e.status === 'active')
    .map<RiskSignal>((emp) => ({
      id: `self-service-${emp.id}`,
      kind: 'update_personal_details',
      title: 'Confirm your personal details',
      summary:
        'Address, emergency contact, and bank details should be reviewed quarterly.',
      severity: 'info',
      confidence: 1.0,
      recommendation:
        'Take 30 seconds to confirm your contact details are still current.',
      rationale:
        'Emergency contact and payment accuracy depend on up-to-date self-service data.',
      policy_basis: [POLICY.selfService],
      legal_basis: [LAW.privacyAct],
      owner_role: 'employee',
      visibility_roles: ['employee'],
      subjectEmployeeId: emp.id,
      action_options: [
        {
          id: 'update-address',
          label: 'Update address',
          kind: 'intent',
          variant: 'primary',
          intent: { rawInput: 'Update my address' },
        },
        {
          id: 'review-details',
          label: 'Review my details',
          kind: 'intent',
          variant: 'secondary',
          intent: { rawInput: 'Show me my personal details on file.' },
        },
      ],
      escalation_required: false,
      status: 'open',
      createdAt: iso(now),
      updatedAt: iso(now),
      sensitivity: 'public',
    }));
}

function buildComplianceGapSignals(
  employees: Employee[],
  docs: EmployeeDocument[],
  now: Date,
): RiskSignal[] {
  // Org-level gap: active employees with zero documents on file is a red flag
  // for HR even though no individual signal is urgent.
  const hasDoc = new Set(docs.map((d) => d.employeeId));
  const missing = employees.filter(
    (e) => e.status === 'active' && !hasDoc.has(e.id),
  );
  if (missing.length === 0) return [];
  return [
    {
      id: `compliance-gap-documents`,
      kind: 'compliance_gap',
      title: `${missing.length} active employees have no documents on file`,
      summary:
        'Active employees are missing required documentation (contracts, ID, certifications).',
      severity: missing.length > 10 ? 'high' : 'medium',
      confidence: 0.85,
      recommendation:
        'Run a document-collection workflow for all affected employees.',
      rationale:
        'Missing baseline documents surface during audits and block offboarding / payroll changes.',
      policy_basis: [POLICY.documentRetention],
      legal_basis: [LAW.privacyAct],
      owner_role: 'admin',
      visibility_roles: ['admin'],
      action_options: [
        {
          id: 'start-collection',
          label: 'Start document collection',
          kind: 'intent',
          variant: 'primary',
          intent: {
            rawInput: 'Start a document-collection workflow for employees with no documents on file.',
          },
        },
      ],
      escalation_required: false,
      status: 'open',
      createdAt: iso(now),
      updatedAt: iso(now),
      sensitivity: 'confidential',
    },
  ];
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Generate the current SignalSet. Pure of I/O beyond the leave store (the
 * only async input), and can be fully stubbed via `inputs.loadBalances`.
 */
export async function generateSignals(
  inputs: GeneratorInputs = {},
): Promise<SignalSet> {
  const now = inputs.now ?? new Date();
  const employees = inputs.employees ?? mockEmployees;
  const milestones = inputs.milestones ?? mockMilestones;
  const documents = inputs.documents ?? mockDocuments;
  const leaveRequests = inputs.leaveRequests ?? mockLeaveRequests;

  const loadBalances =
    inputs.loadBalances ??
    (async (employeeId: string) => {
      try {
        return await getLeaveStore().listBalances(employeeId, 'default');
      } catch {
        return [];
      }
    });

  const signals: RiskSignal[] = [
    ...buildProbationSignals(milestones, now),
    ...buildVisaSignals(milestones, now),
    ...buildExpiringDocSignals(documents, now),
    ...buildPendingLeaveSignals(leaveRequests, now),
    ...(await buildLeaveBalanceSignals(employees, now, loadBalances)),
    ...buildOnboardingSignals(employees, now),
    ...buildAnniversarySignals(milestones, now),
    ...buildSelfServiceSignals(employees, now),
    ...buildComplianceGapSignals(employees, documents, now),
  ];

  // Stable sort: severity desc, then dueDate asc, then id asc for determinism.
  const severityWeight: Record<Severity, number> = {
    critical: 5,
    high: 4,
    medium: 3,
    low: 2,
    info: 1,
  };
  signals.sort((a, b) => {
    if (severityWeight[a.severity] !== severityWeight[b.severity]) {
      return severityWeight[b.severity] - severityWeight[a.severity];
    }
    const aDue = a.dueDate ?? '9999-12-31';
    const bDue = b.dueDate ?? '9999-12-31';
    if (aDue !== bDue) return aDue.localeCompare(bDue);
    return a.id.localeCompare(b.id);
  });

  return { generatedAt: iso(now), signals };
}
