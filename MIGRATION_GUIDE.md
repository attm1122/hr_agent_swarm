# Migration Guide

This guide covers database migrations, schema updates, and data transformations for the HR Agent Swarm project.

## Overview

We use Supabase for database management with the following approach:

- **Schema**: Defined in `src/infrastructure/database/schema.sql`
- **Migrations**: Managed via Supabase CLI
- **Seeding**: TypeScript scripts in `scripts/seed.ts`
- **Types**: Auto-generated from database schema

## Prerequisites

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref your-project-ref
```

## Database Setup

### Initial Setup

1. **Create a new Supabase project** via the dashboard

2. **Apply the schema**:
```bash
# Connect to your Supabase database and run the schema
psql $DATABASE_URL -f src/infrastructure/database/schema.sql

# Or use Supabase dashboard SQL editor
```

3. **Seed the database**:
```bash
npm run db:seed
```

### Environment Variables

Create `.env.local` with:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_PROJECT_ID=your-project-id
```

## Schema Migrations

### Local Development Workflow

1. **Make schema changes** to `schema.sql`

2. **Test locally**:
```bash
# Start local Supabase
supabase start

# Apply schema
supabase db reset

# Or apply specific changes via SQL editor
```

3. **Generate types** after schema changes:
```bash
npm run db:generate
```

4. **Deploy to production**:
```bash
# Push changes to remote
supabase db push
```

### Migration Best Practices

1. **Always backup before migrating**:
```bash
# Create backup via Supabase dashboard or:
supabase db dump -f backup.sql
```

2. **Test migrations on staging first**

3. **Make migrations idempotent**:
```sql
-- Good: Check if exists before creating
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'new_table') THEN
        CREATE TABLE new_table (...);
    END IF;
END $$;
```

4. **Use transactions for complex migrations**

## Common Operations

### Adding a New Table

1. Add to `schema.sql`:
```sql
CREATE TABLE new_entities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE new_entities ENABLE ROW LEVEL SECURITY;

-- Add RLS policy
CREATE POLICY new_entities_tenant_isolation ON new_entities
    FOR ALL
    USING (tenant_id = current_tenant_id());

-- Add trigger
CREATE TRIGGER update_new_entities_updated_at 
    BEFORE UPDATE ON new_entities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add index
CREATE INDEX idx_new_entities_tenant ON new_entities(tenant_id);
```

2. Generate types:
```bash
npm run db:generate
```

3. Create repository in `src/lib/repositories/`

### Modifying an Existing Table

```sql
-- Add column
ALTER TABLE employees ADD COLUMN phone TEXT;

-- Add index
CREATE INDEX idx_employees_phone ON employees(phone);

-- Update existing data
UPDATE employees SET phone = '+61-000-000-000' WHERE phone IS NULL;
```

### Creating a Migration Script

For complex data migrations, create a script:

```typescript
// scripts/migrate-v1-to-v2.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function migrate() {
  // Migration logic here
  console.log('Migration complete');
}

migrate();
```

Run with:
```bash
tsx scripts/migrate-v1-to-v2.ts
```

## RLS Policy Patterns

### Self-Service Pattern
```sql
CREATE POLICY table_self_service ON table_name
    FOR SELECT
    USING (
        tenant_id = current_tenant_id()
        AND user_id = current_user_id()
    );
```

### Manager Access Pattern
```sql
CREATE POLICY table_manager_access ON table_name
    FOR SELECT
    USING (
        tenant_id = current_tenant_id()
        AND (
            user_id = current_user_id()
            OR is_manager_of(user_id)
            OR is_admin()
        )
    );
```

### Admin-Only Pattern
```sql
CREATE POLICY table_admin_only ON table_name
    FOR ALL
    USING (
        tenant_id = current_tenant_id()
        AND is_admin()
    );
```

## Data Seeding

### Development Seed

```bash
# Full seed with sample data
npm run db:seed
```

### Production Seed

For production, seed minimal required data:

```bash
# Seed only essential data
SEED_MODE=minimal tsx scripts/seed.ts
```

### Custom Seed Data

Create environment-specific seed files:

```typescript
// scripts/seed-production.ts
// Production-specific seed data
```

## Troubleshooting

### Common Issues

1. **RLS blocking queries**:
   - Check JWT claims include `tenant_id` and `role`
   - Verify RLS policies are correct
   - Use service role for admin operations

2. **Type generation fails**:
   - Ensure `SUPABASE_PROJECT_ID` is set
   - Check you have access to the project
   - Try: `supabase login` again

3. **Migration conflicts**:
   - Reset local database: `supabase db reset`
   - Check remote schema: `supabase db remote commit`

### Resetting Database

**WARNING: This deletes all data!**

```bash
# Local
supabase db reset

# Remote - use with caution
supabase db push --force
```

### Getting Help

- Supabase Docs: https://supabase.com/docs
- PostgreSQL RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Troubleshooting: Check `supabase status` for local issues
