import { X, Trash2, Calendar, MessageSquare, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AIChatSession } from '../hooks/useAIChatSessions';
import { useState } from 'react';
import { toast } from 'sonner';

interface AIHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    sessions: AIChatSession[];
    isLoading: boolean;
    onSessionSelect: (session: AIChatSession) => void;
    onSessionDelete: (sessionId: string) => Promise<void>;
    currentSessionId?: string;
}

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

export function AIHistoryModal({
    isOpen,
    onClose,
    sessions,
    isLoading,
    onSessionSelect,
    onSessionDelete,
    currentSessionId,
}: AIHistoryModalProps) {
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    if (!isOpen) return null;

    const handleDelete = async (sessionId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (deleteConfirm === sessionId) {
            setIsDeleting(true);
            try {
                await onSessionDelete(sessionId);
                setDeleteConfirm(null);
                toast.success('Chat history deleted');
            } catch (err) {
                toast.error('Failed to delete chat history');
            } finally {
                setIsDeleting(false);
            }
        } else {
            setDeleteConfirm(sessionId);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-2xl max-h-[75vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                    <div>
                        <h2 className="font-semibold text-lg">Chat History</h2>
                        <p className="text-xs text-muted-foreground">View and manage your campaign strategy chats</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Content */}
                <div className="overflow-y-auto flex-1">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading history...
                        </div>
                    ) : sessions.length === 0 ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="text-center">
                                <MessageSquare className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
                                <p className="text-sm text-muted-foreground">No chat history yet</p>
                            </div>
                        </div>
                    ) : (
                        <div className="divide-y divide-border">
                            {sessions.map((session) => (
                                <div
                                    key={session.id}
                                    onClick={() => {
                                        onSessionSelect(session);
                                        onClose();
                                    }}
                                    className={cn(
                                        'w-full text-left p-4 hover:bg-secondary/50 transition-colors group cursor-pointer',
                                        currentSessionId === session.id && 'bg-[#fedc03]/5 border-l-2 border-[#fedc03]'
                                    )}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            onSessionSelect(session);
                                            onClose();
                                        }
                                    }}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-medium text-sm truncate">
                                                {session.title || 'Untitled Campaign'}
                                            </h3>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {session.status === 'completed' ? 'Strategy completed' : 'In progress...'}
                                            </p>
                                            <div className="flex items-center gap-4 mt-2 text-[11px] text-muted-foreground">
                                                <span className="flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" />
                                                    {timeAgo(session.createdAt)}
                                                </span>
                                                {session.messageCount && (
                                                    <span className="flex items-center gap-1">
                                                        <MessageSquare className="w-3 h-3" />
                                                        {session.messageCount} messages
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="shrink-0">
                                            <button
                                                onClick={(e) => handleDelete(session.id, e)}
                                                disabled={isDeleting}
                                                className={cn(
                                                    'p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100',
                                                    deleteConfirm === session.id && 'opacity-100 bg-destructive/10 text-destructive',
                                                    isDeleting && 'opacity-50 cursor-not-allowed'
                                                )}
                                                title={deleteConfirm === session.id ? 'Click again to confirm' : 'Delete'}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

