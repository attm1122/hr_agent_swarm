/**
 * Composer rules for records (employee, address) operations.
 */

import { randomUUID } from 'node:crypto';
import type { Intent } from '../../intent/types';
import type { DecisionTrace } from '../../decision/types';
import type { ExecutionResult } from '../../execution/types';
import type { UIBlock } from '../types';
import { coerceRows } from './shared';
import {
  getEmployeeById,
  getTeamById,
  getPositionById,
  getManagerForEmployee,
  getDirectReports,
  leaveRequests as mockLeaveRequests,
  milestones as mockMilestones,
  documents as mockDocuments,
  getEmployeeFullName,
} from '@/lib/data/mock-data';
import { getFullYearsSinceDateOnly } from '@/lib/date-only';

interface AddressRecordLike {
  street: string;
  suburb?: string | null;
  state?: string | null;
  postcode?: string | null;
  country: string;
}

function formatAddress(a: AddressRecordLike | null | undefined): string {
  if (!a) return '—';
  const parts = [a.street, a.suburb, a.state, a.postcode, a.country].filter(
    Boolean,
  );
  return parts.join(', ');
}

export function composeAddressUpdate(
  intent: Intent,
  _decision: DecisionTrace,
  result: ExecutionResult,
): UIBlock[] {
  if (result.error) {
    return [
      {
        id: randomUUID(),
        kind: 'RiskBanner',
        severity: 'medium',
        title: 'Address update failed',
        message: result.error.message,
      },
      {
        id: randomUUID(),
        kind: 'EditableForm',
        title: 'Enter your new address',
        description:
          'The assistant could not parse the details from your message. Please fill these fields and resubmit.',
        fields: [
          { name: 'street', label: 'Street', type: 'text', required: true },
          { name: 'suburb', label: 'Suburb', type: 'text' },
          { name: 'state', label: 'State', type: 'text' },
          { name: 'postcode', label: 'Postcode', type: 'text' },
          { name: 'country', label: 'Country', type: 'text', defaultValue: 'AU' },
        ],
        submitLabel: 'Save address',
        submitIntent: {
          rawInput: intent.rawInput,
        },
      },
    ];
  }

  const data = result.data as {
    before: AddressRecordLike | null;
    after: AddressRecordLike;
    changedFields: string[];
  };

  const blocks: UIBlock[] = [
    {
      id: randomUUID(),
      kind: 'ConfirmationCard',
      title: 'Address updated',
      message: `Your home address has been updated to ${formatAddress(data.after)}.`,
      before: data.before
        ? {
            street: data.before.street,
            suburb: data.before.suburb,
            state: data.before.state,
            postcode: data.before.postcode,
            country: data.before.country,
          }
        : undefined,
      after: {
        street: data.after.street,
        suburb: data.after.suburb,
        state: data.after.state,
        postcode: data.after.postcode,
        country: data.after.country,
      },
      changedFields: data.changedFields,
      tone: 'positive',
      timestamp: new Date().toISOString(),
    },
    {
      id: randomUUID(),
      kind: 'ActionBar',
      actions: [
        {
          id: 'verify',
          label: 'Verify on profile',
          variant: 'secondary',
          intent: { rawInput: 'Show my current address' },
        },
        {
          id: 'notify-payroll',
          label: 'Notify payroll',
          variant: 'ghost',
          intent: { rawInput: 'Let payroll know my address changed' },
        },
      ],
    },
  ];

  return blocks;
}

export function composeEmployeeRead(
  _intent: Intent,
  _decision: DecisionTrace,
  result: ExecutionResult,
): UIBlock[] {
  if (result.swarmResponses.length === 0) return [];
  const first = result.swarmResponses[0];
  const employees = coerceRows(first.result.data, 'employees', 'items');

  if (employees.length === 0) {
    return [
      {
        id: randomUUID(),
        kind: 'SummaryCard',
        title: 'No employees found',
        body: first.result.summary ?? 'Try a broader search.',
        tone: 'neutral',
      },
    ];
  }

  return [
    {
      id: randomUUID(),
      kind: 'Table',
      title: 'Employees',
      description: first.result.summary,
      columns: [
        { key: 'name', label: 'Name' },
        { key: 'role', label: 'Role' },
        { key: 'team', label: 'Team' },
        { key: 'status', label: 'Status', format: 'badge' },
        { key: 'hireDate', label: 'Hired', format: 'date' },
      ],
      rows: employees.map((e) => ({
        name: [e.firstName, e.lastName].filter(Boolean).join(' ') || String(e.name ?? ''),
        role: String(e.jobTitle ?? e.role ?? ''),
        team: String(e.teamName ?? e.team ?? ''),
        status: String(e.status ?? 'active'),
        hireDate: String(e.hireDate ?? ''),
      })),
      rowCount: employees.length,
      meta: { auditId: first.auditId, agentType: first.agentType },
    },
  ];
}

export function composeEmployeeDetail(employeeId: string): UIBlock[] {
  const employee = getEmployeeById(employeeId);
  if (!employee) return [];

  const team = employee.teamId ? getTeamById(employee.teamId) : null;
  const position = employee.positionId
    ? getPositionById(employee.positionId)
    : null;
  const manager = getManagerForEmployee(employee);
  const reports = getDirectReports(employee.id);
  const empLeave = mockLeaveRequests.filter(
    (lr) => lr.employeeId === employee.id,
  );
  const empMilestones = mockMilestones.filter(
    (m) => m.employeeId === employee.id,
  );
  const empDocs = mockDocuments.filter((d) => d.employeeId === employee.id);
  const tenure = getFullYearsSinceDateOnly(employee.hireDate);
  const fullName = getEmployeeFullName(employee);

  const blocks: UIBlock[] = [];

  // Block 1: SummaryCard — Employee header
  blocks.push({
    id: randomUUID(),
    kind: 'SummaryCard',
    title: fullName,
    body: `${position?.title ?? 'No position'} · ${team?.name ?? 'No team'} · ${tenure} year${tenure !== 1 ? 's' : ''} tenure`,
    tone: 'neutral',
    metrics: [
      { label: 'Status', value: employee.status },
      { label: 'Location', value: employee.workLocation || 'Not set' },
      { label: 'Type', value: employee.employmentType.replace('_', ' ') },
      { label: 'Hired', value: employee.hireDate },
    ],
  });

  // Block 2: Table — Employment details
  blocks.push({
    id: randomUUID(),
    kind: 'Table',
    title: 'Employment Details',
    columns: [
      { key: 'key', label: 'Field' },
      { key: 'value', label: 'Value' },
    ],
    rows: [
      { key: 'Employee Number', value: employee.employeeNumber },
      { key: 'Hire Date', value: employee.hireDate },
      {
        key: 'Employment Type',
        value: employee.employmentType.replace('_', ' '),
      },
      { key: 'Level', value: position?.level ?? 'N/A' },
      { key: 'Work Location', value: employee.workLocation || 'Not set' },
      {
        key: 'Manager',
        value: manager ? getEmployeeFullName(manager) : 'None',
      },
      { key: 'Email', value: employee.email },
    ],
    rowCount: 7,
  });

  // Block 3: Table — Leave requests (if any)
  if (empLeave.length > 0) {
    blocks.push({
      id: randomUUID(),
      kind: 'Table',
      title: 'Leave Requests',
      columns: [
        { key: 'type', label: 'Type' },
        { key: 'dates', label: 'Dates' },
        { key: 'days', label: 'Days' },
        { key: 'status', label: 'Status', format: 'badge' },
      ],
      rows: empLeave.map((lr) => ({
        type: lr.leaveType.replace('_', ' '),
        dates: `${lr.startDate} – ${lr.endDate}`,
        days: lr.daysRequested,
        status: lr.status,
      })),
      rowCount: empLeave.length,
    });
  }

  // Block 4: Timeline — Milestones (if any)
  if (empMilestones.length > 0) {
    blocks.push({
      id: randomUUID(),
      kind: 'Timeline',
      title: 'Milestones',
      events: empMilestones.map((ms) => ({
        id: randomUUID(),
        label: ms.description,
        timestamp: ms.milestoneDate,
        detail: ms.milestoneType.replace('_', ' '),
        tone: ms.status === 'completed'
          ? 'positive' as const
          : ms.status === 'upcoming'
            ? 'neutral' as const
            : 'warning' as const,
      })),
    });
  }

  // Block 5: Table — Documents (if any)
  if (empDocs.length > 0) {
    blocks.push({
      id: randomUUID(),
      kind: 'Table',
      title: 'Documents',
      columns: [
        { key: 'name', label: 'Name' },
        { key: 'category', label: 'Category' },
        { key: 'size', label: 'Size' },
        { key: 'status', label: 'Status', format: 'badge' },
      ],
      rows: empDocs.map((doc) => ({
        name: doc.fileName,
        category: doc.category,
        size: `${(doc.fileSize / 1024 / 1024).toFixed(1)} MB`,
        status: doc.status,
      })),
      rowCount: empDocs.length,
    });
  }

  // Block 6: Table — Direct reports (if any)
  if (reports.length > 0) {
    blocks.push({
      id: randomUUID(),
      kind: 'Table',
      title: 'Direct Reports',
      columns: [
        { key: 'name', label: 'Name' },
        { key: 'role', label: 'Role' },
        { key: 'status', label: 'Status', format: 'badge' },
      ],
      rows: reports.map((r) => ({
        name: getEmployeeFullName(r),
        role: r.positionId
          ? (getPositionById(r.positionId)?.title ?? '')
          : '',
        status: r.status,
      })),
      rowCount: reports.length,
    });
  }

  // Block 7: ActionBar
  blocks.push({
    id: randomUUID(),
    kind: 'ActionBar',
    actions: [
      {
        id: randomUUID(),
        label: 'Edit profile',
        variant: 'secondary',
        intent: { rawInput: `Edit profile for ${fullName}` },
      },
      {
        id: randomUUID(),
        label: 'View leave',
        variant: 'secondary',
        intent: { rawInput: `Show leave requests for ${fullName}` },
      },
      {
        id: randomUUID(),
        label: 'Back to directory',
        variant: 'ghost',
        href: '/employees',
      },
    ],
  });

  return blocks;
}
