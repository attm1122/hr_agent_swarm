/**
 * Admin Configuration Store
 * 
 * Persistent configuration management for platform administrators:
 * - Document requirement rules
 * - Approval routing configuration
 * - Communication templates
 * - Policy access rules
 * 
 * Governance:
 * - All changes require admin:write capability
 * - Changes are audited
 * - No direct database access - uses service layer
 * - Validation before persistence
 */

import type { AgentContext, Role } from '@/types';
import { logSensitiveAction } from '@/lib/infrastructure/audit/audit-logger';
import { hasCapability } from '@/lib/auth/authorization';

// ============================================
// Configuration Types
// ============================================

export interface DocumentRequirementRule {
  id: string;
  name: string;
  employeeTypes: ('full_time' | 'part_time' | 'contractor' | 'intern')[];
  documentTypes: string[];
  requiredByDays: number; // Days from hire date
  reminderDays: number[]; // Days before due to send reminders
  escalationRole: Role;
  isActive: boolean;
  updatedAt: string;
  updatedBy: string;
}

export interface ApprovalRoutingRule {
  id: string;
  workflowType: string;
  steps: Array<{
    stepOrder: number;
    approverRole: Role;
    fallbackRole?: Role;
    timeLimitHours: number;
    escalationAfterHours: number;
    requiredApprovals: number; // 1 for single, 2 for dual, etc.
  }>;
  isActive: boolean;
  updatedAt: string;
  updatedBy: string;
}

export interface CommunicationTemplate {
  id: string;
  name: string;
  type: 'email' | 'slack' | 'sms';
  subject?: string;
  body: string;
  variables: string[]; // Allowed variable names like {{employeeName}}
  audience: Role[];
  isActive: boolean;
  updatedAt: string;
  updatedBy: string;
}

export interface PolicyAccessRule {
  id: string;
  policyId: string;
  allowedRoles: Role[];
  requireAcknowledgment: boolean;
  acknowledgmentExpiryDays?: number;
  isActive: boolean;
  updatedAt: string;
  updatedBy: string;
}

// ============================================
// In-Memory Stores (replace with database in production)
// ============================================

const documentRules: Map<string, DocumentRequirementRule> = new Map();
const approvalRules: Map<string, ApprovalRoutingRule> = new Map();
const templates: Map<string, CommunicationTemplate> = new Map();
const policyRules: Map<string, PolicyAccessRule> = new Map();

// Default configurations
const DEFAULT_DOCUMENT_RULES: DocumentRequirementRule[] = [
  {
    id: 'default-tax-docs',
    name: 'Tax Documentation',
    employeeTypes: ['full_time', 'part_time'],
    documentTypes: ['tax_form', 'bank_details'],
    requiredByDays: 7,
    reminderDays: [5, 3, 1],
    escalationRole: 'manager',
    isActive: true,
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
  },
  {
    id: 'default-contract-docs',
    name: 'Contract Documentation',
    employeeTypes: ['contractor'],
    documentTypes: ['contract', 'insurance'],
    requiredByDays: 1,
    reminderDays: [1],
    escalationRole: 'admin',
    isActive: true,
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
  },
];

const DEFAULT_APPROVAL_RULES: ApprovalRoutingRule[] = [
  {
    id: 'leave-approval',
    workflowType: 'leave_request',
    steps: [
      {
        stepOrder: 1,
        approverRole: 'manager',
        timeLimitHours: 48,
        escalationAfterHours: 72,
        requiredApprovals: 1,
      },
    ],
    isActive: true,
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
  },
  {
    id: 'salary-change-approval',
    workflowType: 'salary_change',
    steps: [
      {
        stepOrder: 1,
        approverRole: 'manager',
        timeLimitHours: 24,
        escalationAfterHours: 48,
        requiredApprovals: 1,
      },
      {
        stepOrder: 2,
        approverRole: 'admin',
        timeLimitHours: 24,
        escalationAfterHours: 48,
        requiredApprovals: 1,
      },
    ],
    isActive: true,
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
  },
];

const DEFAULT_TEMPLATES: CommunicationTemplate[] = [
  {
    id: 'welcome-email',
    name: 'Welcome Email',
    type: 'email',
    subject: 'Welcome to the team, {{firstName}}!',
    body: 'Dear {{firstName}},\n\nWelcome to {{companyName}}. Your manager is {{managerName}}.\n\nPlease complete your onboarding tasks.',
    variables: ['firstName', 'companyName', 'managerName'],
    audience: ['employee'],
    isActive: true,
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
  },
];

const DEFAULT_POLICY_RULES: PolicyAccessRule[] = [
  {
    id: 'handbook-access',
    policyId: 'employee-handbook',
    allowedRoles: ['admin', 'manager', 'team_lead', 'employee', 'payroll'],
    requireAcknowledgment: true,
    acknowledgmentExpiryDays: 365,
    isActive: true,
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
  },
];

// Initialize with defaults
function initializeDefaults() {
  for (const rule of DEFAULT_DOCUMENT_RULES) {
    documentRules.set(rule.id, rule);
  }
  for (const rule of DEFAULT_APPROVAL_RULES) {
    approvalRules.set(rule.id, rule);
  }
  for (const template of DEFAULT_TEMPLATES) {
    templates.set(template.id, template);
  }
  for (const rule of DEFAULT_POLICY_RULES) {
    policyRules.set(rule.id, rule);
  }
}

initializeDefaults();

// ============================================
// RBAC Check Helper
// ============================================

function checkAdminWrite(context: AgentContext): boolean {
  return hasCapability(context.role, 'admin:write');
}

function checkAdminRead(context: AgentContext): boolean {
  return hasCapability(context.role, 'admin:read');
}

// ============================================
// Document Requirement Rules
// ============================================

export function getDocumentRules(context: AgentContext): DocumentRequirementRule[] {
  if (!checkAdminRead(context)) return [];
  return Array.from(documentRules.values()).filter(r => r.isActive);
}

export function createDocumentRule(
  context: AgentContext,
  rule: Omit<DocumentRequirementRule, 'id' | 'updatedAt' | 'updatedBy'>
): { success: boolean; rule?: DocumentRequirementRule; error?: string } {
  if (!checkAdminWrite(context)) {
    return { success: false, error: 'Admin write permission required' };
  }

  // Validation
  if (!rule.name || rule.name.length < 3) {
    return { success: false, error: 'Rule name must be at least 3 characters' };
  }
  if (rule.employeeTypes.length === 0) {
    return { success: false, error: 'At least one employee type required' };
  }
  if (rule.documentTypes.length === 0) {
    return { success: false, error: 'At least one document type required' };
  }
  if (rule.requiredByDays < 0 || rule.requiredByDays > 365) {
    return { success: false, error: 'Required by days must be between 0 and 365' };
  }

  const newRule: DocumentRequirementRule = {
    ...rule,
    id: `doc-rule-${crypto.randomUUID()}`,
    updatedAt: new Date().toISOString(),
    updatedBy: context.employeeId || 'unknown',
  };

  documentRules.set(newRule.id, newRule);

  // Audit log
  logSensitiveAction(
    context,
    'document_rule_created',
    'document_requirement',
    newRule.id,
    false
  );

  return { success: true, rule: newRule };
}

export function updateDocumentRule(
  context: AgentContext,
  id: string,
  updates: Partial<DocumentRequirementRule>
): { success: boolean; rule?: DocumentRequirementRule; error?: string } {
  if (!checkAdminWrite(context)) {
    return { success: false, error: 'Admin write permission required' };
  }

  const existing = documentRules.get(id);
  if (!existing) {
    return { success: false, error: 'Rule not found' };
  }

  const updated: DocumentRequirementRule = {
    ...existing,
    ...updates,
    id, // Prevent ID change
    updatedAt: new Date().toISOString(),
    updatedBy: context.employeeId || 'unknown',
  };

  documentRules.set(id, updated);

  logSensitiveAction(
    context,
    'document_rule_updated',
    'document_requirement',
    id,
    false
  );

  return { success: true, rule: updated };
}

export function deleteDocumentRule(
  context: AgentContext,
  id: string
): { success: boolean; error?: string } {
  if (!checkAdminWrite(context)) {
    return { success: false, error: 'Admin write permission required' };
  }

  const existing = documentRules.get(id);
  if (!existing) {
    return { success: false, error: 'Rule not found' };
  }

  // Soft delete - mark as inactive
  const updated: DocumentRequirementRule = {
    ...existing,
    isActive: false,
    updatedAt: new Date().toISOString(),
    updatedBy: context.employeeId || 'unknown',
  };

  documentRules.set(id, updated);

  logSensitiveAction(
    context,
    'document_rule_deleted',
    'document_requirement',
    id,
    false
  );

  return { success: true };
}

// ============================================
// Approval Routing Rules
// ============================================

export function getApprovalRules(context: AgentContext): ApprovalRoutingRule[] {
  if (!checkAdminRead(context)) return [];
  return Array.from(approvalRules.values()).filter(r => r.isActive);
}

export function createApprovalRule(
  context: AgentContext,
  rule: Omit<ApprovalRoutingRule, 'id' | 'updatedAt' | 'updatedBy'>
): { success: boolean; rule?: ApprovalRoutingRule; error?: string } {
  if (!checkAdminWrite(context)) {
    return { success: false, error: 'Admin write permission required' };
  }

  // Validation
  if (!rule.workflowType) {
    return { success: false, error: 'Workflow type is required' };
  }
  if (rule.steps.length === 0) {
    return { success: false, error: 'At least one approval step required' };
  }

  // Validate step ordering
  const stepOrders = rule.steps.map(s => s.stepOrder).sort((a, b) => a - b);
  for (let i = 0; i < stepOrders.length; i++) {
    if (stepOrders[i] !== i + 1) {
      return { success: false, error: 'Steps must be sequentially ordered (1, 2, 3...)' };
    }
  }

  const newRule: ApprovalRoutingRule = {
    ...rule,
    id: `approval-rule-${crypto.randomUUID()}`,
    updatedAt: new Date().toISOString(),
    updatedBy: context.employeeId || 'unknown',
  };

  approvalRules.set(newRule.id, newRule);

  logSensitiveAction(
    context,
    'approval_rule_created',
    'approval_routing',
    newRule.id,
    false
  );

  return { success: true, rule: newRule };
}

export function updateApprovalRule(
  context: AgentContext,
  id: string,
  updates: Partial<ApprovalRoutingRule>
): { success: boolean; rule?: ApprovalRoutingRule; error?: string } {
  if (!checkAdminWrite(context)) {
    return { success: false, error: 'Admin write permission required' };
  }

  const existing = approvalRules.get(id);
  if (!existing) {
    return { success: false, error: 'Rule not found' };
  }

  const updated: ApprovalRoutingRule = {
    ...existing,
    ...updates,
    id,
    updatedAt: new Date().toISOString(),
    updatedBy: context.employeeId || 'unknown',
  };

  approvalRules.set(id, updated);

  logSensitiveAction(
    context,
    'approval_rule_updated',
    'approval_routing',
    id,
    false
  );

  return { success: true, rule: updated };
}

// ============================================
// Communication Templates
// ============================================

export function getTemplates(context: AgentContext): CommunicationTemplate[] {
  if (!checkAdminRead(context)) return [];
  return Array.from(templates.values()).filter(t => t.isActive);
}

export function createTemplate(
  context: AgentContext,
  template: Omit<CommunicationTemplate, 'id' | 'updatedAt' | 'updatedBy'>
): { success: boolean; template?: CommunicationTemplate; error?: string } {
  if (!checkAdminWrite(context)) {
    return { success: false, error: 'Admin write permission required' };
  }

  // Validation
  if (!template.name || template.name.length < 3) {
    return { success: false, error: 'Template name must be at least 3 characters' };
  }
  if (!template.body || template.body.length < 10) {
    return { success: false, error: 'Template body must be at least 10 characters' };
  }
  if (template.type === 'email' && !template.subject) {
    return { success: false, error: 'Email templates require a subject' };
  }

  const newTemplate: CommunicationTemplate = {
    ...template,
    id: `template-${crypto.randomUUID()}`,
    updatedAt: new Date().toISOString(),
    updatedBy: context.employeeId || 'unknown',
  };

  templates.set(newTemplate.id, newTemplate);

  logSensitiveAction(
    context,
    'template_created',
    'communication_template',
    newTemplate.id,
    false
  );

  return { success: true, template: newTemplate };
}

// ============================================
// Policy Access Rules
// ============================================

export function getPolicyRules(context: AgentContext): PolicyAccessRule[] {
  if (!checkAdminRead(context)) return [];
  return Array.from(policyRules.values()).filter(r => r.isActive);
}

export function createPolicyRule(
  context: AgentContext,
  rule: Omit<PolicyAccessRule, 'id' | 'updatedAt' | 'updatedBy'>
): { success: boolean; rule?: PolicyAccessRule; error?: string } {
  if (!checkAdminWrite(context)) {
    return { success: false, error: 'Admin write permission required' };
  }

  if (!rule.policyId) {
    return { success: false, error: 'Policy ID is required' };
  }
  if (rule.allowedRoles.length === 0) {
    return { success: false, error: 'At least one allowed role required' };
  }

  const newRule: PolicyAccessRule = {
    ...rule,
    id: `policy-rule-${crypto.randomUUID()}`,
    updatedAt: new Date().toISOString(),
    updatedBy: context.employeeId || 'unknown',
  };

  policyRules.set(newRule.id, newRule);

  logSensitiveAction(
    context,
    'policy_rule_created',
    'policy_access',
    newRule.id,
    false
  );

  return { success: true, rule: newRule };
}
