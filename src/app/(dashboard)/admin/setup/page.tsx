/**
 * /admin/setup — Production onboarding wizard
 *
 * One-page control panel for a fresh LEAP deployment:
 *   1. Verify Supabase connection (counts live)
 *   2. Verify Microsoft Graph connectivity (/api/admin/graph-health)
 *   3. Seed tenant + teams + positions (/api/admin/seed)
 *   4. Run directory sync (/api/admin/sync/employees)
 *
 * Each step shows its current status and a retry button. This replaces the
 * old curl-based runbook in SETUP_PRODUCTION.md for non-engineer admins.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Database,
  Cloud,
  Users,
  Building2,
} from 'lucide-react';

type StepStatus = 'idle' | 'checking' | 'ok' | 'warn' | 'error';

interface GraphHealth {
  configured: boolean;
  tokenIssued: boolean;
  directoryReachable: boolean;
  tenantSampleUpn?: string;
  error?: string;
}

interface SeedCounts {
  tenants: number;
  teams: number;
  positions: number;
  employees: number;
}

interface SeedResponse {
  configured: boolean;
  counts?: SeedCounts;
  error?: string;
}

interface SyncResult {
  totalFetched?: number;
  inserted?: number;
  updated?: number;
  skipped?: number;
  errors?: Array<{ upn?: string; error: string }>;
  dryRun?: boolean;
}

export default function SetupPage() {
  const [counts, setCounts] = useState<SeedCounts | null>(null);
  const [supabaseStatus, setSupabaseStatus] = useState<StepStatus>('idle');
  const [supabaseMessage, setSupabaseMessage] = useState<string>('');

  const [graph, setGraph] = useState<GraphHealth | null>(null);
  const [graphStatus, setGraphStatus] = useState<StepStatus>('idle');

  const [seedStatus, setSeedStatus] = useState<StepStatus>('idle');
  const [seedMessage, setSeedMessage] = useState<string>('');

  const [syncStatus, setSyncStatus] = useState<StepStatus>('idle');
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [upnDomain, setUpnDomain] = useState('leap.com.au');
  const [dryRun, setDryRun] = useState(true);

  const checkSupabase = useCallback(async () => {
    setSupabaseStatus('checking');
    setSupabaseMessage('');
    try {
      const res = await fetch('/api/admin/seed', { method: 'GET' });
      const json = (await res.json()) as SeedResponse;
      if (!res.ok) {
        setSupabaseStatus('error');
        setSupabaseMessage(json.error || `HTTP ${res.status}`);
        return;
      }
      if (!json.configured) {
        setSupabaseStatus('error');
        setSupabaseMessage(
          json.error || 'Supabase env vars not set on the server',
        );
        return;
      }
      setCounts(json.counts ?? null);
      setSupabaseStatus('ok');
      setSupabaseMessage('Supabase reachable');
    } catch (err) {
      setSupabaseStatus('error');
      setSupabaseMessage(err instanceof Error ? err.message : 'Request failed');
    }
  }, []);

  const checkGraph = useCallback(async () => {
    setGraphStatus('checking');
    try {
      const res = await fetch('/api/admin/graph-health', { method: 'GET' });
      const json = (await res.json()) as GraphHealth;
      setGraph(json);
      if (!json.configured) setGraphStatus('error');
      else if (!json.tokenIssued) setGraphStatus('error');
      else if (!json.directoryReachable) setGraphStatus('warn');
      else setGraphStatus('ok');
    } catch (err) {
      setGraphStatus('error');
      setGraph({
        configured: false,
        tokenIssued: false,
        directoryReachable: false,
        error: err instanceof Error ? err.message : 'Request failed',
      });
    }
  }, []);

  const runSeed = useCallback(async () => {
    setSeedStatus('checking');
    setSeedMessage('');
    try {
      const res = await fetch('/api/admin/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(DEFAULT_LEAP_SEED),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setSeedStatus('error');
        setSeedMessage(
          json.error ||
            (json.result?.errors?.[0] ?? 'Seed completed with errors'),
        );
      } else {
        setSeedStatus('ok');
        setSeedMessage(
          `Tenant ${json.result?.tenantCreated ? 'created' : 'exists'} — ` +
            `teams: ${json.result?.teamsUpserted}, positions: ${json.result?.positionsUpserted}`,
        );
        if (json.result?.counts) setCounts(json.result.counts);
      }
    } catch (err) {
      setSeedStatus('error');
      setSeedMessage(err instanceof Error ? err.message : 'Seed failed');
    }
  }, []);

  const runSync = useCallback(async () => {
    setSyncStatus('checking');
    setSyncResult(null);
    try {
      const res = await fetch('/api/admin/sync/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ upnDomain, dryRun }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSyncStatus('error');
        setSyncResult({ errors: [{ error: json.error || `HTTP ${res.status}` }] });
      } else {
        setSyncResult(json.result ?? null);
        setSyncStatus(
          (json.result?.errors?.length ?? 0) > 0 ? 'warn' : 'ok',
        );
        // Refresh employee count.
        void checkSupabase();
      }
    } catch (err) {
      setSyncStatus('error');
      setSyncResult({
        errors: [{ error: err instanceof Error ? err.message : 'Sync failed' }],
      });
    }
  }, [upnDomain, dryRun, checkSupabase]);

  // Auto-run the health checks on mount so the page shows current state.
  useEffect(() => {
    void checkSupabase();
    void checkGraph();
  }, [checkSupabase, checkGraph]);

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Production Setup</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Step-by-step initialization for a fresh LEAP deployment. Run these
          once, in order, after deploying to Vercel.
        </p>
      </div>

      {/* Step 1: Supabase */}
      <StepCard
        index={1}
        icon={<Database className="w-4 h-4" />}
        title="Supabase connection"
        description="Verifies NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY and reads current row counts."
        status={supabaseStatus}
        message={supabaseMessage}
        actionLabel="Check connection"
        onAction={checkSupabase}
      >
        {counts && (
          <div className="grid grid-cols-4 gap-2 mt-3">
            <CountPill label="Tenants" value={counts.tenants} />
            <CountPill label="Teams" value={counts.teams} />
            <CountPill label="Positions" value={counts.positions} />
            <CountPill label="Employees" value={counts.employees} />
          </div>
        )}
      </StepCard>

      {/* Step 2: Graph */}
      <StepCard
        index={2}
        icon={<Cloud className="w-4 h-4" />}
        title="Microsoft Graph API"
        description="Exchanges AZURE_CLIENT_SECRET for an access token and probes /users to prove directory-read permission."
        status={graphStatus}
        message={graph?.error}
        actionLabel="Re-check Graph"
        onAction={checkGraph}
      >
        {graph && (
          <div className="mt-3 space-y-1 text-xs text-slate-600">
            <FlagRow label="Configured" value={graph.configured} />
            <FlagRow label="Token issued" value={graph.tokenIssued} />
            <FlagRow
              label="Directory reachable"
              value={graph.directoryReachable}
            />
            {graph.tenantSampleUpn && (
              <div className="flex gap-2 pt-1">
                <span className="text-slate-500">Sample user:</span>
                <span className="font-mono">{graph.tenantSampleUpn}</span>
              </div>
            )}
          </div>
        )}
      </StepCard>

      {/* Step 3: Seed tenant + org */}
      <StepCard
        index={3}
        icon={<Building2 className="w-4 h-4" />}
        title="Seed tenant & org structure"
        description="Creates the LEAP tenant, teams, and position catalog if they don't exist. Safe to re-run."
        status={seedStatus}
        message={seedMessage}
        actionLabel="Run seed"
        onAction={runSeed}
        disabled={supabaseStatus !== 'ok'}
      >
        <div className="mt-3 text-xs text-slate-500">
          Will upsert:{' '}
          <span className="font-medium text-slate-700">
            1 tenant · {DEFAULT_LEAP_SEED.teams.length} teams ·{' '}
            {DEFAULT_LEAP_SEED.positions.length} positions
          </span>
        </div>
      </StepCard>

      {/* Step 4: Directory sync */}
      <StepCard
        index={4}
        icon={<Users className="w-4 h-4" />}
        title="Employee directory sync"
        description="Pulls every active user from Azure AD/Entra in the given UPN domain and upserts into the employees table."
        status={syncStatus}
        actionLabel={dryRun ? 'Dry run' : 'Sync now'}
        onAction={runSync}
        disabled={graphStatus !== 'ok' || supabaseStatus !== 'ok'}
      >
        <div className="mt-3 flex items-center gap-3">
          <Input
            value={upnDomain}
            onChange={(e) => setUpnDomain(e.target.value)}
            placeholder="leap.com.au"
            className="h-8 max-w-xs text-sm"
          />
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
            />
            Dry run (preview only)
          </label>
        </div>
        {syncResult && (
          <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs space-y-1">
            {syncResult.dryRun && (
              <div className="text-amber-700 font-medium">
                Dry run — no changes written
              </div>
            )}
            <div className="grid grid-cols-4 gap-2">
              <Stat label="Fetched" value={syncResult.totalFetched} />
              <Stat label="Inserted" value={syncResult.inserted} />
              <Stat label="Updated" value={syncResult.updated} />
              <Stat label="Skipped" value={syncResult.skipped} />
            </div>
            {(syncResult.errors?.length ?? 0) > 0 && (
              <div className="pt-2">
                <div className="font-medium text-rose-700 mb-1">
                  {syncResult.errors!.length} error(s):
                </div>
                <ul className="list-disc list-inside text-rose-700 max-h-40 overflow-auto">
                  {syncResult.errors!.slice(0, 20).map((e, i) => (
                    <li key={i}>
                      {e.upn ? <strong>{e.upn}:</strong> : null} {e.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </StepCard>

      <Separator />
      <p className="text-xs text-slate-500">
        Missing env vars? Set them with{' '}
        <code className="bg-slate-100 px-1 py-0.5 rounded">
          vercel env add &lt;NAME&gt; production
        </code>{' '}
        and redeploy. See <code className="bg-slate-100 px-1 py-0.5 rounded">SETUP_PRODUCTION.md</code> for
        the full runbook.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Presentational bits
// ---------------------------------------------------------------------------

function StepCard({
  index,
  icon,
  title,
  description,
  status,
  message,
  actionLabel,
  onAction,
  children,
  disabled,
}: {
  index: number;
  icon: React.ReactNode;
  title: string;
  description: string;
  status: StepStatus;
  message?: string;
  actionLabel: string;
  onAction: () => void;
  children?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <Card className="border shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
            {index}
          </div>
          <div className="p-1.5 rounded-md bg-slate-100 text-slate-600">
            {icon}
          </div>
          <CardTitle className="text-sm font-semibold text-slate-900">
            {title}
          </CardTitle>
          <StatusBadge status={status} />
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={onAction}
          disabled={status === 'checking' || disabled}
        >
          {status === 'checking' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
          ) : null}
          {actionLabel}
        </Button>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-xs text-slate-500">{description}</p>
        {message && (
          <p
            className={`text-xs mt-2 ${
              status === 'error'
                ? 'text-rose-700'
                : status === 'warn'
                ? 'text-amber-700'
                : 'text-emerald-700'
            }`}
          >
            {message}
          </p>
        )}
        {children}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: StepStatus }) {
  if (status === 'idle') {
    return (
      <Badge variant="outline" className="text-xs">
        Not run
      </Badge>
    );
  }
  if (status === 'checking') {
    return (
      <Badge variant="outline" className="text-xs bg-slate-100 text-slate-600">
        Running…
      </Badge>
    );
  }
  if (status === 'ok') {
    return (
      <Badge className="text-xs bg-emerald-100 text-emerald-700 border-emerald-200">
        <CheckCircle2 className="w-3 h-3 mr-1" /> Ready
      </Badge>
    );
  }
  if (status === 'warn') {
    return (
      <Badge className="text-xs bg-amber-100 text-amber-700 border-amber-200">
        <AlertCircle className="w-3 h-3 mr-1" /> Partial
      </Badge>
    );
  }
  return (
    <Badge className="text-xs bg-rose-100 text-rose-700 border-rose-200">
      <XCircle className="w-3 h-3 mr-1" /> Failed
    </Badge>
  );
}

function FlagRow({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {value ? (
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
      ) : (
        <XCircle className="w-3.5 h-3.5 text-rose-600" />
      )}
      <span>{label}</span>
    </div>
  );
}

function CountPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-slate-200 rounded-md p-2 text-center bg-white">
      <div className="text-lg font-semibold text-slate-900">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-slate-500">
        {label}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value?: number }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="font-semibold text-slate-800">{value ?? '—'}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LEAP defaults. Tweak once you know the actual org chart; the seed endpoint
// is idempotent so subsequent runs will no-op on existing rows.
// ---------------------------------------------------------------------------

const DEFAULT_LEAP_SEED = {
  tenant: {
    id: 'leap',
    name: 'LEAP Legal Software',
    slug: 'leap',
  },
  teams: [
    { name: 'Engineering', code: 'ENG', department: 'Technology' },
    { name: 'Product', code: 'PROD', department: 'Technology' },
    { name: 'Design', code: 'DES', department: 'Technology' },
    { name: 'People & Culture', code: 'PC', department: 'People' },
    { name: 'Sales', code: 'SALES', department: 'Revenue' },
    { name: 'Customer Success', code: 'CS', department: 'Revenue' },
    { name: 'Marketing', code: 'MKT', department: 'Revenue' },
    { name: 'Finance', code: 'FIN', department: 'Operations' },
    { name: 'Legal', code: 'LEGAL', department: 'Operations' },
    { name: 'Executive', code: 'EXEC', department: 'Executive' },
  ],
  positions: [
    {
      title: 'Software Engineer',
      level: 'IC3',
      department: 'Technology',
      jobFamily: 'engineering',
    },
    {
      title: 'Senior Software Engineer',
      level: 'IC4',
      department: 'Technology',
      jobFamily: 'engineering',
    },
    {
      title: 'Staff Engineer',
      level: 'IC5',
      department: 'Technology',
      jobFamily: 'engineering',
    },
    {
      title: 'Engineering Manager',
      level: 'M2',
      department: 'Technology',
      jobFamily: 'engineering',
    },
    {
      title: 'Product Manager',
      level: 'IC4',
      department: 'Technology',
      jobFamily: 'product',
    },
    {
      title: 'Senior Product Manager',
      level: 'IC5',
      department: 'Technology',
      jobFamily: 'product',
    },
    {
      title: 'Product Designer',
      level: 'IC3',
      department: 'Technology',
      jobFamily: 'design',
    },
    {
      title: 'HR Business Partner',
      level: 'IC4',
      department: 'People',
      jobFamily: 'people',
    },
    {
      title: 'Account Executive',
      level: 'IC3',
      department: 'Revenue',
      jobFamily: 'sales',
    },
    {
      title: 'Customer Success Manager',
      level: 'IC3',
      department: 'Revenue',
      jobFamily: 'customer_success',
    },
    {
      title: 'Marketing Manager',
      level: 'IC4',
      department: 'Revenue',
      jobFamily: 'marketing',
    },
    {
      title: 'Finance Analyst',
      level: 'IC3',
      department: 'Operations',
      jobFamily: 'finance',
    },
    {
      title: 'Legal Counsel',
      level: 'IC5',
      department: 'Operations',
      jobFamily: 'legal',
    },
    { title: 'CEO', level: 'E1', department: 'Executive', jobFamily: 'executive' },
    { title: 'CTO', level: 'E1', department: 'Executive', jobFamily: 'executive' },
  ],
} as const;
