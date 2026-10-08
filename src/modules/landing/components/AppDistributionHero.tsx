import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, Variants, useScroll } from 'framer-motion';
import './AppDistributionHero.css';

import centerImg from '@/assets/hero-images/center.png';
import creatorsImg from '@/assets/hero-images/creators.png';
import brandsImg from '@/assets/hero-images/brands.png';
import agenciesImg from '@/assets/hero-images/agencies.png';

const MotionLink = motion.create(Link);

// --- Animation Variants ---
const hubVariants: Variants = {
  hidden: {
    opacity: 0.4,
    scale: 2.5,
    y: 150,
    x: "-50%",
    transition: { type: "spring", stiffness: 100, damping: 20 }
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    x: "-50%",
    transition: { type: "spring", stiffness: 150, damping: 20, delay: 0.1 }
  }
};

const destinationLeftVariants: Variants = {
  hidden: { opacity: 0, y: 80, x: "-50%", rotate: -15, scale: 0.5, transition: { duration: 0.2 } },
  visible: { opacity: 1, y: 0, x: "-50%", rotate: 0, scale: 1, transition: { type: "spring", stiffness: 250, damping: 22, delay: 0.7 } }
};

const destinationCenterVariants: Variants = {
  hidden: { opacity: 0, y: 80, x: "-50%", rotate: 5, scale: 0.5, transition: { duration: 0.2 } },
  visible: { opacity: 1, y: 0, x: "-50%", rotate: 0, scale: 1, transition: { type: "spring", stiffness: 250, damping: 22, delay: 0.9 } }
};

const destinationRightVariants: Variants = {
  hidden: { opacity: 0, y: 80, x: "-50%", rotate: 15, scale: 0.5, transition: { duration: 0.2 } },
  visible: { opacity: 1, y: 0, x: "-50%", rotate: 0, scale: 1, transition: { type: "spring", stiffness: 250, damping: 22, delay: 1.1 } }
};

const lineVariants: Variants = {
  hidden: { pathLength: 0, opacity: 0, transition: { duration: 0.2 } },
  visible: {
    pathLength: 1,
    opacity: 1,
    transition: { duration: 1.5, ease: "easeInOut", delay: 1.2 }
  }
};

const lightTrailVariants: Variants = {
  hidden: { opacity: 0, transition: { duration: 0.2 } },
  visible: { opacity: 1, transition: { duration: 0.8, ease: "easeIn", delay: 2.2 } }
};

export default function AppDistributionHero() {
  const { scrollY } = useScroll();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const unsubscribe = scrollY.on("change", (latest) => {
      // Trigger animation when user scrolls down from the top
      if (latest > 100) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    });
    return () => unsubscribe();
  }, [scrollY]);

  return (
    <motion.div
      initial="hidden"
      animate={isVisible ? "visible" : "hidden"}
      className="relative h-[520px] w-full max-w-5xl mx-auto flex items-center justify-center scale-[0.95] origin-center"
    >
      <div data-active-app="2" className="hero-app h-[520px] max-md:rounded-b-[24px] relative rounded-[20px] transition after:absolute after:inset-0 after:transition-all before:absolute before:inset-0 before:border before:border-transparent before:rounded-[inherit] before:pointer-events-none before:z-[11] before:transition-all after:opacity-0 w-full">
        <div className="absolute inset-0 transition-all">

          {/* Central MutinyX Processing Hub */}
          <motion.div variants={hubVariants} className="w-[calc(100%-16px)] max-w-[356px] h-[208px] top-[61px] absolute left-1/2 rounded-[30px] border border-black/12 backdrop-blur-md z-10 shadow-xl bg-white/40">
            <div className="absolute inset-[7px] rounded-[22px] hero-app-distribution-process before:absolute before:inset-0 before:border before:border-[#FFD7000F] before:rounded-[22px] before:pointer-events-none">
              <div className="hero-app-distribution-process-light absolute inset-[6px] rounded-[16px] before:absolute before:inset-0 before:border-4 before:border-[#261F0052] before:rounded-[16px] before:pointer-events-none">
                <div className="hero-app-distribution-process-light-animation absolute inset-0 rounded-[inherit]"></div>
                <div className="absolute -inset-[6px] rounded-[22px] blur-[6px]">
                  <div className="hero-app-distribution-process-light-animation absolute inset-0 rounded-[inherit]"></div>
                </div>
              </div>

              <div className="absolute inset-[10px] rounded-[12px] flex items-center justify-center">
                {/* Single Unified SVG Layer for Static Lines and Light Trails */}
                <svg className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] h-[172px] pointer-events-none z-0" style={{ overflow: "visible" }} viewBox="0 0 320 172" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                      <feGaussianBlur stdDeviation="4" result="blur" />
                      <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                  </defs>

                  {/* Animated Base Paths */}
                  <g stroke="rgba(0,0,0,0.15)" strokeWidth="1.5" strokeLinecap="round">
                    <motion.path variants={lineVariants} d="M 160 86 L 160 89 A 4 4 0 0 0 164 93 L 206 93 A 67 49 0 0 0 273 44 L 273 29.5 L 384.5 29.5 Q 400.5 29.5, 411.8 40.8 L 474.2 103.2 Q 485.5 114.5, 485.5 130.5 L 485.5 261" />
                    <motion.path variants={lineVariants} d="M 160 86 L 160 89 A 4 4 0 0 0 164 93 L 206 93 A 35 35 0 0 1 241 128 L 241 157 L 241 189 A 16 16 0 0 1 225 205 L 176 205 A 16 16 0 0 0 160 221 L 160 261" />
                    <motion.path variants={lineVariants} d="M 160 86 L 160 89 A 4 4 0 0 1 156 93 L 48.5 93 L -64 93 Q -80 93, -91.3 104.3 L -153.7 166.7 Q -165 178, -165 194 L -165 261" />
                  </g>

                  {/* Animated Light Trails */}
                  <motion.g variants={lightTrailVariants} stroke="#FFD700" strokeWidth="2.5" strokeLinecap="round" filter="url(#glow)">
                    <path className="svg-light-trail svg-light-trail-delay-linux" d="M 160 86 L 160 89 A 4 4 0 0 0 164 93 L 206 93 A 67 49 0 0 0 273 44 L 273 29.5 L 384.5 29.5 Q 400.5 29.5, 411.8 40.8 L 474.2 103.2 Q 485.5 114.5, 485.5 130.5 L 485.5 261" />
                    <path className="svg-light-trail svg-light-trail-delay-windows" d="M 160 86 L 160 89 A 4 4 0 0 0 164 93 L 206 93 A 35 35 0 0 1 241 128 L 241 157 L 241 189 A 16 16 0 0 1 225 205 L 176 205 A 16 16 0 0 0 160 221 L 160 261" />
                    <path className="svg-light-trail svg-light-trail-delay-mac" d="M 160 86 L 160 89 A 4 4 0 0 1 156 93 L 48.5 93 L -64 93 Q -80 93, -91.3 104.3 L -153.7 166.7 Q -165 178, -165 194 L -165 261" />
                  </motion.g>
                </svg>

                <img alt="Process" className="relative z-10 w-full h-full object-cover rounded-[12px]" src={centerImg} aria-hidden="true" />
              </div>
            </div>
          </motion.div>

          {/* Bottom Destinations (Creators, Brands, Agencies) */}
          <div className="bottom-[41px] absolute left-0 w-full h-[140px] pointer-events-none">

            {/* Creators (Left) */}
            <MotionLink whileHover={{ scale: 1.03 }} to="/creators" variants={destinationLeftVariants} className="absolute top-0 left-1/2 ml-[-325px] w-[262px] pointer-events-auto flex flex-col items-center z-10 hover:z-20">
              <div className="z-[20] w-[8px] h-[8px] absolute -top-[4px] left-1/2 -translate-x-1/2 rounded-full bg-[#1c238b] shadow-[0_0_8px_rgba(28,35,139,0.8)] border-[1.5px] border-white"></div>
              <img alt="Creators" className="w-[238px] h-[140px] rounded-[16px] shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-black/20 object-cover" src={creatorsImg} />
            </MotionLink>

            {/* Brands (Center) */}
            <MotionLink whileHover={{ scale: 1.03 }} to="/for-brands" variants={destinationCenterVariants} className="absolute top-0 left-1/2 ml-[0px] w-[262px] hidden md:flex flex-col items-center pointer-events-auto z-10 hover:z-20">
              <div className="z-[20] w-[8px] h-[8px] absolute -top-[4px] left-1/2 -translate-x-1/2 rounded-full bg-[#1c238b] shadow-[0_0_8px_rgba(28,35,139,0.8)] border-[1.5px] border-white"></div>
              <img alt="Brands" className="w-[238px] h-[140px] rounded-[16px] shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-black/20 object-cover" src={brandsImg} />
            </MotionLink>

            {/* Agencies (Right) */}
            <MotionLink whileHover={{ scale: 1.03 }} to="/agencies" variants={destinationRightVariants} className="absolute top-0 left-1/2 ml-[325px] w-[262px] hidden md:flex flex-col items-center pointer-events-auto z-10 hover:z-20">
              <div className="z-[20] w-[8px] h-[8px] absolute -top-[4px] left-1/2 -translate-x-1/2 rounded-full bg-[#1c238b] shadow-[0_0_8px_rgba(28,35,139,0.8)] border-[1.5px] border-white"></div>
              <img alt="Agencies" className="w-[238px] h-[140px] rounded-[16px] shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-black/20 object-cover" src={agenciesImg} />
            </MotionLink>

          </div>
        </div>
      </div>
    </motion.div>
  );
}
