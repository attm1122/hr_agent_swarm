# HR Agent Swarm - Quickstart

Your project is configured for Supabase: `https://ycrvhfgcdygdjqzlglgt.supabase.co`

## Option 1: Automated Setup (Recommended)

```bash
# Run the automated setup script
npx tsx scripts/setup.ts
```

This will guide you through the entire process interactively.

---

## Option 2: Manual Setup

### Step 1: Get Your API Keys

1. Visit: https://app.supabase.com/project/ycrvhfgcdygdjqzlglgt/settings/api
2. Copy the `anon public` key
3. Copy the `service_role secret` key (⚠️ keep this secret!)
4. Paste them into `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...
```

### Step 2: Install Supabase CLI

```bash
npm install -g supabase
```

### Step 3: Login & Link

```bash
npx supabase login
npx supabase link --project-ref ycrvhfgcdygdjqzlglgt
```

### Step 4: Apply Migrations

```bash
npx supabase db push
```

This creates all tables with tenant isolation and RLS policies.

### Step 5: Seed Sample Data

```bash
npx supabase db reset
```

### Step 6: Create Admin User

```bash
npx tsx scripts/setup-admin.ts admin@yourcompany.com YourPassword123! Admin User
```

### Step 7: Run the App

```bash
npm run dev
```

Visit: http://localhost:3000/auth/login

---

## Development Mode (No Supabase Required)

If you just want to test the UI without setting up Supabase:

```bash
# .env.local should already have this:
MOCK_AUTH_ENABLED=true
```

Then simply:
```bash
npm run dev
```

Login with any credentials - mock auth bypasses everything.

---

## Troubleshooting

### "Supabase CLI not found"
```bash
npm install -g supabase
```

### "Invalid API key"
- Double-check you copied the full key
- Make sure `.env.local` is saved
- Restart the terminal

### "Database connection failed"
- Check internet connection
- Verify project is active at https://app.supabase.com

### "Migrations failed"
```bash
# Check status
npx supabase db status

# Try resetting
npx supabase db reset
```

---

## Project Structure

```
supabase/
  migrations/
    000001_add_tenant_isolation.sql   # Tenant columns
    000002_add_rpc_functions.sql      # Utility functions
    000003_add_rls_policies.sql       # Security policies
  seed.sql                            # Sample data
  config.toml                         # Supabase config

src/
  lib/supabase/
    client.ts                         # Browser client
    server.ts                         # Server client
    middleware.ts                     # Auth middleware
  lib/auth/session.ts                 # Production auth
  lib/infrastructure/
    outbox/outbox-service.ts          # Reliable events
    database/transaction.ts           # Transaction safety
    database/tenant-isolation.ts      # Tenant enforcement

scripts/
  setup.ts                            # Automated setup
  setup-admin.ts                      # Create admin user
  verify-supabase.ts                  # Test connection
```

---

## Security Checklist

Before production:

- [ ] `NEXT_PUBLIC_PRODUCTION_AUTH=true`
- [ ] `MOCK_AUTH_ENABLED=false`
- [ ] Changed all default passwords
- [ ] Enabled email confirmations in Supabase
- [ ] Configured HTTPS
- [ ] Set up audit log retention
- [ ] Enabled RLS on all tables (done via migrations)

---

## What's Already Done

✅ Supabase URL configured  
✅ Database migrations created  
✅ Tenant isolation implemented  
✅ RLS policies written  
✅ Outbox pattern ready  
✅ Transaction safety added  
✅ Build passing  
✅ Auth flow working  

---

## Need Help?

1. Run verification: `npx tsx scripts/verify-supabase.ts`
2. Check logs: `npm run dev` output
3. Review: `SETUP.md` for detailed instructions
4. Supabase Dashboard: https://app.supabase.com/project/ycrvhfgcdygdjqzlglgt
