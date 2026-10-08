import { Star, Flame, Sparkles, Zap, Heart, Sprout, type LucideIcon } from 'lucide-react';

export interface BadgeMetadata {
  key: string;
  label: string;
  emoji: string;
  color: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  description: string;
  icon: LucideIcon;
}

export const BADGE_METADATA: Record<string, BadgeMetadata> = {
  top_creator: {
    key: 'top_creator',
    label: 'Top Creator',
    emoji: '⭐',
    color: 'amber',
    bgClass: 'bg-amber-50 dark:bg-amber-950/30',
    textClass: 'text-amber-700 dark:text-amber-400',
    borderClass: 'border-amber-200 dark:border-amber-800/50',
    description: '10+ campaigns · ₹25k+ total brand spend',
    icon: Star,
  },
  trending: {
    key: 'trending',
    label: 'Trending',
    emoji: '🔥',
    color: 'purple',
    bgClass: 'bg-purple-50 dark:bg-purple-950/30',
    textClass: 'text-purple-700 dark:text-purple-400',
    borderClass: 'border-purple-200 dark:border-purple-800/50',
    description: '3+ campaigns in the last 30 days — actively in demand',
    icon: Flame,
  },
  viral_creator: {
    key: 'viral_creator',
    label: 'Viral Creator',
    emoji: '💥',
    color: 'pink',
    bgClass: 'bg-pink-50 dark:bg-pink-950/30',
    textClass: 'text-pink-700 dark:text-pink-400',
    borderClass: 'border-pink-200 dark:border-pink-800/50',
    description: 'Twitter/Meme campaign · 10+ creators · 5,000+ followers',
    icon: Sparkles,
  },
  fast_delivery: {
    key: 'fast_delivery',
    label: 'Fast Delivery',
    emoji: '⚡',
    color: 'teal',
    bgClass: 'bg-teal-50 dark:bg-teal-950/30',
    textClass: 'text-teal-700 dark:text-teal-400',
    borderClass: 'border-teal-200 dark:border-teal-800/50',
    description: '5+ campaigns · at least one at 70%+ progress',
    icon: Zap,
  },
  brand_favourite: {
    key: 'brand_favourite',
    label: 'Brand Favourite',
    emoji: '❤️',
    color: 'blue',
    bgClass: 'bg-blue-50 dark:bg-blue-950/30',
    textClass: 'text-blue-700 dark:text-blue-400',
    borderClass: 'border-blue-200 dark:border-blue-800/50',
    description: '3+ distinct brands · 5+ total campaigns',
    icon: Heart,
  },
  rising_star: {
    key: 'rising_star',
    label: 'Rising Star',
    emoji: '🌱',
    color: 'green',
    bgClass: 'bg-green-50 dark:bg-green-950/30',
    textClass: 'text-green-700 dark:text-green-400',
    borderClass: 'border-green-200 dark:border-green-800/50',
    description: '≤ 45 days old · 1+ completed campaign · 1,000+ followers',
    icon: Sprout,
  },
};
