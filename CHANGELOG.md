# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Multi-agent orchestration system with coordinator pattern
- Repository layer with Supabase + local fallback
- Manager support agent for team insights and employee briefs
- Durable agent tracing and observability
- Idempotent store initialization for all data stores
- RLS policies for tenant isolation
- Export approval workflow
- Health check API endpoint
- GitHub issue templates (bug, feature, security)
- Pull request template
- Security policy
- Pre-commit hooks with husky and lint-staged
- E2E tests with Playwright
- CI/CD pipeline with GitHub Actions
- Database seed scripts and migration guide
- Comprehensive documentation (README, DEPLOYMENT, MIGRATION_GUIDE)

### Security
- Row-Level Security (RLS) policies on all tables
- Audit logging with integrity hashes
- CSRF protection
- Rate limiting
- Security headers (HSTS, CSP, etc.)
- Input validation and sanitization

## [0.1.0] - 2024-01-15

### Added
- Initial release
- Basic Next.js application structure
- Component library with shadcn/ui
- Employee management features
- Leave management
- Onboarding/offboarding workflows
- Basic RAG implementation for policy search
- Test suite with Vitest

### Features
- Dashboard with metrics
- Employee directory
- Leave balance tracking
- Document management
- Approval workflows
- Knowledge base search

[Unreleased]: https://github.com/attm1122/hr_agent_swarm/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/attm1122/hr_agent_swarm/releases/tag/v0.1.0
