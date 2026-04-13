/**
 * Tool definitions exposed to Claude.
 *
 * Each agent intent becomes a Claude tool the model can call. The tool's
 * input schema is the payload shape the existing agent expects, so the
 * orchestrator can pass the LLM's tool_use straight into
 * `coordinator.route({ intent, payload, context, query })`.
 *
 * Adding new agent capabilities = adding entries here; the orchestrator
 * loop and chat UI need no changes.
 */

import type Anthropic from '@anthropic-ai/sdk';
import type { AgentIntent } from '@/types';

/** A tool Claude can invoke that maps to an existing agent intent. */
export interface AgentTool {
  /** Tool name surfaced to Claude (snake_case). */
  name: string;
  /** Human-readable description Claude uses to decide when to call. */
  description: string;
  /** JSON Schema for inputs (also forms the agent payload). */
  input_schema: Anthropic.Tool.InputSchema;
  /** Maps the tool back to the agent intent the coordinator expects. */
  intent: AgentIntent;
}

/**
 * The complete tool catalogue. Order matters only for display; Claude
 * picks tools by name + description.
 */
export const AGENT_TOOLS: AgentTool[] = [
  // ----- Employee Profile -----
  {
    name: 'employee_search',
    description:
      'Search the employee directory by name, email, team, role, manager, location, or status. Returns matching employees with their basic profile (name, email, team, role, manager, hire date, status). Use this first when you need to find one or more employees by any descriptive criteria.',
    intent: 'employee_search',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Free-text search across name, email, employee number.',
        },
        teamId: { type: 'string', description: 'Filter by team UUID.' },
        managerId: { type: 'string', description: 'Filter by manager UUID.' },
        status: {
          type: 'string',
          enum: ['active', 'inactive', 'on_leave', 'terminated', 'pending'],
          description: 'Filter by employment status.',
        },
        limit: { type: 'number', description: 'Max results (default 25).' },
      },
    },
  },
  {
    name: 'employee_summary',
    description:
      'Get a deep profile for one specific employee: tenure, manager, direct reports, recent leave, document status, milestones, current onboarding/offboarding plans. Use this when the user asks "tell me about X" or after employee_search has narrowed to one person.',
    intent: 'employee_summary',
    input_schema: {
      type: 'object',
      properties: {
        employeeId: {
          type: 'string',
          description: 'UUID of the employee to profile.',
        },
      },
      required: ['employeeId'],
    },
  },

  // ----- Leave & Milestones -----
  {
    name: 'leave_balance',
    description:
      "Get an employee's current leave balances across all leave types (annual, sick, personal, parental, etc.) for the active period. Includes entitlement, taken, pending, and remaining days.",
    intent: 'leave_balance',
    input_schema: {
      type: 'object',
      properties: {
        employeeId: { type: 'string', description: 'Employee UUID.' },
      },
      required: ['employeeId'],
    },
  },
  {
    name: 'leave_request',
    description:
      'List or filter leave requests. Use to answer "show me pending leave for the engineering team", "what leave did Sarah take this quarter", etc.',
    intent: 'leave_request',
    input_schema: {
      type: 'object',
      properties: {
        employeeId: { type: 'string', description: 'Filter by employee UUID.' },
        status: {
          type: 'string',
          enum: ['draft', 'pending', 'approved', 'rejected', 'cancelled'],
        },
        startDateAfter: { type: 'string', description: 'ISO date.' },
        startDateBefore: { type: 'string', description: 'ISO date.' },
      },
    },
  },
  {
    name: 'milestone_list',
    description:
      'List upcoming employee milestones (service anniversaries, probation ends, visa expiries, certification expiries, contract expiries, performance reviews). Filter by horizon, type, or employee.',
    intent: 'milestone_list',
    input_schema: {
      type: 'object',
      properties: {
        withinDays: {
          type: 'number',
          description: 'Only milestones occurring within N days from today.',
        },
        type: {
          type: 'string',
          enum: [
            'service_anniversary',
            'probation_end',
            'visa_expiry',
            'certification_expiry',
            'contract_expiry',
            'performance_review',
          ],
        },
        employeeId: { type: 'string' },
        teamId: { type: 'string' },
      },
    },
  },

  // ----- Documents & Compliance -----
  {
    name: 'document_list',
    description:
      "List an employee's HR documents (contracts, visas, certifications, IDs, medical, tax, performance) with status (active/expired/expiring/missing). Use to answer compliance questions.",
    intent: 'document_list',
    input_schema: {
      type: 'object',
      properties: {
        employeeId: { type: 'string' },
        category: {
          type: 'string',
          enum: ['contract', 'visa', 'certification', 'id', 'medical', 'tax', 'performance', 'other'],
        },
        status: {
          type: 'string',
          enum: ['active', 'expired', 'expiring', 'missing'],
        },
      },
    },
  },
  {
    name: 'document_classify',
    description:
      'Classify a document by name/path into the correct HR category (contract, visa, certification, etc.). Useful when reasoning about a freshly synced or uploaded file.',
    intent: 'document_classify',
    input_schema: {
      type: 'object',
      properties: {
        fileName: { type: 'string', description: 'Original file name.' },
        path: { type: 'string', description: 'Optional folder path hint.' },
      },
      required: ['fileName'],
    },
  },

  // ----- Onboarding -----
  {
    name: 'onboarding_create',
    description:
      'Create an onboarding plan for a new hire from a template. Returns the generated task list and target completion date.',
    intent: 'onboarding_create',
    input_schema: {
      type: 'object',
      properties: {
        employeeId: { type: 'string' },
        templateName: { type: 'string', description: 'e.g. "default", "engineer", "exec".' },
        startDate: { type: 'string', description: 'ISO date.' },
      },
      required: ['employeeId', 'templateName', 'startDate'],
    },
  },
  {
    name: 'onboarding_progress',
    description:
      'Get an onboarding plan with its tasks, completion %, blockers, and overdue items.',
    intent: 'onboarding_progress',
    input_schema: {
      type: 'object',
      properties: {
        planId: { type: 'string' },
        employeeId: { type: 'string', description: 'Look up by employee instead of plan id.' },
      },
    },
  },

  // ----- Offboarding -----
  {
    name: 'offboarding_create',
    description: "Create an offboarding plan for a leaving employee.",
    intent: 'offboarding_create',
    input_schema: {
      type: 'object',
      properties: {
        employeeId: { type: 'string' },
        terminationDate: { type: 'string', description: 'ISO date.' },
        checklistTemplate: { type: 'string', description: 'e.g. "voluntary", "involuntary".' },
      },
      required: ['employeeId', 'terminationDate', 'checklistTemplate'],
    },
  },
  {
    name: 'offboarding_progress',
    description:
      'Get an offboarding plan with its tasks (access removal, asset return, knowledge transfer, HR exit, payroll exit, compliance) and progress.',
    intent: 'offboarding_progress',
    input_schema: {
      type: 'object',
      properties: {
        planId: { type: 'string' },
        employeeId: { type: 'string' },
      },
    },
  },

  // ----- Workflow / Approvals -----
  {
    name: 'workflow_status',
    description:
      'Look up an approval workflow (leave, salary, promotion, termination, document, communication, review) by id, by reference (e.g. a leave request), or list pending workflows for the current user.',
    intent: 'workflow_status',
    input_schema: {
      type: 'object',
      properties: {
        workflowId: { type: 'string' },
        referenceType: { type: 'string' },
        referenceId: { type: 'string' },
        approverId: { type: 'string', description: 'List workflows awaiting this approver.' },
      },
    },
  },
  {
    name: 'workflow_approve',
    description:
      "Record an approval decision on a workflow step. The current user must be the assigned approver. Always confirm with the human before calling.",
    intent: 'workflow_approve',
    input_schema: {
      type: 'object',
      properties: {
        workflowId: { type: 'string' },
        stepNumber: { type: 'number' },
        decision: { type: 'string', enum: ['approve', 'reject'] },
        comments: { type: 'string' },
      },
      required: ['workflowId', 'stepNumber', 'decision'],
    },
  },

  // ----- Knowledge / Policy -----
  {
    name: 'policy_search',
    description:
      'Search policy documents with permission-aware retrieval. Returns ranked policy chunks with source document + version. Use this whenever the user asks a policy or "what does the handbook say" question.',
    intent: 'policy_search',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural-language question or keywords.' },
        category: { type: 'string', description: 'Optional category filter.' },
      },
      required: ['query'],
    },
  },
  {
    name: 'policy_answer',
    description:
      'Generate a grounded answer to a policy question with citations to the source clauses. Prefer this over policy_search when the user asks a direct question and wants a synthesised answer.',
    intent: 'policy_answer',
    input_schema: {
      type: 'object',
      properties: {
        question: { type: 'string' },
      },
      required: ['question'],
    },
  },

  // ----- Manager Support / Cross-cutting -----
  {
    name: 'dashboard_summary',
    description:
      'Fan-out across all agents to produce a holistic snapshot for the current user (their team, pending approvals, expiring documents, upcoming milestones, leave usage). Use as a default "status check" tool when the user asks "what should I know" or opens a fresh conversation.',
    intent: 'dashboard_summary',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
];

/** Convert to the exact shape the Anthropic SDK wants. */
export function getAnthropicTools(): Anthropic.Tool[] {
  return AGENT_TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }));
}

/** Lookup helper used by the orchestrator. */
const TOOL_BY_NAME = new Map(AGENT_TOOLS.map((t) => [t.name, t]));
export function getToolByName(name: string): AgentTool | undefined {
  return TOOL_BY_NAME.get(name);
}
