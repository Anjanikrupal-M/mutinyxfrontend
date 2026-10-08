export type Tone = 'good' | 'warn' | 'bad' | 'neutral' | 'brand';

export const toneClasses: Record<Tone, string> = {
  good: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/25 dark:text-emerald-400',
  warn: 'bg-amber-500/10 text-amber-700 border-amber-500/25 dark:text-amber-400',
  bad: 'bg-rose-500/10 text-rose-700 border-rose-500/25 dark:text-rose-400',
  neutral: 'bg-secondary text-muted-foreground border-border',
  brand: 'bg-[#fedc03] text-black border-[#fedc03]',
};
