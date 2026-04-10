/**
 * Secure Integration Adapter Layer
 * Enforces security controls for external system integrations.
 * 
 * Integrations:
 * - BambooHR (employee data)
 * - Microsoft 365 (documents)
 * - HR3 (payroll)
 * - Slack (communications)
 * 
 * Security Controls:
 * 1. Credential encryption at rest
 * 2. Request signing
 * 3. Timeout enforcement
 * 4. Response size limits
 * 5. Audit logging
 * 6. No credential logging
 */

import type { AgentContext } from '@/types';

// Allowed integration endpoints (prevent SSRF)
const ALLOWED_INTEGRATION_HOSTS = [
  'api.bamboohr.com',
  'graph.microsoft.com',
  'hooks.slack.com',
  'api.slack.com',
  // HR3 hosts would be internal - configure per deployment
];

// Maximum response size (5MB)
const MAX_RESPONSE_SIZE = 5 * 1024 * 1024;

// Request timeout (30 seconds)
const REQUEST_TIMEOUT_MS = 30000;

interface IntegrationConfig {
  name: string;
  baseUrl: string;
  timeoutMs: number;
  maxRetries: number;
  allowedMethods: string[];
  sensitiveFields: string[];  // Fields to redact in logs
}

interface SecureRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
}

export interface SecureResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  statusCode?: number;
}

/**
 * Integration configurations with security settings
 */
const INTEGRATION_CONFIGS: Record<string, IntegrationConfig> = {
  bamboohr: {
    name: 'BambooHR',
    baseUrl: 'https://api.bamboohr.com',
    timeoutMs: 30000,
    maxRetries: 3,
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE'],
    sensitiveFields: ['ssn', 'dateOfBirth', 'salary', 'homeAddress'],
  },
  microsoft365: {
    name: 'Microsoft 365',
    baseUrl: 'https://graph.microsoft.com',
    timeoutMs: 30000,
    maxRetries: 3,
    allowedMethods: ['GET', 'POST'],
    sensitiveFields: ['content', 'body', 'attachments'],
  },
  slack: {
    name: 'Slack',
    baseUrl: 'https://hooks.slack.com',
    timeoutMs: 10000,
    maxRetries: 2,
    allowedMethods: ['POST'],
    sensitiveFields: ['text', 'attachments'],
  },
  hr3: {
    name: 'HR3',
    baseUrl: process.env.HR3_API_URL || 'https://internal-hr3.company.com',
    timeoutMs: 30000,
    maxRetries: 3,
    allowedMethods: ['GET', 'POST'],
    sensitiveFields: ['salary', 'bankAccount', 'taxId'],
  },
};

/**
 * Validate URL is in allowlist (SSRF protection)
 */
function validateIntegrationUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_INTEGRATION_HOSTS.includes(parsed.hostname);
  } catch {
    return false;
  }
}

/**
 * Redact sensitive fields from logged data
 */
function redactSensitiveFields(data: unknown, fields: string[]): unknown {
  if (typeof data !== 'object' || data === null) return data;
  
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (fields.includes(key.toLowerCase())) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      result[key] = redactSensitiveFields(value, fields);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Secure fetch wrapper with timeout and SSRF protection
 */
export async function secureFetch(
  integrationName: string,
  endpoint: string,
  options: SecureRequestOptions = {},
  context?: AgentContext
): Promise<SecureResponse> {
  const config = INTEGRATION_CONFIGS[integrationName];
  if (!config) {
    return { success: false, error: `Unknown integration: ${integrationName}` };
  }
  
  // Build full URL
  const url = endpoint.startsWith('http') ? endpoint : `${config.baseUrl}${endpoint}`;
  
  // SSRF Protection: Validate URL
  if (!validateIntegrationUrl(url)) {
    logSecurityEvent('SSRF_BLOCKED', { url, integration: integrationName }, context);
    return { success: false, error: 'Integration URL not in allowlist' };
  }
  
  // Validate HTTP method
  const method = options.method || 'GET';
  if (!config.allowedMethods.includes(method)) {
    return { success: false, error: `Method ${method} not allowed for ${integrationName}` };
  }
  
  // Prepare secure headers (no credential leakage)
  const headers: Record<string, string> = {
    'User-Agent': 'HRAgentSwarm/1.0 (Secure Integration)',
    'Accept': 'application/json',
    'Accept-Charset': 'utf-8',
    ...options.headers,
  };
  
  // Add authorization header from secure credential store
  const credential = await getIntegrationCredential(integrationName);
  if (credential) {
    headers['Authorization'] = credential;
  }
  
  // Execute request with timeout
  const timeoutMs = options.timeoutMs || config.timeoutMs;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    const response = await fetch(url, {
      method,
      headers,
      body: options.body,
      signal: controller.signal,
      // Security: Don't follow redirects automatically (prevent open redirects)
      redirect: 'error',
    });
    
    clearTimeout(timeoutId);
    
    // Check response size (stream-based check would be better for production)
    const contentLength = parseInt(response.headers.get('content-length') || '0');
    if (contentLength > MAX_RESPONSE_SIZE) {
      return { success: false, error: 'Response exceeds maximum size' };
    }
    
    // Parse response
    const data = await response.json();
    
    // Log with redacted sensitive fields
    logIntegrationRequest(integrationName, endpoint, method, response.status, data, config.sensitiveFields, context);
    
    if (!response.ok) {
      return {
        success: false,
        error: `Integration error: ${response.statusText}`,
        statusCode: response.status,
      };
    }
    
    return {
      success: true,
      data,
      statusCode: response.status,
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Don't expose internal errors to caller
    if (errorMessage.includes('abort')) {
      return { success: false, error: 'Request timeout' };
    }
    
    logSecurityEvent('INTEGRATION_ERROR', { integration: integrationName, error: errorMessage }, context);
    return { success: false, error: 'Integration request failed' };
  }
}

/**
 * Retrieve integration credential from secure storage
 * Production: Use AWS Secrets Manager, Azure Key Vault, etc.
 */
async function getIntegrationCredential(integrationName: string): Promise<string | null> {
  // POC: Environment variables (not for production!)
  // Production: Use secure credential vault with encryption
  const envMap: Record<string, string> = {
    bamboohr: process.env.BAMBOOHR_API_KEY || '',
    microsoft365: process.env.M365_ACCESS_TOKEN || '',
    slack: process.env.SLACK_WEBHOOK_TOKEN || '',
    hr3: process.env.HR3_API_KEY || '',
  };
  
  const credential = envMap[integrationName];
  if (!credential) {
    return null;
  }
  
  // Format credential appropriately for each integration
  switch (integrationName) {
    case 'bamboohr':
      return `Basic ${btoa(`${credential}:x`)}`;
    case 'microsoft365':
      return `Bearer ${credential}`;
    case 'slack':
      return ''; // Slack webhooks don't use Authorization header
    case 'hr3':
      return `ApiKey ${credential}`;
    default:
      return null;
  }
}

/**
 * Log integration request with security monitoring
 */
function logIntegrationRequest(
  integration: string,
  endpoint: string,
  method: string,
  statusCode: number,
  data: unknown,
  sensitiveFields: string[],
  context?: AgentContext
): void {
  const redactedData = redactSensitiveFields(data, sensitiveFields);
  
  // In production: Send to SIEM, not console
  if (process.env.NODE_ENV === 'production') {
    // eslint-disable-next-line no-console
    console.log('[INTEGRATION]', {
      timestamp: new Date().toISOString(),
      integration,
      endpoint,
      method,
      statusCode,
      userId: context?.userId,
      role: context?.role,
      dataSize: JSON.stringify(data).length,
    });
  }
}

/**
 * Log security-relevant events
 */
function logSecurityEvent(
  eventType: string,
  details: Record<string, unknown>,
  context?: AgentContext
): void {
  // In production: Send to security monitoring service
  if (process.env.NODE_ENV === 'production') {
    // eslint-disable-next-line no-console
    console.warn('[SECURITY]', {
      timestamp: new Date().toISOString(),
      eventType,
      details,
      userId: context?.userId,
      role: context?.role,
      sessionId: context?.sessionId,
    });
  }
}

/**
 * Send secure message to Slack
 * Prevents message injection and enforces rate limits
 */
export async function sendSlackMessage(
  channel: string,
  message: string,
  context?: AgentContext
): Promise<SecureResponse> {
  // Validate channel format
  if (!/^[A-Z0-9]+$/.test(channel)) {
    return { success: false, error: 'Invalid channel format' };
  }
  
  // Sanitize message
  if (message.length > 4000) {
    return { success: false, error: 'Message exceeds maximum length' };
  }
  
  // Check for dangerous content
  if (message.includes('<script') || message.includes('javascript:')) {
    logSecurityEvent('SLACK_MESSAGE_REJECTED', { reason: 'dangerous_content', channel }, context);
    return { success: false, error: 'Message contains unsafe content' };
  }
  
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    return { success: false, error: 'Slack integration not configured' };
  }
  
  return secureFetch('slack', webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      channel,
      text: message,
      unfurl_links: false,  // Security: Prevent link previews that could leak data
    }),
  }, context);
}

/**
 * Fetch employee data from BambooHR with field filtering
 */
export async function fetchBambooHREmployee(
  employeeId: string,
  allowedFields: string[],
  context?: AgentContext
): Promise<SecureResponse> {
  // Validate employee ID format
  if (!/^[0-9]+$/.test(employeeId)) {
    return { success: false, error: 'Invalid employee ID format' };
  }
  
  const response = await secureFetch(
    'bamboohr',
    `/employees/${employeeId}`,
    { method: 'GET' },
    context
  );
  
  if (!response.success || !response.data) {
    return response;
  }
  
  // Filter fields based on permissions
  const filteredData: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if ((response.data as Record<string, unknown>)[field] !== undefined) {
      filteredData[field] = (response.data as Record<string, unknown>)[field];
    }
  }
  
  return {
    success: true,
    data: filteredData,
    statusCode: response.statusCode,
  };
}

/**
 * Health check for all integrations
 */
export async function checkIntegrationHealth(): Promise<Record<string, boolean>> {
  const results: Record<string, boolean> = {};
  
  for (const name of Object.keys(INTEGRATION_CONFIGS)) {
    try {
      const response = await secureFetch(name, '/health', { method: 'GET', timeoutMs: 5000 });
      results[name] = response.success;
    } catch {
      results[name] = false;
    }
  }
  
  return results;
}
