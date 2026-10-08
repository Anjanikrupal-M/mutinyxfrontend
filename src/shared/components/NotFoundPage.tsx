import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';

export default function NotFoundPage() {
    return (
        <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in">
            <div className="text-7xl font-bold font-display text-muted-foreground/20 mb-4">404</div>
            <h1 className="text-2xl font-bold font-display mb-2">Page Not Found</h1>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm">The page you're looking for doesn't exist or has been moved.</p>
            <Link
                to="/dashboard"
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-premium"
            >
                <Home className="w-4 h-4" />
                Go to Dashboard
            </Link>
        </div>
    );
}
