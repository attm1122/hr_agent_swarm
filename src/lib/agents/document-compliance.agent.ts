/**
 * Document & Compliance Agent
 * Handles document queries, expiry alerting, and compliance checks.
 *
 * Data source: `getDocumentStore()` / `getEmployeeStore()` / `getMilestoneStore()`
 * — transparently reads from Supabase when `SUPABASE_SERVICE_ROLE_KEY` is
 * configured, or falls back to mock-data in dev. No agent changes needed to
 * switch modes.
 *
 * Deterministic compliance rules — no AI classification in POC.
 */

import type { AgentResult, AgentContext, AgentIntent } from '@/types';
import type { Agent } from './base';
import { createAgentResult, createErrorResult } from './base';
import { getDocumentStore } from '@/lib/data/document-store';
import { getEmployeeStore } from '@/lib/data/employee-store';
import { getMilestoneStore } from '@/lib/data/milestone-store';
import { canViewDocument, hasCapability } from '@/lib/auth/authorization';
import { buildRecordScopeContext } from '@/lib/auth/team-scope';
import { getDerivedMilestoneState } from '@/lib/milestones';

export class DocumentComplianceAgent implements Agent {
  readonly type = 'document_compliance' as const;
  readonly name = 'Document & Compliance Agent';
  readonly supportedIntents: AgentIntent[] = ['document_list', 'document_classify'];
  readonly requiredPermissions = ['document:read'];

  canHandle(intent: AgentIntent): boolean {
    return this.supportedIntents.includes(intent);
  }

  async execute(
    intent: AgentIntent,
    payload: Record<string, unknown>,
    context: AgentContext,
  ): Promise<AgentResult> {
    switch (intent) {
      case 'document_list':
        return this.listDocuments(payload, context);
      case 'document_classify':
        return this.complianceCheck(payload, context);
      default:
        return createErrorResult(`Unsupported intent: ${intent}`);
    }
  }

  private async listDocuments(
    payload: Record<string, unknown>,
    context: AgentContext,
  ): Promise<AgentResult> {
    // Capability gate
    if (!hasCapability(context.role, 'document:read')) {
      return createErrorResult('Not authorized to access documents', ['RBAC violation']);
    }

    const scopeContext = buildRecordScopeContext(context);
    const docStore = getDocumentStore();
    const employeeStore = getEmployeeStore();
    const tenantId = context.tenantId || 'default';

    const statusFilter = payload.status as string | undefined;
    const employeeIdFilter = payload.employeeId as string | undefined;

    let docs = await docStore.list(
      { status: statusFilter, employeeId: employeeIdFilter },
      tenantId,
    );

    // Scope + sensitivity filtering via policy (documents are team_visible by default)
    docs = docs.filter((d) =>
      canViewDocument(context, d.employeeId, 'team_visible', scopeContext.teamEmployeeIds),
    );

    // Enrich with employee names
    const empIds = Array.from(new Set(docs.map((d) => d.employeeId)));
    const employees = empIds.length
      ? await employeeStore.findByIds(empIds, tenantId)
      : [];
    const empById = new Map(employees.map((e) => [e.id, e]));

    const enriched = docs.map((d) => {
      const emp = empById.get(d.employeeId);
      return {
        ...d,
        employeeName: emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown',
      };
    });

    const expiring = enriched.filter((d) => d.status === 'expiring').length;
    const expired = enriched.filter((d) => d.status === 'expired').length;
    const risks: string[] = [];
    if (expiring > 0) risks.push(`${expiring} document${expiring > 1 ? 's' : ''} expiring soon`);
    if (expired > 0) risks.push(`${expired} document${expired > 1 ? 's' : ''} already expired`);

    return createAgentResult(enriched, {
      summary: `${enriched.length} document${enriched.length !== 1 ? 's' : ''} on file`,
      confidence: 1.0,
      risks,
      citations: [
        {
          source: docStore.backend === 'supabase' ? 'Supabase' : 'Microsoft 365',
          reference: 'OneDrive HR Documents',
        },
      ],
    });
  }

  private async complianceCheck(
    _payload: Record<string, unknown>,
    context: AgentContext,
  ): Promise<AgentResult> {
    // Only admin can run org-wide compliance checks
    if (!hasCapability(context.role, 'compliance:read')) {
      return createErrorResult('Only administrators can run compliance checks', ['RBAC violation']);
    }

    const docStore = getDocumentStore();
    const milestoneStore = getMilestoneStore();
    const employeeStore = getEmployeeStore();
    const tenantId = context.tenantId || 'default';

    const allDocs = await docStore.list({}, tenantId);
    const expiringDocs = allDocs.filter((d) => d.status === 'expiring');
    const expiredDocs = allDocs.filter((d) => d.status === 'expired');
    const missingDocs = allDocs.filter((d) => d.status === 'missing');

    const allMilestones = await milestoneStore.list({}, tenantId);
    const visaExpiries = allMilestones.filter(
      (milestone) =>
        milestone.milestoneType === 'visa_expiry' &&
        getDerivedMilestoneState(milestone) !== 'completed',
    );
    const probationDue = allMilestones.filter(
      (milestone) =>
        milestone.milestoneType === 'probation_end' &&
        getDerivedMilestoneState(milestone) !== 'completed',
    );

    // Enrich proposed actions with employee names
    const relevantEmpIds = Array.from(
      new Set([
        ...expiringDocs.map((d) => d.employeeId),
        ...visaExpiries.map((m) => m.employeeId),
      ]),
    );
    const employees = relevantEmpIds.length
      ? await employeeStore.findByIds(relevantEmpIds, tenantId)
      : [];
    const empById = new Map(employees.map((e) => [e.id, e]));

    const empName = (id: string) => {
      const emp = empById.get(id);
      return emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown';
    };

    const risks: string[] = [];
    if (expiredDocs.length > 0) risks.push(`${expiredDocs.length} expired documents require immediate action`);
    if (visaExpiries.length > 0) risks.push(`${visaExpiries.length} visa expir${visaExpiries.length > 1 ? 'ies' : 'y'} upcoming`);

    const proposedActions = [
      ...expiringDocs.map((d) => ({
        type: 'document_renewal',
        label: `Renew ${d.fileName} for ${empName(d.employeeId)}`,
        payload: { documentId: d.id, employeeId: d.employeeId },
      })),
      ...visaExpiries.map((m) => ({
        type: 'visa_followup',
        label: `Follow up on visa for ${empName(m.employeeId)}`,
        payload: { milestoneId: m.id, employeeId: m.employeeId },
      })),
    ];

    return createAgentResult(
      {
        expiringDocuments: expiringDocs.length,
        expiredDocuments: expiredDocs.length,
        missingDocuments: missingDocs.length,
        visaExpiries: visaExpiries.length,
        probationDue: probationDue.length,
        totalAlerts: expiringDocs.length + expiredDocs.length + missingDocs.length + visaExpiries.length,
      },
      {
        summary: `Compliance check: ${expiringDocs.length + expiredDocs.length + missingDocs.length} document issues, ${visaExpiries.length} visa alerts`,
        confidence: 1.0,
        risks,
        requiresApproval: false,
        proposedActions,
        citations: [
          {
            source: docStore.backend === 'supabase' ? 'Supabase' : 'Microsoft 365',
            reference: 'Document Repository',
          },
          {
            source: milestoneStore.backend === 'supabase' ? 'Supabase' : 'Internal',
            reference: 'Milestone Tracker',
          },
        ],
      },
    );
  }
}
