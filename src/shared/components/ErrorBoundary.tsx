import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
    children: ReactNode;
    /** Optional custom fallback — if omitted the built-in error card is shown. */
    fallback?: ReactNode;
    title?: string;
    onReset?: () => void;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

/**
 * Class-based error boundary that wraps subtrees to catch rendering exceptions.
 * React Router's errorElement handles route-level errors; this handles the rest.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <SomeComponent />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('[ErrorBoundary caught error]:', error, errorInfo);
    }

    private reset = () => {
        this.props.onReset?.();
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) return this.props.fallback;

            return (
                <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in surface rounded-2xl p-6 border border-border">
                    <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center mb-4">
                        <AlertTriangle className="w-6 h-6 text-destructive" />
                    </div>
                    <h2 className="text-lg font-semibold font-display mb-1">{this.props.title ?? 'Something went wrong'}</h2>
                    <p className="text-sm text-muted-foreground mb-5 max-w-md">
                        {(import.meta.env.DEV && this.state.error?.message) || 'An unexpected error occurred while loading this view. Try again, or refresh the page.'}
                    </p>
                    <button
                        onClick={this.reset}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90 transition-premium"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Try again
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

