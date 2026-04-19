# Contributing to HR Agent Swarm

## Development Setup

```bash
# Clone repository
git clone <repo-url>
cd hr_agent_swarm

# Use correct Node version
nvm use

# Install dependencies
npm install

# Copy environment
cp .env.example .env.local

# Start development
npm run dev
```

## Project Structure

```
src/
├── app/              # Next.js App Router
├── components/       # React components
├── lib/             # Business logic
│   ├── agents/      # AI agents
│   ├── auth/        # Authentication
│   ├── repositories/# Data access
│   ├── services/    # Business services
│   └── ports/       # Interface definitions
└── types/           # TypeScript types
```

## Code Style

- **TypeScript**: Strict mode enabled
- **Linting**: ESLint with Next.js config
- **Formatting**: Prettier
- **Imports**: Use `@/` alias for project imports

## Making Changes

1. Create feature branch: `git checkout -b feature/name`
2. Make changes with tests
3. Run checks:
   ```bash
   npm run typecheck
   npm run lint
   npm run test
   npm run build
   ```
4. Commit with clear message
5. Open PR

## Testing

```bash
# Unit tests
npm run test

# Watch mode
npm run test:watch

# E2E tests
npm run test:e2e
```

## Database Changes

1. Create migration:
   ```bash
   npx supabase migration new migration_name
   ```

2. Edit `supabase/migrations/xxx_migration_name.sql`

3. Apply locally:
   ```bash
   npx supabase db push
   ```

4. Test migration:
   ```bash
   npx supabase db reset
   ```

## Commit Convention

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `refactor:` Code restructuring
- `test:` Tests
- `chore:` Maintenance

Example: `feat: add leave request approval workflow`

## PR Checklist

- [ ] Tests pass
- [ ] Type check passes
- [ ] Linting passes
- [ ] Build succeeds
- [ ] Documentation updated
- [ ] Migrations tested (if applicable)

## Questions?

Open an issue or discussion on GitHub.
