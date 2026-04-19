/**
 * Outbox Pattern Implementation
 * 
 * Ensures reliable event publishing by:
 * 1. Storing events in the outbox table within the same transaction as business data
 * 2. Asynchronously processing outbox events and publishing to event bus
 * 3. Handling retries and dead letter scenarios
 * 
 * This guarantees at-least-once delivery even if the event bus is temporarily unavailable.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, OutboxEvent } from '@/types/database';
import type { EventBusPort, DomainEvent } from '@/lib/ports';
import { createId } from '@/lib/utils/ids';

export interface OutboxEventInput {
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  headers?: Record<string, string>;
  userId?: string;
  correlationId?: string;
  causationId?: string;
  version?: number;
}

export class OutboxService {
  constructor(
    private supabase: SupabaseClient<Database>,
    private eventBus?: EventBusPort
  ) {}

  /**
   * Store an event in the outbox within a transaction
   * This should be called within a Supabase RPC transaction
   */
  async scheduleEvent(
    tenantId: string,
    input: OutboxEventInput
  ): Promise<void> {
    const { error } = await this.supabase
      .from('outbox_events')
      .insert({
        tenant_id: tenantId,
        event_type: input.eventType,
        aggregate_type: input.aggregateType,
        aggregate_id: input.aggregateId,
        payload: input.payload,
        headers: {
          ...(input.headers || {}),
          userId: input.userId,
          correlationId: input.correlationId,
          causationId: input.causationId,
          version: String(input.version || 1),
        },
        status: 'pending',
        retry_count: 0,
      } as never);

    if (error) {
      throw new Error(`Failed to schedule outbox event: ${error.message}`);
    }
  }

  /**
   * Store multiple events in the outbox within a transaction
   */
  async scheduleEvents(
    tenantId: string,
    inputs: OutboxEventInput[]
  ): Promise<void> {
    if (inputs.length === 0) return;

    const events = inputs.map(input => ({
      tenant_id: tenantId,
      event_type: input.eventType,
      aggregate_type: input.aggregateType,
      aggregate_id: input.aggregateId,
      payload: input.payload,
      headers: {
        ...(input.headers || {}),
        userId: input.userId,
        correlationId: input.correlationId,
        causationId: input.causationId,
        version: String(input.version || 1),
      },
      status: 'pending',
      retry_count: 0,
    }));

    const { error } = await this.supabase
      .from('outbox_events')
      .insert(events as never);

    if (error) {
      throw new Error(`Failed to schedule outbox events: ${error.message}`);
    }
  }

  /**
   * Process pending outbox events
   * Call this periodically (e.g., via cron job or background worker)
   */
  async processPendingEvents(batchSize: number = 100): Promise<{
    processed: number;
    failed: number;
  }> {
    if (!this.eventBus) {
      throw new Error('EventBus not configured');
    }

    // Fetch pending events
    const { data: events, error } = await this.supabase
      .from('outbox_events')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(batchSize);

    if (error) {
      throw new Error(`Failed to fetch pending events: ${error.message}`);
    }

    let processed = 0;
    let failed = 0;

    for (const event of (events || []) as OutboxEvent[]) {
      try {
        await this.processEvent(event);
        processed++;
      } catch (err) {
        await this.markEventFailed(event, err instanceof Error ? err.message : 'Unknown error');
        failed++;
      }
    }

    return { processed, failed };
  }

  /**
   * Process a single outbox event
   */
  private async processEvent(event: OutboxEvent): Promise<void> {
    // Mark as processing
    const { error: processingError } = await this.supabase
      .from('outbox_events')
      .update({
        status: 'processing',
        retry_count: event.retry_count + 1,
      } as never)
      .eq('id', event.id)
      .eq('tenant_id', event.tenant_id);

    if (processingError) {
      throw new Error(`Failed to mark event as processing: ${processingError.message}`);
    }

    // Convert outbox event to DomainEvent
    const headers = (event.headers || {}) as Record<string, string>;
    const domainEvent: DomainEvent = {
      id: createId(),
      type: event.event_type,
      payload: event.payload,
      timestamp: new Date().toISOString(),
      correlationId: headers.correlationId || createId(),
      causationId: headers.causationId,
      tenantId: event.tenant_id,
      userId: headers.userId,
      version: parseInt(headers.version || '1', 10),
    };

    await this.eventBus!.publish(domainEvent);

    // Mark as completed
    const { error: completeError } = await this.supabase
      .from('outbox_events')
      .update({
        status: 'completed',
        processed_at: new Date().toISOString(),
      } as never)
      .eq('id', event.id)
      .eq('tenant_id', event.tenant_id);

    if (completeError) {
      throw new Error(`Failed to mark event as completed: ${completeError.message}`);
    }
  }

  /**
   * Mark an event as failed
   */
  private async markEventFailed(event: OutboxEvent, errorMessage: string): Promise<void> {
    const maxRetries = 3;
    const status = event.retry_count >= maxRetries ? 'failed' : 'pending';

    await this.supabase
      .from('outbox_events')
      .update({
        status,
        error_message: errorMessage,
      } as never)
      .eq('id', event.id)
      .eq('tenant_id', event.tenant_id);
  }

  /**
   * Retry failed events
   */
  async retryFailedEvents(maxAgeHours: number = 24): Promise<number> {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - maxAgeHours);

    const { data, error } = await this.supabase
      .from('outbox_events')
      .update({ status: 'pending', error_message: null } as never)
      .eq('status', 'failed')
      .gte('created_at', cutoff.toISOString())
      .select('id');

    if (error) {
      throw new Error(`Failed to retry events: ${error.message}`);
    }

    return (data || []).length;
  }

  /**
   * Clean up old completed events
   */
  async cleanupOldEvents(olderThanDays: number = 30): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);

    const { error, count } = await this.supabase
      .from('outbox_events')
      .delete()
      .eq('status', 'completed')
      .lt('processed_at', cutoff.toISOString());

    if (error) {
      throw new Error(`Failed to cleanup old events: ${error.message}`);
    }

    return count || 0;
  }
}
