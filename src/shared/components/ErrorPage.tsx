import { useRouteError, isRouteErrorResponse, Link } from 'react-router-dom';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';

export default function ErrorPage() {
    const error = useRouteError();

    let title = 'Something went wrong';
    let message = 'An unexpected error occurred. Please try again.';
    let statusCode: number | null = null;

    if (isRouteErrorResponse(error)) {
        statusCode = error.status;
        if (error.status === 404) {
            title = 'Page Not Found';
            message = "The page you're looking for doesn't exist or has been moved.";
        } else if (error.status === 403) {
            title = 'Access Denied';
            message = "You don't have permission to access this page.";
        } else if (error.status >= 500) {
            title = 'Server Error';
            message = 'The server encountered an error. Please try again later.';
        }
    } else if (error instanceof Error) {
        message = error.message;
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] py-24 text-center animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mb-6">
                <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>

            {statusCode && (
                <p className="text-5xl font-bold font-display text-muted-foreground/20 mb-2">
                    {statusCode}
                </p>
            )}

            <h1 className="text-2xl font-bold font-display mb-2">{title}</h1>
            <p className="text-sm text-muted-foreground mb-8 max-w-sm">{message}</p>

            <div className="flex items-center gap-3">
                <button
                    onClick={() => window.location.reload()}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-secondary transition-premium"
                >
                    <RefreshCw className="w-4 h-4" />
                    Try again
                </button>
                <Link
                    to="/dashboard"
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90 transition-premium"
                >
                    <Home className="w-4 h-4" />
                    Go to Dashboard
                </Link>
            </div>
        </div>
    );
}
