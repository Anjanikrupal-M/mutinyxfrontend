import { cn } from '@/lib/utils';

const STEPS = [
    { title: 'Invite by email', description: 'They get their own login credentials.' },
    { title: 'Scoped access', description: 'Campaigns and applications only — billing and brand settings stay yours.' },
    { title: 'Stay in control', description: 'Deactivate anytime — access ends instantly, their work stays.' },
];

/** The dark "How teams work" banner at the top of the Teams page. */
export function TeamsExplainer({ className }: { className?: string }) {
    return (
        <section
            className={cn(
                'relative mb-6 flex animate-fade-up flex-col gap-5 overflow-hidden rounded-3xl bg-foreground px-6 py-5 text-background shadow-card lg:flex-row lg:items-center lg:gap-8',
                className,
            )}
        >
            <div className="shrink-0 lg:w-52">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand">How teams work</p>
                <p className="mt-1.5 font-display text-xl font-semibold leading-tight tracking-tight">
                    Delegate without sharing your password
                </p>
            </div>

            <ol className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
                {STEPS.map((step, i) => (
                    <li key={step.title} className="flex items-start gap-2.5">
                        <span className="font-display text-lg font-bold leading-none tabular-nums text-brand">
                            {String(i + 1).padStart(2, '0')}
                        </span>
                        <span className="min-w-0">
                            <span className="block text-[13px] font-semibold leading-tight">{step.title}</span>
                            <span className="mt-1 block text-xs leading-relaxed text-background/55">{step.description}</span>
                        </span>
                    </li>
                ))}
            </ol>
        </section>
    );
}
