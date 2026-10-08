import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import http from '@/core/http';
import { API } from '@/core/api';
import { queryKeys } from '@/core/queryKeys';

export interface TierConfigEntry {
    tier: 'nano' | 'micro' | 'mid' | 'macro' | 'mega';
    label: string;
    range: string;
    followerMin: number;
    followerMax: number | null;
    suggestedPrice: { minimum: number; median: number; maximum: number };
    minBudget: number;
}

// Fallback used while loading or if API is unavailable
export const TIER_CONFIG_FALLBACK: TierConfigEntry[] = [
    { tier: 'nano',  label: 'Nano',  range: '<10K',      followerMin: 1_000,   followerMax: 10_000,    suggestedPrice: { minimum: 1_000,   median: 2_000,   maximum: 3_000   }, minBudget: 1_000   },
    { tier: 'micro', label: 'Micro', range: '10K–100K',  followerMin: 10_000,  followerMax: 100_000,   suggestedPrice: { minimum: 3_000,   median: 9_000,   maximum: 15_000  }, minBudget: 3_000   },
    { tier: 'mid',   label: 'Mid',   range: '100K–500K', followerMin: 100_000, followerMax: 500_000,   suggestedPrice: { minimum: 15_000,  median: 32_500,  maximum: 50_000  }, minBudget: 15_000  },
    { tier: 'macro', label: 'Macro', range: '500K–1M',   followerMin: 500_000, followerMax: 1_000_000, suggestedPrice: { minimum: 50_000,  median: 125_000, maximum: 200_000 }, minBudget: 50_000  },
    { tier: 'mega',  label: 'Mega',  range: '1M+',       followerMin: 1_000_000, followerMax: null,    suggestedPrice: { minimum: 200_000, median: 600_000, maximum: 1_000_000 }, minBudget: 200_000 },
];

export function useTierConfig() {
    const query = useQuery<TierConfigEntry[]>({
        queryKey: queryKeys.pricing.tierConfig,
        queryFn: () =>
            http
                .get<{ status: string; data: TierConfigEntry[] }>(API.pricing.tierConfig)
                .then((r) => r.data.data),
        staleTime: 10 * 60 * 1000, // 10 min — tier config rarely changes
        retry: 1,
    });

    // Memoised so the copy keeps a stable identity — `tiers` is a useMemo dep
    // in AIStrategistChat and would otherwise recompute on every render.
    const tiers = useMemo(() => {
        if (!query.data) return TIER_CONFIG_FALLBACK;
        
        return query.data.map((apiTier) => {
            const fallback = TIER_CONFIG_FALLBACK.find(f => f.tier === apiTier.tier);
            if (!fallback) return apiTier;
            return {
                ...apiTier,
                range: fallback.range,
                followerMin: fallback.followerMin,
                followerMax: fallback.followerMax,
            };
        });
    }, [query.data]);

    // Convenience map: tier key → { min, max } for backward-compat with TIER_AVERAGE_COSTS usage
    const tierCosts: Record<string, { min: number; max: number }> = Object.fromEntries(
        tiers.map((t) => [t.tier, { min: t.suggestedPrice.minimum, max: t.suggestedPrice.maximum }]),
    );

    return { tiers, tierCosts, isLoading: query.isLoading };
}
