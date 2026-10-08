import { useNavigate } from 'react-router-dom';
import { Loader2, UserPlus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';
import { useTeamMembers, useAssignTeamMemberBrand } from '../hooks/useTeam';

interface AddTeamMemberModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    brandId: string;
    brandName: string;
    // Team members already assigned to this brand — excluded from the "assign" list.
    existingMemberIds: string[];
}

/**
 * Brand-screen team modal. Assignment of existing team members to a brand happens here
 * (the one place a member is tied to a brand). Creating a brand-new member is not done
 * here — that lives centrally on Settings > Teams, so the "create new" action redirects
 * there.
 */
export function AddTeamMemberModal({ open, onOpenChange, brandId, brandName, existingMemberIds }: AddTeamMemberModalProps) {
    const navigate = useNavigate();
    const { data: allTeamMembers = [], isLoading: isLoadingMembers } = useTeamMembers();
    const { mutate: assignBrand, isPending: isAssigning, variables: assigningVariables } = useAssignTeamMemberBrand();
    const assignableMembers = allTeamMembers.filter((m) => !existingMemberIds.includes(m.id));

    const handleAssignExisting = (managerId: string) => {
        assignBrand({ managerId, brandId }, { onSuccess: () => onOpenChange(false) });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="break-all">Add a team member to {brandName}</DialogTitle>
                </DialogHeader>

                {/* min-w-0: this is a grid item of DialogContent (a grid); without it the
                    default min-width:auto lets an unbroken member name expand the whole modal
                    before the row's truncate can apply. */}
                <div className="space-y-3 min-w-0">
                    <p className="text-sm text-muted-foreground break-all">
                        Assign one of your existing team members to also manage {brandName} — a brand can have more than one team member.
                    </p>

                    {isLoadingMembers ? (
                        <div className="flex items-center justify-center py-10">
                            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                        </div>
                    ) : assignableMembers.length === 0 ? (
                        <p className="text-sm text-muted-foreground border border-dashed border-border rounded-lg px-3 py-6 text-center">
                            {allTeamMembers.length === 0
                                ? 'You have no team members yet, create one from below.'
                                : 'Every existing team member is already assigned to this brand.'}
                        </p>
                    ) : (
                        <div className="border border-border rounded-lg divide-y divide-border max-h-72 overflow-y-auto">
                            {assignableMembers.map((member) => {
                                const isThisOnePending = isAssigning && assigningVariables?.managerId === member.id;
                                return (
                                    <div key={member.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium truncate">{member.name}</p>
                                            <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="shrink-0"
                                            disabled={isAssigning}
                                            onClick={() => handleAssignExisting(member.id)}
                                        >
                                            {isThisOnePending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Assign'}
                                        </Button>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* New people are created centrally, not per-brand. */}
                    <div className="pt-1 border-t border-border">
                        <button
                            type="button"
                            onClick={() => { onOpenChange(false); navigate('/teams'); }}
                            className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-foreground hover:bg-secondary/70 transition-premium justify-center"
                        >
                            <UserPlus className="w-4 h-4 text-muted-foreground" />
                            Create a new team member
                        </button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
