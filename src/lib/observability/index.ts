/**
 * Observability Module
 * 
 * Provides operational visibility for the HR Agent Swarm platform:
 * - Agent execution tracing
 * - Security event monitoring  
 * - Performance metrics
 * - Health checks
 * - Dashboard telemetry
 * 
 * Governance:
 * - No PII in telemetry
 * - Security events are high-cardinality
 * - Performance data is sampled
 * - Audit trail preserved
 */

export {
  // Agent tracing
  traceAgentExecution,
  getAgentMetrics,
  type AgentTrace,
  
  // Security monitoring
  recordSecurityEvent,
  getSecurityMetrics,
  type SecurityMetric,
  
  // Performance monitoring
  recordPerformanceMetric,
  getPerformanceReport,
  type PerformanceMetric,
  
  // Health checks
  checkSystemHealth,
  type HealthStatus,
  
  // Dashboard telemetry
  recordUserAction,
  getDashboardMetrics,
} from './telemetry';

export {
  // Integration health
  checkIntegrationHealth,
  getIntegrationStatus,
  type IntegrationHealth,
} from './integration-health';
