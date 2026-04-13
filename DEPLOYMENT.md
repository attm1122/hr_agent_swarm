# Deployment Guide

This guide covers deploying the HR Agent Swarm application to various environments.

## Prerequisites

- Node.js 20+
- npm 10+
- Supabase account
- Vercel account (recommended)
- Clerk account (for authentication)

## Environment Setup

### 1. Copy Environment Template

```bash
cp .env.example .env.local
```

### 2. Configure Required Variables

```bash
# Authentication (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...

# Database (Supabase)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...

# Optional: AI Integration
OPENAI_API_KEY=sk-proj-...
```

## Deployment Options

### Option 1: Vercel (Recommended)

#### Initial Setup

1. **Install Vercel CLI**:
```bash
npm i -g vercel
```

2. **Login to Vercel**:
```bash
vercel login
```

3. **Link Project**:
```bash
vercel link
```

4. **Set Environment Variables**:
```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add SUPABASE_SERVICE_ROLE_KEY
# ... add all required variables
```

#### Deploy

```bash
# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

#### GitHub Integration

1. Connect your GitHub repo to Vercel
2. Enable automatic deployments on push
3. Configure preview deployments for PRs

### Option 2: Docker

#### Build Image

```bash
# Build production image
docker build -t hr-agent-swarm:latest .

# Run locally
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL=... \
  -e SUPABASE_SERVICE_ROLE_KEY=... \
  hr-agent-swarm:latest
```

#### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}
      - NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${CLERK_PUBLISHABLE_KEY}
      - CLERK_SECRET_KEY=${CLERK_SECRET_KEY}
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### Option 3: Self-Hosted

#### Requirements

- Node.js 20+
- PostgreSQL 15+
- Redis (optional, for sessions)
- Nginx (reverse proxy)

#### Setup Steps

1. **Clone and Build**:
```bash
git clone https://github.com/attm1122/hr_agent_swarm.git
cd hr_agent_swarm
npm ci
npm run build
```

2. **Configure Database**:
```bash
# Apply schema
psql $DATABASE_URL -f src/infrastructure/database/schema.sql

# Seed data
npm run db:seed
```

3. **Start Application**:
```bash
npm start
```

4. **Configure Nginx**:
```nginx
server {
    listen 80;
    server_name hr-agent-swarm.example.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Database Setup

### Supabase Configuration

1. **Create Project**:
   - Go to https://app.supabase.io
   - Create new project
   - Note the project URL and anon key

2. **Apply Schema**:
```bash
# Via SQL Editor in Supabase dashboard
# Copy contents of src/infrastructure/database/schema.sql

# Or via CLI
supabase db push
```

3. **Configure RLS**:
   - Enable RLS on all tables (already in schema)
   - Test policies with different user roles

4. **Set up Webhook (Optional)**:
   - Configure auth webhooks for Clerk integration
   - Set webhook URL: `https://your-app.com/api/auth/webhook`

### Clerk Configuration

1. **Create Application**:
   - Go to https://dashboard.clerk.com
   - Create new application
   - Configure authentication methods

2. **Create JWT Template**:
   - Name: `supabase`
   - Claims:
```json
{
  "sub": "{{user.id}}",
  "role": "{{user.public_metadata.role}}",
  "tenant_id": "{{user.public_metadata.tenant_id}}"
}
```

3. **Configure Webhooks**:
   - Endpoint: `https://your-app.com/api/auth/webhook`
   - Events: `user.created`, `user.updated`

## Production Checklist

### Security

- [ ] Enable RLS policies on all tables
- [ ] Configure CORS origins
- [ ] Set up CSP headers
- [ ] Enable rate limiting
- [ ] Configure audit logging
- [ ] Set up HTTPS/TLS
- [ ] Enable HSTS
- [ ] Configure security headers

### Performance

- [ ] Enable CDN for static assets
- [ ] Configure caching headers
- [ ] Set up connection pooling
- [ ] Enable query caching
- [ ] Configure auto-scaling

### Monitoring

- [ ] Set up error tracking (Sentry)
- [ ] Configure logging
- [ ] Set up uptime monitoring
- [ ] Configure alerting
- [ ] Set up performance monitoring

### Backup & Recovery

- [ ] Configure database backups
- [ ] Set up disaster recovery plan
- [ ] Test restore procedures
- [ ] Document RTO/RPO

## Environment-Specific Configuration

### Development

```bash
# .env.local
NODE_ENV=development
DEBUG=true
SKIP_AUTH_CHECKS=false
USE_MOCK_DATA=false
LOG_LEVEL=debug
```

### Staging

```bash
# .env.staging
NODE_ENV=production
DEBUG=false
SKIP_AUTH_CHECKS=false
USE_MOCK_DATA=false
LOG_LEVEL=info
SENTRY_ENVIRONMENT=staging
```

### Production

```bash
# .env.production
NODE_ENV=production
DEBUG=false
SKIP_AUTH_CHECKS=false
USE_MOCK_DATA=false
LOG_LEVEL=warn
SENTRY_ENVIRONMENT=production
```

## Troubleshooting

### Build Failures

1. **Type Errors**:
```bash
npm run typecheck
```

2. **Lint Errors**:
```bash
npm run lint
```

3. **Test Failures**:
```bash
npm test
```

### Runtime Issues

1. **Database Connection**:
   - Check `SUPABASE_SERVICE_ROLE_KEY`
   - Verify IP allowlist
   - Check connection pool limits

2. **Authentication**:
   - Verify Clerk configuration
   - Check JWT template
   - Test webhook endpoints

3. **Performance**:
   - Monitor query performance
   - Check for N+1 queries
   - Review bundle size

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `AUTH_REQUIRED` | Missing session | Check Clerk configuration |
| `RLS_POLICY_VIOLATION` | RLS blocking query | Verify JWT claims include tenant_id |
| `RATE_LIMIT_EXCEEDED` | Too many requests | Increase rate limits or implement backoff |
| `BUILD_FAILED` | Type/lint errors | Run `npm run typecheck && npm run lint` |

## Rollback Procedure

1. **Database**:
```bash
# Restore from backup
supabase db restore backup-id
```

2. **Application**:
```bash
# Vercel
vercel rollback

# Docker
docker-compose down
docker-compose up -d --no-deps --build app
```

## Support

- **Vercel Docs**: https://vercel.com/docs
- **Supabase Docs**: https://supabase.com/docs
- **Clerk Docs**: https://clerk.com/docs
- **Issues**: https://github.com/attm1122/hr_agent_swarm/issues
