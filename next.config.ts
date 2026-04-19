import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Security headers applied to all routes
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // HSTS - force HTTPS for 2 years, include subdomains, preload list
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          // CSP - strict content security policy
          // NOTE: Next.js requires 'unsafe-inline' and 'unsafe-eval' for hydration.
          // For maximum security, implement nonce-based CSP in middleware.
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Required for Next.js
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self'",
              "connect-src 'self'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "upgrade-insecure-requests",
            ].join('; '),
          },
          // Prevent clickjacking
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          // Prevent MIME type sniffing
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          // XSS Protection (legacy browsers)
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          // Referrer policy
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          // Permissions policy - disable unnecessary features
          {
            key: 'Permissions-Policy',
            value: [
              'camera=()',
              'microphone=()',
              'geolocation=()',
              'payment=()',
              'usb=()',
              'magnetometer=()',
              'gyroscope=()',
              'accelerometer=()',
              'ambient-light-sensor=()',
              'autoplay=()',
              'battery=()',
              'display-capture=()',
              'document-domain=()',
              'encrypted-media=()',
              'fullscreen=()',
              'gamepad=()',
              'idle-detection=()',
              'interest-cohort=()',
              'midi=()',
              'navigation-override=()',
              'otp-credentials=()',
              'picture-in-picture=()',
              'publickey-credentials-get=()',
              'screen-wake-lock=()',
              'serial=()',
              'speaker-selection=()',
              'storage-access=()',
              'web-share=()',
              'xr-spatial-tracking=()',
            ].join(', '),
          },
          // Cross-Origin Opener Policy — prevents cross-origin window references
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          // Cross-Origin Embedder Policy — requires explicit CORP for cross-origin resources
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
          // Cross-Origin Resource Policy — this origin's resources can only be loaded same-origin
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'same-origin',
          },
          // Origin-Agent-Cluster — prevents synchronous cross-origin access
          {
            key: 'Origin-Agent-Cluster',
            value: '?1',
          },
          // DNS Prefetch Control — disable prefetching to prevent info leakage
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'off',
          },
          // Download Options — prevent IE from opening downloads in context
          {
            key: 'X-Download-Options',
            value: 'noopen',
          },
          // Expect-CT — enforce Certificate Transparency
          {
            key: 'Expect-CT',
            value: 'max-age=86400, enforce',
          },
        ],
      },
      // API routes get stricter CSP and no framing
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'none'; frame-ancestors 'none';",
          },
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'cross-origin',
          },
        ],
      },
      // Security.txt should be served with plain text
      {
        source: '/security.txt',
        headers: [
          {
            key: 'Content-Type',
            value: 'text/plain; charset=utf-8',
          },
        ],
      },
      {
        source: '/.well-known/security.txt',
        headers: [
          {
            key: 'Content-Type',
            value: 'text/plain; charset=utf-8',
          },
        ],
      },
    ];
  },

  // Security: Disable powered-by header
  poweredByHeader: false,

  // Security: Enable React strict mode for additional checks
  reactStrictMode: true,

  // Security: Configure image domains (whitelist only)
  images: {
    domains: [],
    remotePatterns: [],
  },

  // Output standalone build for Docker
  output: 'standalone',

  // Turbopack configuration
  turbopack: {
    // Resolve lockfile warning
    root: process.cwd(),
  },
};

export default nextConfig;
