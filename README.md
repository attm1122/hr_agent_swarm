# HR Agent Swarm

AI-powered HR management system with multi-agent orchestration, RAG knowledge base, and workflow automation.

## 🚀 Quick Start

```bash
# Clone and install
git clone <repo-url>
cd hr_agent_swarm
npm install

# Automated setup (interactive)
npm run setup

# Or manual setup - see QUICKSTART.md
```

## 📋 Prerequisites

- Node.js 20+
- Supabase account (free tier works)
- Supabase CLI: `npm install -g supabase`

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Next.js 16 + React 19                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Auth Layer  │  │  AI Agents   │  │    RAG       │  │
│  │  (Supabase)  │  │ (OpenAI)     │  │ (Pinecone)   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │         Hexagonal Architecture                    │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │  │
│  │  │  Domain  │ │  Ports   │ │  Adapters        │  │  │
│  │  │  Layer   │ │(Interfaces)│ │ (Supabase, etc) │  │  │
│  │  └──────────┘ └──────────┘ └──────────────────┘  │  │
│  └──────────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│              Supabase PostgreSQL                         │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐    │
│  │  RLS Policies│ │ Tenant Isol. │ │ Outbox Patt. │    │
│  └──────────────┘ └──────────────┘ └──────────────┘    │
└─────────────────────────────────────────────────────────┘
```

## 🛡️ Security Features

- **Tenant Isolation**: Every query filtered by `tenant_id`
- **Row Level Security (RLS)**: Database-level access control
- **Audit Logging**: All changes tracked
- **Outbox Pattern**: Reliable event delivery
- **Fail-Closed Auth**: No session = no access

## 📦 Key Features

| Feature | Description |
|---------|-------------|
| **AI Agents** | Multi-agent swarm for HR queries (leave, policies, docs) |
| **RAG** | Knowledge base with semantic search |
| **Workflows** | Approval flows for leave, documents, etc. |
| **Document Mgmt** | OneDrive integration, expiry tracking |
| **Compliance** | Milestone tracking, visa/cert expiry alerts |
| **Analytics** | Manager dashboards, HR reports |

## 🗂️ Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (dashboard)/        # Protected routes
│   ├── api/                # API routes
│   └── auth/               # Login/callback
├── lib/
│   ├── agents/             # AI agent implementations
│   ├── auth/               # Session management
│   ├── repositories/       # Data access layer
│   ├── services/           # Business logic
│   ├── ports/              # Interface definitions
│   └── infrastructure/     # External adapters
├── components/             # UI components
├── types/                  # TypeScript types
└── hooks/                  # React hooks

supabase/
├── migrations/             # Database migrations
├── seed.sql               # Sample data
└── config.toml            # CLI config
```

## 🛠️ Development

```bash
# Dev server with hot reload
npm run dev

# Type checking
npm run typecheck

# Run tests
npm run test

# Build for production
npm run build
```

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# With UI
npm run test:e2e:ui
```

## 🚢 Deployment

### Vercel (Recommended)

1. Connect GitHub repo to Vercel
2. Add environment variables from `.env.local`
3. Deploy

### Environment Variables

Required:
```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_PRODUCTION_AUTH=true
```

Optional:
```env
OPENAI_API_KEY=            # For AI features
REDIS_URL=                 # For rate limiting
SENTRY_DSN=                # Error tracking
```

## 📚 Documentation

- [QUICKSTART.md](QUICKSTART.md) - Get started in 5 minutes
- [SETUP.md](SETUP.md) - Detailed setup guide
- [GET_KEYS.md](GET_KEYS.md) - How to get Supabase keys
- [AGENTS.md](AGENTS.md) - Architecture decisions

## 🔐 Security

See [Security Checklist](QUICKSTART.md#security-checklist) before production.

Key points:
- Never commit `.env.local`
- Service role key stays server-side only
- Enable RLS on all tables
- Use strong passwords
- Enable 2FA for admin accounts

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Submit PR

## 📄 License

MIT License - see LICENSE file

## 🆘 Support

- Issues: GitHub Issues
- Discussions: GitHub Discussions
- Email: support@example.com

---

Built with Next.js, Supabase, TypeScript, and OpenAI.
