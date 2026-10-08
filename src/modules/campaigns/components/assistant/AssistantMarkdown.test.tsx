import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AssistantMarkdown } from './AssistantMarkdown';

/** The literal asterisks the model emits must never reach the transcript. */
describe('AssistantMarkdown', () => {
    it('renders bold without leaking asterisks', () => {
        const { container } = render(<AssistantMarkdown content="1. **What is the movie about?** This helps." />);
        expect(container.textContent).not.toContain('**');
        expect(screen.getByText('What is the movie about?').tagName).toBe('STRONG');
    });

    it('groups consecutive numbered lines into one list', () => {
        const { container } = render(
            <AssistantMarkdown content={'1. First thing\n2. Second thing\n3. Third thing'} />,
        );
        expect(container.querySelectorAll('ol')).toHaveLength(1);
        expect(container.querySelectorAll('li')).toHaveLength(3);
    });

    it('groups bullets into one list', () => {
        const { container } = render(<AssistantMarkdown content={'- alpha\n- beta'} />);
        expect(container.querySelectorAll('ul')).toHaveLength(1);
        expect(container.querySelectorAll('li')).toHaveLength(2);
    });

    it('keeps paragraphs separate from lists', () => {
        const { container } = render(
            <AssistantMarkdown content={'Here is the plan:\n\n1. Do this\n2. Do that\n\nLet me know!'} />,
        );
        expect(container.querySelectorAll('ol')).toHaveLength(1);
        expect(container.textContent).toContain('Here is the plan:');
        expect(container.textContent).toContain('Let me know!');
    });

    // The model writes long answers as a "loose" list — a blank line between every item. That
    // blank line used to close the list, so each item opened a fresh <ol> and, because every
    // list restarts at one, the transcript showed "1. 1. 1. 1." straight down the page.
    it('keeps one list when items are separated by blank lines', () => {
        const { container } = render(
            <AssistantMarkdown
                content={'1. **Creators**: pan-India reach.\n\n2. **Budget**: scale it up.\n\n3. **Platform**: add YouTube.'}
            />,
        );
        expect(container.querySelectorAll('ol')).toHaveLength(1);
        const numbers = [...container.querySelectorAll('li')].map((li) => li.textContent?.trim().slice(0, 2));
        expect(numbers).toEqual(['1.', '2.', '3.']);
    });

    it('starts a new list after an intervening paragraph', () => {
        const { container } = render(
            <AssistantMarkdown content={'1. one\n\nSome prose in between.\n\n1. restarted'} />,
        );
        expect(container.querySelectorAll('ol')).toHaveLength(2);
    });

    it('keeps bullets in one list across blank lines', () => {
        const { container } = render(<AssistantMarkdown content={'- alpha\n\n- beta\n\n- gamma'} />);
        expect(container.querySelectorAll('ul')).toHaveLength(1);
        expect(container.querySelectorAll('li')).toHaveLength(3);
    });

    it('never emits raw HTML from model output', () => {
        const { container } = render(<AssistantMarkdown content={'<img src=x onerror=alert(1)>'} />);
        expect(container.querySelector('img')).toBeNull();
        expect(container.textContent).toContain('<img src=x onerror=alert(1)>');
    });
});
