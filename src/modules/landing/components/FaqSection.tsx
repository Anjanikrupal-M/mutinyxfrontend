import { motion } from "framer-motion";
import { FaqPro, type FaqProItem } from "@/components/ui/faq-pro";
import { HelpCircle } from "lucide-react";
import { RevealDots } from "@/components/ui/reveal-dots";

interface FaqSectionProps {
  badge?: string;
  title?: string;
  description?: string;
  items: FaqProItem[];
}

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
};

export function FaqSection({
  badge = "Frequently Asked Questions",
  title = "Got Questions? We've Got Answers",
  description = "Find quick answers to common questions about MutinyX.",
  items,
}: FaqSectionProps) {
  return (
    <section id="faq" className="relative w-full py-16 md:py-24 overflow-hidden z-10">
      <RevealDots maskCutout="none" />
      <div className="container mx-auto px-4 max-w-4xl relative z-10">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center rounded-full px-4 py-1.5 text-xs font-bold text-foreground mb-6 bg-white/40 backdrop-blur-md shadow-[4px_4px_10px_rgba(0,0,0,0.05),-4px_-4px_10px_rgba(255,255,255,0.8)] border border-white/60">
            <HelpCircle className="w-3.5 h-3.5 mr-2 text-brand-600" />
            {badge}
          </div>
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tight mb-4 text-foreground">
            {title}
          </h2>
          <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto font-medium font-geist">
            {description}
          </p>
        </motion.div>

        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
        >
          <FaqPro items={items} defaultOpenFirst={false} />
        </motion.div>
      </div>
    </section>
  );
}

export default FaqSection;
