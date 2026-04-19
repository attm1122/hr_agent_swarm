/**
 * Security.txt — Well-Known Security Policy (RFC 9116)
 *
 * Serves the security policy at /.well-known/security.txt
 */

import { NextResponse } from 'next/server';

const SECURITY_TXT = `# Security Policy for HR Agent Swarm

# Contact
Contact: security@company.com

# Acknowledgments
Acknowledgments: https://company.com/security/hall-of-fame

# Policy
Policy: https://company.com/security/policy

# Preferred-Languages
Preferred-Languages: en

# Expires
Expires: 2027-04-18T00:00:00.000Z

# Canonical
Canonical: https://company.com/.well-known/security.txt
`;

export async function GET() {
  return new NextResponse(SECURITY_TXT, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
