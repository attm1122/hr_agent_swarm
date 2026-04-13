import { ChatWorkspace } from '@/components/chat/ChatWorkspace';
import { isAnthropicConfigured } from '@/lib/ai/anthropic-client';
import { Card, CardContent } from '@/components/ui/card';
import { Bot, AlertTriangle } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function ChatPage() {
  const aiReady = isAnthropicConfigured();

  if (!aiReady) {
    return (
      <div className="flex h-full items-center justify-center">
        <Card className="max-w-lg border shadow-sm">
          <CardContent className="p-8 text-center">
            <Bot className="mx-auto mb-4 h-12 w-12 text-slate-400" />
            <h1 className="text-lg font-semibold text-slate-900">
              AI Assistant is not yet configured
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Set <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">ANTHROPIC_API_KEY</code> in the server environment and redeploy to enable conversational AI.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>All other HR tools continue to work normally.</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <ChatWorkspace />;
}
