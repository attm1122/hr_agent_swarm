import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Database, Shield, Users, Bell, Palette, Key, Globe, Rocket, ArrowRight, Settings } from 'lucide-react';
import { ContextualCopilot } from '@/components/shared/ContextualCopilot';

const settingsGroups = [
  {
    title: 'General',
    items: [
      { icon: Globe, label: 'Organization', description: 'Company name, timezone, locale', status: 'Configured' },
      { icon: Palette, label: 'Appearance', description: 'Theme and display preferences', status: 'Default' },
      { icon: Bell, label: 'Notifications', description: 'Email and Slack preferences', status: '3 active' },
    ],
  },
  {
    title: 'Security & Access',
    items: [
      { icon: Shield, label: 'Roles & Permissions', description: 'Manage user roles and access', status: '4 roles' },
      { icon: Key, label: 'API Keys', description: 'Integrations and API tokens', status: '2 active' },
      { icon: Users, label: 'User Management', description: 'Admin users and auth settings', status: '3 admins' },
    ],
  },
  {
    title: 'Integrations',
    items: [
      { icon: Database, label: 'Supabase', description: 'Database connection', status: 'Connected' },
      { icon: Database, label: 'BambooHR', description: 'Employee data sync', status: 'Not configured' },
      { icon: Database, label: 'Slack', description: 'Notifications and comms', status: 'Connected' },
    ],
  },
];

export default function AdminPage() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="ds-display">Settings</h1>
          <p className="ds-meta mt-1">Manage your HR Agent Swarm configuration</p>
        </div>
      </div>

      <ContextualCopilot
        context="settings and configuration"
        placeholder="Find settings, configure integrations, or check system status..."
        suggestions={[
          'How do I configure SSO?',
          'Show me active API keys',
          'What integrations are connected?',
        ]}
      />

      {/* Production Setup Card */}
      <Link href="/admin/setup" className="block group">
        <div className="bg-white rounded-lg border border-[var(--info-border)] p-4 flex items-center gap-4 hover:shadow-sm transition-shadow">
          <div className="p-2.5 rounded-lg bg-[var(--info-bg)] text-[var(--info-text)]">
            <Rocket className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="ds-title">Production Setup</p>
            <p className="ds-meta">Verify Supabase + Graph, seed tenant, sync employees</p>
          </div>
          <Button variant="ghost" size="sm" className="h-8 gap-1 text-[var(--info-text)] group-hover:bg-[var(--info-bg)]">
            Open
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </Link>

      {/* Settings Groups */}
      {settingsGroups.map((group, gi) => (
        <div key={gi}>
          <h2 className="ds-heading mb-2">{group.title}</h2>
          <div className="bg-white rounded-lg border border-[var(--border-default)] overflow-hidden divide-y divide-[var(--border-subtle)]">
            {group.items.map((item, ii) => {
              const Icon = item.icon;
              const isConnected = item.status === 'Connected' || item.status === 'Configured';
              return (
                <div key={ii} className="flex items-center gap-4 px-4 py-3 hover:bg-[var(--muted-surface)] transition-colors cursor-pointer">
                  <div className="p-2 rounded-md bg-[var(--muted-surface)] shrink-0">
                    <Icon className="w-4 h-4 text-[var(--text-tertiary)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="ds-title">{item.label}</p>
                    <p className="ds-meta">{item.description}</p>
                  </div>
                  <Badge variant="outline" className={
                    isConnected ? 'status-active text-[11px]' :
                    item.status === 'Not configured' ? 'status-neutral text-[11px]' :
                    'text-[11px]'
                  }>{item.status}</Badge>
                  <Button variant="ghost" size="sm" className="h-7 text-xs">Configure</Button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
