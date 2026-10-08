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

/** One roster card on the Teams page. The whole card opens the member's detail page. */
export function TeamMemberCard({ member, showBrands, onOpen, className }: TeamMemberCardProps) {
    const joined = formatDistanceToNowStrict(new Date(member.createdAt), { addSuffix: true });
    const isNew = Date.now() - new Date(member.createdAt).getTime() < 14 * 86_400_000;

    return (
        <button
            type="button"
            onClick={onOpen}
            className={cn(
                'group relative flex w-full animate-fade-up flex-col overflow-hidden rounded-3xl border border-border bg-card p-5 text-left shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:border-foreground/25 hover:shadow-float focus-visible:outline-none',
                className,
            )}
        >
            {/* Accent bar that draws in on hover */}
            <span aria-hidden className="absolute inset-x-0 top-0 h-[3px] origin-left scale-x-0 bg-brand transition-transform duration-500 ease-out group-hover:scale-x-100" />

            <div className="flex items-start justify-between gap-3">
                <span className="relative shrink-0">
                    <span className={cn(
                        'grid h-12 w-12 place-items-center rounded-2xl font-display text-sm font-bold tracking-wide transition-transform duration-300 group-hover:scale-105',
                        avatarTone(member.id),
                        !member.isActive && 'opacity-50 grayscale',
                    )}>
                        {memberInitials(member.name)}
                    </span>
                    <span
                        aria-hidden
                        className={cn(
                            'absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-[2.5px] border-card',
                            member.isActive ? 'bg-success' : 'bg-muted-foreground/40',
                        )}
                    />
                </span>

                <span className="flex items-center gap-1.5">
                    {isNew && member.isActive && (
                        <span className="rounded-full border border-brand/50 bg-brand/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-foreground">
                            New
                        </span>
                    )}
                    <span className="grid h-8 w-8 place-items-center rounded-full border border-border text-muted-foreground transition-all duration-300 group-hover:border-foreground group-hover:bg-foreground group-hover:text-background">
                        <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:rotate-45" />
                    </span>
                </span>
            </div>

            <div className="mt-4 min-w-0">
                <p className={cn('truncate font-display text-base font-semibold tracking-tight', !member.isActive && 'text-muted-foreground')}>
                    {member.name}
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className={cn('h-1.5 w-1.5 rounded-full', member.isActive ? 'bg-success' : 'bg-muted-foreground/40')} />
                    {member.isActive ? 'Active · Team member' : 'Deactivated'}
                </p>
            </div>

            <div className="mt-4 space-y-1.5 rounded-2xl bg-secondary/60 p-3 text-xs">
                <p className="flex min-w-0 items-center gap-2 text-foreground/80">
                    <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{member.email}</span>
                </p>
                <p className="flex min-w-0 items-center gap-2 text-foreground/80">
                    <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className={cn('truncate', !member.phoneNumber && 'text-muted-foreground/70')}>
                        {member.phoneNumber || 'No phone added'}
                    </span>
                </p>
            </div>

            {/* Which brands this member manages — meaningful for agencies with several brands. */}
            {showBrands && member.brands.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                    {member.brands.map((b) => (
                        <span key={b.id} className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-medium text-foreground">
                            {b.brandName}
                        </span>
                    ))}
                </div>
            )}

            <p className="mt-auto flex items-center gap-1.5 pt-4 text-[11px] font-medium text-muted-foreground">
                <CalendarDays className="h-3 w-3" />
                Joined {joined}
            </p>
        </button>
    );
}
