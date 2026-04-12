/**
 * In-Memory Event Bus - For development and testing
 */

import type {
  DomainEvent,
  EventBusPort,
  EventHandler,
} from '@/lib/ports/event-bus-port';

export class InMemoryEventBus implements EventBusPort {
  private handlers = new Map<string, Set<EventHandler<DomainEvent>>>();
  private allHandlers = new Set<EventHandler<DomainEvent>>();
  private eventHistory: DomainEvent[] = [];
  private maxHistory = 1000;

  async publish<T extends DomainEvent>(event: T): Promise<void> {
    // Store in history
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistory) {
      this.eventHistory.shift();
    }

    // Notify specific handlers
    const specificHandlers = this.handlers.get(event.type);
    if (specificHandlers) {
      for (const handler of specificHandlers) {
        try {
          await handler.handle(event);
        } catch (err) {
          console.error(`Event handler failed for ${event.type}:`, err);
        }
      }
    }

    // Notify catch-all handlers
    for (const handler of this.allHandlers) {
      try {
        await handler.handle(event);
      } catch (err) {
        console.error(`Catch-all handler failed for ${event.type}:`, err);
      }
    }
  }

  async publishBatch<T extends DomainEvent>(events: T[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }

  subscribe<T extends DomainEvent>(
    eventType: T['type'],
    handler: EventHandler<T>
  ): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler as EventHandler<DomainEvent>);
  }

  subscribeAll(handler: EventHandler<DomainEvent>): void {
    this.allHandlers.add(handler);
  }

  unsubscribe<T extends DomainEvent>(
    eventType: T['type'],
    handler: EventHandler<T>
  ): void {
    const specificHandlers = this.handlers.get(eventType);
    if (specificHandlers) {
      specificHandlers.delete(handler as EventHandler<DomainEvent>);
    }
  }

  async query(params: {
    tenantId: string;
    eventTypes?: string[];
    aggregateId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<DomainEvent[]> {
    let events = this.eventHistory.filter(e => e.tenantId === params.tenantId);

    if (params.eventTypes) {
      events = events.filter(e => params.eventTypes!.includes(e.type));
    }

    if (params.aggregateId) {
      // Assuming aggregate ID is in payload for most events
      events = events.filter(e => {
        const payload = e.payload as Record<string, unknown>;
        return Object.values(payload).includes(params.aggregateId);
      });
    }

    if (params.startDate) {
      events = events.filter(e => e.timestamp >= params.startDate!);
    }

    if (params.endDate) {
      events = events.filter(e => e.timestamp <= params.endDate!);
    }

    // Sort by timestamp desc
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const offset = params.offset || 0;
    const limit = params.limit || 100;
    
    return events.slice(offset, offset + limit);
  }

  async health(): Promise<{ healthy: boolean; lag?: number }> {
    return { healthy: true, lag: 0 };
  }

  // For testing
  clearHistory(): void {
    this.eventHistory = [];
  }

  getHistory(): DomainEvent[] {
    return [...this.eventHistory];
  }
}
