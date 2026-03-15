'use client';

import * as Sentry from '@sentry/nextjs';
import { AlertTriangle, LayoutDashboard, RefreshCw } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    Sentry.captureException(error);
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught error:', error, errorInfo);
    }
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isDev = process.env.NODE_ENV === 'development';

      return (
        <div
          role="alert"
          aria-live="assertive"
          className="min-h-screen bg-[#03020a] flex items-center justify-center p-4"
        >
          <div className="bg-[#090818] border border-[#1e1e3a] p-8 max-w-2xl w-full">
            {/* Header */}
            <div className="flex items-start gap-4 mb-6">
              <div className="p-3 bg-[#F2A93B]/10 flex-shrink-0">
                <AlertTriangle className="w-8 h-8 text-[#F2A93B]" aria-hidden="true" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[#f0eef8]">Something went wrong</h1>
                <p className="text-[#a09bb8] mt-1">
                  An unexpected error occurred. You can try again or return to the dashboard.
                </p>
              </div>
            </div>

            {/* Error details — user-friendly message in production, full info in dev */}
            {this.state.error && (
              <div className="bg-[#03020a] p-4 mb-6 border border-[#1e1e3a]">
                <p className="text-[#F2A93B] font-mono text-sm break-all">
                  {isDev
                    ? this.state.error.toString()
                    : this.state.error.message || 'An unexpected error occurred.'}
                </p>
                {isDev && this.state.errorInfo && (
                  <details className="mt-4">
                    <summary className="text-[#5c5878] cursor-pointer hover:text-[#f0eef8] text-sm select-none">
                      Stack trace (development only)
                    </summary>
                    <pre className="text-xs text-[#5c5878] mt-2 overflow-auto max-h-64 whitespace-pre-wrap">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={this.handleReset}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#F2A93B]/10 border border-[#F2A93B]/20 text-[#F2A93B] hover:bg-[#F2A93B]/20 font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F2A93B] focus-visible:ring-offset-2 focus-visible:ring-offset-[#03020a]"
              >
                <RefreshCw className="w-4 h-4" aria-hidden="true" />
                Try Again
              </button>

              <a
                href="/"
                onClick={this.handleReset}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#141428] border border-[#2a2a50] text-[#a09bb8] hover:border-[#F2A93B]/50 hover:text-[#f0eef8] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2a2a50] focus-visible:ring-offset-2 focus-visible:ring-offset-[#03020a]"
              >
                <LayoutDashboard className="w-4 h-4" aria-hidden="true" />
                Go to Dashboard
              </a>

              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#141428] border border-[#2a2a50] text-[#a09bb8] hover:border-[#F2A93B]/50 hover:text-[#f0eef8] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2a2a50] focus-visible:ring-offset-2 focus-visible:ring-offset-[#03020a]"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
