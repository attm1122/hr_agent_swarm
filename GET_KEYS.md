# Get Your Supabase Keys

Your Supabase URL is configured: `https://ycrvhfgcdygdjqzlglgt.supabase.co`

Now you need to get your API keys from the Supabase Dashboard.

## Step 1: Open Project Settings

Go to: **https://app.supabase.com/project/ycrvhfgcdygdjqzlglgt/settings/api**

## Step 2: Copy the Keys

In the "Project API keys" section, copy these two values:

### 1. `anon public` key
```
eyJhbGciOiJIUzI1NiIs... (long string)
```
**Use for:** `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 2. `service_role secret` key ⚠️ KEEP SECRET
```
eyJhbGciOiJIUzI1NiIs... (long string)
```
**Use for:** `SUPABASE_SERVICE_ROLE_KEY`

## Step 3: Update .env.local

Open `.env.local` and paste your keys:

```env
NEXT_PUBLIC_SUPABASE_URL=https://ycrvhfgcdygdjqzlglgt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=paste-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=paste-service-role-key-here
NEXT_PUBLIC_PRODUCTION_AUTH=false
MOCK_AUTH_ENABLED=true
```

## Step 4: Verify Connection

Run the verification script:

```bash
npx tsx scripts/verify-supabase.ts
```

You should see:
```
✓ Database connected
✓ Tenants table accessible
✓ Employees table accessible
✓ Auth admin API accessible
```

## Step 5: Apply Database Migrations

Once keys are configured:

```bash
# Login to Supabase CLI
npx supabase login

# Link your project
npx supabase link --project-ref ycrvhfgcdygdjqzlglgt

# Push migrations
npx supabase db push
```

## ⚠️ Security Warning

**NEVER commit these keys to git:**
- `SUPABASE_SERVICE_ROLE_KEY` - This bypasses ALL security
- Anyone with this key can read/modify ALL data

The `.env.local` file is already in `.gitignore` so it won't be committed.

## Troubleshooting

### "Invalid API key" error
- Make sure you copied the full key (it's long)
- Don't confuse `anon` with `service_role`

### "Cannot connect" error
- Check your internet connection
- Verify the project is active in Supabase dashboard
- Try accessing: https://ycrvhfgcdygdjqzlglgt.supabase.co

### Missing tables
- Migrations haven't been applied yet
- Run: `npx supabase db push`

## Quick Checklist

- [ ] Copied `anon public` key
- [ ] Copied `service_role secret` key
- [ ] Pasted both into `.env.local`
- [ ] Ran `npx tsx scripts/verify-supabase.ts`
- [ ] Verification passed
- [ ] Ready to run `npm run dev`
