/**
 * Redis-Backed CSRF Protection
 * 
 * Production-ready CSRF token storage that works across multiple instances.
 */

import type { CachePort } from '@/lib/ports';

export interface CSRFConfig {
  secret: string;
  cookieName?: string;
  headerName?: string;
  tokenTTLSeconds?: number;
}

export class RedisCSRFProtection {
  private config: Required<CSRFConfig>;

  constructor(
    private cache: CachePort,
    config: CSRFConfig
  ) {
    this.config = {
      secret: config.secret,
      cookieName: config.cookieName || 'csrf_token',
      headerName: config.headerName || 'X-CSRF-Token',
      tokenTTLSeconds: config.tokenTTLSeconds || 3600, // 1 hour
    };
  }

  /**
   * Generate a new CSRF token for a session
   */
  async generateToken(sessionId: string): Promise<string> {
    const token = this.createToken();
    await this.cache.storeCsrfToken(sessionId, token, this.config.tokenTTLSeconds);
    return token;
  }

  /**
   * Validate a CSRF token
   */
  async validateToken(sessionId: string, token: string): Promise<boolean> {
    if (!sessionId || !token) return false;
    return await this.cache.validateCsrfToken(sessionId, token);
  }

  /**
   * Revoke a CSRF token
   */
  async revokeToken(sessionId: string): Promise<void> {
    await this.cache.revokeCsrfToken(sessionId);
  }

  private createToken(): string {
    // Generate a secure random token
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  getHeaderName(): string {
    return this.config.headerName;
  }

  getCookieName(): string {
    return this.config.cookieName;
  }
}
