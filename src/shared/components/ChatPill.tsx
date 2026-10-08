import { MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip';

const CHAT_LOCKED_TOOLTIP = 'Chat unlocks automatically during the script & work phase.';

interface ChatPillProps {
    chatEnabled: boolean;
    unreadCount?: number;
    onClick?: () => void;
    className?: string;
}

export function ChatPill({ chatEnabled, unreadCount = 0, onClick, className }: ChatPillProps) {
    const button = (
        <button
            type="button"
            onClick={chatEnabled ? onClick : undefined}
            disabled={!chatEnabled}
            className={cn(
                'inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium transition-premium',
                chatEnabled
                    ? 'bg-secondary/80 hover:bg-secondary text-muted-foreground hover:text-foreground'
                    : 'bg-secondary/60 text-muted-foreground/70 cursor-not-allowed',
                className
            )}
            title={chatEnabled ? 'Open chat' : undefined}
        >
            <MessageCircle className="w-3 h-3" />
            Chat
            {chatEnabled && unreadCount > 0 && (
                <span className="w-3.5 h-3.5 rounded-full bg-[#fedc03] text-black text-[8px] font-bold flex items-center justify-center">
                    {unreadCount}
                </span>
            )}
        </button>
    );

    if (!chatEnabled) {
        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>{button}</TooltipTrigger>
                    <TooltipContent>{CHAT_LOCKED_TOOLTIP}</TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }

    return button;
}
