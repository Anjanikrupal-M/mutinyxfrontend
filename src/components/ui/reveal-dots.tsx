"use client"
import React, { useRef, useEffect } from "react"

interface RevealDotsProps {
  maskCutout?: string | "none";
}

export const RevealDots = ({ maskCutout }: RevealDotsProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const dotsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let ticking = false
    const updateMousePosition = (e: MouseEvent) => {
      if (!ticking) {
        requestAnimationFrame(() => {
          if (containerRef.current && dotsRef.current) {
            const rect = containerRef.current.getBoundingClientRect()
            const x = e.clientX - rect.left
            const y = e.clientY - rect.top
            dotsRef.current.style.setProperty("--mouse-x", `${x}px`)
            dotsRef.current.style.setProperty("--mouse-y", `${y}px`)
          }
          ticking = false
        })
        ticking = true
      }
    }
    window.addEventListener("mousemove", updateMousePosition, { passive: true })
    return () => window.removeEventListener("mousemove", updateMousePosition)
  }, [])

  const defaultCutout = 'radial-gradient(ellipse 600px 350px at 50% 50%, transparent 60%, black 100%)';
  const appliedCutout = maskCutout === "none" ? null : (maskCutout || defaultCutout);

  return (
    <div ref={containerRef} className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
      <div
        ref={dotsRef}
        className="absolute inset-0 transition-opacity duration-300"
        style={{
          // Draw the dots
          backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255, 215, 0, 0.8) 2px, transparent 0)',
          backgroundSize: '32px 32px',
          maskImage: `radial-gradient(circle 250px at var(--mouse-x, -1000px) var(--mouse-y, -1000px), black 0%, transparent 100%)${appliedCutout ? `, ${appliedCutout}` : ''}`,
          maskComposite: appliedCutout ? 'intersect' : undefined,
          WebkitMaskImage: `radial-gradient(circle 250px at var(--mouse-x, -1000px) var(--mouse-y, -1000px), black 0%, transparent 100%)${appliedCutout ? `, ${appliedCutout}` : ''}`,
          WebkitMaskComposite: appliedCutout ? 'source-in' : undefined,
        }}
      />
    </div>
  )
}
