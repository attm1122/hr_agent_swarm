/**
 * Agent Registry
 *
 * Provides factory functions for creating fully-configured coordinators.
 * Prefer `createCoordinator` for explicit dependency injection.
 * `getCoordinator` is kept for backward compatibility.
 */

export { createCoordinator } from './factory';
export { SwarmCoordinator } from './coordinator';
export type { Agent } from './base';
export { createAgentResult, createErrorResult } from './base';

import { createCoordinator } from './factory';
import type { SwarmCoordinator } from './coordinator';

let coordinator: SwarmCoordinator | null = null;

/**
 * @deprecated Use `createCoordinator()` for explicit DI in new code.
 * Kept for backward compatibility with existing consumers.
 */
export function getCoordinator(): SwarmCoordinator {
  if (!coordinator) {
    coordinator = createCoordinator();
  }
  return coordinator;
}
