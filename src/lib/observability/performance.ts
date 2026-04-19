/**
 * Performance Monitoring
 * 
 * Utilities for monitoring and tracking application performance.
 * Integrates with the agent run repository for timing data.
 */

import { getAgentRunRepository } from '@/lib/repositories';
import { logger } from '@/lib/observability/logger';

interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'bytes' | 'count' | 'percent';
  timestamp: string;
  context?: Record<string, unknown>;
}

interface PerformanceReport {
  timestamp: string;
  period: 'hour' | 'day' | 'week';
  metrics: {
    avgResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    errorRate: number;
    throughput: number;
  };
  topSlowQueries: Array<{
    intent: string;
    avgTime: number;
    count: number;
  }>;
}

// In-memory metrics buffer (flush periodically)
const metricsBuffer: PerformanceMetric[] = [];

/**
 * Record a performance metric
 */
export function recordMetric(
  name: string,
  value: number,
  unit: PerformanceMetric['unit'],
  context?: Record<string, unknown>
): void {
  const metric: PerformanceMetric = {
    name,
    value,
    unit,
    timestamp: new Date().toISOString(),
    context,
  };

  metricsBuffer.push(metric);

  // Flush if buffer gets too large
  if (metricsBuffer.length > 1000) {
    flushMetrics();
  }
}

/**
 * Time a function execution
 */
export async function timeExecution<T>(
  name: string,
  fn: () => Promise<T>,
  context?: Record<string, unknown>
): Promise<T> {
  const start = performance.now();
  
  try {
    const result = await fn();
    const duration = performance.now() - start;
    recordMetric(name, duration, 'ms', { ...context, status: 'success' });
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    recordMetric(name, duration, 'ms', { 
      ...context, 
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

/**
 * Generate performance report from agent runs
 */
export async function generatePerformanceReport(
  period: 'hour' | 'day' | 'week' = 'day'
): Promise<PerformanceReport> {
  const repo = getAgentRunRepository();
  
  // Calculate time range
  const hours = period === 'hour' ? 1 : period === 'day' ? 24 : 168;
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  
  // Query agent runs in the period
  const { records } = await repo.queryAgentRuns({
    startDate: since,
    limit: 10000,
  });
  
  if (records.length === 0) {
    return {
      timestamp: new Date().toISOString(),
      period,
      metrics: {
        avgResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        errorRate: 0,
        throughput: 0,
      },
      topSlowQueries: [],
    };
  }
  
  // Calculate response times
  const times = records
    .map(r => r.executionTimeMs)
    .filter((t): t is number => t !== null && t !== undefined)
    .sort((a, b) => a - b);
  
  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const p95Index = Math.floor(times.length * 0.95);
  const p99Index = Math.floor(times.length * 0.99);
  
  // Calculate error rate
  const errors = records.filter(r => !r.success).length;
  const errorRate = (errors / records.length) * 100;
  
  // Calculate throughput (requests per hour)
  const throughput = records.length / hours;
  
  // Find slowest intents
  const intentStats = new Map<string, { times: number[]; count: number }>();
  
  for (const record of records) {
    if (!record.executionTimeMs) continue;
    
    const existing = intentStats.get(record.intent);
    if (existing) {
      existing.times.push(record.executionTimeMs);
      existing.count++;
    } else {
      intentStats.set(record.intent, {
        times: [record.executionTimeMs],
        count: 1,
      });
    }
  }
  
  const topSlowQueries = Array.from(intentStats.entries())
    .map(([intent, stats]) => ({
      intent,
      avgTime: stats.times.reduce((a, b) => a + b, 0) / stats.count,
      count: stats.count,
    }))
    .sort((a, b) => b.avgTime - a.avgTime)
    .slice(0, 5);
  
  return {
    timestamp: new Date().toISOString(),
    period,
    metrics: {
      avgResponseTime: Math.round(avgTime),
      p95ResponseTime: times[p95Index] || 0,
      p99ResponseTime: times[p99Index] || 0,
      errorRate: Math.round(errorRate * 100) / 100,
      throughput: Math.round(throughput * 100) / 100,
    },
    topSlowQueries,
  };
}

/**
 * Flush metrics to persistent storage
 */
async function flushMetrics(): Promise<void> {
  if (metricsBuffer.length === 0) return;
  
  // In production, send to monitoring service (DataDog, New Relic, etc.)
  // For now, just log to console
  if (process.env.DEBUG === 'true') {
    logger.info('Performance metrics', { component: 'observability:performance', metrics: metricsBuffer });
  }
  
  // Clear buffer
  metricsBuffer.length = 0;
}

/**
 * Monitor memory usage
 */
export function monitorMemory(): PerformanceMetric {
  const usage = process.memoryUsage();
  
  return {
    name: 'memory_usage',
    value: usage.heapUsed,
    unit: 'bytes',
    timestamp: new Date().toISOString(),
    context: {
      heapTotal: usage.heapTotal,
      external: usage.external,
      rss: usage.rss,
    },
  };
}

/**
 * Create a performance marker for web vitals
 */
export function markPerformance(label: string): void {
  if (typeof performance !== 'undefined' && performance.mark) {
    performance.mark(label);
  }
}

/**
 * Measure between two performance marks
 */
export function measurePerformance(
  name: string,
  startLabel: string,
  endLabel: string
): number | null {
  if (typeof performance === 'undefined' || !performance.measure) {
    return null;
  }
  
  try {
    const measure = performance.measure(name, startLabel, endLabel);
    return measure.duration;
  } catch {
    return null;
  }
}

// Auto-flush metrics every 60 seconds
if (typeof setInterval !== 'undefined') {
  setInterval(flushMetrics, 60000);
}

// Flush on process exit
if (typeof process !== 'undefined') {
  process.on('beforeExit', () => {
    flushMetrics();
  });
}
