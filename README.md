# HR Agent Swarm

**⚠️ IMPORTANT: This is a Proof-of-Concept (POC) Project**

This is a deterministic orchestration system demonstrating HR workflow automation with multi-agent patterns. It is NOT a true LLM "agent swarm" with autonomous model-driven behavior. AI features are simulated with rule-based logic for demonstration purposes.

**Production Readiness**: This codebase is intended for evaluation, architecture review, and as a foundation for production development. It requires additional hardening before production deployment.

---

## 🎯 Purpose

HR Agent Swarm demonstrates a modern architecture for HR management systems with:

- **Multi-agent orchestration** pattern with specialized domain agents
- **RAG (Retrieval-Augmented Generation)** pipeline for policy knowledge
- **Row-Level Security (RLS)** for multi-tenant data isolation
- **Comprehensive audit logging** for compliance
- **Approval workflows** for sensitive operations

## 🏗️ Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Layer                              │
│  Next.js 16 App Router • React 19 • Tailwind CSS • shadcn/ui    │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                        API Layer                                 │
│  RESTful endpoints • CSRF protection • Rate limiting • RBAC     │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                      Agent Swarm                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ Employee │ │  Leave   │ │Workflows │ │ Knowledge│           │
│  │  Agent   │ │  Agent   │ │  Agent   │ │  Agent   │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
│                              │                                   │
│                    ┌─────────────────┐                          │
│                    │   Coordinator   │                          │
│                    │  (Router + RLS) │                          │
│                    └─────────────────┘                          │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                    Repository Layer                              │
│  Supabase Client • RLS Policies • Query Builder • Fallback      │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                    Data Layer                                    │
│  PostgreSQL • Row-Level Security • Audit Logs • Vector Store    │
└─────────────────────────────────────────────────────────────────┘
```

### Agent Architecture

The system uses a coordinator pattern where specialist agents handle specific domains:

| Agent | Domain | Capabilities |
|-------|--------|--------------|
| `employee_profile` | Employee Management | Search, profiles, org chart |
| `leave_milestones` | Leave & Milestones | Balances, requests, upcoming dates |
| `document_compliance` | Documents | Classification, compliance tracking |
| `onboarding` | Onboarding | Plans, tasks, progress tracking |
| `offboarding` | Offboarding | Exit workflows, asset returns |
| `workflow_approvals` | Approvals | Multi-step workflows, inbox |
| `knowledge_policy` | Knowledge Base | RAG-powered policy search |
| `manager_support` | Manager Insights | Team summaries, employee briefs |

**Note**: Agent "intelligence" is currently rule-based. LLM integration points exist but use deterministic mock responses.

### Security Model

- **Authentication**: Clerk (planned) or custom JWT
- **Authorization**: RBAC with permissions matrix
- **Data Isolation**: PostgreSQL Row-Level Security (RLS) per tenant
- **Audit**: Tamper-resistant audit logs with integrity hashes
- **Transport**: Security headers, CSRF tokens, rate limiting

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- npm 10+
- Supabase account (or local Docker)
- Clerk account (optional, for auth)

### Quick Start

1. **Clone and install**:
```bash
git clone https://github.com/attm1122/hr_agent_swarm.git
cd hr_agent_swarm
npm install
```

2. **Set up environment**:
```bash
cp .env.example .env.local
# Edit .env.local with your credentials
```

3. **Set up database**:
```bash
# Option A: Use Supabase Cloud
# Create project at https://app.supabase.io
# Copy connection details to .env.local

# Option B: Local Supabase
supabase start
```

4. **Apply schema and seed**:
```bash
# Apply schema via Supabase SQL editor or:
psql $DATABASE_URL -f src/infrastructure/database/schema.sql

# Seed with sample data
npm run db:seed
```

5. **Run development server**:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 📊 Data Model

### Core Entities

- **Tenants**: Multi-tenant isolation boundary
- **Employees**: Staff with org hierarchy (manager relationships)
- **Teams**: Organizational units with cost centers
- **Positions**: Job roles and levels

### HR Domains

- **Leave**: Balance tracking, requests, approvals
- **Compensation**: Salary records with external sync (HR3)
- **Documents**: Employee files with expiration tracking
- **Milestones**: Service anniversaries, visa expiries, probation
- **Onboarding/Offboarding**: Task workflows with templates
- **Workflows**: Generic approval engine with multi-step flows

### Knowledge Domain

- **Policy Documents**: Version-controlled HR policies
- **Chunks**: Embeddable segments for RAG retrieval
- **Knowledge Zones**: Access-controlled content areas

See `src/infrastructure/database/schema.sql` for full schema.

## 🔐 Authentication Model

### Current State (POC)

The POC uses a mock authentication system for development:
- Simulated user sessions
- Mock employee records linked to auth
- No real JWT validation

### Production Path

For production, implement:

1. **Clerk Integration** (recommended):
   - Set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - Set `CLERK_SECRET_KEY`
   - Use Clerk JWT templates for Supabase

2. **Custom Auth** (alternative):
   - Implement JWT validation middleware
   - Store user sessions in database
   - Link auth users to employee records

3. **RLS Context**:
   - Pass `tenant_id`, `user_id`, `role` in JWT claims
   - Policies automatically enforce access control

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch

# Type checking
npm run typecheck

# Linting
npm run lint
```

### Test Coverage

| Layer | Status | Notes |
|-------|--------|-------|
| Components | ✅ 100% | All UI components tested |
| Agents | ✅ 100% | Unit + integration |
| Repositories | ✅ 100% | Mock Supabase + fallback |
| API Routes | ✅ 100% | Handler isolation |
| Security | ✅ 100% | Middleware + auth |
| E2E | ⚠️ Planned | Playwright tests pending |

## 🚢 Deployment

### Vercel (Recommended)

```bash
vercel --prod
```

Required environment variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`

### Database Migrations

```bash
# Generate types from schema
npm run db:generate

# Push schema changes
npm run db:migrate

# Reset database (WARNING: deletes data)
npm run db:reset
```

See `MIGRATION_GUIDE.md` for detailed migration instructions.

## 📋 Limitations & Known Issues

### Current POC Limitations

1. **Authentication**: Mock auth - requires Clerk/production auth
2. **AI Features**: Deterministic responses - no actual LLM integration
3. **Real-time**: No WebSocket updates
4. **Notifications**: No email/push notification system
5. **File Storage**: OneDrive integration mocked
6. **HR3 Sync**: External API integration mocked

### Architecture Debt

1. **Repository Pattern**: In-memory fallback adds complexity
2. **Error Handling**: Some edge cases need hardening
3. **Rate Limiting**: In-memory only (needs Redis for multi-instance)
4. **Audit Logs**: Buffer-based (needs WAL for production)

## 🗺️ Roadmap

### Phase 1: Foundation (Complete) ✅
- Multi-agent architecture
- Repository pattern with fallback
- RLS schema design
- Audit logging infrastructure

### Phase 2: Hardening (Next)
- [ ] Real authentication (Clerk)
- [ ] Full RLS policy enforcement
- [ ] LLM integration (OpenAI/Azure)
- [ ] WebSocket real-time updates
- [ ] File storage (Supabase Storage)

### Phase 3: Scale
- [ ] Redis for sessions/rate limiting
- [ ] Elasticsearch for search
- [ ] Kafka for event streaming
- [ ] Multi-region deployment

### Phase 4: Intelligence
- [ ] True agent autonomy
- [ ] Learning from approvals
- [ ] Predictive analytics
- [ ] Natural language HR operations

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all checks pass: `npm test && npm run build`
5. Submit a pull request

### Development Guidelines

- **TypeScript**: Strict mode enabled
- **Testing**: All new code requires tests
- **Security**: Follow OWASP guidelines
- **Performance**: Lazy loading, code splitting

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/attm1122/hr_agent_swarm/issues)
- **Discussions**: [GitHub Discussions](https://github.com/attm1122/hr_agent_swarm/discussions)
- **Documentation**: See `/docs` folder and inline JSDoc

---

**Disclaimer**: This software is provided as-is for evaluation purposes. The authors assume no liability for production use without appropriate security review and hardening.
