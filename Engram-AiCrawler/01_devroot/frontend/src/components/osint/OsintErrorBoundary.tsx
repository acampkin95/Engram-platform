import { Component, type ReactNode } from 'react';
import { FaCircleExclamation, FaRotate } from 'react-icons/fa6';
import { Button, Card, CardBody } from '@/components/ui';

interface Props {
  children: ReactNode;
  panelName?: string;
  onRetry?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class OsintErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[OsintErrorBoundary] ${this.props.panelName ?? 'Panel'} error:`, error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    this.props.onRetry?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <Card className="border-neon-r/30">
          <CardBody className="relative flex flex-col items-center justify-center py-12 text-center">
            {/* Corner bracket decorations */}
            <span className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-neon-r" />
            <span className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-neon-r" />
            <span className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-neon-r" />
            <span className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-neon-r" />

            <FaCircleExclamation className="w-10 h-10 text-neon-r mb-3" />
            <h3 className="text-sm font-semibold text-text mb-1">
              {this.props.panelName ?? 'Panel'} encountered an error
            </h3>
            <p className="text-xs text-text-dim mb-4 max-w-sm">
              {this.state.error?.message ?? 'An unexpected error occurred. Please try again.'}
            </p>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<FaRotate className="w-4 h-4" />}
              onClick={this.handleRetry}
            >
              Retry
            </Button>
          </CardBody>
        </Card>
      );
    }

    return this.props.children;
  }
}
