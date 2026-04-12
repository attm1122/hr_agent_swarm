/**
 * Event Bus Port - Interface for event-driven communication
 */

// ============================================================================
// Domain Events
// ============================================================================

export interface DomainEvent {
  id: string;
  type: string;
  payload: unknown;
  timestamp: string;
  correlationId: string;
  causationId?: string;
  tenantId: string;
  userId?: string;
  version: number;
}

// ============================================================================
// HR Domain Events
// ============================================================================

export interface EmployeeHiredEvent extends DomainEvent {
  type: 'employee.hired';
  payload: {
    employeeId: string;
    firstName: string;
    lastName: string;
    email: string;
    hireDate: string;
    teamId: string;
    managerId: string;
    positionId: string;
  };
}

export interface EmployeeTerminatedEvent extends DomainEvent {
  type: 'employee.terminated';
  payload: {
    employeeId: string;
    terminationDate: string;
    reason: string;
    initiatedBy: string;
  };
}

export interface LeaveRequestedEvent extends DomainEvent {
  type: 'leave.requested';
  payload: {
    requestId: string;
    employeeId: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    daysRequested: number;
  };
}

export interface LeaveApprovedEvent extends DomainEvent {
  type: 'leave.approved';
  payload: {
    requestId: string;
    employeeId: string;
    approvedBy: string;
    approvedAt: string;
  };
}

export interface WorkflowStepApprovedEvent extends DomainEvent {
  type: 'workflow.step_approved';
  payload: {
    workflowId: string;
    stepId: string;
    stepNumber: number;
    approvedBy: string;
    nextStepId?: string;
  };
}

export interface WorkflowCompletedEvent extends DomainEvent {
  type: 'workflow.completed';
  payload: {
    workflowId: string;
    type: string;
    referenceId: string;
    completedAt: string;
  };
}

export interface OnboardingTaskCompletedEvent extends DomainEvent {
  type: 'onboarding.task_completed';
  payload: {
    planId: string;
    taskId: string;
    employeeId: string;
    taskName: string;
    completedBy: string;
    allTasksComplete: boolean;
  };
}

export interface OnboardingCompletedEvent extends DomainEvent {
  type: 'onboarding.completed';
  payload: {
    planId: string;
    employeeId: string;
    completedAt: string;
  };
}

export interface DocumentExpiredEvent extends DomainEvent {
  type: 'document.expired';
  payload: {
    documentId: string;
    employeeId: string;
    documentType: string;
    expiredAt: string;
  };
}

export interface MilestoneReachedEvent extends DomainEvent {
  type: 'milestone.reached';
  payload: {
    milestoneId: string;
    employeeId: string;
    milestoneType: string;
    milestoneDate: string;
  };
}

export type HREvent =
  | EmployeeHiredEvent
  | EmployeeTerminatedEvent
  | LeaveRequestedEvent
  | LeaveApprovedEvent
  | WorkflowStepApprovedEvent
  | WorkflowCompletedEvent
  | OnboardingTaskCompletedEvent
  | OnboardingCompletedEvent
  | DocumentExpiredEvent
  | MilestoneReachedEvent;

// ============================================================================
// Event Handler
// ============================================================================

export interface EventHandler<T extends DomainEvent = DomainEvent> {
  eventType: T['type'];
  handle(event: T): Promise<void>;
}

// ============================================================================
// Event Bus Port
// ============================================================================

export interface EventBusPort {
  // Publish events
  publish<T extends DomainEvent>(event: T): Promise<void>;
  publishBatch<T extends DomainEvent>(events: T[]): Promise<void>;
  
  // Subscribe to events
  subscribe<T extends DomainEvent>(
    eventType: T['type'],
    handler: EventHandler<T>
  ): void;
  
  subscribeAll(handler: EventHandler<DomainEvent>): void;
  
  // Unsubscribe
  unsubscribe<T extends DomainEvent>(
    eventType: T['type'],
    handler: EventHandler<T>
  ): void;
  
  // Query events (for event sourcing/replay)
  query(params: {
    tenantId: string;
    eventTypes?: string[];
    aggregateId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<DomainEvent[]>;
  
  // Health check
  health(): Promise<{ healthy: boolean; lag?: number }>;
}

// ============================================================================
// Outbox Pattern Support
// ============================================================================

export interface OutboxEntry {
  id: string;
  event: DomainEvent;
  status: 'pending' | 'processing' | 'failed' | 'delivered';
  retryCount: number;
  createdAt: string;
  processedAt?: string;
  error?: string;
}

export interface OutboxPort {
  enqueue(event: DomainEvent): Promise<void>;
  dequeue(batchSize: number): Promise<OutboxEntry[]>;
  markDelivered(id: string): Promise<void>;
  markFailed(id: string, error: string): Promise<void>;
  retry(id: string): Promise<void>;
}
