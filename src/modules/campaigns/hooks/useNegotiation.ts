// ─────────────────────────────────────────────────────────────
// Negotiation Hooks — Get history, Accept, Counter-offer
// ─────────────────────────────────────────────────────────────

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import http from '@/core/http';
import { API } from '@/core/api';
import { queryKeys } from '@/core/queryKeys';
import type { ApiResponse } from '@/core/types';
import type { CampaignInfluencer, NegotiationData, NegotiationEntry } from '@/shared/types/campaign';

// ── Queries ──

export function useNegotiation(campaignId: string, influencerId: string) {
    return useQuery({
        queryKey: queryKeys.campaigns.negotiation(campaignId, influencerId),
        queryFn: async () => {
            const { data } = await http.get<ApiResponse<NegotiationData>>(
                API.campaigns.negotiation.get(campaignId, influencerId),
            );
            return data.data;
        },
        enabled: !!campaignId && !!influencerId,
        // Cache each negotiation thread for 30s — avoids refiring N parallel fetches
        // every time the card list re-renders (one per negotiating card).
        staleTime: 30_000,
    });
}

// ── Mutations ──

export function useAcceptNegotiation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            campaignId,
            influencerId,
            amount,
        }: {
            campaignId: string;
            influencerId: string;
            amount: number;
        }) => {
            const { data } = await http.post<ApiResponse<unknown>>(
                API.campaigns.negotiation.accept(campaignId, influencerId),
                { amount },
            );
            return data.data;
        },
        onSuccess: (_, { campaignId, influencerId }) => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.campaigns.negotiation(campaignId, influencerId),
            });
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.applications(campaignId) });
        },
    });
}

export function useCounterOffer() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            campaignId,
            influencerId,
            amount,
            note,
        }: {
            campaignId: string;
            influencerId: string;
            amount: number;
            note?: string;
        }) => {
            const { data } = await http.post<ApiResponse<NegotiationEntry>>(
                API.campaigns.negotiation.counter(campaignId, influencerId),
                { amount, note },
            );
            return data.data;
        },
        // Optimistic patch: card renderer reads effectiveStatus first, so all three
        // status fields must flip together for the UI to swap Accept/Reject/Counter
        // for the NegotiationActions component before the network round-trip lands.
        onMutate: async ({ campaignId, influencerId, amount, note }) => {
            const appsKey = queryKeys.campaigns.applications(campaignId);
            const boardKey = queryKeys.campaigns.statusBoard(campaignId);
            const negKey = queryKeys.campaigns.negotiation(campaignId, influencerId);

            await Promise.all([
                queryClient.cancelQueries({ queryKey: appsKey }),
                queryClient.cancelQueries({ queryKey: boardKey }),
                queryClient.cancelQueries({ queryKey: negKey }),
            ]);

            const previousApps = queryClient.getQueryData<CampaignInfluencer[]>(appsKey);
            const previousBoard = queryClient.getQueryData<CampaignInfluencer[]>(boardKey);
            const previousNeg = queryClient.getQueryData<NegotiationData>(negKey);

            const patch = (rows?: CampaignInfluencer[]) =>
                rows?.map((row) =>
                    String(row.influencerId) === String(influencerId)
                        ? {
                              ...row,
                              status: 'negotiating' as const,
                              effectiveStatus: 'negotiating' as const,
                              effective_status: 'negotiating' as const,
                              // Do NOT overwrite tierRate/quotedPrice — they hold the
                              // influencer's original quoted price (preserved by backend).
                              // The negotiation history shows all counter amounts.
                              agreedBudget: null,
                          }
                        : row,
                );

            queryClient.setQueryData<CampaignInfluencer[] | undefined>(appsKey, patch(previousApps));
            queryClient.setQueryData<CampaignInfluencer[] | undefined>(boardKey, patch(previousBoard));

            // Optimistically update the negotiation cache so NegotiationActions immediately
            // shows "Waiting for influencer to respond" instead of the stale Accept button.
            // Must not bail when `old` is undefined — that's a cold cache and the optimistic
            // patch still needs to fire so the Accept button disappears right away.
            queryClient.setQueryData<NegotiationData | undefined>(negKey, (old) => {
                const base = old ?? {
                    campaignId,
                    influencerId,
                    campaignInfluencerId: '',
                    status: 'negotiating' as const,
                    tierRate: null,
                    agreedBudget: null,
                    lastOfferBy: 'brand' as const,
                    permissions: { canAccept: false, canCounter: false },
                    history: [],
                };
                return {
                    ...base,
                    lastOfferBy: 'brand' as const,
                    history: [
                        ...(base.history ?? []),
                        {
                            id: `optimistic-${Date.now()}`,
                            party: 'brand' as const,
                            amount,
                            note: note ?? null,
                            createdAt: new Date().toISOString(),
                        },
                    ],
                    permissions: { canAccept: false, canCounter: false },
                };
            });

            if (import.meta.env.DEV) {
                console.debug('[NEGOTIATION_DEBUG] Counter optimistic patch applied', {
                    campaignId,
                    influencerId,
                    sentAmount: amount,
                });
            }

            return { previousApps, previousBoard, previousNeg };
        },
        onError: (_err, { campaignId, influencerId }, context) => {
            queryClient.setQueryData(queryKeys.campaigns.applications(campaignId), context?.previousApps);
            queryClient.setQueryData(queryKeys.campaigns.statusBoard(campaignId), context?.previousBoard);
            queryClient.setQueryData(queryKeys.campaigns.negotiation(campaignId, influencerId), context?.previousNeg);
        },
        onSuccess: (_, { campaignId, influencerId }) => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.campaigns.negotiation(campaignId, influencerId),
            });
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.applications(campaignId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.statusBoard(campaignId) });
        },
    });
}
