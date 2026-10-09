import { Check, Sparkles, type LucideIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';

export interface ExplainerStep {
    icon: LucideIcon;
    title: string;
    description: string;
    /**
     * Optional hover animation for the step's icon, matched to what the step means:
     * 'build' — the building rises and its windows light up, with a "+" popping in;
     * 'switch' — the two arrows slide past each other; 'archive' — the box lid lifts and settles;
     * 'toggle' — the switch flips on; 'inbox' — application cards keep dropping into the tray;
     * 'stack' — separate layers converge into one stack and a check pops in.
     * Styles live in index.css (.explainer-icon-*).
     */
    motion?: 'build' | 'switch' | 'archive' | 'toggle' | 'inbox' | 'stack';
}

interface PageExplainerProps {
    /** Small uppercase eyebrow, e.g. "What is a Program?" */
    label: string;
    /** One or two sentence summary of what the page does. */
    description: string;
    /** Numbered how-it-works steps rendered as cards below the summary. */
    steps: ExplainerStep[];
    className?: string;
    /** Unique key for local storage to remember if the user dismissed this banner. */
    dismissKey?: string;
}

// Staggered entrance for the steps; Tailwind needs the full class names spelled out.
const STEP_DELAYS = ['[animation-delay:120ms]', '[animation-delay:200ms]', '[animation-delay:280ms]', '[animation-delay:360ms]'];

/**
 * Reusable "what is this page" explainer banner (Brands, Programs). A dark card: the
 * intro sits on the left, the how-it-works steps run as a numbered track on the right,
 * joined by a dashed line. Yellow is only the accent (glow, numbers, icon hover).
 */
export function PageExplainer({ label, description, steps, className, dismissKey }: PageExplainerProps) {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        try {
            if (dismissKey && localStorage.getItem(`dismissed_${dismissKey}`)) {
                setIsVisible(false);
            }
        } catch {
            // Storage blocked — just keep showing the banner.
        }
    }, [dismissKey]);

    const handleDismiss = () => {
        try {
            if (dismissKey) localStorage.setItem(`dismissed_${dismissKey}`, 'true');
        } catch {
            // Storage blocked — hide for this visit only.
        }
        setIsVisible(false);
    };

    if (!isVisible) return null;

    return (
        <section
            className={cn(
                'group/explainer relative mb-6 flex animate-fade-up flex-col gap-5 overflow-hidden rounded-3xl bg-neutral-950 px-5 py-4 text-white shadow-card lg:flex-row lg:items-center lg:gap-8',
                className,
            )}
        >
            {/* Soft yellow glow and a dot grid fading out to the right */}
            <span aria-hidden className="stat-glow pointer-events-none absolute -left-20 -top-24 h-56 w-56 rounded-full bg-brand/20 blur-3xl" />
            <span aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:radial-gradient(rgb(255_255_255)_1px,transparent_1px)] [background-size:16px_16px] [mask-image:linear-gradient(to_right,black,transparent_60%)]" />

            {dismissKey && (
                <button
                    type="button"
                    onClick={handleDismiss}
                    aria-label="Dismiss"
                    className="absolute right-3 top-3 z-10 grid h-7 w-7 place-items-center rounded-full text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                >
                    <X className="h-3.5 w-3.5" />
                </button>
            )}

            {/* Intro */}
            <div className="relative shrink-0 lg:w-[270px]">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/40 bg-brand/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-brand">
                    <Sparkles className="h-3 w-3" />
                    {label}
                </span>
                <p className="mt-2.5 text-[12.5px] leading-relaxed text-white/60">{description}</p>
            </div>

            {/* Steps as a numbered track */}
            {steps.length > 0 && (
                <ol
                    className={cn(
                        'relative grid flex-1 grid-cols-1 gap-5 sm:gap-4',
                        steps.length >= 4 ? 'sm:grid-cols-2 xl:grid-cols-4' : steps.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3',
                    )}
                >
                    {/* Dashed connector behind the icon chips (one row layouts only) */}
                    {steps.length <= 3 && (
                        <span aria-hidden className="pointer-events-none absolute left-5 right-10 top-[18px] hidden border-t border-dashed border-white/15 sm:block" />
                    )}
                    {steps.map((step, i) => (
                        <li key={step.title} className={cn('group/step relative animate-fade-up', STEP_DELAYS[Math.min(i, STEP_DELAYS.length - 1)])}>
                            <div className="flex items-center gap-2.5">
                                <span
                                    className={cn(
                                        'relative grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-neutral-900 text-white transition-all duration-300 group-hover/step:-translate-y-0.5 group-hover/step:border-transparent group-hover/step:bg-brand group-hover/step:text-black',
                                        step.motion && `explainer-icon explainer-icon-${step.motion}`,
                                    )}
                                >
                                    <step.icon className="h-4 w-4 overflow-visible" />
                                    {step.motion === 'build' && (
                                        <span aria-hidden className="explainer-build-plus absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-foreground text-[10px] font-bold leading-none text-brand">+</span>
                                    )}
                                    {step.motion === 'inbox' && (
                                        <>
                                            <span aria-hidden className="explainer-inbox-drop absolute left-[calc(50%-4px)] top-2 h-1.5 w-2 rounded-[2px] bg-neutral-950" />
                                            <span aria-hidden className="explainer-inbox-drop absolute left-[calc(50%-4px)] top-2 h-1.5 w-2 rounded-[2px] bg-neutral-950" />
                                        </>
                                    )}
                                    {step.motion === 'stack' && (
                                        <span aria-hidden className="explainer-stack-check absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-neutral-950 text-brand">
                                            <Check className="h-2.5 w-2.5" strokeWidth={3} />
                                        </span>
                                    )}
                                </span>
                                <span className="bg-neutral-950 pr-2 font-display text-[11px] font-bold tabular-nums tracking-wider text-brand/70">
                                    {String(i + 1).padStart(2, '0')}
                                </span>
                            </div>
                            <p className="mt-2.5 text-[13px] font-semibold leading-tight text-white">
                                {/* Titles may already carry "1. " — the number is shown above. */}
                                {step.title.replace(/^\d+\.\s*/, '')}
                            </p>
                            <p className="mt-1 text-xs leading-relaxed text-white/55">{step.description}</p>
                        </li>
                    ))}
                </ol>
            )}
        </section>
    );
}
