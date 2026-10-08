"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface HoverEmojiBubbleProps {
  text: string;
  emoji: string;
}

export const HoverEmojiBubble = ({ text, emoji }: HoverEmojiBubbleProps) => {
  const [bubbles, setBubbles] = useState<{ id: number; x: number; y: number; delay: number; duration: number }[]>([]);
  const hoverIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isHoveredRef = useRef(false);
  const containerRef = useRef<HTMLSpanElement>(null);

  const spawnBubble = () => {
    const newBubble = {
      id: Date.now() + Math.random(),
      x: (Math.random() - 0.5) * 60, // Random horizontal spread
      y: -40 - Math.random() * 50,   // Random float height
      delay: 0,
      duration: 0.6 + Math.random() * 0.6, // Variable speed
    };

    setBubbles((prev) => [...prev, newBubble]);

    // Auto-remove after animation completes
    setTimeout(() => {
      setBubbles((prev) => prev.filter((b) => b.id !== newBubble.id));
    }, newBubble.duration * 1000 + 100);
  };

  const handleMouseEnter = () => {
    isHoveredRef.current = true;

    // Initial burst
    for (let i = 0; i < 3; i++) {
      spawnBubble();
    }

    // Continuous spawn loop
    if (hoverIntervalRef.current) clearInterval(hoverIntervalRef.current);
    hoverIntervalRef.current = setInterval(() => {
      if (isHoveredRef.current) {
        spawnBubble();
      }
    }, 150); // Adjust this value to change spawn rate
  };

  const handleMouseLeave = () => {
    isHoveredRef.current = false;
    if (hoverIntervalRef.current) {
      clearInterval(hoverIntervalRef.current);
      hoverIntervalRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (hoverIntervalRef.current) clearInterval(hoverIntervalRef.current);
    };
  }, []);



  return (
    <span
      ref={containerRef}
      className="relative inline-block cursor-default"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {text}
      <AnimatePresence>
        {bubbles.map((bubble) => (
          <motion.span
            key={bubble.id}
            initial={{ opacity: 0, y: 0, x: 0, scale: 0.5 }}
            animate={{
              opacity: [0, 1, 0],
              y: bubble.y,
              x: bubble.x,
              scale: [0.5, 1.2, 1],
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: bubble.duration,
              delay: bubble.delay,
              ease: "easeOut",
            }}
            className="absolute left-1/2 top-0 -translate-x-1/2 pointer-events-none text-2xl drop-shadow-md z-50 select-none"
          >
            {emoji}
          </motion.span>
        ))}
      </AnimatePresence>
    </span>
  );
};
