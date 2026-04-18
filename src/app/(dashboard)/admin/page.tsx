export const dynamic = 'force-dynamic';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Settings, Database, Shield, Users, Bell, Palette, Key, Globe } from 'lucide-react';

const settingsGroups = [
  {
    title: 'General',
    items: [
      { icon: Globe, label: 'Organization', description: 'Company name, timezone, locale settings', status: 'Configured' },
      { icon: Palette, label: 'Appearance', description: 'Theme, branding, and display preferences', status: 'Default' },
      { icon: Bell, label: 'Notifications', description: 'Email and Slack notification preferences', status: '3 active' },
    ],
  },
  {
    title: 'Security & Access',
    items: [
      { icon: Shield, label: 'Roles & Permissions', description: 'Manage user roles and access levels', status: '4 roles' },
      { icon: Key, label: 'API Keys', description: 'Manage integrations and API access tokens', status: '2 active' },
      { icon: Users, label: 'User Management', description: 'Admin users and authentication settings', status: '3 admins' },
    ],
  },
  {
    title: 'Integrations',
    items: [
      { icon: Database, label: 'Supabase', description: 'Database connection and configuration', status: 'Connected' },
      { icon: Database, label: 'BambooHR', description: 'Employee data sync', status: 'Not configured' },
      { icon: Database, label: 'Slack', description: 'Notifications and communications', status: 'Connected' },
    ],
  },
];

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Settings</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage your HR Agent Swarm configuration</p>
        </div>
      </div>

      {settingsGroups.map((group, gi) => (
        <div key={gi}>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">{group.title}</h2>
          <Card className="border shadow-sm">
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100">
                {group.items.map((item, ii) => {
                  const Icon = item.icon;
                  const isConnected = item.status === 'Connected' || item.status === 'Configured';
                  return (
                    <div key={ii} className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors cursor-pointer">
                      <div className="p-2 rounded-lg bg-slate-100 flex-shrink-0">
                        <Icon className="w-4 h-4 text-slate-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900">{item.label}</p>
                        <p className="text-xs text-slate-500">{item.description}</p>
                      </div>
                      <Badge variant="outline" className={
                        isConnected ? 'bg-emerald-100 text-emerald-700 border-emerald-200 text-xs' :
                        item.status === 'Not configured' ? 'bg-slate-100 text-slate-500 border-slate-200 text-xs' :
                        'text-xs'
                      }>{item.status}</Badge>
                      <Button variant="ghost" size="sm" className="h-7 text-xs">Configure</Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  );
}
