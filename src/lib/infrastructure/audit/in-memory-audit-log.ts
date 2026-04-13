/**
 * In-Memory Audit Log - For development and testing
 */

import type { AuditLogPort, AuditLogEntry } from '@/lib/ports/infrastructure-ports';

export class InMemoryAuditLog implements AuditLogPort {
  private entries: AuditLogEntry[] = [];
  private maxEntries = 10000;

  async log(entry: AuditLogEntry): Promise<void> {
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }
  }

  async query(params: {
    tenantId: string;
    userId?: string;
    resourceType?: string;
    resourceId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<AuditLogEntry[]> {
    let results = this.entries.filter(e => e.tenantId === params.tenantId);

    if (params.userId) {
      results = results.filter(e => e.userId === params.userId);
    }
    if (params.resourceType) {
      results = results.filter(e => e.resourceType === params.resourceType);
    }
    if (params.resourceId) {
      results = results.filter(e => e.resourceId === params.resourceId);
    }
    if (params.startDate) {
      results = results.filter(e => e.timestamp >= params.startDate!);
    }
    if (params.endDate) {
      results = results.filter(e => e.timestamp <= params.endDate!);
    }

    results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const offset = params.offset || 0;
    const limit = params.limit || 100;
    return results.slice(offset, offset + limit);
  }

  async verifyIntegrity(): Promise<{ valid: boolean; tamperedEntries?: string[] }> {
    return { valid: true };
  }
}
