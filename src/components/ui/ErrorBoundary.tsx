import { Component, type ReactNode, type ErrorInfo } from 'react';
import { Button } from './Button';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center p-6 text-center">
          <div className="rounded-full bg-red-50 p-3 text-red-600 mb-4">
            <AlertTriangle className="h-8 w-8" strokeWidth={1.5} />
          </div>
          <h2 className="text-lg font-bold text-neutral-900 mb-1">Something went wrong</h2>
          <p className="max-w-md text-sm text-neutral-500 mb-4">
            {this.state.error?.message || 'An unexpected error occurred while loading this section.'}
          </p>
          <Button onClick={this.handleReset} size="sm">
            Refresh page
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
