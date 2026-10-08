import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CampaignStepperStep {
    id: number;
    title: string;
}

interface CampaignStepperProps {
    steps: CampaignStepperStep[];
    currentStep: number;
    onStepClick: (id: number) => void;
    className?: string;
}

export function CampaignStepper({ steps, currentStep, onStepClick, className }: CampaignStepperProps) {
    const activeTitle = steps.find((s) => s.id === currentStep)?.title;

    return (
        <div className={cn("sticky top-14 z-20 bg-background/95 backdrop-blur-md border-b border-border/80 py-2.5 mb-6 transition-all", className)}>
            <div className="flex items-center">
                {steps.map((s, i) => {
                    const isDone = currentStep > s.id;
                    const isActive = currentStep === s.id;
                    return (
                        <div key={s.id} className={cn('flex items-center', i < steps.length - 1 && 'flex-1')}>
                            <button
                                type="button"
                                onClick={() => onStepClick(s.id)}
                                className="flex items-center gap-2.5 shrink-0 group"
                            >
                                <div className={cn(
                                    'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border-2 transition-premium',
                                    isDone || isActive
                                        ? 'bg-foreground border-foreground text-background'
                                        : 'bg-background border-border text-muted-foreground group-hover:border-muted-foreground/50'
                                )}>
                                    {isDone ? <Check className="w-3.5 h-3.5" /> : s.id}
                                </div>
                                <span className={cn(
                                    'hidden sm:block text-sm font-medium whitespace-nowrap',
                                    isActive ? 'text-foreground' : isDone ? 'text-foreground/70' : 'text-muted-foreground'
                                )}>
                                    {s.title}
                                </span>
                            </button>
                            {i < steps.length - 1 && (
                                <div className="flex-1 h-[2px] mx-3 rounded-full bg-border overflow-hidden">
                                    <div className={cn('h-full bg-foreground transition-all duration-300', isDone ? 'w-full' : 'w-0')} />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            <p className="sm:hidden text-xs font-medium text-muted-foreground mt-2">
                Step {currentStep} of {steps.length} · {activeTitle}
            </p>
        </div>
    );
}
