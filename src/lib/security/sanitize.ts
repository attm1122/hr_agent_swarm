/**
 * Input Sanitization and Output Encoding Module
 * Prevents XSS, injection attacks, and unsafe content rendering.
 *
 * Controls:
 * 1. HTML entity encoding for display
 * 2. Script tag removal (multi-vector)
 * 3. Attribute sanitization
 * 4. URL validation (with SSRF protection)
 * 5. SQL-like pattern detection (defense in depth)
 * 6. Prototype-pollution prevention
 *
 * IMPORTANT — Regex flags:
 *   Detection patterns (used with .test()) MUST NOT have the /g flag.
 *   JavaScript RegExp with /g is stateful: `.test()` mutates `lastIndex`,
 *   so a second call on the same input may return the opposite result.
 *   Only the *stripping* patterns (used with .replace()) carry /g.
 */

// =========================================================================
// XSS Detection — patterns that indicate malicious content
// =========================================================================

/**
 * Detection patterns — used with .test(), so NO /g flag.
 * Covers OWASP XSS cheat sheet vectors including:
 *   - Script tags (with attribute / self-closing variants)
 *   - javascript:/vbscript: protocol handlers
 *   - Inline event handlers (onclick, onerror, onload, …)
 *   - Dangerous embed tags (iframe, object, embed, applet, base, form)
 *   - Data URIs that can execute (text/html, SVG+xml with base64)
 *   - SVG/MathML execution contexts
 *   - CSS expression() / url("javascript:…")
 *   - HTML entity / Unicode escape obfuscation
 */
const XSS_DETECT: RegExp[] = [
  // --- Tag-based vectors ---
  /<script[\s>\/]/i,
  /<\/script\s*>/i,
  /<iframe[\s>\/]/i,
  /<object[\s>\/]/i,
  /<embed[\s>\/]/i,
  /<applet[\s>\/]/i,
  /<base[\s>\/]/i,
  /<form[\s>\/]/i,
  /<link[\s][^>]*\brel\s*=\s*["']?import/i,

  // --- SVG / MathML execution ---
  /<svg[\s>\/]/i,
  /<math[\s>\/]/i,

  // --- Protocol handlers ---
  /javascript\s*:/i,
  /vbscript\s*:/i,
  /livescript\s*:/i,

  // --- Event handlers (on* attributes) ---
  /\bon\w+\s*=/i,

  // --- Data URIs with executable MIME types ---
  /data\s*:\s*text\/html/i,
  /data\s*:\s*image\/svg\+xml/i,
  /data\s*:[^;]*;base64/i,

  // --- CSS expression / moz-binding ---
  /expression\s*\(/i,
  /-moz-binding\s*:/i,

  // --- Obfuscation: HTML entity encoding of "<script" ---
  // &#60;script  /  &#x3c;script  /  &#X3C;script
  /&#(?:0*60|x0*3c)\s*;?\s*s\s*c\s*r\s*i\s*p\s*t/i,

  // --- Obfuscation: Unicode escape sequences ---
  // \u003cscript  (commonly used in JSON injection)
  /\\u003c\s*s\s*c\s*r\s*i\s*p\s*t/i,
  /\\u0073\s*c\s*r\s*i\s*p\s*t/i, // \u0073 = 's'

  // --- Null-byte injection (bypass WAF by inserting \0 inside tags) ---
  /<\x00[a-z]/i,
  /\x00/,  // Any null byte is suspicious in user input

  // --- Import / dynamic import ---
  /import\s*\(/i,
];

/**
 * Stripping patterns — used with .replace(), so they carry /gi.
 * These must be broader to actually remove the dangerous content.
 */
const XSS_STRIP: RegExp[] = [
  /<script[^>]*>[\s\S]*?<\/script\s*>/gi,
  /<script[^>]*\/?>/gi,
  /javascript\s*:/gi,
  /vbscript\s*:/gi,
  /livescript\s*:/gi,
  /\bon\w+\s*=[^>]*/gi,
  /<iframe[^>]*>[\s\S]*?<\/iframe\s*>/gi,
  /<object[^>]*>[\s\S]*?<\/object\s*>/gi,
  /<embed[^>]*\/?>/gi,
  /<applet[^>]*>[\s\S]*?<\/applet\s*>/gi,
  /<base[^>]*\/?>/gi,
  /<form[^>]*>[\s\S]*?<\/form\s*>/gi,
  /<svg[^>]*>[\s\S]*?<\/svg\s*>/gi,
  /<math[^>]*>[\s\S]*?<\/math\s*>/gi,
  /data\s*:\s*text\/html[^'"]*/gi,
  /data\s*:\s*image\/svg\+xml[^;]*;base64[^'"]*/gi,
  /expression\s*\([^)]*\)/gi,
  /-moz-binding\s*:[^;}]*/gi,
  /&#(?:0*60|x0*3c)\s*;?/gi, // encoded <
];

// =========================================================================
// SQL Injection Detection — defense-in-depth (parameterised queries are primary)
// =========================================================================

/**
 * SQL detection patterns — NO /g flag.
 * Covers: tautology, UNION, stacked queries, comments, stored procs,
 * time-based blind (WAITFOR/BENCHMARK/SLEEP), hex strings,
 * INFORMATION_SCHEMA probing, nested comment obfuscation.
 */
const SQL_DETECT: RegExp[] = [
  // Tautology: ' OR 1=1, " OR ""="
  /['"][\s]*(?:OR|AND)[\s]+['"]?\w*['"]?\s*=\s*['"]?\w*['"]?/i,
  // Classic ' OR '1'='1
  /'\s*OR\s+'[^']*'\s*=\s*'[^']*'/i,

  // UNION SELECT
  /UNION[\s/*(]+(?:ALL[\s/*(]+)?SELECT/i,

  // Stacked queries: ; DROP TABLE
  /;\s*(?:DROP|ALTER|CREATE|TRUNCATE|INSERT|UPDATE|DELETE|EXEC|EXECUTE)\b/i,

  // SQL comment markers that truncate queries
  /--\s/,
  /\/\*[\s\S]*?\*\//,  // block comment
  /\/\*!/,              // MySQL conditional comment

  // Extended stored procedures
  /\bxp_\w+/i,
  /\bexec\s*\(/i,
  /\bEXECUTE\s+\w/i,

  // Time-based blind injection
  /WAITFOR\s+DELAY/i,
  /BENCHMARK\s*\(/i,
  /SLEEP\s*\(/i,
  /pg_sleep\s*\(/i,

  // INFORMATION_SCHEMA probing
  /INFORMATION_SCHEMA\b/i,
  /sys\.\w+columns\b/i,

  // Hex-encoded strings (0x followed by hex digits)
  /0x[0-9a-f]{8,}/i,

  // INTO OUTFILE / LOAD_FILE
  /INTO\s+(?:OUT|DUMP)FILE/i,
  /LOAD_FILE\s*\(/i,

  // Encoded single-quote (%27) followed by SQL keyword
  /%27[\s\S]*?(?:OR|AND|UNION|SELECT|DROP|INSERT|UPDATE|DELETE)/i,
];

// =========================================================================
// Prototype pollution — blocked keys
// =========================================================================

const POISON_KEYS = new Set([
  '__proto__',
  'constructor',
  'prototype',
  '__defineGetter__',
  '__defineSetter__',
  '__lookupGetter__',
  '__lookupSetter__',
]);

// =========================================================================
// Public API
// =========================================================================

/**
 * HTML entity encoding for safe display.
 * Encodes &, <, >, ", ', / and backtick.
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
    '`': '&#96;',
  };

  return text.replace(/[&<>"'\/`]/g, (s) => entityMap[s] || s);
}

/**
 * Remove dangerous HTML content entirely.
 * Uses the *stripping* regexes (with /g) so all occurrences are removed.
 */
export function stripDangerousHtml(text: string): string {
  if (typeof text !== 'string') return '';

  let sanitized = text;
  for (const pattern of XSS_STRIP) {
    // Reset lastIndex before each replace (belt-and-braces for /g regexes)
    pattern.lastIndex = 0;
    sanitized = sanitized.replace(pattern, '');
  }

  return sanitized;
}

/**
 * Sanitize user input for storage.
 * Removes dangerous content while preserving safe text.
 */
export function sanitizeInput(text: string): string {
  if (typeof text !== 'string') return '';

  // Step 1: Remove null bytes (bypass vector)
  let sanitized = text.replace(/\x00/g, '');

  // Step 2: Remove control characters (except newline, tab, carriage return)
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Step 3: Strip dangerous HTML
  sanitized = stripDangerousHtml(sanitized);

  // Step 4: Normalize whitespace
  sanitized = sanitized.replace(/\s+/g, ' ').trim();

  // Step 5: Limit length (prevent DoS via huge strings)
  const MAX_LENGTH = 10_000;
  if (sanitized.length > MAX_LENGTH) {
    sanitized = sanitized.substring(0, MAX_LENGTH);
  }

  return sanitized;
}

/** Maximum recursion depth for object sanitization. */
const MAX_OBJECT_DEPTH = 20;

/**
 * Sanitize an entire object recursively.
 *
 * - Blocks prototype-pollution keys (__proto__, constructor, prototype, …)
 * - Enforces a recursion depth limit to prevent stack-overflow DoS
 * - Sanitises string values via `sanitizeInput`
 * - Passes through numbers, booleans, and null unchanged
 */
export function sanitizeObject<T extends Record<string, unknown>>(
  obj: T,
  _depth: number = 0,
): T {
  if (_depth > MAX_OBJECT_DEPTH) {
    // Depth limit — return empty object to prevent stack overflow
    return {} as T;
  }

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    // Block prototype-pollution keys
    if (POISON_KEYS.has(key)) {
      continue;
    }

    // Sanitize keys (prevent injection via key names)
    const safeKey = sanitizeInput(key).replace(/[^a-zA-Z0-9_.-]/g, '_');
    if (!safeKey) continue; // Skip if key sanitises to nothing

    if (typeof value === 'string') {
      result[safeKey] = sanitizeInput(value);
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      result[safeKey] = value;
    } else if (value === null) {
      result[safeKey] = null;
    } else if (Array.isArray(value)) {
      result[safeKey] = value.map((item) =>
        typeof item === 'string'
          ? sanitizeInput(item)
          : typeof item === 'object' && item !== null
            ? sanitizeObject(item as Record<string, unknown>, _depth + 1)
            : item,
      );
    } else if (typeof value === 'object') {
      result[safeKey] = sanitizeObject(
        value as Record<string, unknown>,
        _depth + 1,
      );
    } else {
      // Skip functions, symbols, undefined
      result[safeKey] = undefined;
    }
  }

  return result as T;
}

/**
 * Check if text contains SQL injection patterns.
 * Returns true if suspicious patterns detected.
 *
 * NOTE: This is defense-in-depth only. Parameterised queries are the
 * primary defense — this catches obvious probes before they reach the DB
 * layer and feeds the audit log.
 */
export function containsSqlInjection(text: string): boolean {
  if (typeof text !== 'string') return false;
  return SQL_DETECT.some((pattern) => pattern.test(text));
}

/**
 * Check if text contains XSS patterns.
 * Returns true if dangerous content detected.
 */
export function containsXss(text: string): boolean {
  if (typeof text !== 'string') return false;
  return XSS_DETECT.some((pattern) => pattern.test(text));
}

/**
 * Validate and sanitize email address.
 */
export function sanitizeEmail(email: string): string | null {
  if (typeof email !== 'string') return null;

  // Basic email pattern
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const trimmed = email.trim().toLowerCase();

  if (!emailPattern.test(trimmed)) return null;
  if (trimmed.length > 254) return null; // RFC 5321 max

  // Additional safety: encode special chars
  return encodeHtml(trimmed);
}

/** Private IP ranges that indicate SSRF attempts in production. */
const PRIVATE_HOSTNAMES = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '[::1]',       // IPv6 loopback
  '[::]',        // IPv6 any
  '[::ffff:127.0.0.1]', // IPv4-mapped IPv6 loopback
];

function isPrivateIp(hostname: string): boolean {
  const lower = hostname.toLowerCase();

  // Exact matches
  if (PRIVATE_HOSTNAMES.includes(lower)) return true;

  // Remove brackets for IPv6 comparison
  const bare = lower.replace(/^\[|\]$/g, '');

  // RFC 1918 ranges
  if (/^10\./.test(bare)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(bare)) return true;
  if (/^192\.168\./.test(bare)) return true;

  // Link-local
  if (/^169\.254\./.test(bare)) return true;

  // Cloud metadata endpoints
  if (bare === '169.254.169.254') return true;

  // IPv6 private prefixes
  if (/^f[cd][0-9a-f]{2}:/i.test(bare)) return true; // ULA
  if (/^fe80:/i.test(bare)) return true;              // link-local

  return false;
}

/**
 * Validate and sanitize URL.
 * Only allows http/https protocols. Blocks SSRF targets in production.
 */
export function sanitizeUrl(url: string): string | null {
  if (typeof url !== 'string') return null;

  try {
    const parsed = new URL(url);

    // Only allow http/https
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }

    // Block private/internal IPs in production (SSRF prevention)
    if (process.env.NODE_ENV === 'production' && isPrivateIp(parsed.hostname)) {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Sanitize file name to prevent path traversal.
 */
export function sanitizeFilename(filename: string): string | null {
  if (typeof filename !== 'string') return null;

  // Remove null bytes first (bypass vector)
  let sanitized = filename.replace(/\x00/g, '');

  // Remove path traversal attempts: ../ and ..\ (all encodings)
  sanitized = sanitized.replace(/\.\.[\\/]/g, '');
  sanitized = sanitized.replace(/%2e%2e[%2f%5c]/gi, '');
  sanitized = sanitized.replace(/\.\.$/g, '');

  // Replace directory separators with underscores
  sanitized = sanitized.replace(/[\\/]/g, '_');

  // Remove characters that are dangerous on various OS
  sanitized = sanitized.replace(/[<>:"|?*\x00-\x1F]/g, '');

  // Limit length
  if (sanitized.length > 255) {
    sanitized = sanitized.substring(0, 255);
  }

  // Ensure not empty and not just dots
  if (!sanitized || /^\.+$/.test(sanitized)) {
    return null;
  }

  return sanitized;
}

/**
 * Validate ID format (alphanumeric, hyphen, underscore only).
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
 * Create safe JSON string (prevents injection in JSON/HTML contexts).
 */
export function safeJsonStringify(obj: unknown): string {
  return JSON.stringify(obj, (_key, value) => {
    if (typeof value === 'string') {
      // Escape characters that could break out of JSON embedded in HTML
      return value
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/&/g, '\\u0026')
        .replace(/\u2028/g, '\\u2028')  // Line separator
        .replace(/\u2029/g, '\\u2029'); // Paragraph separator
    }
    return value;
  });
}

/**
 * Log sanitization event for security monitoring.
 */
export function logSanitizationEvent(
  type: 'xss_detected' | 'sql_detected' | 'input_cleaned',
  original: string,
  sanitized: string,
  source: string,
): void {
  // Always log in production; in dev it's just noise
  if (process.env.NODE_ENV === 'production') {
    const { securityLog } = require('./logger');
    securityLog.warn('sanitize', `${type} detected in ${source}`, {
      type,
      source,
      originalLength: original.length,
      sanitizedLength: sanitized.length,
      // Never log the actual payload — it could be exfiltrated via logs
    });
  }
}
