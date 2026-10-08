import { useState } from 'react';
import { Headset } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { DedicatedManagerModal } from '@/shared/components/DedicatedManagerModal';
import { useAuthStore } from '@/shared/stores/authStore';
import { cn } from '@/lib/utils';

/**
 * "Hire a Manager" call-to-action, rendered inside PageHeader's actions row so it
 * sits inline beside each page's own action buttons (Add new brand, Create
 * Campaign, …) on every page — no reserved strip, no pushed-down content.
 *
 * Visible to every signed-in user, all the time: the dialog lets anyone reach the
 * Mutiny Talent team directly (email / WhatsApp) or request a callback.
 *
 * `compact` renders an icon-only square button for tight surfaces that have no
 * PageHeader actions row — currently the Messages conversation-list header, where a
 * full-width labelled button would crowd the title at a 300px column width.
 */
/** `className` restyles the button for a surface (e.g. the dashboard's pill buttons); default look otherwise. */
export function HireManagerButton({ compact = false, className }: { compact?: boolean; className?: string }) {
    const user = useAuthStore((s) => s.user);
    const [isManagerModalOpen, setIsManagerModalOpen] = useState(false);

    if (!user) return null;

    return (
        <>
            <Button
                type="button"
                variant="outline"
                size={compact ? 'icon' : 'default'}
                className={cn(compact && 'h-9 w-9 shrink-0 rounded-full', className)}
                onClick={() => setIsManagerModalOpen(true)}
                aria-label="Hire a Manager"
                title="Connect with the Mutiny Talent team for a dedicated account manager"
            >
                <Headset className={compact ? 'w-4 h-4' : 'w-4 h-4 sm:mr-0.5'} />
                {!compact && <span className="hidden sm:inline">Hire a Manager</span>}
            </Button>
            <DedicatedManagerModal open={isManagerModalOpen} onOpenChange={setIsManagerModalOpen} />
        </>
    );
}
