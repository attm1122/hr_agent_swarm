# Getting Started in 5 Minutes

## Step 1: Start the Application (30 seconds)

```bash
# Navigate to project
cd /Users/aubreymazinyi/hr_agent_swarm

# Start development server
npm run dev
```

The app will be available at **http://localhost:3000**

---

## Step 2: Login (1 minute)

With mock auth enabled (default), you can login with **any** email and password.

**Example login:**
- Email: `admin@company.com`
- Password: `anypassword`

---

## Step 3: Explore (3 minutes)

### Dashboard (`/`)
- Overview of HR metrics
- Quick actions
- Recent activity

### Employees (`/employees`)
- View all employees
- Search and filter
- Add new employees

### Leave (`/leave`)
- Submit leave requests
- View leave balance
- Approve requests (as manager)

### Admin (`/admin`)
- System configuration
- Knowledge base management
- Audit logs

---

## What's Working Now

With mock auth, you can:
- ✅ View all pages
- ✅ Navigate the UI
- ✅ See sample data
- ✅ Test workflows
- ✅ Explore features

**Not available in mock mode:**
- ❌ Real database persistence
- ❌ Multi-tenant isolation
- ❌ Email notifications
- ❌ Actual AI responses (mocked)

---

## Next: Connect to Supabase

For full functionality:

```bash
# 1. Get your API keys
# https://app.supabase.com/project/ycrvhfgcdygdjqzlglgt/settings/api

# 2. Add to .env.local:
# NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
# SUPABASE_SERVICE_ROLE_KEY=your-service-key

# 3. Run setup
npm run setup

# 4. Restart
npm run dev
```

---

## Common Commands

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run typecheck        # Check types

# Testing
npm run test             # Run tests
npm run verify           # Test Supabase connection

# Database
npm run setup            # Full setup
npm run setup:admin      # Create admin user

# Deployment
npm run deploy           # Deploy to Vercel
```

Or use Make:
```bash
make dev                 # Start dev server
make build               # Build
make setup               # Full setup
make deploy              # Deploy
```

---

## Troubleshooting

### Port 3000 already in use
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port
npm run dev -- --port 3001
```

### Build errors
```bash
# Clear cache
rm -rf .next
npm run build
```

### Type errors
```bash
npm run typecheck
```

---

## Project Structure

```
src/
├── app/                    # Next.js pages
│   ├── (dashboard)/        # Protected routes
│   ├── api/                # API routes
│   └── auth/               # Login pages
├── lib/
│   ├── agents/             # AI agents
│   ├── auth/               # Authentication
│   ├── repositories/       # Database access
│   └── infrastructure/     # Core infrastructure
├── components/             # UI components
└── types/                  # TypeScript types
```

---

## Key Features

| Feature | Path | Description |
|---------|------|-------------|
| Dashboard | `/` | Overview & metrics |
| Employees | `/employees` | Employee directory |
| Leave | `/leave` | Leave management |
| Compliance | `/compliance` | Documents & milestones |
| HR Admin | `/hr` | HR dashboards |
| Admin | `/admin` | System settings |

---

## Need Help?

1. **Setup issues**: See `SETUP.md`
2. **Architecture**: See `INFRASTRUCTURE_SUMMARY.md`
3. **API docs**: See `API.md`
4. **Scripts**: See `SCRIPTS.md`

---

**You're ready to go!** 🚀

Start the server: `npm run dev`
