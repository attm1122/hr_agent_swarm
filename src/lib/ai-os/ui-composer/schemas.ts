/**
 * Zod schemas for UIBlock. The discriminated union is validated at the
 * server → client boundary: every block the composer emits is parsed before
 * being sent over SSE. Any malformed block fails loud.
 */

import { z } from 'zod';

const UIActionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  variant: z.enum(['primary', 'secondary', 'destructive', 'ghost']).optional(),
  intent: z
    .object({
      rawInput: z.string().min(1),
      prefill: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
  href: z.string().optional(),
  confirmCopy: z.string().optional(),
});

const BlockMetaSchema = z
  .object({
    auditId: z.string().optional(),
    agentType: z.string().optional(),
    intent: z.string().optional(),
  })
  .optional();

const commonBlockFields = {
  id: z.string().min(1),
  actions: z.array(UIActionSchema).optional(),
  meta: BlockMetaSchema,
};

export const SummaryCardSchema = z.object({
  ...commonBlockFields,
  kind: z.literal('SummaryCard'),
  title: z.string().min(1),
  body: z.string().optional(),
  icon: z.string().optional(),
  tone: z.enum(['neutral', 'positive', 'warning', 'danger']).optional(),
  metrics: z
    .array(
      z.object({
        label: z.string(),
        value: z.union([z.string(), z.number()]),
        delta: z.string().optional(),
      }),
    )
    .optional(),
});

export const ConfirmationCardSchema = z.object({
  ...commonBlockFields,
  kind: z.literal('ConfirmationCard'),
  title: z.string().min(1),
  message: z.string().min(1),
  before: z.record(z.string(), z.unknown()).optional(),
  after: z.record(z.string(), z.unknown()).optional(),
  changedFields: z.array(z.string()).optional(),
  tone: z.enum(['positive', 'neutral']).optional(),
  timestamp: z.string(),
});

export const RiskBannerSchema = z.object({
  ...commonBlockFields,
  kind: z.literal('RiskBanner'),
  severity: z.enum(['low', 'medium', 'high']),
  title: z.string().min(1),
  message: z.string().min(1),
  references: z
    .array(z.object({ label: z.string(), href: z.string().optional() }))
    .optional(),
});

export const RecommendationPanelSchema = z.object({
  ...commonBlockFields,
  kind: z.literal('RecommendationPanel'),
  title: z.string().min(1),
  recommendations: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      detail: z.string().optional(),
      severity: z.enum(['info', 'warning', 'critical']).optional(),
    }),
  ),
});

const EditableFormFieldSchema = z.object({
  name: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(['text', 'email', 'number', 'date', 'select', 'textarea']),
  required: z.boolean().optional(),
  placeholder: z.string().optional(),
  defaultValue: z.union([z.string(), z.number()]).optional(),
  options: z
    .array(z.object({ label: z.string(), value: z.string() }))
    .optional(),
  pattern: z.string().optional(),
  helpText: z.string().optional(),
});

export const EditableFormSchema = z.object({
  ...commonBlockFields,
  kind: z.literal('EditableForm'),
  title: z.string().min(1),
  description: z.string().optional(),
  fields: z.array(EditableFormFieldSchema),
  submitLabel: z.string().min(1),
  submitIntent: z.object({
    rawInput: z.string().min(1),
    prefill: z.record(z.string(), z.unknown()).optional(),
  }),
});

export const DocumentEditorSchema = z.object({
  ...commonBlockFields,
  kind: z.literal('DocumentEditor'),
  title: z.string().min(1),
  markdown: z.string(),
  readOnly: z.boolean().optional(),
});

const TableColumnSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  align: z.enum(['left', 'right', 'center']).optional(),
  format: z.enum(['text', 'number', 'date', 'currency', 'badge']).optional(),
});

export const TableBlockSchema = z.object({
  ...commonBlockFields,
  kind: z.literal('Table'),
  title: z.string().optional(),
  description: z.string().optional(),
  columns: z.array(TableColumnSchema),
  rows: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.null()]))),
  rowCount: z.number().optional(),
});

export const ChartBlockSchema = z.object({
  ...commonBlockFields,
  kind: z.literal('Chart'),
  title: z.string().min(1),
  chartType: z.enum(['bar', 'line', 'pie']),
  series: z.array(
    z.object({
      label: z.string(),
      value: z.number(),
      hint: z.string().optional(),
    }),
  ),
});

export const TimelineBlockSchema = z.object({
  ...commonBlockFields,
  kind: z.literal('Timeline'),
  title: z.string().min(1),
  events: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      timestamp: z.string(),
      detail: z.string().optional(),
      icon: z.string().optional(),
      tone: z.enum(['neutral', 'positive', 'warning', 'danger']).optional(),
    }),
  ),
});

export const ApprovalPanelSchema = z.object({
  ...commonBlockFields,
  kind: z.literal('ApprovalPanel'),
  title: z.string().min(1),
  requiredApprovers: z.array(z.string()),
  workflowId: z.string().optional(),
  reason: z.string().min(1),
  riskLevel: z.enum(['low', 'medium', 'high']),
});

export const TaskChecklistSchema = z.object({
  ...commonBlockFields,
  kind: z.literal('TaskChecklist'),
  title: z.string().min(1),
  items: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      done: z.boolean(),
      blocker: z.boolean().optional(),
      detail: z.string().optional(),
    }),
  ),
});

export const ArtifactPreviewSchema = z.object({
  ...commonBlockFields,
  kind: z.literal('ArtifactPreview'),
  title: z.string().min(1),
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().optional(),
  rowCount: z.number().optional(),
  href: z.string().min(1),
  previewRows: z
    .array(z.record(z.string(), z.union([z.string(), z.number(), z.null()])))
    .optional(),
  previewColumns: z.array(TableColumnSchema).optional(),
  expiresAt: z.string().optional(),
});

export const ActionBarSchema = z.object({
  ...commonBlockFields,
  kind: z.literal('ActionBar'),
  primaryLabel: z.string().optional(),
});

export const UIBlockSchema = z.discriminatedUnion('kind', [
  SummaryCardSchema,
  ConfirmationCardSchema,
  RiskBannerSchema,
  RecommendationPanelSchema,
  EditableFormSchema,
  DocumentEditorSchema,
  TableBlockSchema,
  ChartBlockSchema,
  TimelineBlockSchema,
  ApprovalPanelSchema,
  TaskChecklistSchema,
  ArtifactPreviewSchema,
  ActionBarSchema,
]);
