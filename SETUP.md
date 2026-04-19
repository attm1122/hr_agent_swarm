# HR Agent Swarm - Setup Guide

This guide walks you through setting up the HR Agent Swarm application from scratch.

## Prerequisites

- Node.js 20+ and npm 10+
- Supabase CLI installed: `npm install -g supabase`
- A Supabase project (free tier works fine)

## Step 1: Clone and Install

```bash
git clone <repo-url>
cd hr_agent_swarm
npm install
```

## Step 2: Configure Supabase

### Create a Supabase Project

1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Create a new project
3. Note down:
   - Project URL (e.g., `https://xxxxxx.supabase.co`)
   - Anon key (public)
   - Service role key (secret - keep this safe!)

### Link Your Project

```bash
npx supabase login
npx supabase link --project-ref your-project-ref
```

## Step 3: Run Database Migrations

```bash
# Apply all migrations
npx supabase db push
```

This creates:
- Tenant isolation with `tenant_id` columns
- Row Level Security (RLS) policies
- Outbox events table for reliable messaging
- RPC functions for transactions
- Audit logging triggers

## Step 4: Seed Initial Data

```bash
# Apply seed data (sample employees, teams, etc.)
npx supabase db reset
# OR apply just the seed:
psql $SUPABASE_DB_URL -f supabase/seed.sql
```

## Step 5: Configure Environment

```bash
# Copy the example file
cp .env.example .env.local

# Edit with your credentials
nano .env.local
```

Required values:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_PRODUCTION_AUTH=true
```

## Step 6: Create Admin User

```bash
# Set environment variables first
export NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Create admin user
npx tsx scripts/setup-admin.ts admin@yourcompany.com SecurePassword123! Admin User
```

## Step 7: Run the Application

```bash
# Development mode
npm run dev

# Or build for production
npm run build
npm start
```

Visit: http://localhost:3000/auth/login

## Step 8: Configure Supabase Auth (Production)

In Supabase Dashboard:

1. **Authentication > Settings**:
   - Site URL: `https://yourdomain.com`
   - Redirect URLs: Add `https://yourdomain.com/auth/callback`

2. **Authentication > Email Templates**:
   - Customize confirmation and password reset emails

3. **Authentication > Providers** (optional):
   - Enable Google, Azure AD, or other OAuth providers

## Development Mode (Without Supabase)

For local testing without a Supabase project:

```env
# .env.local
NEXT_PUBLIC_PRODUCTION_AUTH=false
MOCK_AUTH_ENABLED=true
MOCK_AUTH_USER_ID=user_dev_001
MOCK_AUTH_EMPLOYEE_ID=emp_dev_001
MOCK_AUTH_NAME=Dev Admin
MOCK_AUTH_EMAIL=dev@example.com
MOCK_AUTH_ROLE=admin
MOCK_AUTH_TITLE=System Administrator
MOCK_AUTH_TENANT_ID=00000000-0000-0000-0000-000000000000
```

## Verification Checklist

After setup, verify:

- [ ] Login page loads at `/auth/login`
- [ ] Can log in with admin credentials
- [ ] Dashboard loads without errors
- [ ] Employee list is visible
- [ ] Can create leave requests
- [ ] Tenant isolation works (data from other tenants not visible)
- [ ] RLS policies block unauthorized access

## Troubleshooting

### "Authentication not configured" error
- Ensure `NEXT_PUBLIC_PRODUCTION_AUTH=true` in production
- Check Supabase URL and keys are correct

### "Tenant isolation violation" error
- Ensure `tenant_id` is set in user metadata
- Check RLS policies are enabled

### Database connection errors
- Verify Supabase project is running
- Check network connectivity
- Ensure service role key is correct (not anon key)

### Build errors
```bash
# Clear Next.js cache
rm -rf .next

# Rebuild
npm run build
```

## Next Steps

After initial setup:

1. **Configure OAuth providers** (Google, Azure AD)
2. **Set up email templates** for confirmations
3. **Add your company branding** to the login page
4. **Configure Redis** for rate limiting (optional)
5. **Set up Sentry** for error tracking (optional)
6. **Deploy to Vercel** or your hosting provider

## Security Checklist

Before going live:

- [ ] `NEXT_PUBLIC_PRODUCTION_AUTH=true`
- [ ] `MOCK_AUTH_ENABLED=false`
- [ ] Service role key NOT exposed to client
- [ ] RLS policies enabled on all tables
- [ ] Strong password policy configured
- [ ] HTTPS enforced
- [ ] Audit logging enabled
- [ ] Rate limiting configured

## Support

For issues:
1. Check the logs: `npm run dev` output
2. Review Supabase logs in Dashboard
3. Check browser console for errors
4. Verify environment variables

## Architecture Overview

```
┌─────────────────────────────────────────┐
│           Next.js Application           │
│  ┌──────────┐  ┌─────────────────────┐ │
│  │   Auth   │  │   Tenant Context    │ │
│  │ (Supabase)│  │   (Middleware)      │ │
│  └────┬─────┘  └─────────────────────┘ │
│       │                                  │
│  ┌────▼──────────────────────────────┐  │
│  │      Repositories (Supabase)      │  │
│  │  ┌─────────┐ ┌─────────────────┐  │  │
│  │  │  CRUD   │ │ Tenant Isolation│  │  │
│  │  └─────────┘ └─────────────────┘  │  │
│  └────┬──────────────────────────────┘  │
└───────┼─────────────────────────────────┘
        │
┌───────▼─────────────────────────────────┐
│         Supabase PostgreSQL              │
│  ┌──────────┐ ┌──────────┐ ┌─────────┐  │
│  │   RLS    │ │ Outbox   │ │  Audit  │  │
│  │ Policies │ │  Events  │ │   Log   │  │
│  └──────────┘ └──────────┘ └─────────┘  │
└─────────────────────────────────────────┘
```
