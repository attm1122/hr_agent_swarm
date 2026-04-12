# Security Policy

## Supported Versions

The following versions of HR Agent Swarm are currently being supported with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

We take the security of HR Agent Swarm seriously. If you believe you have found a security vulnerability, please report it to us as described below.

### Please do not report security vulnerabilities through public GitHub issues.

Instead, please report them via email to **security@example.com** (replace with actual security contact).

You should receive a response within 48 hours. If for some reason you do not, please follow up via email to ensure we received your original message.

Please include the following information in your report:

- Type of issue (e.g., authentication bypass, XSS, SQL injection, etc.)
- Full paths of source file(s) related to the manifestation of the issue
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

## Security Best Practices

When deploying HR Agent Swarm, please ensure you follow these security best practices:

### Authentication & Authorization
- Use strong, unique passwords for all accounts
- Enable multi-factor authentication (MFA) where available
- Regularly review and update role permissions
- Use Clerk or another reputable auth provider in production

### Data Protection
- Enable Row-Level Security (RLS) on all database tables
- Use HTTPS/TLS for all communications
- Encrypt sensitive data at rest
- Regularly rotate API keys and secrets

### Infrastructure
- Keep all dependencies up to date
- Use environment variables for secrets (never commit them)
- Enable audit logging
- Set up monitoring and alerting

### Development
- Never disable authentication in production
- Validate all user inputs
- Use parameterized queries to prevent SQL injection
- Implement proper CSRF protection

## Security Features

HR Agent Swarm includes several built-in security features:

- **Row-Level Security (RLS)**: Database-level access control
- **CSRF Protection**: Token-based CSRF prevention
- **Rate Limiting**: Configurable request throttling
- **Audit Logging**: Comprehensive security event logging
- **Input Validation**: Strict input sanitization
- **Security Headers**: HSTS, CSP, X-Frame-Options, etc.

## Known Limitations

As this is a Proof-of-Concept (POC) project, there are some known security limitations:

- Mock authentication is used in development mode
- In-memory storage is used for some features (should use database in production)
- Some audit logs are buffered in memory (should use persistent storage)

Please review the [README.md](./README.md) for more information on production readiness.

## Security Updates

Security updates will be released as patch versions (e.g., 0.1.1). We recommend:

1. Subscribing to GitHub releases
2. Regularly checking for updates
3. Testing updates in a staging environment before production

## Acknowledgments

We would like to thank the following individuals who have responsibly disclosed security issues:

- *No disclosures yet*

## License

This security policy is provided under the same license as the project. See [LICENSE](./LICENSE) for details.
