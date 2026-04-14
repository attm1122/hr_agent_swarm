/**
 * AI-OS UI Composer — typed block schema.
 *
 * UIBlock is the contract between the server-side UIComposer and the
 * client-side BlockRenderer. Every surface in the AI-OS speaks this protocol.
 *
 * Rules:
 *   - Blocks are pure data. No JSX, no functions, no DOM references.
 *   - Discriminated by `kind`.
 *   - Every block carries optional `actions: UIAction[]` for interactive elements.
 *   - Every block carries an `id` so the renderer can key, animate, and dedupe.
 */

import type { ExecutionMode } from '../decision/types';
import type { Intent } from '../intent/types';

/** A button or link that either posts a new intent or downloads a URL. */
export interface UIAction {
  id: string;
  label: string;
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost';
  /** If set, a follow-up intent the assistant should run when clicked. */
  intent?: {
    rawInput: string;
    prefill?: Partial<Intent>;
  };
  /** If set, a direct URL (artifact download, external link). */
  href?: string;
  /** If set, opens a confirmation modal with this copy before acting. */
  confirmCopy?: string;
}

export interface BlockMeta {
  auditId?: string;
  agentType?: string;
  intent?: string;
}

interface BaseBlock {
  id: string;
  actions?: UIAction[];
  meta?: BlockMeta;
}

export interface SummaryCardBlock extends BaseBlock {
  kind: 'SummaryCard';
  title: string;
  body?: string;
  icon?: string; // lucide icon name
  tone?: 'neutral' | 'positive' | 'warning' | 'danger';
  metrics?: Array<{ label: string; value: string | number; delta?: string }>;
}

export interface ConfirmationCardBlock extends BaseBlock {
  kind: 'ConfirmationCard';
  title: string;
  message: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  changedFields?: string[];
  tone?: 'positive' | 'neutral';
  timestamp: string;
}

export interface RiskBannerBlock extends BaseBlock {
  kind: 'RiskBanner';
  severity: 'low' | 'medium' | 'high';
  title: string;
  message: string;
  references?: Array<{ label: string; href?: string }>;
}

export interface RecommendationPanelBlock extends BaseBlock {
  kind: 'RecommendationPanel';
  title: string;
  recommendations: Array<{
    id: string;
    title: string;
    detail?: string;
    severity?: 'info' | 'warning' | 'critical';
  }>;
}

export interface EditableFormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'number' | 'date' | 'select' | 'textarea';
  required?: boolean;
  placeholder?: string;
  defaultValue?: string | number;
  options?: Array<{ label: string; value: string }>;
  pattern?: string;
  helpText?: string;
}

export interface EditableFormBlock extends BaseBlock {
  kind: 'EditableForm';
  title: string;
  description?: string;
  fields: EditableFormField[];
  submitLabel: string;
  submitIntent: { rawInput: string; prefill?: Partial<Intent> };
}

export interface DocumentEditorBlock extends BaseBlock {
  kind: 'DocumentEditor';
  title: string;
  /** Markdown body the user can edit before sending. */
  markdown: string;
  readOnly?: boolean;
}

export interface TableColumn {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  format?: 'text' | 'number' | 'date' | 'currency' | 'badge';
}

export interface TableBlock extends BaseBlock {
  kind: 'Table';
  title?: string;
  description?: string;
  columns: TableColumn[];
  rows: Array<Record<string, string | number | null>>;
  rowCount?: number; // total (rows may be a preview)
}

export interface ChartBlock extends BaseBlock {
  kind: 'Chart';
  title: string;
  chartType: 'bar' | 'line' | 'pie';
  series: Array<{ label: string; value: number; hint?: string }>;
}

export interface TimelineEvent {
  id: string;
  label: string;
  timestamp: string;
  detail?: string;
  icon?: string;
  tone?: 'neutral' | 'positive' | 'warning' | 'danger';
}

export interface TimelineBlock extends BaseBlock {
  kind: 'Timeline';
  title: string;
  events: TimelineEvent[];
}

export interface ApprovalPanelBlock extends BaseBlock {
  kind: 'ApprovalPanel';
  title: string;
  requiredApprovers: string[]; // role names
  workflowId?: string;
  reason: string;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface TaskChecklistItem {
  id: string;
  label: string;
  done: boolean;
  blocker?: boolean;
  detail?: string;
}

export interface TaskChecklistBlock extends BaseBlock {
  kind: 'TaskChecklist';
  title: string;
  items: TaskChecklistItem[];
}

export interface ArtifactPreviewBlock extends BaseBlock {
  kind: 'ArtifactPreview';
  title: string;
  filename: string;
  mimeType: string;
  sizeBytes?: number;
  rowCount?: number;
  href: string; // signed URL or blob URL
  previewRows?: Array<Record<string, string | number | null>>;
  previewColumns?: TableColumn[];
  expiresAt?: string;
}

export interface ActionBarBlock extends BaseBlock {
  kind: 'ActionBar';
  /** Actions render as prominent buttons in a row. */
  primaryLabel?: string;
}

export type UIBlock =
  | SummaryCardBlock
  | ConfirmationCardBlock
  | RiskBannerBlock
  | RecommendationPanelBlock
  | EditableFormBlock
  | DocumentEditorBlock
  | TableBlock
  | ChartBlock
  | TimelineBlock
  | ApprovalPanelBlock
  | TaskChecklistBlock
  | ArtifactPreviewBlock
  | ActionBarBlock;

export type UIBlockKind = UIBlock['kind'];

export interface ComposedWorkspace {
  intentId: string;
  mode: ExecutionMode;
  blocks: UIBlock[];
  /** Short narrative summary shown above the block stream. */
  headline?: string;
}
