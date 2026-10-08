"use client"

import React from "react"
import { motion } from "framer-motion"

interface GradientTracingProps {
  width: number
  height: number
  baseColor?: string
  gradientColors?: [string, string, string]
  animationDuration?: number
  strokeWidth?: number
  path?: string
  className?: string
}

export const GradientTracing: React.FC<GradientTracingProps> = ({
  width,
  height,
  baseColor = "black",
  gradientColors = ["#FFD700", "#FFD700", "#9E00FF"], // Using Mutiny Yellow and a purple
  animationDuration = 2,
  strokeWidth = 2,
  path = `M0,${height / 2} L${width},${height / 2}`,
  className
}) => {
  const gradientId = `pulse-${Math.random().toString(36).substr(2, 9)}`

  return (
    <div className={`relative ${className || ''}`} style={{ width: '100%', height }}>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        fill="none"
        className="overflow-visible"
      >
        <path
          d={path}
          stroke={baseColor}
          strokeOpacity="0.1"
          strokeWidth={strokeWidth}
          className="transition-all"
        />
        <path
          d={path}
          stroke={`url(#${gradientId})`}
          strokeLinecap="round"
          strokeWidth={strokeWidth}
        />
        <defs>
          <motion.linearGradient
            animate={{
              x1: ["-100%", "100%"],
              x2: ["0%", "200%"],
            }}
            transition={{
              duration: animationDuration,
              repeat: Infinity,
              ease: "linear",
            }}
            id={gradientId}
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor={gradientColors[0]} stopOpacity="0" />
            <stop stopColor={gradientColors[1]} />
            <stop offset="1" stopColor={gradientColors[2]} stopOpacity="0" />
          </motion.linearGradient>
        </defs>
      </svg>
    </div>
  )
}
