'use client';

/**
 * Error Boundary Component — App-Styled Fallback
 *
 * Catches JavaScript errors in child components and displays a
 * brand-consistent fallback UI with support information.
 */

import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { logger } from '@/lib/observability/logger';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
  errorId?: string;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorId: crypto.randomUUID() };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const errorId = this.state.errorId || crypto.randomUUID();
    logger.error('ErrorBoundary caught an error', {
      component: 'components:error-boundary',
      errorId,
      error: error instanceof Error ? error.message : String(error),
      errorInfo: errorInfo.componentStack,
    });
    this.setState({ errorInfo, errorId });

    if (process.env.NODE_ENV === 'production' && typeof window !== 'undefined') {
      // Sentry.captureException(error, { extra: { ...errorInfo, errorId } });
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined, errorId: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--navy-50)] p-4">
          <Card className="max-w-md w-full border shadow-lg">
            <CardContent className="p-8 text-center">
              <div className="flex justify-center mb-4">
                <div className="bg-red-100 p-3 rounded-full">
                  <AlertTriangle className="h-8 w-8 text-red-600" aria-hidden="true" />
                </div>
              </div>

              <h1 className="text-xl font-semibold text-slate-900 mb-2">
                Something went wrong
              </h1>

              <p className="text-sm text-slate-500 mb-6">
                We apologize for the inconvenience. An error occurred while rendering this page.
              </p>

              {this.state.errorId && (
                <p className="text-xs text-slate-400 mb-4 font-mono">
                  Error ID: {this.state.errorId}
                </p>
              )}

              {process.env.NODE_ENV === 'development' && this.state.error && (
                <div className="mb-6 text-left">
                  <details className="bg-red-50 border border-red-200 rounded-lg overflow-hidden">
                    <summary className="px-3 py-2 text-sm font-medium text-red-800 cursor-pointer select-none">
                      {this.state.error.name}: {this.state.error.message}
                    </summary>
                    {this.state.errorInfo && (
                      <pre className="text-xs text-red-600 p-3 overflow-auto max-h-48 border-t border-red-200">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    )}
                  </details>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  onClick={this.handleReset}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white h-9"
                >
                  <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
                  Try again
                </Button>

                <Link href="/" className="inline-flex items-center justify-center h-9 px-4 py-2 border border-slate-300 text-sm font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
                  <Home className="h-4 w-4 mr-2" aria-hidden="true" />
                  Go home
                </Link>
              </div>

              <p className="mt-4 text-xs text-slate-400">
                If this problem persists, contact support with the error ID above.
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
