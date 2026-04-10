import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mail, MessageSquare, Plus, Send, Clock, CheckCircle2, FileText } from 'lucide-react';

const templates = [
  { id: 'ct-1', name: 'Welcome Email', category: 'onboarding', channel: 'email', uses: 12 },
  { id: 'ct-2', name: 'Probation Reminder', category: 'compliance', channel: 'email', uses: 8 },
  { id: 'ct-3', name: 'Anniversary Congratulations', category: 'engagement', channel: 'slack', uses: 15 },
  { id: 'ct-4', name: 'Document Expiry Alert', category: 'compliance', channel: 'email', uses: 6 },
  { id: 'ct-5', name: 'Leave Approval Notification', category: 'leave', channel: 'email', uses: 24 },
  { id: 'ct-6', name: 'Team Announcement', category: 'general', channel: 'slack', uses: 4 },
];

const recentDrafts = [
  { id: 'd-1', subject: 'Welcome aboard, Jessica!', recipient: 'Jessica Wong', status: 'draft' as const, date: '2025-04-01' },
  { id: 'd-2', subject: 'Visa Expiry Reminder', recipient: 'Jessica Wong', status: 'sent' as const, date: '2025-03-28' },
  { id: 'd-3', subject: 'Happy 6 Year Anniversary!', recipient: 'David Park', status: 'sent' as const, date: '2025-03-15' },
];

export default function CommunicationsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Communications</h1>
          <p className="text-sm text-slate-500 mt-0.5">{templates.length} templates, {recentDrafts.length} recent drafts</p>
        </div>
        <Button size="sm" className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white">
          <Plus className="w-4 h-4 mr-2" />
          New Draft
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100"><FileText className="w-4 h-4 text-blue-600" /></div>
            <div><p className="text-2xl font-bold text-slate-900">{templates.length}</p><p className="text-xs text-slate-500">Templates</p></div>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100"><Clock className="w-4 h-4 text-amber-600" /></div>
            <div><p className="text-2xl font-bold text-slate-900">1</p><p className="text-xs text-slate-500">Drafts</p></div>
          </CardContent>
        </Card>
        <Card className="border shadow-sm bg-emerald-50/50 border-emerald-200">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100"><Send className="w-4 h-4 text-emerald-600" /></div>
            <div><p className="text-2xl font-bold text-slate-900">2</p><p className="text-xs text-slate-500">Sent This Week</p></div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Templates */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-500" />
              Templates
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {templates.map(t => (
                <div key={t.id} className="flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors">
                  {t.channel === 'email' ? <Mail className="w-4 h-4 text-slate-400" /> : <MessageSquare className="w-4 h-4 text-slate-400" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900">{t.name}</p>
                    <p className="text-xs text-slate-500 capitalize">{t.category} · {t.channel}</p>
                  </div>
                  <Badge variant="secondary" className="text-xs">{t.uses} uses</Badge>
                  <Button variant="ghost" size="sm" className="h-7 text-xs">Use</Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Drafts */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Send className="w-4 h-4 text-emerald-500" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {recentDrafts.map(d => (
                <div key={d.id} className="flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900">{d.subject}</p>
                    <p className="text-xs text-slate-500">To: {d.recipient} · {new Date(d.date).toLocaleDateString()}</p>
                  </div>
                  <Badge variant="outline" className={
                    d.status === 'sent' ? 'bg-emerald-100 text-emerald-700 border-emerald-200 text-xs' :
                    'bg-amber-100 text-amber-700 border-amber-200 text-xs'
                  }>{d.status}</Badge>
                  {d.status === 'draft' && <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white">Send</Button>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
