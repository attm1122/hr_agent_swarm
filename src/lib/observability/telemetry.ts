/**
 * Telemetry Module
 * 
 * Agent execution tracing, security monitoring, and performance metrics.
 * All telemetry excludes PII - uses role, intent, success/failure only.
 */

import type { AgentIntent, AgentType } from '@/types';

// ============================================
// Agent Execution Tracing
// ============================================

export interface AgentTrace {
  id: string;
  timestamp: string;
  agentType: AgentType;
  intent: AgentIntent;
  role: string;
  success: boolean;
  executionTimeMs: number;
  cacheHit?: boolean;
  errorType?: string;
  // No PII: no userId, no query content, no employee names
}

const agentTraces: AgentTrace[] = [];
const MAX_TRACES = 1000;

/**
 * Record agent execution trace
 * Excludes all PII - only intent, role, success, timing
 */
export function traceAgentExecution(
  agentType: AgentType,
  intent: AgentIntent,
  role: string,
  success: boolean,
  executionTimeMs: number,
  metadata?: {
    cacheHit?: boolean;
    errorType?: string;
  }
): void {
  const trace: AgentTrace = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    agentType,
    intent,
    role,
    success,
    executionTimeMs,
    cacheHit: metadata?.cacheHit,
    errorType: metadata?.errorType,
  };

  agentTraces.push(trace);

  // Maintain size limit
  if (agentTraces.length > MAX_TRACES) {
    agentTraces.shift();
  }

  // In production: send to observability platform
  if (process.env.NODE_ENV === 'production') {
    // sendToObservability(trace);
  }
}

/**
 * Get agent execution metrics
 */
export function getAgentMetrics(timeWindowMinutes: number = 60): {
  totalExecutions: number;
  successRate: number;
  avgExecutionTime: number;
  byAgent: Record<string, { count: number; successRate: number }>;
  byIntent: Record<string, { count: number; successRate: number }>;
  errors: Array<{ type: string; count: number }>;
} {
  const cutoff = new Date(Date.now() - timeWindowMinutes * 60 * 1000);
  const recent = agentTraces.filter(t => new Date(t.timestamp) > cutoff);

  const total = recent.length;
  const successful = recent.filter(t => t.success).length;

  // By agent type
  const byAgent: Record<string, { count: number; successRate: number }> = {};
  for (const trace of recent) {
    const key = trace.agentType;
    if (!byAgent[key]) {
      byAgent[key] = { count: 0, successRate: 0 };
    }
    byAgent[key].count++;
  }
  for (const key of Object.keys(byAgent)) {
    const agentTraces = recent.filter(t => t.agentType === key);
    const success = agentTraces.filter(t => t.success).length;
    byAgent[key].successRate = agentTraces.length > 0 ? success / agentTraces.length : 0;
  }

  // By intent
  const byIntent: Record<string, { count: number; successRate: number }> = {};
  for (const trace of recent) {
    const key = trace.intent;
    if (!byIntent[key]) {
      byIntent[key] = { count: 0, successRate: 0 };
    }
    byIntent[key].count++;
  }
  for (const key of Object.keys(byIntent)) {
    const intentTraces = recent.filter(t => t.intent === key);
    const success = intentTraces.filter(t => t.success).length;
    byIntent[key].successRate = intentTraces.length > 0 ? success / intentTraces.length : 0;
  }

  // Error aggregation
  const errorMap = new Map<string, number>();
  for (const trace of recent) {
    if (trace.errorType) {
      errorMap.set(trace.errorType, (errorMap.get(trace.errorType) || 0) + 1);
    }
  }

  return {
    totalExecutions: total,
    successRate: total > 0 ? successful / total : 0,
    avgExecutionTime: total > 0 
      ? recent.reduce((sum, t) => sum + t.executionTimeMs, 0) / total 
      : 0,
    byAgent,
    byIntent,
    errors: Array.from(errorMap.entries()).map(([type, count]) => ({ type, count })),
  };
}

// ============================================
// Security Event Monitoring
// ============================================

export interface SecurityMetric {
  id: string;
  timestamp: string;
  eventType: 'rate_limit_hit' | 'csrf_violation' | 'auth_failure' | 'rbac_denied' | 'suspicious_pattern';
  role: string;
  ipHash: string; // Hashed IP for privacy
  userAgentHash: string; // Hashed UA for privacy
  details: Record<string, unknown>;
}

const securityMetrics: SecurityMetric[] = [];
const MAX_SECURITY_METRICS = 500;

/**
 * Record security event for monitoring
 * Uses hashed identifiers for privacy
 */
export function recordSecurityEvent(
  eventType: SecurityMetric['eventType'],
  role: string,
  ipAddress: string,
  userAgent: string,
  details?: Record<string, unknown>
): void {
  // Simple hash function for privacy
  const hashString = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  };

  const metric: SecurityMetric = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    eventType,
    role,
    ipHash: hashString(ipAddress),
    userAgentHash: hashString(userAgent),
    details: details || {},
  };

  securityMetrics.push(metric);

  if (securityMetrics.length > MAX_SECURITY_METRICS) {
    securityMetrics.shift();
  }

  // Alert on critical security events
  if (eventType === 'csrf_violation' || eventType === 'suspicious_pattern') {
    console.warn('[SECURITY ALERT]', eventType, 'from role:', role);
    // In production: send to security team
  }
}

/**
 * Get security metrics for dashboard
 */
export function getSecurityMetrics(timeWindowMinutes: number = 60): {
  totalEvents: number;
  byType: Record<string, number>;
  byRole: Record<string, number>;
  topBlockedIps: Array<{ ipHash: string; count: number }>;
  alertCount: number;
} {
  const cutoff = new Date(Date.now() - timeWindowMinutes * 60 * 1000);
  const recent = securityMetrics.filter(m => new Date(m.timestamp) > cutoff);

  // By type
  const byType: Record<string, number> = {};
  for (const metric of recent) {
    byType[metric.eventType] = (byType[metric.eventType] || 0) + 1;
  }

  // By role
  const byRole: Record<string, number> = {};
  for (const metric of recent) {
    byRole[metric.role] = (byRole[metric.role] || 0) + 1;
  }

  // Top blocked IPs
  const ipCounts = new Map<string, number>();
  for (const metric of recent) {
    if (metric.eventType === 'rate_limit_hit' || metric.eventType === 'auth_failure') {
      ipCounts.set(metric.ipHash, (ipCounts.get(metric.ipHash) || 0) + 1);
    }
  }
  const topBlockedIps = Array.from(ipCounts.entries())
    .map(([ipHash, count]) => ({ ipHash, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Alert count (critical events)
  const alertCount = recent.filter(
    m => m.eventType === 'csrf_violation' || m.eventType === 'suspicious_pattern'
  ).length;

  return {
    totalEvents: recent.length,
    byType,
    byRole,
    topBlockedIps,
    alertCount,
  };
}

// ============================================
// Performance Metrics
// ============================================

export interface PerformanceMetric {
  id: string;
  timestamp: string;
  operation: string;
  durationMs: number;
  memoryDelta?: number;
  cacheHit?: boolean;
}

const performanceMetrics: PerformanceMetric[] = [];
const MAX_PERF_METRICS = 500;

/**
 * Record performance metric
 */
export function recordPerformanceMetric(
  operation: string,
  durationMs: number,
  metadata?: {
    memoryDelta?: number;
    cacheHit?: boolean;
  }
): void {
  const metric: PerformanceMetric = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    operation,
    durationMs,
    memoryDelta: metadata?.memoryDelta,
    cacheHit: metadata?.cacheHit,
  };

  performanceMetrics.push(metric);

  if (performanceMetrics.length > MAX_PERF_METRICS) {
    performanceMetrics.shift();
  }
}

/**
 * Get performance report
 */
export function getPerformanceReport(timeWindowMinutes: number = 60): {
  avgResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  byOperation: Record<string, { avg: number; count: number }>;
  cacheHitRate: number;
} {
  const cutoff = new Date(Date.now() - timeWindowMinutes * 60 * 1000);
  const recent = performanceMetrics.filter(m => new Date(m.timestamp) > cutoff);

  const durations = recent.map(m => m.durationMs).sort((a, b) => a - b);
  const avg = durations.length > 0 
    ? durations.reduce((a, b) => a + b, 0) / durations.length 
    : 0;

  const p95Index = Math.floor(durations.length * 0.95);
  const p99Index = Math.floor(durations.length * 0.99);

  // By operation
  const byOperation: Record<string, { avg: number; count: number }> = {};
  const opGroups = new Map<string, number[]>();
  for (const metric of recent) {
    const arr = opGroups.get(metric.operation) || [];
    arr.push(metric.durationMs);
    opGroups.set(metric.operation, arr);
  }
  for (const [op, times] of opGroups) {
    byOperation[op] = {
      avg: times.reduce((a, b) => a + b, 0) / times.length,
      count: times.length,
    };
  }

  // Cache hit rate
  const cacheMetrics = recent.filter(m => m.cacheHit !== undefined);
  const cacheHits = cacheMetrics.filter(m => m.cacheHit).length;

  return {
    avgResponseTime: avg,
    p95ResponseTime: durations[p95Index] || 0,
    p99ResponseTime: durations[p99Index] || 0,
    byOperation,
    cacheHitRate: cacheMetrics.length > 0 ? cacheHits / cacheMetrics.length : 0,
  };
}

// ============================================
// System Health Checks
// ============================================

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Array<{
    name: string;
    status: 'pass' | 'fail' | 'warn';
    message: string;
    latency: number;
  }>;
  timestamp: string;
}

/**
 * Check system health
 */
export function checkSystemHealth(): HealthStatus {
  const checks: HealthStatus['checks'] = [];
  const start = performance.now();

  // Memory check
  const memStart = performance.now();
  const memUsage = process.memoryUsage();
  const memHealthy = memUsage.heapUsed < 500 * 1024 * 1024; // 500MB threshold
  checks.push({
    name: 'memory',
    status: memHealthy ? 'pass' : 'warn',
    message: `Heap: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
    latency: performance.now() - memStart,
  });

  // Agent traces check
  const traceStart = performance.now();
  checks.push({
    name: 'agent_traces',
    status: agentTraces.length < MAX_TRACES ? 'pass' : 'warn',
    message: `${agentTraces.length}/${MAX_TRACES} traces stored`,
    latency: performance.now() - traceStart,
  });

  // Security metrics check
  const secStart = performance.now();
  checks.push({
    name: 'security_metrics',
    status: securityMetrics.length < MAX_SECURITY_METRICS ? 'pass' : 'warn',
    message: `${securityMetrics.length}/${MAX_SECURITY_METRICS} events stored`,
    latency: performance.now() - secStart,
  });

  // Determine overall status
  const hasFailures = checks.some(c => c.status === 'fail');
  const hasWarnings = checks.some(c => c.status === 'warn');
  const status = hasFailures ? 'unhealthy' : hasWarnings ? 'degraded' : 'healthy';

  return {
    status,
    checks,
    timestamp: new Date().toISOString(),
  };
}

// ============================================
// User Action Telemetry (Privacy-Safe)
// ============================================

const userActions: Array<{
  id: string;
  timestamp: string;
  action: string;
  role: string;
  success: boolean;
}> = [];

/**
 * Record user action (no PII)
 */
export function recordUserAction(
  action: string,
  role: string,
  success: boolean
): void {
  userActions.push({
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    action,
    role,
    success,
  });

  if (userActions.length > 1000) {
    userActions.shift();
  }
}

/**
 * Get dashboard metrics
 */
export function getDashboardMetrics(): {
  activeUsers: number;
  actionsLastHour: number;
  topActions: Array<{ action: string; count: number }>;
} {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recent = userActions.filter(a => new Date(a.timestamp) > oneHourAgo);

  // Unique roles as proxy for active users
  const activeRoles = new Set(recent.map(a => a.role));

  // Top actions
  const actionCounts = new Map<string, number>();
  for (const action of recent) {
    actionCounts.set(action.action, (actionCounts.get(action.action) || 0) + 1);
  }
  const topActions = Array.from(actionCounts.entries())
    .map(([action, count]) => ({ action, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    activeUsers: activeRoles.size,
    actionsLastHour: recent.length,
    topActions,
  };
}
