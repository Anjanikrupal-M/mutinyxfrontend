import { Fragment, memo, type ReactNode } from 'react';

/**
 * Minimal markdown renderer for assistant replies.
 *
 * Renders to React nodes, never to an HTML string — there is no `dangerouslySetInnerHTML`
 * here, so model output cannot inject markup no matter what it emits. That is a stronger
 * guarantee than the escape-then-regex approach used by the legacy chat, and it avoids adding
 * a markdown dependency.
 *
 * Supports what the model actually produces in conversation: bold, italic, inline code,
 * numbered and bulleted lists, and paragraphs. Anything else falls through as plain text
 * rather than showing raw syntax like `**this**`, which was leaking into the transcript.
 */

const INLINE = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\n]+\*|_[^_\n]+_|`[^`\n]+`)/g;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
    const parts = text.split(INLINE).filter((p) => p !== '');

    return parts.map((part, i) => {
        const key = `${keyPrefix}-${i}`;

        if ((part.startsWith('**') && part.endsWith('**') && part.length > 4)
            || (part.startsWith('__') && part.endsWith('__') && part.length > 4)) {
            return <strong key={key} className="font-semibold">{part.slice(2, -2)}</strong>;
        }
        if ((part.startsWith('*') && part.endsWith('*') && part.length > 2)
            || (part.startsWith('_') && part.endsWith('_') && part.length > 2)) {
            return <em key={key}>{part.slice(1, -1)}</em>;
        }
        if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
            return (
                <code key={key} className="px-1 py-0.5 rounded bg-secondary text-[0.9em] font-mono">
                    {part.slice(1, -1)}
                </code>
            );
        }
        return <Fragment key={key}>{part}</Fragment>;
    });
}

interface Block {
    type: 'p' | 'ol' | 'ul';
    lines: string[];
}

/** Groups consecutive list lines so a list renders as one element, not N stray paragraphs. */
function toBlocks(text: string): Block[] {
    const blocks: Block[] = [];

    /**
     * The last block that actually holds content.
     *
     * A blank line pushes an empty `p` placeholder, so looking only at the final block meant a
     * list written with blank lines between its items — which is exactly how the model writes
     * them — never matched the open list. Every item opened a fresh `<ol>`, and since each new
     * list restarts at one, the transcript rendered "1. 1. 1. 1." down the page.
     */
    const lastMeaningful = (): Block | undefined => {
        for (let i = blocks.length - 1; i >= 0; i--) {
            if (blocks[i].lines.some((l) => l.trim())) return blocks[i];
        }
        return undefined;
    };

    for (const rawLine of text.split('\n')) {
        const line = rawLine.trimEnd();

        const ordered = line.match(/^\s*\d+[.)]\s+(.*)$/);
        const bulleted = line.match(/^\s*[-*•]\s+(.*)$/);

        if (ordered) {
            const last = lastMeaningful();
            if (last?.type === 'ol') last.lines.push(ordered[1]);
            else blocks.push({ type: 'ol', lines: [ordered[1]] });
            continue;
        }
        if (bulleted) {
            const last = lastMeaningful();
            if (last?.type === 'ul') last.lines.push(bulleted[1]);
            else blocks.push({ type: 'ul', lines: [bulleted[1]] });
            continue;
        }

        if (!line.trim()) {
            // A blank line closes the current block rather than creating an empty one.
            if (blocks.length > 0 && blocks[blocks.length - 1].lines.length > 0) {
                blocks.push({ type: 'p', lines: [] });
            }
            continue;
        }

        const last = blocks[blocks.length - 1];
        if (last?.type === 'p' && last.lines.length > 0) last.lines.push(line);
        else if (last?.type === 'p') last.lines[0] = line;
        else blocks.push({ type: 'p', lines: [line] });
    }

    return blocks.filter((b) => b.lines.length > 0 && b.lines.some((l) => l.trim()));
}

/**
 * Memoised on `content`, which is the whole prop.
 *
 * A streaming reply re-renders the transcript once per animation frame, and without this every
 * frame re-parsed EVERY message in the thread — blocks, inline spans and all — to produce
 * identical output for all but the one that changed. On a long conversation that is what turned
 * a smooth typewriter into a stuttering one. Now only the bubble whose text actually changed
 * does any work.
 */
function AssistantMarkdownImpl({ content }: { content: string }) {
    const blocks = toBlocks(content);

    if (blocks.length === 0) return null;

    return (
        <div className="space-y-2.5">
            {blocks.map((block, bi) => {
                if (block.type === 'ol') {
                    return (
                        <ol key={bi} className="space-y-1.5 ml-0.5">
                            {block.lines.map((line, li) => (
                                <li key={li} className="flex gap-2.5">
                                    <span className="text-muted-foreground font-medium tabular-nums shrink-0">
                                        {li + 1}.
                                    </span>
                                    <span className="flex-1">{renderInline(line, `${bi}-${li}`)}</span>
                                </li>
                            ))}
                        </ol>
                    );
                }

                if (block.type === 'ul') {
                    return (
                        <ul key={bi} className="space-y-1.5 ml-0.5">
                            {block.lines.map((line, li) => (
                                <li key={li} className="flex gap-2.5">
                                    <span className="text-[#fedc03] shrink-0 leading-6">•</span>
                                    <span className="flex-1">{renderInline(line, `${bi}-${li}`)}</span>
                                </li>
                            ))}
                        </ul>
                    );
                }

                return (
                    <p key={bi}>
                        {block.lines.map((line, li) => (
                            <Fragment key={li}>
                                {li > 0 ? <br /> : null}
                                {renderInline(line, `${bi}-${li}`)}
                            </Fragment>
                        ))}
                    </p>
                );
            })}
        </div>
    );
}

export const AssistantMarkdown = memo(AssistantMarkdownImpl);
