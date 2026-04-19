# Development Scripts

All scripts are runnable via `npx tsx scripts/<script>.ts` or `npm run <command>`.

## Quick Reference

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `npm run setup` | Automated setup | First time setup |
| `npm run setup:admin` | Create admin user | After database setup |
| `npm run verify` | Test Supabase connection | Troubleshooting |
| `npm run deploy` | Deploy to Vercel | Releasing |
| `npm run health-check` | Check app health | Post-deployment |

---

## Setup Scripts

### `npm run setup`

Interactive automated setup. Guides you through:
1. Checking prerequisites
2. Installing Supabase CLI
3. Logging in to Supabase
4. Linking your project
5. Applying migrations
6. Seeding data
7. Creating admin user
8. Verifying installation

```bash
npm run setup
```

### `npm run setup:admin`

Creates the first admin user in the system.

```bash
# Interactive
npm run setup:admin

# Or with arguments
npx tsx scripts/setup-admin.ts admin@company.com Password123! John Doe
```

**Arguments:**
- `email` - Admin email address
- `password` - Password (min 8 chars)
- `firstName` - First name (optional)
- `lastName` - Last name (optional)

---

## Verification Scripts

### `npm run verify`

Tests your Supabase connection and configuration.

```bash
npm run verify
```

**Checks:**
- Environment variables set
- Database connectivity
- Tables accessible
- Auth API working
- RLS status

**Output:**
```
🔍 Supabase Connection Verification

URL: https://ycrvhfgcdygdjqzlglgt.supabase.co
Anon Key: ✓ Set (eyJhbGciOiJIUzI1NiIs...)
Service Role Key: ✓ Set (eyJhbGciOiJIUzI1NiIs...)

Test 1: Checking database connection...
   ✓ Database connected
Test 2: Checking tenants table...
   ✓ Tenants table accessible
...
```

### `npm run health-check`

Checks if the deployed application is healthy.

```bash
# Check local dev server
npm run health-check

# Check specific URL
npm run health-check https://your-app.vercel.app
```

---

## Deployment Scripts

### `npm run deploy`

Deploys to Vercel with safety checks.

```bash
# Deploy to preview
npm run deploy preview

# Deploy to production (with confirmation)
npm run deploy production
```

**Process:**
1. Checks Vercel CLI installed
2. Runs tests
3. Builds project
4. For production: asks for confirmation
5. Deploys
6. Configures environment variables

---

## Database Scripts

### Manual Supabase Commands

```bash
# Link project (one-time)
npx supabase link --project-ref ycrvhfgcdygdjqzlglgt

# Apply migrations
npx supabase db push

# Reset database with seed data
npx supabase db reset

# Check status
npx supabase db status

# Start local Supabase
npx supabase start

# Stop local Supabase
npx supabase stop
```

---

## Development Scripts

### Standard npm Scripts

```bash
# Development server
npm run dev

# Production build
npm run build

# Type checking
npm run typecheck

# Linting
npm run lint
npm run lint:fix

# Tests
npm run test
npm run test:watch
npm run test:coverage
```

---

## Script Dependencies

All scripts require:
- Node.js 20+
- npm packages installed (`npm ci`)

Some scripts need:
- Supabase CLI (auto-installed if missing)
- Vercel CLI (auto-installed if missing)
- Environment variables in `.env.local`

---

## Troubleshooting

### "Command not found"
```bash
# Install tsx globally
npm install -g tsx

# Or use npx
npx tsx scripts/setup.ts
```

### "Cannot find module"
```bash
# Reinstall dependencies
rm -rf node_modules
npm ci
```

### Environment variables not loaded
```bash
# Scripts load .env.local automatically
# If not working, ensure file exists
cat .env.local
```

### Permission denied on scripts
```bash
# Make scripts executable
chmod +x scripts/*.ts
```

---

## Creating New Scripts

Template for new scripts:

```typescript
#!/usr/bin/env tsx
/**
 * Script Name
 * Description of what this script does
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  console.log('Starting script...');
  
  // Your code here
  
  console.log('Done!');
}

main().catch(console.error);
```

Save to `scripts/my-script.ts` and run:
```bash
npx tsx scripts/my-script.ts
```

---

## CI/CD Integration

Scripts are used in GitHub Actions (`.github/workflows/ci.yml`):

```yaml
- name: Run tests
  run: npm run test

- name: Type check
  run: npm run typecheck

- name: Build
  run: npm run build
```
