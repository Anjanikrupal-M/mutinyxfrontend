"use client";
import {
  useScroll,
  useTransform,
  motion,
  useMotionValueEvent,
} from "framer-motion";
import React, { useEffect, useRef, useState } from "react";

interface TimelineEntry {
  title: string;
  content: React.ReactNode;
}

export const Timeline = ({ data }: { data: TimelineEntry[] }) => {
  const ref = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const [completed, setCompleted] = useState<boolean[]>([]);
  const [offsets, setOffsets] = useState<number[]>([]);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setHeight(rect.height);
    }
  }, [ref]);

  useEffect(() => {
    // Initialize completed array: Step 0 is active initially, others inactive
    const initialCompleted = data.map((_, index) => index === 0);
    setCompleted(initialCompleted);
  }, [data]);

  useEffect(() => {
    const measureOffsets = () => {
      if (ref.current) {
        const newOffsets = rowRefs.current.map((row) => {
          if (!row) return 0;
          return row.offsetTop;
        });
        setOffsets(newOffsets);
      }
    };

    measureOffsets();
    
    window.addEventListener("resize", measureOffsets);
    window.addEventListener("load", measureOffsets);
    
    const timer = setTimeout(measureOffsets, 250);

    return () => {
      window.removeEventListener("resize", measureOffsets);
      window.removeEventListener("load", measureOffsets);
      clearTimeout(timer);
    };
  }, [data, height]);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start 10%", "end 50%"],
  });

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    const currentLineHeight = latest * height;
    const nextCompleted = data.map((_, index) => {
      if (index === 0) return true;
      const targetOffset = offsets[index] || 0;
      // The line touches the circle when the line height reaches the row's offsetTop
      return currentLineHeight >= targetOffset;
    });

    if (JSON.stringify(nextCompleted) !== JSON.stringify(completed)) {
      setCompleted(nextCompleted);
    }
  });

  const heightTransform = useTransform(scrollYProgress, [0, 1], [0, height]);
  const opacityTransform = useTransform(scrollYProgress, [0, 0.1], [0, 1]);

  return (
    <div
      className="w-full bg-white dark:bg-neutral-950 font-sans md:px-10"
      ref={containerRef}
    >
      <div className="max-w-7xl mx-auto py-20 px-4 md:px-8 lg:px-10">
        <h2 className="text-lg md:text-4xl mb-4 text-black dark:text-white max-w-4xl font-extrabold">
          The MutinyX Pipeline
        </h2>
        <p className="text-neutral-700 dark:text-neutral-300 text-sm md:text-base max-w-sm font-medium">
          From creator discovery to payment escrow, see how everything flows in one system.
        </p>
      </div>

      <div ref={ref} className="relative max-w-7xl mx-auto pb-20">
        {data.map((item, index) => (
          <div
            key={index}
            ref={(el) => {
              rowRefs.current[index] = el;
            }}
            className="flex justify-start pt-10 md:pt-40 md:gap-10"
          >
            <div className="sticky flex flex-col md:flex-row z-40 items-center top-40 self-start max-w-xs lg:max-w-sm md:w-full">
              <div className="h-10 absolute left-3 md:left-3 w-10 rounded-full bg-white dark:bg-black flex items-center justify-center">
                <div
                  className={`h-4 w-4 rounded-full border transition-all duration-300 ${
                    completed[index]
                      ? "bg-brand border-brand-600 shadow-[0_0_10px_rgba(245,222,75,0.5)] scale-110"
                      : "bg-neutral-200 dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700"
                  }`}
                />
              </div>
              <h3 className={`hidden md:block text-xl md:pl-20 md:text-5xl font-bold transition-colors duration-300 ${
                completed[index]
                  ? "text-black dark:text-white"
                  : "text-neutral-500/40 dark:text-neutral-500/40"
              }`}>
                {item.title}
              </h3>
            </div>

            <div className="relative pl-20 pr-4 md:pl-4 w-full">
              <h3 className={`md:hidden block text-2xl mb-4 text-left font-bold transition-colors duration-300 ${
                completed[index]
                  ? "text-black dark:text-white"
                  : "text-neutral-500/40"
              }`}>
                {item.title}
              </h3>
              {item.content}{" "}
            </div>
          </div>
        ))}
        <div
          style={{
            height: height + "px",
          }}
          className="absolute md:left-8 left-8 top-0 overflow-hidden w-[2px] bg-[linear-gradient(to_bottom,var(--tw-gradient-stops))] from-transparent from-[0%] via-neutral-200 dark:via-neutral-700 to-transparent to-[99%]  [mask-image:linear-gradient(to_bottom,transparent_0%,black_10%,black_90%,transparent_100%)] "
        >
          <motion.div
            style={{
              height: heightTransform,
              opacity: opacityTransform,
            }}
            className="absolute inset-x-0 top-0  w-[2px] bg-gradient-to-t from-yellow-500 via-yellow-400 to-transparent from-[0%] via-[10%] rounded-full"
          />
        </div>
      </div>
    </div>
  );
};

