import { MessageCircle } from 'lucide-react';

const EMPTY_MESSAGE =
    'No active conversations yet. Chat unlocks automatically when your campaigns reach the script or content creation phase.';

export function MessagesEmptyState() {
    return (
        <div
            className="flex flex-col items-center justify-center py-16 px-6 text-center animate-fade-in"
            style={{ minHeight: '400px' }}
        >
            {/* Illustration: chat bubbles */}
            <div className="relative mb-6">
                <div className="w-20 h-20 rounded-full bg-foreground flex items-center justify-center">
                    <MessageCircle className="w-9 h-9 text-background" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-accent border-2 border-card flex items-center justify-center">
                    <MessageCircle className="w-4 h-4 text-accent-foreground" />
                </div>
            </div>
            <h3 className="text-lg font-semibold font-display text-foreground mb-2">
                No conversations yet
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm">
                {EMPTY_MESSAGE}
            </p>
        </div>
    );
}
