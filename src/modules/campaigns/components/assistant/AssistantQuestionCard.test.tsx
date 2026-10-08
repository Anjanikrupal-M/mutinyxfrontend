import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AssistantQuestionCard } from './AssistantQuestionCard';
import type { AskUserQuestion } from '@/shared/types/assistant';

/**
 * A tile and a typed answer are alternatives. `answerFor` prefers free text over a selection,
 * so if both can be active at once the card shows a tick on one answer and submits another —
 * which is exactly what a ticked ₹75,000 above an open input did.
 */
const budget: AskUserQuestion = {
    id: 'budget',
    question: 'What should I build this campaign budget around?',
    options: [
        { label: '₹75,000', description: 'Lean test' },
        { label: '₹1,50,000', description: 'Recommended' },
    ],
};

function setup(question: AskUserQuestion = budget) {
    const onSubmit = vi.fn();
    render(<AssistantQuestionCard questions={[question]} onSubmit={onSubmit} />);
    return { onSubmit };
}

describe('AssistantQuestionCard', () => {
    it('clears a selected tile when the typed answer is opened', () => {
        setup();
        fireEvent.click(screen.getByText('₹75,000'));
        // The tick is the only signal that a tile is chosen.
        expect(document.querySelector('.lucide-check')).not.toBeNull();

        fireEvent.click(screen.getByText('Enter my own'));
        expect(document.querySelector('.lucide-check')).toBeNull();
    });

    it('submits the typed answer alone, with no tile left selected', () => {
        const { onSubmit } = setup();
        fireEvent.click(screen.getByText('₹75,000'));
        fireEvent.click(screen.getByText('Enter my own'));
        fireEvent.change(screen.getByPlaceholderText('Type your answer…'), { target: { value: '₹90,000' } });
        fireEvent.click(screen.getByText(/Send answer/));

        expect(onSubmit).toHaveBeenCalledWith([{ questionId: 'budget', answer: '₹90,000' }]);
    });

    it('clears typed text when a tile is picked instead, so the tick is what gets sent', () => {
        const { onSubmit } = setup();
        fireEvent.click(screen.getByText('Enter my own'));
        fireEvent.change(screen.getByPlaceholderText('Type your answer…'), { target: { value: '₹90,000' } });
        fireEvent.click(screen.getByText('₹1,50,000'));

        // The input closes with the text dropped; the tile is now the whole answer.
        expect(screen.queryByPlaceholderText('Type your answer…')).toBeNull();
        fireEvent.click(screen.getByText(/Send answer/));
        expect(onSubmit).toHaveBeenCalledWith([{ questionId: 'budget', answer: '₹1,50,000' }]);
    });

    it('keeps multi-select tiles combinable with each other', () => {
        const { onSubmit } = setup({
            id: 'formats',
            question: 'Which formats?',
            multiSelect: true,
            options: [{ label: 'Reel' }, { label: 'Story' }],
        });
        fireEvent.click(screen.getByText('Reel'));
        fireEvent.click(screen.getByText('Story'));
        fireEvent.click(screen.getByText(/Send answer/));

        expect(onSubmit).toHaveBeenCalledWith([{ questionId: 'formats', answer: 'Reel, Story' }]);
    });
});
