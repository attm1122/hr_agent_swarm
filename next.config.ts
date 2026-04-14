import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  // Security headers applied to all routes
  async headers() {
    // SECURITY: In production, strip 'unsafe-eval' from CSP. It is only needed
    // for Next.js HMR / React Fast Refresh in development. Leaving it in
    // production defeats CSP by allowing eval() and new Function().
    const scriptSrc = isProd
      ? "script-src 'self' 'unsafe-inline'"   // No unsafe-eval in production
      : "script-src 'self' 'unsafe-inline' 'unsafe-eval'"; // Required for Next.js HMR

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
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              scriptSrc,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' https://fonts.gstatic.com",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
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
            ].join(', '),
          },
        ],
      },
      // API routes get stricter CSP
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'none'; frame-ancestors 'none';",
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
};

export default nextConfig;
