/**
 * Document & Compliance Agent
 * Handles document queries, expiry alerting, and compliance checks.
 * Data source: Microsoft 365 / OneDrive (mock: mock-data.ts documents)
 * Deterministic compliance rules — no AI classification in POC.
 */

import type { AgentResult, AgentContext, AgentIntent } from '@/types';
import type { Agent } from './base';
import { createAgentResult, createErrorResult } from './base';
import {
  documents, milestones, getEmployeeById, getEmployeeFullName,
} from '@/lib/data/mock-data';
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
    context: AgentContext
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
    context: AgentContext
  ): Promise<AgentResult> {
    // Capability gate
    if (!hasCapability(context.role, 'document:read')) {
      return createErrorResult('Not authorized to access documents', ['RBAC violation']);
    }

    const scopeContext = buildRecordScopeContext(context);

    // Scope + sensitivity filtering via policy (documents are team_visible by default)
    let docs = documents.filter(d =>
      canViewDocument(context, d.employeeId, 'team_visible', scopeContext.teamEmployeeIds)
    );

    if (payload.status && payload.status !== 'all') {
      docs = docs.filter(d => d.status === payload.status);
    }
    if (payload.employeeId) {
      docs = docs.filter(d => d.employeeId === payload.employeeId);
    }

    const enriched = docs.map(d => {
      const emp = getEmployeeById(d.employeeId);
      return { ...d, employeeName: emp ? getEmployeeFullName(emp) : 'Unknown' };
    });

    const expiring = enriched.filter(d => d.status === 'expiring').length;
    const expired = enriched.filter(d => d.status === 'expired').length;
    const risks: string[] = [];
    if (expiring > 0) risks.push(`${expiring} document${expiring > 1 ? 's' : ''} expiring soon`);
    if (expired > 0) risks.push(`${expired} document${expired > 1 ? 's' : ''} already expired`);

    return createAgentResult(enriched, {
      summary: `${enriched.length} document${enriched.length !== 1 ? 's' : ''} on file`,
      confidence: 1.0,
      risks,
      citations: [{ source: 'Microsoft 365', reference: 'OneDrive HR Documents' }],
    });
  }

  private async complianceCheck(
    _payload: Record<string, unknown>,
    context: AgentContext
  ): Promise<AgentResult> {
    // Only admin can run org-wide compliance checks
    if (!hasCapability(context.role, 'compliance:read')) {
      return createErrorResult('Only administrators can run compliance checks', ['RBAC violation']);
    }

    const expiringDocs = documents.filter(d => d.status === 'expiring');
    const expiredDocs = documents.filter(d => d.status === 'expired');
    const missingDocs = documents.filter(d => d.status === 'missing');

    const visaExpiries = milestones.filter(
      (milestone) =>
        milestone.milestoneType === 'visa_expiry' &&
        getDerivedMilestoneState(milestone) !== 'completed'
    );
    const probationDue = milestones.filter(
      (milestone) =>
        milestone.milestoneType === 'probation_end' &&
        getDerivedMilestoneState(milestone) !== 'completed'
    );

    const risks: string[] = [];
    if (expiredDocs.length > 0) risks.push(`${expiredDocs.length} expired documents require immediate action`);
    if (visaExpiries.length > 0) risks.push(`${visaExpiries.length} visa expir${visaExpiries.length > 1 ? 'ies' : 'y'} upcoming`);

    const proposedActions = [
      ...expiringDocs.map(d => {
        const emp = getEmployeeById(d.employeeId);
        return {
          type: 'document_renewal',
          label: `Renew ${d.fileName} for ${emp ? getEmployeeFullName(emp) : 'Unknown'}`,
          payload: { documentId: d.id, employeeId: d.employeeId },
        };
      }),
      ...visaExpiries.map(m => {
        const emp = getEmployeeById(m.employeeId);
        return {
          type: 'visa_followup',
          label: `Follow up on visa for ${emp ? getEmployeeFullName(emp) : 'Unknown'}`,
          payload: { milestoneId: m.id, employeeId: m.employeeId },
        };
      }),
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
          { source: 'Microsoft 365', reference: 'Document Repository' },
          { source: 'Internal', reference: 'Milestone Tracker' },
        ],
      }
    );
  }
}
