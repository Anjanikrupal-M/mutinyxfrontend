"use client";

import React from "react";
import { LazyMotion, domAnimation, m } from "motion/react";

export interface Step {
  title: string | React.ReactNode;
  description: string;
  icon?: React.ElementType;
  colorTheme?: "orange" | "blue" | "purple";
  colors?: {
    bg: string;
    text: string;
    border: string;
  };
}

interface CardProps {
  number: string;
  title: string | React.ReactNode;
  description: string;
  icon?: React.ElementType;
  colorTheme?: "orange" | "blue" | "purple";
  className?: string;
  rotate?: string;
  colors?: {
    bg: string;
    text: string;
    border: string;
  };
}


const Card = ({
  number,
  title,
  description,
  icon: Icon,
  colorTheme = "blue",
  className,
  rotate,
  colors: customColors,
}: CardProps) => {
  const defaultBgColors = {
    orange: "bg-orange-50 dark:bg-orange-500/10",
    blue: "bg-blue-50 dark:bg-blue-500/10",
    purple: "bg-purple-50 dark:bg-purple-500/10",
  };
  const defaultTextColors = {
    orange: "text-orange-500 dark:text-orange-400",
    blue: "text-blue-600 dark:text-blue-400",
    purple: "text-purple-600 dark:text-purple-400",
  };
  const defaultBorderColors = {
    orange: "border-orange-100 dark:border-orange-500/20",
    blue: "border-blue-100 dark:border-blue-500/20",
    purple: "border-purple-100 dark:border-purple-500/20",
  };

  const bgColor = customColors?.bg || defaultBgColors[colorTheme];
  const textColor = customColors?.text || defaultTextColors[colorTheme];
  const borderColor = customColors?.border || defaultBorderColors[colorTheme];

  return (
    <div
      className={`relative w-full md:w-[280px] transition-transform duration-300 hover:z-30 hover:scale-105 ${rotate} ${className}`}
    >
      <div className="bg-white dark:bg-neutral-900 p-2 rounded-[25px] shadow-[0px_10px_20px_0px_#D3D3D3] dark:shadow-none border border-neutral-100 dark:border-neutral-800 relative">
        {Icon && (
          <div className={`absolute -top-3 -right-3 w-10 h-10 rounded-full bg-white dark:bg-neutral-900 shadow-md border border-neutral-100 dark:border-neutral-800 flex items-center justify-center z-40 ${textColor}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
        <div
          className={`${bgColor} border ${borderColor} rounded-[15px] p-[15px] h-full flex flex-col relative overflow-hidden`}
        >
          <span
            className={`${textColor} text-4xl font-handwriting mb-5`}
            style={{
              fontFamily: '"Comic Sans MS", "Chalkboard SE", sans-serif',
            }}
          >
            {number}
          </span>
          <h3 className="text-2xl font-semibold text-neutral-800 dark:text-neutral-100 leading-none mb-[10px]">
            {title}
          </h3>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm/5 tracking-tight">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
};

export interface StepPosition {
  className?: string;
  rotate?: string;
}

export interface HowItWorksProps {
  features?: Step[];
  className?: string;
  stepPositions?: StepPosition[];
}

const DEFAULT_CARD_POSITIONS: StepPosition[] = [
  { className: "md:absolute md:top-0 md:left-[15%]", rotate: "rotate-8" },
  {
    className: "md:absolute md:top-[120px] md:right-[15%]",
    rotate: "-rotate-8",
  },
  { className: "md:absolute md:top-[450px] md:left-[15%]", rotate: "rotate-8" },
  {
    className: "md:absolute md:top-[570px] md:right-[10%]",
    rotate: "-rotate-8",
  },
  { className: "md:absolute md:top-[850px] md:left-[15%]", rotate: "rotate-8" },
  {
    className: "md:absolute md:top-[970px] md:right-[15%]",
    rotate: "-rotate-8",
  },
  { className: "md:absolute md:top-[1300px] md:left-[15%]", rotate: "rotate-8" },
];

// Mobile alternating offsets — odd cards nudge right, even cards nudge left
const MOBILE_OFFSETS = [
  "ml-0 mr-6",   // card 1: shifted right
  "ml-6 mr-0",   // card 2: shifted left
  "ml-0 mr-6",
  "ml-6 mr-0",
  "ml-0 mr-6",
  "ml-6 mr-0",
  "ml-0 mr-6",
];

const MOBILE_ROTATES = [
  "rotate-1",
  "-rotate-1",
  "rotate-1",
  "-rotate-1",
  "rotate-1",
  "-rotate-1",
  "rotate-1",
];

export default function HowItWorks({
  features,
  className,
  stepPositions,
}: HowItWorksProps) {
  const defaultFeatures: Step[] = [
    {
      title: "Create Account",
      description:
        "Sign up in minutes. Enter your details and verify your email to get started.",
      colorTheme: "orange",
    },
    {
      title: "Verify Identity",
      description:
        "Complete your profile verification to ensure secure transactions and compliance.",
      colorTheme: "blue",
    },
    {
      title: "Select Plan",
      description:
        "Choose from a variety of investment plans tailored to your financial goals.",
      colorTheme: "purple",
    },
    {
      title: "Analyze & Invest",
      description:
        "Review returns and make your first investment with confidence.",
      colorTheme: "orange",
    },
    {
      title: "Track Growth",
      description:
        "Monitor your portfolio in real-time and watch your wealth grow over time.",
      colorTheme: "blue",
    },
  ];

  const data = features && features.length > 0 ? features : defaultFeatures;
  const positions = stepPositions || DEFAULT_CARD_POSITIONS;

  let height = 1530; // updated for 7 items
  if (data.length === 1) height = 400;
  else if (data.length === 2) height = 450;
  else if (data.length === 3) height = 800;
  else if (data.length === 4) height = 900;
  else if (data.length === 5) height = 1130;
  else if (data.length === 6) height = 1350;
  else if (data.length >= 7) height = 1600;

  return (
    <LazyMotion features={domAnimation}>
      <div
        className={`bg-white dark:bg-black pt-10 pb-16 md:py-20 px-4 md:px-8 relative ${className}`}
      >
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.08] dark:opacity-[0.15]"
          style={{
            backgroundImage: "linear-gradient(#000 1px, transparent 1px)",
            backgroundSize: "100% 32px",
            marginTop: "4px",
          }}
        ></div>
        <div
          className="absolute inset-0 pointer-events-none opacity-0 dark:opacity-[0.1]"
          style={{
            backgroundImage: "linear-gradient(#fff 1px, transparent 1px)",
            backgroundSize: "100% 32px",
            marginTop: "4px",
          }}
        ></div>
        <div className="from-background pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r"></div>
        <div className="from-background pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l"></div>

        {/* ── MOBILE layout ── */}
        <div className="md:hidden relative max-w-sm mx-auto">
          {/* Vertical dashed spine */}
          <div className="absolute left-1/2 top-0 bottom-0 -translate-x-1/2 w-px pointer-events-none z-0">
            <svg className="w-full h-full" preserveAspectRatio="none">
              <m.line
                x1="1" y1="0" x2="1" y2="100%"
                stroke="currentColor"
                className="text-neutral-800 dark:text-neutral-400"
                strokeWidth="2"
                strokeDasharray="8 6"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                initial={{ strokeDashoffset: 0 }}
                animate={{ strokeDashoffset: -140 }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              />
            </svg>
          </div>

          <div className="flex flex-col gap-6 relative z-10">
            {data.map((step, index) => {
              const offset = MOBILE_OFFSETS[index % MOBILE_OFFSETS.length];
              const mobileRotate = MOBILE_ROTATES[index % MOBILE_ROTATES.length];
              return (
                <m.div
                  key={index}
                  className={`${offset} ${mobileRotate}`}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.45, delay: index * 0.06, ease: "easeOut" }}
                >
                  <Card
                    number={`0${index + 1}`}
                    title={step.title}
                    description={step.description}
                    icon={step.icon}
                    colorTheme={step.colorTheme || "blue"}
                    colors={step.colors}
                  />
                </m.div>
              );
            })}
          </div>
        </div>

        {/* ── DESKTOP layout (unchanged) ── */}
        <div className="hidden md:block max-w-6xl mx-auto relative z-10">
          <div
            className="relative w-full max-w-[1000px] mx-auto md:block h-auto md:h-[var(--md-height)]"
            style={{ "--md-height": `${height}px` } as React.CSSProperties}
          >
            {data.length > 1 && (
              <svg
                className="absolute top-0 left-0 w-full h-full pointer-events-none z-0"
                viewBox={`0 0 1000 ${height}`}
                preserveAspectRatio="none"
              >
                {(() => {
                  const pathD = data.reduce((acc, _, index) => {
                    if (index >= data.length - 1) return acc;
                    if (index === 0)
                      return "M 290 150 C 500 150, 550 270, 710 270"; // 1 -> 2
                    if (index === 1)
                      return acc + " C 850 270, 500 350, 290 450"; // 2 -> 3
                    if (index === 2)
                      return acc + " C 290 600, 550 720, 750 720"; // 3 -> 4
                    if (index === 3)
                      return acc + " C 950 720, 500 800, 290 850"; // 4 -> 5
                    if (index === 4)
                      return acc + " C 290 1000, 550 1120, 710 1120"; // 5 -> 6
                    if (index === 5)
                      return acc + " C 850 1120, 500 1200, 290 1300"; // 6 -> 7
                    return acc;
                  }, "");
                  return (
                    <m.path
                      d={pathD}
                      stroke="currentColor"
                      className="text-neutral-800 dark:text-neutral-400"
                      strokeWidth="2"
                      strokeDasharray="8 6"
                      fill="none"
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                      initial={{ strokeDashoffset: 0 }}
                      animate={{
                        strokeDashoffset: -140,
                      }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                    />
                  );
                })()}
              </svg>
            )}

            {data.map((step, index) => {
              const position = positions[index % positions.length];

              return (
                <Card
                  key={index}
                  number={`0${index + 1}`}
                  title={step.title}
                  description={step.description}
                  icon={step.icon}
                  colorTheme={step.colorTheme || "blue"}
                  colors={step.colors}
                  rotate={position.rotate}
                  className={position.className}
                />
              );
            })}
          </div>
        </div>
      </div>
    </LazyMotion>
  );
}
