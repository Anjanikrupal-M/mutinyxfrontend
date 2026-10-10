// ─────────────────────────────────────────────────────────────
// AnimatedDonutChart — a donut whose segments sweep in one after
// another, with a glow on the hovered segment and whatever the
// caller passes in its centre (usually the hovered segment's value).
//
// Hover can be driven from outside too (`activeLabel`), so a legend
// beside the chart and the ring stay in step.
//
// Arc lengths and offsets are animated by framer-motion and the
// segment colours come from the caller, so they are set inline.
// ─────────────────────────────────────────────────────────────

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface DonutChartSegment {
    value: number;
    /** Any CSS colour. */
    color: string;
    label: string;
}

interface AnimatedDonutChartProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
    data: DonutChartSegment[];
    totalValue?: number;
    size?: number;
    strokeWidth?: number;
    animationDuration?: number;
    animationDelayPerSegment?: number;
    highlightOnHover?: boolean;
    centerContent?: React.ReactNode;
    /** Label of the segment to highlight, e.g. from a hovered legend row. */
    activeLabel?: string | null;
    /** Called when the pointer enters a segment (or leaves the chart, with null). */
    onSegmentHover?: (segment: DonutChartSegment | null) => void;
}

export const AnimatedDonutChart = React.forwardRef<HTMLDivElement, AnimatedDonutChartProps>(
    (
        {
            data,
            totalValue: propTotalValue,
            size = 200,
            strokeWidth = 20,
            animationDuration = 1,
            animationDelayPerSegment = 0.05,
            highlightOnHover = true,
            centerContent,
            activeLabel,
            onSegmentHover,
            className,
            ...props
        },
        ref,
    ) => {
        const total = React.useMemo(
            () => propTotalValue || data.reduce((sum, segment) => sum + segment.value, 0),
            [data, propTotalValue],
        );
        const radius = size / 2 - strokeWidth / 2;
        const circumference = 2 * Math.PI * radius;
        // A small gap between segments so neighbours stay distinct (rounded caps would otherwise touch).
        const gap = data.filter((segment) => segment.value > 0).length > 1 ? strokeWidth * 0.9 : 0;
        let cumulative = 0;

        return (
            <div
                ref={ref}
                className={cn('relative flex items-center justify-center', className)}
                style={{ width: size, height: size }}
                onMouseLeave={() => onSegmentHover?.(null)}
                {...props}
            >
                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 overflow-visible" role="img" aria-label="Donut chart">
                    <circle cx={size / 2} cy={size / 2} r={radius} fill="transparent" strokeWidth={strokeWidth} className="stroke-foreground/[0.06]" />
                    <AnimatePresence>
                        {data.map((segment, index) => {
                            if (segment.value <= 0 || total <= 0) return null;
                            const fraction = segment.value / total;
                            const length = Math.max(fraction * circumference - gap, 0.5);
                            const offset = cumulative * circumference;
                            cumulative += fraction;
                            const isActive = activeLabel === segment.label;
                            const isDimmed = highlightOnHover && activeLabel != null && !isActive;
                            return (
                                <motion.circle
                                    key={segment.label}
                                    cx={size / 2}
                                    cy={size / 2}
                                    r={radius}
                                    fill="transparent"
                                    stroke={segment.color}
                                    strokeWidth={strokeWidth}
                                    strokeLinecap="round"
                                    strokeDasharray={`${length} ${circumference}`}
                                    initial={{ opacity: 0, strokeDashoffset: circumference }}
                                    animate={{ opacity: isDimmed ? 0.35 : 1, strokeDashoffset: -offset }}
                                    transition={{
                                        opacity: { duration: 0.25, delay: activeLabel === undefined ? index * animationDelayPerSegment : 0 },
                                        strokeDashoffset: { duration: animationDuration, delay: index * animationDelayPerSegment, ease: 'easeOut' },
                                    }}
                                    className={cn('origin-center', highlightOnHover && 'cursor-pointer')}
                                    style={{
                                        filter: isActive ? `drop-shadow(0 0 6px ${segment.color})` : 'none',
                                        transform: isActive ? 'scale(1.04)' : 'scale(1)',
                                        transition: 'filter 0.2s ease-out, transform 0.2s ease-out',
                                    }}
                                    onMouseEnter={() => onSegmentHover?.(segment)}
                                >
                                    <title>{`${segment.label}: ${(fraction * 100).toFixed(1)}%`}</title>
                                </motion.circle>
                            );
                        })}
                    </AnimatePresence>
                </svg>
                {centerContent && (
                    <div
                        className="pointer-events-none absolute flex flex-col items-center justify-center"
                        style={{ width: size - strokeWidth * 2.5, height: size - strokeWidth * 2.5 }}
                    >
                        {centerContent}
                    </div>
                )}
            </div>
        );
    },
);
AnimatedDonutChart.displayName = 'AnimatedDonutChart';
