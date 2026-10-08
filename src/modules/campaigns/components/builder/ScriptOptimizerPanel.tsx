import { AlertCircle, Check, Shuffle, Sparkles, ThumbsUp, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ScriptAnalysis {
    overallScore: number;
    hook: { score: number; issue: string; suggestion: string };
    cta: { score: number; issue: string; suggestion: string };
    tone: { score: number; issue: string; suggestion: string };
    topWin: string;
    quickFix: string;
    improvedScript: string;
}

function scoreTint(score: number) {
    return score >= 80
        ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
        : score >= 60
            ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
            : 'bg-red-500/10 text-red-600 border-red-500/20';
}

interface ScoreCardProps {
    index: number;
    title: string;
    score: number;
    issue: string;
    suggestion: string;
}

function ScoreCard({ index, title, score, issue, suggestion }: ScoreCardProps) {
    return (
        <div className="p-4 rounded-xl border border-border/80 bg-secondary/10 flex flex-col justify-between space-y-3">
            <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-foreground">{index}. {title}</span>
                    <span className={cn('text-[9px] px-2 py-0.5 font-bold rounded-full border', scoreTint(score))}>
                        {score}/100
                    </span>
                </div>
                <p className="text-[11px] text-muted-foreground font-medium leading-relaxed">&quot;{issue}&quot;</p>
            </div>
            <div className="pt-2 border-t border-border/60">
                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1">AI Suggestion</p>
                <p className="text-xs text-foreground/90 leading-relaxed font-medium">{suggestion}</p>
            </div>
        </div>
    );
}

interface ScriptOptimizerPanelProps {
    description: string;
    analyzeLabel: string;
    reAnalyzeLabel: string;
    disabled: boolean;
    onAnalyze: () => void;
    isAnalyzing: boolean;
    analysis: ScriptAnalysis | null;
    analysisError: string | null;
    improvedScript: string | null;
    isGeneratingImproved: boolean;
    improvedScriptError: string | null;
    onGenerateImproved: () => void;
    onUseImproved: () => void;
}

export function ScriptOptimizerPanel({
    description,
    analyzeLabel,
    reAnalyzeLabel,
    disabled,
    onAnalyze,
    isAnalyzing,
    analysis,
    analysisError,
    improvedScript,
    isGeneratingImproved,
    improvedScriptError,
    onGenerateImproved,
    onUseImproved,
}: ScriptOptimizerPanelProps) {
    return (
        <div className="mt-4 border border-dashed border-border/80 p-5 rounded-2xl bg-secondary/10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-brand/20 flex items-center justify-center text-foreground shrink-0">
                        <Sparkles className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground leading-none">MutinyX AI Script Optimizer</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{description}</p>
                    </div>
                </div>
                <button
                    type="button"
                    disabled={disabled || isAnalyzing}
                    onClick={onAnalyze}
                    className={cn(
                        'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold transition-premium shrink-0 shadow-sm',
                        disabled || isAnalyzing
                            ? 'bg-secondary/40 text-muted-foreground border-border cursor-not-allowed'
                            : 'bg-brand text-black border-brand hover:bg-brand/80 active:scale-[0.98] cursor-pointer'
                    )}
                >
                    <Sparkles className={cn('w-3.5 h-3.5', isAnalyzing && 'animate-spin')} />
                    {isAnalyzing ? 'Analyzing...' : analysis ? reAnalyzeLabel : analyzeLabel}
                </button>
            </div>

            {isAnalyzing && (
                <div className="mt-4 p-5 rounded-2xl border border-brand/30 bg-brand/5 animate-pulse space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand/20 flex items-center justify-center text-foreground">
                            <Sparkles className="w-4 h-4 animate-spin" />
                        </div>
                        <div className="flex-1 space-y-2">
                            <div className="h-3.5 bg-muted/60 rounded w-1/3" />
                            <div className="h-2.5 bg-muted/40 rounded w-1/2" />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="p-3 rounded-xl bg-background/50 border border-border/50 space-y-2">
                                <div className="h-2.5 bg-muted/60 rounded w-1/2" />
                                <div className="h-2 bg-muted/40 rounded w-5/6" />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {analysisError && !isAnalyzing && (
                <div className="mt-4 p-4 rounded-xl border border-red-200 bg-red-50/50 text-red-600 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{analysisError}</span>
                </div>
            )}

            {analysis && !isAnalyzing && (
                <div className="mt-5 p-5 rounded-xl border border-border/80 bg-background/80 shadow-premium space-y-5 animate-fade-in">
                    <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-4">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-foreground text-brand flex items-center justify-center shadow-sm">
                                <Sparkles className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-foreground">AI Performance Report</h4>
                                <p className="text-[10px] text-muted-foreground">Tailored feedback based on your campaign parameters</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Score</span>
                            <div className={cn('w-11 h-11 rounded-full border flex flex-col items-center justify-center font-bold text-sm shadow-sm', scoreTint(analysis.overallScore))}>
                                {analysis.overallScore}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex gap-2.5">
                            <div className="w-6.5 h-6.5 rounded bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                                <ThumbsUp className="w-3.5 h-3.5" />
                            </div>
                            <div>
                                <p className="text-[9px] font-bold text-emerald-700 uppercase tracking-wider">🏆 Top Win</p>
                                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed font-medium">{analysis.topWin}</p>
                            </div>
                        </div>
                        <div className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5 flex gap-2.5">
                            <div className="w-6.5 h-6.5 rounded bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
                                <Wrench className="w-3.5 h-3.5" />
                            </div>
                            <div>
                                <p className="text-[9px] font-bold text-amber-700 uppercase tracking-wider">⚡ Quick Fix</p>
                                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed font-medium">{analysis.quickFix}</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-2">
                        <ScoreCard index={1} title="Hook Power" {...analysis.hook} />
                        <ScoreCard index={2} title="CTA Strength" {...analysis.cta} />
                        <ScoreCard index={3} title="Brand Tone" {...analysis.tone} />
                    </div>

                    <div className="pt-4 border-t border-border/60 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <h5 className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                                    <Sparkles className="w-3.5 h-3.5 text-foreground" />
                                    AI-Generated Improved Script
                                </h5>
                                <p className="text-[10px] text-muted-foreground mt-0.5">Rewritten to fix the flaws identified above.</p>
                            </div>
                            {!improvedScript && (
                                <button
                                    type="button"
                                    disabled={isGeneratingImproved}
                                    onClick={onGenerateImproved}
                                    className={cn(
                                        'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold transition-premium shrink-0',
                                        isGeneratingImproved
                                            ? 'bg-secondary/40 text-muted-foreground border-border cursor-not-allowed'
                                            : 'bg-foreground text-background border-foreground hover:opacity-80 active:scale-[0.98] cursor-pointer'
                                    )}
                                >
                                    <Sparkles className={cn('w-3.5 h-3.5', isGeneratingImproved && 'animate-spin')} />
                                    {isGeneratingImproved ? 'Generating...' : 'Generate Improved Script'}
                                </button>
                            )}
                        </div>
                        {isGeneratingImproved && (
                            <div className="p-4 rounded-xl border border-border/60 bg-secondary/10 animate-pulse space-y-2.5">
                                {[1, 2, 3, 4].map((i) => (
                                    <div key={i} className={cn('h-2.5 bg-muted/50 rounded', i === 4 ? 'w-2/3' : 'w-full')} />
                                ))}
                            </div>
                        )}
                        {improvedScriptError && !isGeneratingImproved && (
                            <div className="p-3 rounded-xl border border-red-200 bg-red-50/50 text-red-600 text-xs flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                <span>{improvedScriptError}</span>
                            </div>
                        )}
                        {improvedScript && !isGeneratingImproved && (
                            <div className="space-y-3 animate-fade-in">
                                <div className="p-4 rounded-xl border border-brand/30 bg-brand/5 text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap font-medium max-h-52 overflow-y-auto">
                                    {improvedScript}
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={onUseImproved}
                                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-foreground text-background text-xs font-bold transition-premium hover:opacity-80 active:scale-[0.98]"
                                    >
                                        <Check className="w-3.5 h-3.5" />
                                        Use This Script
                                    </button>
                                    <button
                                        type="button"
                                        disabled={isGeneratingImproved}
                                        onClick={onGenerateImproved}
                                        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-border text-xs font-bold text-muted-foreground transition-premium hover:bg-secondary/20 active:scale-[0.98]"
                                    >
                                        <Shuffle className="w-3.5 h-3.5" />
                                        Regenerate
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
