import { Component, type ReactNode, type ErrorInfo } from'react';
import { AlertTriangle, RefreshCw, LayoutDashboard } from'lucide-react';

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
 return {
 hasError: true,
 error,
 };
 }

 componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
 if (process.env.NODE_ENV ==='development') {
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

 const isDev = process.env.NODE_ENV ==='development';

 return (
 <div
 role="alert"
 aria-live="assertive"
 className="min-h-screen bg-void flex items-center justify-center p-4"
 >
 <div className="bg-surface border border-border p-8 max-w-2xl w-full">
 {/* Header */}
 <div className="flex items-start gap-4 mb-6">
 <div className="p-3 bg-neon-r/10 flex-shrink-0">
 <AlertTriangle className="w-8 h-8 text-neon-r" aria-hidden="true" />
 </div>
 <div>
 <h1 className="text-2xl font-bold text-text">
 Something went wrong
 </h1>
 <p className="text-text-dim mt-1">
 An unexpected error occurred. You can try again or return to the dashboard.
 </p>
 </div>
 </div>

 {/* Error details — user-friendly message in production, full info in dev */}
 {this.state.error && (
 <div className="bg-void p-4 mb-6 border border-border">
 <p className="text-neon-r font-mono text-sm break-all">
 {isDev
 ? this.state.error.toString()
 : this.state.error.message ||'An unexpected error occurred.'}
 </p>
 {isDev && this.state.errorInfo && (
 <details className="mt-4">
 <summary className="text-text-dim cursor-pointer hover:text-text text-sm select-none">
 Stack trace (development only)
 </summary>
 <pre className="text-xs text-text-dim mt-2 overflow-auto max-h-64 whitespace-pre-wrap">
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
 className="inline-flex items-center gap-2 px-4 py-2 bg-cyan hover:bg-cyan-dim text-void font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan focus-visible:ring-offset-2"
 >
 <RefreshCw className="w-4 h-4" aria-hidden="true" />
 Try Again
 </button>

 <a
 href="/"
 onClick={this.handleReset}
 className="inline-flex items-center gap-2 px-4 py-2 bg-raised hover:bg-raised text-text font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-border focus-visible:ring-offset-2"
 >
 <LayoutDashboard className="w-4 h-4" aria-hidden="true" />
 Go to Dashboard
 </a>

 <button
 type="button"
 onClick={() => window.location.reload()}
 className="inline-flex items-center gap-2 px-4 py-2 bg-raised hover:bg-raised text-text font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-border focus-visible:ring-offset-2"
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
