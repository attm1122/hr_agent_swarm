/**
 * Integration Health Monitoring
 * 
 * Monitors external system connectivity and health:
 * - BambooHR API health
 * - Microsoft 365 Graph API
 * - HR3 system connectivity
 * - Slack webhook status
 * 
 * Provides:
 * - Health status dashboard data
 * - Last sync timestamps
 * - Error rate tracking
 * - Automatic retry logic recommendations
 */

import { checkIntegrationHealth as checkSecureIntegrationHealth } from '@/lib/security/secure-adapter';

export interface IntegrationHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  lastSync: string | null;
  lastError: string | null;
  errorCount24h: number;
  avgResponseTime: number;
  endpoint: string;
  // No credentials, no sensitive data
}

// In-memory health store (replace with persistent storage in production)
const healthStore: Map<string, IntegrationHealth> = new Map([
  ['bambooHR', {
    name: 'BambooHR',
    status: 'unknown',
    lastSync: null,
    lastError: null,
    errorCount24h: 0,
    avgResponseTime: 0,
    endpoint: 'api.bamboohr.com',
  }],
  ['microsoft365', {
    name: 'Microsoft 365',
    status: 'unknown',
    lastSync: null,
    lastError: null,
    errorCount24h: 0,
    avgResponseTime: 0,
    endpoint: 'graph.microsoft.com',
  }],
  ['hr3', {
    name: 'HR3',
    status: 'unknown',
    lastSync: null,
    lastError: null,
    errorCount24h: 0,
    avgResponseTime: 0,
    endpoint: 'hr3.company.internal',
  }],
  ['slack', {
    name: 'Slack',
    status: 'unknown',
    lastSync: null,
    lastError: null,
    errorCount24h: 0,
    avgResponseTime: 0,
    endpoint: 'hooks.slack.com',
  }],
]);

/**
 * Check all integration health statuses
 * Performs lightweight health checks (no heavy operations)
 */
export async function checkIntegrationHealth(): Promise<IntegrationHealth[]> {
  const results: IntegrationHealth[] = [];

  for (const [key, health] of healthStore) {
    const start = performance.now();
    
    try {
      // Use the secure adapter's health check
      const secureHealth = await checkSecureIntegrationHealth();
      const isHealthy = secureHealth[health.name] || false;
      
      const updated: IntegrationHealth = {
        ...health,
        status: isHealthy ? 'healthy' : 'degraded',
        lastSync: new Date().toISOString(),
        avgResponseTime: performance.now() - start,
        lastError: isHealthy ? null : 'Health check failed',
      };

      healthStore.set(key, updated);
      results.push(updated);
    } catch (error) {
      // Update with error state
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const updated: IntegrationHealth = {
        ...health,
        status: 'unhealthy',
        lastError: errorMessage,
        errorCount24h: health.errorCount24h + 1,
        avgResponseTime: performance.now() - start,
      };

      healthStore.set(key, updated);
      results.push(updated);
    }
  }

  return results;
}

/**
 * Get current integration status (without performing new checks)
 */
export function getIntegrationStatus(): IntegrationHealth[] {
  return Array.from(healthStore.values());
}

/**
 * Record integration sync result
 */
export function recordSyncResult(
  integration: string,
  success: boolean,
  error?: string,
  durationMs?: number
): void {
  const health = healthStore.get(integration);
  if (!health) return;

  const updated: IntegrationHealth = {
    ...health,
    lastSync: new Date().toISOString(),
    status: success ? 'healthy' : 'degraded',
    lastError: success ? null : error || 'Sync failed',
    errorCount24h: success ? health.errorCount24h : health.errorCount24h + 1,
    avgResponseTime: durationMs || health.avgResponseTime,
  };

  healthStore.set(integration, updated);
}

/**
 * Get integration health summary for dashboard
 */
export function getIntegrationSummary(): {
  total: number;
  healthy: number;
  degraded: number;
  unhealthy: number;
  unknown: number;
  lastChecked: string;
  criticalIssues: string[];
} {
  const all = Array.from(healthStore.values());
  
  const healthy = all.filter(i => i.status === 'healthy').length;
  const degraded = all.filter(i => i.status === 'degraded').length;
  const unhealthy = all.filter(i => i.status === 'unhealthy').length;
  const unknown = all.filter(i => i.status === 'unknown').length;

  // Critical issues: unhealthy integrations with recent errors
  const criticalIssues = all
    .filter(i => i.status === 'unhealthy' && i.errorCount24h > 3)
    .map(i => `${i.name}: ${i.lastError || 'Multiple failures'}`);

  // Last checked = most recent lastSync
  const lastChecked = all
    .map(i => i.lastSync)
    .filter(Boolean)
    .sort()
    .pop() || new Date().toISOString();

  return {
    total: all.length,
    healthy,
    degraded,
    unhealthy,
    unknown,
    lastChecked,
    criticalIssues,
  };
}

/**
 * Get sync recommendations based on health status
 */
export function getSyncRecommendations(): Array<{
  integration: string;
  recommendation: 'sync_now' | 'investigate' | 'pause_sync' | 'no_action';
  reason: string;
}> {
  const recommendations: Array<{
    integration: string;
    recommendation: 'sync_now' | 'investigate' | 'pause_sync' | 'no_action';
    reason: string;
  }> = [];

  for (const [key, health] of healthStore) {
    if (health.status === 'unhealthy' && health.errorCount24h > 5) {
      recommendations.push({
        integration: health.name,
        recommendation: 'pause_sync',
        reason: `Multiple failures (${health.errorCount24h} in 24h): ${health.lastError}`,
      });
    } else if (health.status === 'unhealthy') {
      recommendations.push({
        integration: health.name,
        recommendation: 'investigate',
        reason: `Service unhealthy: ${health.lastError}`,
      });
    } else if (health.status === 'degraded') {
      recommendations.push({
        integration: health.name,
        recommendation: 'investigate',
        reason: 'Service performance degraded',
      });
    } else if (!health.lastSync || 
               new Date(health.lastSync).getTime() < Date.now() - 24 * 60 * 60 * 1000) {
      recommendations.push({
        integration: health.name,
        recommendation: 'sync_now',
        reason: 'No sync in last 24 hours',
      });
    } else {
      recommendations.push({
        integration: health.name,
        recommendation: 'no_action',
        reason: 'Healthy',
      });
    }
  }

  return recommendations;
}
