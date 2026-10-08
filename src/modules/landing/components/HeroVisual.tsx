import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

/**
 * HeroVisual — pixel-perfect React port of index.html
 *
 * Framer exports 3 CSS breakpoints. We replicate them here via Tailwind
 * responsive prefixes and inline style overrides.
 *
 * Breakpoints (from styles.css media queries):
 *   ≥1200px (desktop)  → .hxmhn6 rules  — container h:670, cards w:248
 *   810–1199px (tablet) → .3ir6en rules  — container h:670, cards bleed off-edge
 *   ≤809px (mobile)    → .1qolqx1 rules — container h:468, cards hidden (mobile shows phone only)
 *
 * Card mapping (image → CSS class → rotation → top → left/right → w×h):
 *   img_1 → 4fmtir  → -15°  top:28  left:37  (tablet: left:-43)   248×281
 *   img_6 → 1iexqbk → +15°  top:281 left:37  (tablet: left:-43)   248×280
 *   img_5 → 1i4kfa2 → -15°  top:533 left:65  (tablet: left:-15)   248×243
 *   img_8 → p1ho6w  → +15°  top:30  right:53 (tablet: right:-27)  248×199
 *   img_7 → 1a6599x → -15°  top:197 right:47 (tablet: right:-33)  248×196
 *   img_9 → 59bqxl  → +15°  top:423 right:53 (tablet: right:-19)  248×330
 */
export function HeroVisual() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  const yUp = useTransform(scrollYProgress, [0, 1], [0, -50]);
  const yDown = useTransform(scrollYProgress, [0, 1], [0, 50]);

  return (
    /**
     * Mirrors .framer-1gqtlme:
     *   width:100%  height:670px  display:flex  justify-content:center
     *   align-items:center  overflow:visible  position:sticky  top:0
     *
     * We keep position:relative (not sticky) so it participates in normal flow.
     * overflow:visible lets the absolutely-positioned cards spill out.
     */
    <div className="w-full overflow-visible">
      <div
        ref={sectionRef}
        className="relative max-w-[1050px] w-full mx-auto flex items-center justify-center overflow-visible"
        style={{ height: 670 }}
      >
        {/* ────────── CENTER PHONE (framer-c9b4gi-container: 280×578) ────────── */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="relative z-[60] flex-none overflow-visible"
          style={{ width: 280, height: 578 }}
        >
          {/*
           * Shadow layer — framer-6igufk
           * width: 162%  height: 116%  top: 0%  left: 0%
           * Bleeds outside the phone to create the soft drop-shadow
           */}
          <div className="absolute pointer-events-none" style={{ width: "162%", height: "116%", top: 0, left: 0 }}>
            <img src="/creators/collection/extracted_image_2.png" alt="" className="w-full h-full object-fill" draggable={false} />
          </div>

          {/*
           * Screen layer — framer-1czr3j7
           * width: 90%  height: 96%  top: 1.89627%  left: 5%
           */}
          <div
            className="absolute overflow-hidden"
            style={{ width: "90%", height: "96%", top: "1.89627%", left: "5%", borderRadius: 40 }}
          >
            <img src="/creators/collection/extracted_image_3.jpg" alt="Pop Site screen" className="w-full h-full object-cover" draggable={false} />
          </div>

          {/*
           * iPhone Border overlay — framer-14edbi7
           * width: 100%  height: 99%  top: 0%  left: 0%
           */}
          <div className="absolute pointer-events-none" style={{ width: "100%", height: "99%", top: 0, left: 0 }}>
            <img src="/creators/collection/extracted_image_4.png" alt="" className="w-full h-full object-fill" draggable={false} />
          </div>
        </motion.div>

        {/* ═══════════════ LEFT CARDS ═══════════════ */}

        {/*
       * img_1 / framer-4fmtir — Stats
       * desktop: top:28  left:37   248×281   rotate(-15deg)
       * tablet:  top:28  left:-43  248×280   rotate(-15deg)
       */}
        <motion.div
          initial={{ opacity: 0, scale: 1.5, rotate: 10 }}
          animate={{ opacity: 1, scale: 1, rotate: -15 }}
          transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.1 }}
          style={{
            y: yUp,
            position: "absolute",
            top: 28,
            left: 37,
            width: 248,
            height: 281,
          }}
          className="hidden md:block z-10 overflow-hidden rounded-[10px] border border-black/[0.08] shadow-[20px_25px_31px_rgba(0,0,0,0.08)] bg-white"
        >
          <img src="/creators/collection/extracted_image_1.jpg" alt="Stats" className="w-full h-full object-cover" draggable={false} />
        </motion.div>

        {/*
       * img_6 / framer-1iexqbk — Contact
       * desktop: top:281  left:37   248×280   rotate(+15deg)
       * tablet:  top:281  left:-43  248×280   rotate(+15deg)
       */}
        <motion.div
          initial={{ opacity: 0, scale: 1.5, rotate: -10 }}
          animate={{ opacity: 1, scale: 1, rotate: 15 }}
          transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.3 }}
          style={{
            y: yDown,
            position: "absolute",
            top: 241,
            left: 37,
            width: 248,
            height: 280,
          }}
          className="hidden md:block z-30 overflow-hidden rounded-[10px] border border-black/[0.08] shadow-[20px_25px_31px_rgba(0,0,0,0.08)] bg-white"
        >
          <img src="/creators/collection/extracted_image_6.jpg" alt="Contact" className="w-full h-full object-cover" draggable={false} />
        </motion.div>

        {/*
       * img_5 / framer-1i4kfa2 — Resume
       * desktop: top:533  left:65   248×243   rotate(-15deg)
       * tablet:  top:533  left:-15  248×243   rotate(-15deg)
       */}
        <motion.div
          initial={{ opacity: 0, scale: 1.5, rotate: 15 }}
          animate={{ opacity: 1, scale: 1, rotate: -15 }}
          transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.5 }}
          style={{
            y: yUp,
            position: "absolute",
            top: 533,
            left: 65,
            width: 248,
            height: 243,
          }}
          className="hidden md:block z-10 overflow-hidden rounded-[10px] border border-black/[0.08] shadow-[20px_25px_31px_rgba(0,0,0,0.08)] bg-white"
        >
          <img src="/creators/collection/extracted_image_5.jpg" alt="Resume" className="w-full h-full object-cover" draggable={false} />
        </motion.div>

        {/* ═══════════════ RIGHT CARDS ═══════════════ */}

        {/*
       * img_8 / framer-p1ho6w — FAQ
       * desktop: top:30   right:53   248×199   rotate(+15deg)
       * tablet:  top:30   right:-27  248×199   rotate(+15deg)
       */}
        <motion.div
          initial={{ opacity: 0, scale: 1.5, rotate: -15 }}
          animate={{ opacity: 1, scale: 1, rotate: 15 }}
          transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.2 }}
          style={{
            y: yDown,
            position: "absolute",
            top: 30,
            right: 53,
            width: 248,
            height: 199,
          }}
          className="hidden md:block z-50 overflow-hidden rounded-[10px] border border-black/[0.08] shadow-[20px_25px_31px_rgba(0,0,0,0.08)] bg-white"
        >
          <img src="/creators/collection/extracted_image_8.jpg" alt="FAQ" className="w-full h-full object-cover" draggable={false} />
        </motion.div>

        {/*
       * img_7 / framer-1a6599x — My Stack
       * desktop: top:197  right:47   248×196   rotate(-15deg)
       * tablet:  top:197  right:-33  248×196   rotate(-15deg)
       */}
        <motion.div
          initial={{ opacity: 0, scale: 1.5, rotate: 10 }}
          animate={{ opacity: 1, scale: 1, rotate: -15 }}
          transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.4 }}
          style={{
            y: yUp,
            position: "absolute",
            top: 237,
            right: 47,
            width: 248,
            height: 196,
          }}
          className="hidden md:block z-30 overflow-hidden rounded-[10px] border border-black/[0.08] shadow-[20px_25px_31px_rgba(0,0,0,0.08)] bg-white"
        >
          <img src="/creators/collection/extracted_image_7.jpg" alt="My Stack" className="w-full h-full object-cover" draggable={false} />
        </motion.div>

        {/*
       * img_9 / framer-59bqxl — Showcase
       * desktop: top:423  right:53   248×330   rotate(+15deg)
       * tablet:  top:423  right:-19  248×330   rotate(+15deg)
       */}
        <motion.div
          initial={{ opacity: 0, scale: 1.5, rotate: -10 }}
          animate={{ opacity: 1, scale: 1, rotate: 15 }}
          transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.6 }}
          style={{
            y: yDown,
            position: "absolute",
            top: 423,
            right: 53,
            width: 248,
            height: 330,
          }}
          className="hidden md:block z-30 overflow-hidden rounded-[10px] border border-black/[0.08] shadow-[20px_25px_31px_rgba(0,0,0,0.08)] bg-white"
        >
          <img src="/creators/collection/extracted_image_9.jpg" alt="Showcase" className="w-full h-full object-cover" draggable={false} />
        </motion.div>
      </div>
    </div>
  );
}
