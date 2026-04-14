/**
 * Public barrel for the AI-OS module.
 *
 * Only re-exports used across the app should live here. Internal adapters
 * (storage, specific writes, etc.) stay private behind their folders.
 */

export { runAiOs } from './orchestrator/ai-os-orchestrator';
export type {
  RunAiOsInput,
  RunAiOsResult,
} from './orchestrator/ai-os-orchestrator';

export type {
  AiOsEvent,
  AiOsEventKind,
  AiOsEmit,
  ArtifactRef,
} from './orchestrator/events';

export type { Intent, ActionType, EntityType, OutputFormat } from './intent/types';
export type { DecisionTrace, ExecutionMode, RiskScore } from './decision/types';
export type {
  UIBlock,
  UIBlockKind,
  ComposedWorkspace,
  UIAction,
  BlockMeta,
  SummaryCardBlock,
  ConfirmationCardBlock,
  RiskBannerBlock,
  RecommendationPanelBlock,
  EditableFormBlock,
  EditableFormField,
  DocumentEditorBlock,
  TableBlock,
  TableColumn,
  ChartBlock,
  TimelineBlock,
  TimelineEvent,
  ApprovalPanelBlock,
  TaskChecklistBlock,
  TaskChecklistItem,
  ArtifactPreviewBlock,
  ActionBarBlock,
} from './ui-composer/types';
export { UIBlockSchema } from './ui-composer/schemas';

export { interpretRequest } from './intent/interpreter';
export { decideExecutionMode } from './decision/engine';
export { compose } from './ui-composer/composer';
export { resolveIdentity } from './identity/identity-agent';
export { persistTrace, recentTraces } from './agents/audit-agent';

export {
  generateSignals,
  buildProjectionContext,
  projectSignals,
} from './signals';
export type {
  RiskSignal,
  SignalKind,
  SignalSet,
  Severity as SignalSeverity,
  ActionOption,
  PolicyBasis,
  LegalBasis,
  ProjectionContext,
  ProjectedSignalSet,
  DecisionObject,
} from './signals';

export {
  addNotification,
  getNotifications,
  markRead,
  markAllRead,
  getUnreadCount,
} from './notifications';
export type {
  InAppNotification,
  NotificationChannel,
  NotificationPriority,
  NotificationStatus,
} from './notifications';
