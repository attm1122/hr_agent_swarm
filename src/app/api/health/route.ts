/**
 * Health Check API
 * 
 * Provides endpoints for monitoring system health:
 * - /api/health - Basic health status
 * 
 * Used by:
 * - Load balancers for health checks
 * - Monitoring systems
 * - Deployment validation
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/infrastructure/database/client';

interface HealthCheck {
  status: 'pass' | 'fail' | 'warn';
  responseTime?: number;
  message?: string;
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    database: HealthCheck;
    memory: HealthCheck;
  };
}

// Track startup time
const startupTime = Date.now();

/**
 * Check database connectivity
 */
async function checkDatabase(): Promise<HealthCheck> {
  const start = Date.now();
  
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from('tenants').select('id').limit(1);
    
    const responseTime = Date.now() - start;
    
    if (error) {
      return {
        status: 'fail',
        responseTime,
        message: `Database query failed: ${error.message}`,
      };
    }
    
    return {
      status: responseTime > 1000 ? 'warn' : 'pass',
      responseTime,
      message: 'Database connection successful',
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown database error';
    return {
      status: 'fail',
      message: `Database connection failed: ${message}`,
    };
  }
}

/**
 * Check memory usage
 */
function checkMemory(): HealthCheck {
  const usage = process.memoryUsage();
  const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
  const usagePercent = Math.round((usage.heapUsed / usage.heapTotal) * 100);
  
  let status: HealthCheck['status'] = 'pass';
  let message = `Memory usage: ${heapUsedMB}MB / ${heapTotalMB}MB (${usagePercent}%)`;
  
  if (usagePercent > 90) {
    status = 'fail';
    message = `Critical memory usage: ${usagePercent}%`;
  } else if (usagePercent > 75) {
    status = 'warn';
    message = `High memory usage: ${usagePercent}%`;
  }
  
  return { status, message };
}

/**
 * GET /api/health
 * Basic health check for load balancers
 */
export async function GET(req: NextRequest) {
  try {
    const [dbCheck, memoryCheck] = await Promise.all([
      checkDatabase(),
      checkMemory(),
    ]);
    
    // Determine overall status
    let status: HealthStatus['status'] = 'healthy';
    if (dbCheck.status === 'fail' || memoryCheck.status === 'fail') {
      status = 'unhealthy';
    } else if (dbCheck.status === 'warn' || memoryCheck.status === 'warn') {
      status = 'degraded';
    }
    
    const health: HealthStatus = {
      status,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.1.0',
      uptime: Date.now() - startupTime,
      checks: {
        database: dbCheck,
        memory: memoryCheck,
      },
    };
    
    // Return 503 if unhealthy for load balancer to remove from pool
    const statusCode = status === 'unhealthy' ? 503 : 200;
    
    return NextResponse.json(health, { 
      status: statusCode,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Health check failed';
    
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '0.1.0',
        error: message,
      },
      { 
        status: 503,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }
    );
  }
}

/**
 * HEAD /api/health
 * Lightweight health check for load balancers
 */
export async function HEAD() {
  try {
    const dbCheck = await checkDatabase();
    const status = dbCheck.status === 'pass' ? 200 : 503;
    
    return new NextResponse(null, {
      status,
      headers: {
        'X-Health-Status': dbCheck.status,
        'Cache-Control': 'no-cache',
      },
    });
  } catch {
    return new NextResponse(null, { status: 503 });
  }
}
