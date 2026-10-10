import { MailPlus, ShieldCheck, UserX } from 'lucide-react';
import { PageExplainer, type ExplainerStep } from '@/shared/components/PageExplainer';

const STEPS: ExplainerStep[] = [
    { icon: MailPlus, title: 'Invite by email', description: 'They get their own login credentials.' },
    { icon: ShieldCheck, title: 'Scoped access', description: 'Campaigns and applications only — billing and brand settings stay yours.' },
    { icon: UserX, title: 'Stay in control', description: 'Deactivate anytime — access ends instantly, their work stays.' },
];

/**
 * The "How teams work" banner at the top of the Teams page: the same explainer card as the
 * Brands and Programs pages (intro on the left, a numbered track of steps, dismissible).
 */
export function TeamsExplainer({ className }: { className?: string }) {
    return (
        <PageExplainer
            label="How teams work"
            description="Delegate without sharing your password. Invite teammates by email, give them access to campaigns and applications only, and switch that access off whenever you need to."
            dismissKey="mutiny:explainer:teams"
            steps={STEPS}
            className={className}
        />
    );
}
