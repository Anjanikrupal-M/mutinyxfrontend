import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────
// ProgressPillButton — the black pill with a yellow bead used for "commit" actions (Submit
// ticket on Support, Save / Update password on Settings). Every step plays once, nothing loops:
//   busy → the bead slides along the button to the far end while a thin yellow line fills
//          underneath; on arrival the icon leaves it ('fly': up and away, 'drop': down into it).
//   done → a tick springs into the bead and the line completes; then the bead glides home.
// Callers own the phase: 'busy' while the request runs, 'done' briefly after it succeeds
// (useDoneFlash below), 'idle' otherwise.
// ─────────────────────────────────────────────────────────────

export type ProgressPhase = 'idle' | 'busy' | 'done';

interface ProgressPillButtonProps {
    phase: ProgressPhase;
    icon: LucideIcon;
    labels: { idle: string; busy: string; done: string };
    /** How the icon leaves the bead once it reaches the end. */
    exit?: 'fly' | 'drop';
    disabled?: boolean;
    onClick: () => void;
    className?: string;
}

const BEAD = 32; // h-8 / w-8
const PAD = 6; // px-1.5 on each side

const EXITS = {
    fly: { x: 26, y: -30, rotate: -20 },
    drop: { y: 22, scale: 0.6 },
} as const;

export function ProgressPillButton({ phase, icon: Icon, labels, exit = 'fly', disabled, onClick, className }: ProgressPillButtonProps) {
    const buttonRef = useRef<HTMLButtonElement>(null);
    const [travel, setTravel] = useState(0);

    // How far the bead travels: the button's inner width minus the bead and its padding.
    useEffect(() => {
        const el = buttonRef.current;
        if (!el) return;
        const measure = () => setTravel(Math.max(0, el.clientWidth - BEAD - PAD * 2));
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const away = phase !== 'idle';
    // The widest label sizes the button, so an auto-width button doesn't jump between states.
    const widest = [labels.idle, labels.busy, labels.done].reduce((a, b) => (b.length > a.length ? b : a));

    return (
        <button
            ref={buttonRef}
            type="button"
            onClick={onClick}
            disabled={disabled || away}
            aria-live="polite"
            className={cn(
                'group/pill relative flex h-11 items-center overflow-hidden rounded-full bg-foreground px-1.5 text-sm font-semibold text-background transition-shadow duration-300 hover:shadow-float',
                !away && 'disabled:opacity-50',
                className,
            )}
        >
            {/* Progress line along the bottom: fills most of the way while busy, completes when done */}
            <motion.span
                aria-hidden
                className="pointer-events-none absolute bottom-0 left-0 h-[3px] bg-brand"
                initial={false}
                animate={{ width: phase === 'idle' ? '0%' : phase === 'busy' ? '85%' : '100%', opacity: phase === 'idle' ? 0 : 1 }}
                transition={{ duration: phase === 'busy' ? 1.2 : 0.35, ease: 'easeOut' }}
            />

            {/* The bead — slides to the end while busy, back home when idle */}
            <motion.span
                className="relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand text-black"
                initial={false}
                animate={{ x: away ? travel : 0 }}
                transition={{ type: 'spring', stiffness: 170, damping: 22 }}
            >
                <AnimatePresence mode="wait" initial={false}>
                    {phase === 'idle' && (
                        <motion.span
                            key="icon"
                            initial={{ scale: 0, rotate: -30 }}
                            animate={{ scale: 1, rotate: 0 }}
                            exit={{ ...EXITS[exit], opacity: 0, transition: { duration: 0.45, delay: 0.35, ease: [0.5, 0, 0.75, 0] } }}
                            className={cn(
                                'grid place-items-center transition-transform duration-300',
                                exit === 'fly'
                                    ? 'group-hover/pill:-translate-y-0.5 group-hover/pill:translate-x-0.5 group-hover/pill:-rotate-12'
                                    : 'group-hover/pill:translate-y-0.5 group-hover/pill:scale-110',
                            )}
                        >
                            <Icon className="h-4 w-4" />
                        </motion.span>
                    )}
                    {phase === 'done' && (
                        <motion.span
                            key="tick"
                            initial={{ scale: 0, rotate: -90 }}
                            animate={{ scale: 1, rotate: 0 }}
                            exit={{ scale: 0, opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 420, damping: 16 }}
                        >
                            <Check className="h-4 w-4" strokeWidth={3} />
                        </motion.span>
                    )}
                </AnimatePresence>
            </motion.span>

            {/* Invisible copy of the widest label: gives the button its width */}
            <span aria-hidden className="invisible whitespace-nowrap pl-3 pr-5">{widest}</span>

            {/* Visible label: just right of the bead at rest; once the bead slides off to the right
                end, it moves to the left edge, so the bead never covers it */}
            <span className={cn(
                'pointer-events-none absolute inset-0 flex items-center overflow-hidden transition-[padding] duration-300',
                away ? 'pl-5 pr-12' : 'pl-[50px] pr-5',
            )}>
                <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                        key={phase}
                        className="block truncate"
                        initial={{ y: 14, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -14, opacity: 0 }}
                        transition={{ duration: 0.22, ease: 'easeOut' }}
                    >
                        {labels[phase]}
                    </motion.span>
                </AnimatePresence>
            </span>
        </button>
    );
}

/** A short-lived "done" flag: call `flash()` on success; `done` stays true for `ms`. */
export function useDoneFlash(ms = 2200) {
    const [done, setDone] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    useEffect(() => () => clearTimeout(timer.current), []);
    const flash = useCallback(() => {
        clearTimeout(timer.current);
        setDone(true);
        timer.current = setTimeout(() => setDone(false), ms);
    }, [ms]);
    return { done, flash };
}
