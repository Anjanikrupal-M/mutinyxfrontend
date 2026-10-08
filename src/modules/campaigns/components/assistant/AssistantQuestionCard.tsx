import { useState } from 'react';
import { Check, CornerDownLeft, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import type { AskUserQuestion } from '@/shared/types/assistant';

/**
 * Renders an `ask_user` pause as selectable options.
 *
 * The card exists only while the turn is PAUSED on this question — the server has stopped and
 * is waiting for an answer — so there is no state in which it should be greyed out. It used to
 * take a `disabled` flag from `isStreaming`, which stayed true for the few milliseconds between
 * `ai:question` and `ai:done`: the options appeared at half opacity and unclickable, then
 * flipped to live. That flash is why the flag is gone.
 *
 * Every question gets a free-text escape hatch whether the model offered one or not — the
 * assistant's options are a shortcut, never a cage. A user who wants to say something the
 * model did not anticipate must always be able to.
 */
export function AssistantQuestionCard({
    questions,
    onSubmit,
}: {
    questions: AskUserQuestion[];
    onSubmit: (answers: Array<{ questionId: string; answer: string }>) => void;
}) {
    const [selected, setSelected] = useState<Record<string, string[]>>({});
    const [freeText, setFreeText] = useState<Record<string, string>>({});
    const [showFreeText, setShowFreeText] = useState<Record<string, boolean>>({});

    /**
     * Picking a tile and typing an answer are alternatives, so choosing either one clears the
     * other. `answerFor` silently prefers free text over a selection, which meant the two
     * controls could both look active while only one of them counted: a ticked ₹75,000 tile
     * sitting above an open input, with whatever got typed overriding the tile that still had
     * the tick on it. Keeping them mutually exclusive is what makes the card honest about what
     * pressing Send will actually submit.
     */
    const toggle = (q: AskUserQuestion, label: string) => {
        setFreeText((prev) => (prev[q.id] ? { ...prev, [q.id]: '' } : prev));
        setShowFreeText((prev) => (prev[q.id] ? { ...prev, [q.id]: false } : prev));
        setSelected((prev) => {
            const current = prev[q.id] ?? [];
            if (q.multiSelect) {
                return {
                    ...prev,
                    [q.id]: current.includes(label) ? current.filter((l) => l !== label) : [...current, label],
                };
            }
            return { ...prev, [q.id]: current.includes(label) ? [] : [label] };
        });
    };

    /** Opening the typed answer drops any tile selection — see the note on `toggle`. */
    const openFreeText = (q: AskUserQuestion) => {
        setSelected((prev) => (prev[q.id]?.length ? { ...prev, [q.id]: [] } : prev));
        setShowFreeText((prev) => ({ ...prev, [q.id]: true }));
    };

    const answerFor = (q: AskUserQuestion): string => {
        const custom = freeText[q.id]?.trim();
        if (custom) return custom;
        return (selected[q.id] ?? []).join(', ');
    };

    const allAnswered = questions.every((q) => answerFor(q).length > 0);

    const submit = () => {
        if (!allAnswered) return;
        onSubmit(questions.map((q) => ({ questionId: q.id, answer: answerFor(q) })));
    };

    return (
        <div className="bg-card border border-border rounded-xl p-4 space-y-4 animate-fade-in">
            {questions.map((q) => {
                const chosen = selected[q.id] ?? [];
                return (
                    <div key={q.id}>
                        <p className="text-sm font-semibold mb-2">{q.question}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {q.options.map((opt) => {
                                const isOn = chosen.includes(opt.label);
                                return (
                                    <button
                                        key={opt.label}
                                        type="button"
                                        onClick={() => toggle(q, opt.label)}
                                        className={cn(
                                            'text-left p-2.5 rounded-lg border transition-premium',
                                            isOn
                                                ? 'border-foreground bg-secondary'
                                                : 'border-border hover:bg-secondary/60',
                                        )}
                                    >
                                        <span className="flex items-center gap-1.5">
                                            {isOn ? <Check className="w-3.5 h-3.5 shrink-0" /> : null}
                                            <span className="text-xs font-semibold">{opt.label}</span>
                                        </span>
                                        {opt.description ? (
                                            <span className="block text-[11px] text-muted-foreground mt-0.5">
                                                {opt.description}
                                            </span>
                                        ) : null}
                                    </button>
                                );
                            })}

                            {/* The free-text escape sits INSIDE the options grid, shaped like an
                                option, because as a line of small grey text underneath it read as
                                a caption rather than a control — users reported there was no way
                                to enter their own budget when there always had been one. */}
                            {showFreeText[q.id] ? null : (
                                <button
                                    type="button"
                                    onClick={() => openFreeText(q)}
                                    className="text-left p-2.5 rounded-lg border border-dashed border-border hover:bg-secondary/60 hover:border-foreground/40 transition-premium"
                                >
                                    <span className="flex items-center gap-1.5">
                                        <Pencil className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                                        <span className="text-xs font-semibold">Enter my own</span>
                                    </span>
                                    <span className="block text-[11px] text-muted-foreground mt-0.5">
                                        Type your own answer instead
                                    </span>
                                </button>
                            )}
                        </div>

                        {showFreeText[q.id] ? (
                            <div className="flex items-center gap-2 mt-2">
                                <Input
                                    autoFocus
                                    value={freeText[q.id] ?? ''}
                                    placeholder="Type your answer…"
                                    onChange={(e) => setFreeText((prev) => ({ ...prev, [q.id]: e.target.value }))}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            submit();
                                        }
                                    }}
                                    className="h-9 text-xs"
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        // Clearing the text matters: answerFor() prefers free text
                                        // over a selected option, so leaving it behind would keep
                                        // overriding the tile they just went back to pick.
                                        setFreeText((prev) => ({ ...prev, [q.id]: '' }));
                                        setShowFreeText((prev) => ({ ...prev, [q.id]: false }));
                                    }}
                                    className="text-[11px] text-muted-foreground hover:text-foreground shrink-0 px-1.5 transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        ) : null}
                    </div>
                );
            })}

            <Button size="sm" onClick={submit} disabled={!allAnswered} className="w-full">
                <CornerDownLeft className="w-3.5 h-3.5 mr-1.5" />
                Send answer{questions.length > 1 ? 's' : ''}
            </Button>
        </div>
    );
}
