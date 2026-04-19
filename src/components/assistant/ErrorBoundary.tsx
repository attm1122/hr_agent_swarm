'use client';

import { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * React error boundary tailored to the AssistantWorkspace.
 *
 * Catches rendering errors in child components and shows a graceful
 * fallback UI that matches the existing slate/emerald palette.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[AssistantWorkspace] ErrorBoundary caught:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const isDev = process.env.NODE_ENV !== 'production';

    return (
      <Card className="mx-auto max-w-lg border-slate-200 dark:border-slate-800">
        <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
            <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>

          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">
              Something went wrong
            </h2>
            <p className="text-sm text-muted-foreground">
              Part of the workspace could not be displayed.
            </p>
          </div>

          {isDev && this.state.error && (
            <div className="w-full rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-left text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              {this.state.error.message}
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button variant="default" size="sm" onClick={this.handleReset}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Try again
            </Button>
            <Link
              href="/"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              <Home className="mr-1.5 h-3.5 w-3.5" />
              Go home
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }
}

export default ErrorBoundary;
