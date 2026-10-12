import { ArrowUpRight, CalendarDays, Mail, Phone } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import { cn } from '@/lib/utils';
import type { TeamMember } from '../hooks/useTeam';

// Avatar tones rotate by member so the roster doesn't read as a wall of identical circles.
const AVATAR_TONES = [
    'bg-foreground text-brand',
    'bg-secondary text-foreground ring-1 ring-inset ring-border',
    'bg-brand/20 text-foreground ring-1 ring-inset ring-brand/40',
];

export function memberInitials(name: string) {
    const parts = name.trim().split(/\s+/);
    return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function avatarTone(id: string) {
    let hash = 0;
    for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    return AVATAR_TONES[hash % AVATAR_TONES.length];
}

interface TeamMemberCardProps {
    member: TeamMember;
    showBrands: boolean;
    onOpen: () => void;
    className?: string;
}

/** One roster card on the Teams page — compact. The whole card opens the member's detail page. */
export function TeamMemberCard({ member, showBrands, onOpen, className }: TeamMemberCardProps) {
    const joined = formatDistanceToNowStrict(new Date(member.createdAt), { addSuffix: true });
    const isNew = Date.now() - new Date(member.createdAt).getTime() < 14 * 86_400_000;

    return (
        <button
            type="button"
            onClick={onOpen}
            className={cn(
                'group relative isolate flex w-full animate-fade-up flex-col overflow-hidden rounded-2xl border border-border bg-card p-4 text-left shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-brand/50 hover:shadow-float focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
                className,
            )}
        >
            {/* Hover: a soft yellow glow blooms in the top corner */}
            <span aria-hidden className="pointer-events-none absolute -right-12 -top-12 -z-10 h-32 w-32 scale-50 rounded-full bg-brand/30 opacity-0 blur-3xl transition-all duration-500 group-hover:scale-100 group-hover:opacity-100" />

            {/* Avatar, name and status on one row; the open arrow on the right */}
            <div className="flex items-center gap-3">
                <span className="relative shrink-0">
                    <span className={cn(
                        'grid h-10 w-10 place-items-center rounded-xl font-display text-xs font-bold tracking-wide transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105',
                        avatarTone(member.id),
                        !member.isActive && 'opacity-50 grayscale',
                    )}>
                        {memberInitials(member.name)}
                    </span>
                    <span
                        aria-hidden
                        className={cn(
                            'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card',
                            member.isActive ? 'bg-success' : 'bg-muted-foreground/40',
                        )}
                    />
                </span>
                <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                        <span className={cn('truncate font-display text-sm font-semibold tracking-tight', !member.isActive && 'text-muted-foreground')}>
                            {member.name}
                        </span>
                        {isNew && member.isActive && (
                            <span className="shrink-0 rounded-full bg-brand/20 px-1.5 py-px text-[9px] font-bold uppercase tracking-[0.08em]">New</span>
                        )}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">{member.isActive ? 'Active · Team member' : 'Deactivated'}</span>
                </span>
                <span className="relative grid h-7 w-7 shrink-0 place-items-center rounded-full border border-border text-muted-foreground transition-all duration-300 group-hover:border-brand group-hover:bg-brand group-hover:text-black">
                    <ArrowUpRight className="h-3 w-3 transition-transform duration-300 group-hover:rotate-45" />
                </span>
            </div>

            <div className="mb-3 mt-3 space-y-1 text-[11px]">
                <p className="flex min-w-0 items-center gap-2 text-foreground/80">
                    <Mail className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className="truncate">{member.email}</span>
                </p>
                <p className="flex min-w-0 items-center gap-2 text-foreground/80">
                    <Phone className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className={cn('truncate', !member.phoneNumber && 'text-muted-foreground/70')}>
                        {member.phoneNumber || 'No phone added'}
                    </span>
                </p>
            </div>

            {/* Footer: the brands this member manages (agencies), then when they joined */}
            <div className="mt-auto flex items-center gap-2 border-t border-dashed border-border pt-2.5 text-[10px] text-muted-foreground">
                {showBrands && member.brands.length > 0 && (
                    <span className="flex min-w-0 items-center gap-1">
                        <span className="truncate rounded-full border border-border px-1.5 py-px font-medium text-foreground">{member.brands[0].brandName}</span>
                        {member.brands.length > 1 && (
                            <span className="shrink-0 rounded-full bg-secondary px-1.5 py-px font-semibold" title={member.brands.slice(1).map((b) => b.brandName).join(', ')}>
                                +{member.brands.length - 1}
                            </span>
                        )}
                    </span>
                )}
                <span className="ml-auto flex shrink-0 items-center gap-1 font-medium">
                    <CalendarDays className="h-3 w-3" />
                    {joined}
                </span>
            </div>
        </button>
    );
}
