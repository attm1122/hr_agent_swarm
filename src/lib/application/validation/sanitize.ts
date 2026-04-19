import { logger } from '@/lib/observability/logger';

/**
 * Input Sanitization and Output Encoding Module
 * Prevents XSS, injection attacks, and unsafe content rendering.
 * 
 * Controls:
 * 1. HTML entity encoding for display
 * 2. Script tag removal
 * 3. Attribute sanitization
 * 4. URL validation
 * 5. SQL-like pattern detection (defense in depth)
 */

// Dangerous patterns that should never appear in user content
const DANGEROUS_PATTERNS = [
  /<script[^>]*>.*?<\/script>/gi,
  /<script[^>]*\/>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,  // onclick, onerror, etc.
  /<iframe[^>]*>.*?<\/iframe>/gi,
  /<object[^>]*>.*?<\/object>/gi,
  /<embed[^>]*\/?>/gi,
  /<applet[^>]*>.*?<\/applet>/gi,
  /data:text\/html/gi,
  /data:image\/svg[^;]*;base64/gi,  // SVG can contain scripts
];

// SQL injection patterns (defense in depth - parameterized queries are primary defense)
const SQL_PATTERNS = [
  /(\%27)|(\')|(\-\-)|(\%23)|(#)/gi,  // Single quote, comment
  /((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))/gi,  // = followed by dangerous chars
  /\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/gi,  // 'or' patterns
  /((\%27)|(\'))union/gi,
  /exec\s*\(/gi,
  /xp_/gi,  // Extended stored procedures
];

/**
 * HTML entity encoding for safe display
 */
export function encodeHtml(text: string): string {
  if (typeof text !== 'string') return '';
  
  const entityMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };
  
  return text.replace(/[&<>"'\/]/g, (s) => entityMap[s] || s);
}

/**
 * Remove dangerous HTML content entirely
 */
export function stripDangerousHtml(text: string): string {
  if (typeof text !== 'string') return '';
  
  let sanitized = text;
  
  for (const pattern of DANGEROUS_PATTERNS) {
    sanitized = sanitized.replace(pattern, '');
  }
  
  return sanitized;
}

/**
 * Sanitize user input for storage
 * Removes dangerous content while preserving safe text
 */
export function sanitizeInput(text: string): string {
  if (typeof text !== 'string') return '';
  
  // Step 1: Remove control characters
  let sanitized = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  // Step 2: Strip dangerous HTML
  sanitized = stripDangerousHtml(sanitized);
  
  // Step 3: Normalize whitespace
  sanitized = sanitized.replace(/\s+/g, ' ').trim();
  
  // Step 4: Limit length (prevent DoS via huge strings)
  const MAX_LENGTH = 10000;
  if (sanitized.length > MAX_LENGTH) {
    sanitized = sanitized.substring(0, MAX_LENGTH);
  }
  
  return sanitized;
}

/**
 * Sanitize an entire object recursively
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    // Sanitize keys too (prevent prototype pollution)
    const safeKey = sanitizeInput(key).replace(/[^a-zA-Z0-9_]/g, '_');
    
    if (typeof value === 'string') {
      result[safeKey] = sanitizeInput(value);
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      result[safeKey] = value;
    } else if (value === null) {
      result[safeKey] = null;
    } else if (Array.isArray(value)) {
      result[safeKey] = value.map(item => 
        typeof item === 'string' ? sanitizeInput(item) :
        typeof item === 'object' && item !== null ? sanitizeObject(item as Record<string, unknown>) :
        item
      );
    } else if (typeof value === 'object') {
      result[safeKey] = sanitizeObject(value as Record<string, unknown>);
    } else {
      // Skip functions, symbols, undefined
      result[safeKey] = undefined;
    }
  }
  
  return result as T;
}

/**
 * Check if text contains SQL injection patterns
 * Returns true if suspicious patterns detected
 */
export function containsSqlInjection(text: string): boolean {
  if (typeof text !== 'string') return false;
  
  return SQL_PATTERNS.some(pattern => pattern.test(text));
}

/**
 * Check if text contains XSS patterns
 * Returns true if dangerous content detected
 */
export function containsXss(text: string): boolean {
  if (typeof text !== 'string') return false;
  
  return DANGEROUS_PATTERNS.some(pattern => pattern.test(text));
}

/**
 * Validate and sanitize email address
 */
export function sanitizeEmail(email: string): string | null {
  if (typeof email !== 'string') return null;
  
  // Basic email pattern
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const trimmed = email.trim().toLowerCase();
  
  if (!emailPattern.test(trimmed)) return null;
  
  // Additional safety: encode special chars
  return encodeHtml(trimmed);
}

/**
 * Validate and sanitize URL
 * Only allows http/https protocols
 */
export function sanitizeUrl(url: string): string | null {
  if (typeof url !== 'string') return null;
  
  try {
    const parsed = new URL(url);
    
    // Only allow http/https
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    
    // Block localhost/internal IPs in production
    const hostname = parsed.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('10.') || hostname.startsWith('192.168.')) {
      // Allow in development, block in production
      if (process.env.NODE_ENV === 'production') {
        return null;
      }
    }
    
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Sanitize file name to prevent path traversal
 */
export function sanitizeFilename(filename: string): string | null {
  if (typeof filename !== 'string') return null;
  
  // Remove path traversal attempts
  let sanitized = filename.replace(/\.\//g, '').replace(/\.\\/g, '');
  sanitized = sanitized.replace(/\//g, '_').replace(/\\\\/g, '_');
  
  // Remove null bytes
  sanitized = sanitized.replace(/\x00/g, '');
  
  // Limit length
  if (sanitized.length > 255) {
    sanitized = sanitized.substring(0, 255);
  }
  
  // Ensure not empty and has extension
  if (!sanitized || sanitized === '.' || sanitized === '..') {
    return null;
  }
  
  return sanitized;
}

/**
 * Validate ID format (alphanumeric, hyphen, underscore only)
 */
export function sanitizeId(id: string): string | null {
  if (typeof id !== 'string') return null;
  
  const trimmed = id.trim();
  const validPattern = /^[a-zA-Z0-9\-_]+$/;
  
  if (!validPattern.test(trimmed)) return null;
  if (trimmed.length > 100) return null;
  
  return trimmed;
}

/**
 * Create safe JSON string (prevents injection in JSON contexts)
 */
export function safeJsonStringify(obj: unknown): string {
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'string') {
      // Escape special characters for safe embedding in HTML <script> tags
      // U+2028 and U+2029 are valid in JSON but break JavaScript parsers
      return value
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/&/g, '\\u0026')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');
    }
    return value;
  });
}

/**
 * Log sanitization event for security monitoring
 */
export function logSanitizationEvent(
  type: 'xss_detected' | 'sql_detected' | 'input_cleaned',
  original: string,
  sanitized: string,
  source: string
): void {
  // In production: send to security monitoring service
  if (process.env.NODE_ENV === 'production') {
     
    logger.warn(`[SECURITY] ${type} in ${source}:`, {
      component: 'sanitize',
      timestamp: new Date().toISOString(),
      type,
      source,
      originalLength: original.length,
      sanitizedLength: sanitized.length,
    });
  }
}
