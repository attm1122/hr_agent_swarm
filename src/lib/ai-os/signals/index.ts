/**
 * Public barrel for the signals module. Exported types are the contract
 * between the intelligence layer and every UI surface.
 */

export type {
  SignalKind,
  Severity,
  SignalStatus,
  PolicyBasis,
  LegalBasis,
  ActionOption,
  RiskSignal,
  DecisionObject,
  SignalSet,
  ProjectionContext,
  ProjectedSignalSet,
} from './types';

export { generateSignals } from './generator';
export { buildProjectionContext, projectSignals } from './projection';
