import { useRef, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/shared/ui/button";
import { AntiMetalButton } from "@/components/ui/anti-metal-button";
import { RevealDots } from "@/components/ui/reveal-dots";
import { motion, Variants } from "framer-motion";
import { SpotlightNavbar } from "@/shared/ui/spotlight-navbar";
import { useSmoothScroll } from "@/shared/hooks/useSmoothScroll";
import { ProgressiveBlur } from "@/components/ui/progressive-blur";
import { AwardBadge } from "@/shared/ui/award-badge";
import HowItWorks, { Step } from "@/shared/ui/how-it-works";
import mutinyTalentAppImg from "@/assets/mutiny-talent-app.png";
import { Search, UserPlus, FileText, UploadCloud, MessageSquare, Banknote, Building2, Sparkles } from "lucide-react";
import { HeroVisual } from "./components/HeroVisual";
import { CollectionVisual } from "./components/CollectionVisual";
import { SiteFooter } from "@/shared/ui/site-footer";
import { ContactSection } from "@/shared/ui/contact-section";
import { FaqSection } from "./components/FaqSection";
import { AppStoreButton } from '@/shared/ui/app-store-button';
import { PlayStoreButton } from '@/shared/ui/play-store-button';

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
};

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15 }
  }
};

const MetaVerifiedIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 40 40"
    fill="currentColor"
    {...props}
  >
    <path fillRule="evenodd" d="M19.998 3.094 14.638 0l-2.972 5.15H5.432v6.354L0 14.64 3.094 20 0 25.359l5.432 3.137v5.905h5.975L14.638 40l5.36-3.094L25.358 40l3.232-5.6h6.162v-6.01L40 25.359 36.905 20 40 14.641l-5.248-3.03v-6.46h-6.419L25.358 0l-5.36 3.094Zm7.415 11.225 2.254 2.287-11.43 11.5-6.835-6.93 2.244-2.258 4.587 4.581 9.18-9.18Z" />
  </svg>
);

export default function CreatorsPage() {
  const [hideBottomBlur, setHideBottomBlur] = useState(false);
  const ctaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setHideBottomBlur(entry.isIntersecting);
      },
      {
        rootMargin: "0px 0px -10% 0px",
        threshold: 0.05,
      }
    );

    if (ctaRef.current) {
      observer.observe(ctaRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  useSmoothScroll();

  const scrollToTop = () => {
    if ((window as any).__lenis) {
      (window as any).__lenis.scrollTo(0, { duration: 1.2 });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const NAV_ITEMS = [
    {
      label: "Solutions",
      children: [
        {
          label: "Brands & Agencies",
          href: "/for-brands",
          description: "Launch campaigns, discover creators, manage escrow & track ROI.",
          ctaText: "Explore Platform",
          icon: <Building2 className="w-4 h-4 text-brand-700" />,
        },
        {
          label: "Creators",
          href: "/creators",
          description: "Get invited to brand deals, submit content & get instant payouts.",
          ctaText: "Get Creator App",
          icon: <Sparkles className="w-4 h-4 text-brand-700" />,
        },
      ],
    },
    { label: "Features", href: "#features" },
    { label: "How It Works", href: "#how-it-works" },
    { label: "FAQ", href: "#faq" },
    { label: "Contact", href: "#contact" },
  ];

  const creatorFaqs = [
    {
      id: "how-to-join",
      question: "How do I join MutinyX as a creator?",
      answer: "Download the Mutiny Talent app on iOS or Android, create your creator profile, and connect your Instagram account securely via official Meta verification.",
      action: {
        label: "Download MutinyX app",
        href: "/download"
      }
    },
    {
      id: "apply-vs-invite",
      question: "Do I apply for campaigns or will brands invite me?",
      answer: "Both! You can browse open brand campaigns tailored to your niche and apply directly, or receive direct collaboration offers from brands who find your profile."
    },
    {
      id: "how-payments-work",
      question: "When and how do I get paid?",
      answer: "Payments are backed by digital agreements. Once your content is reviewed, approved, and published per campaign deliverables, payouts are released directly into your bank account without chasing."
    },
    {
      id: "what-is-digital-mou",
      question: "What is a Digital MOU?",
      answer: "Every collaboration includes a clear, built-in digital agreement covering deliverables, timelines, content usage rights, and payment terms before you start creating."
    },
    {
      id: "content-submissions",
      question: "How do content reviews and revisions work?",
      answer: "Upload your draft scripts and videos directly in the Mutiny Talent app. Brands provide structured feedback and approvals in one place, eliminating endless DM and email chaos."
    }
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-brand/30 selection:text-foreground relative overflow-x-hidden">

      <ProgressiveBlur
        position="top"
        className="fixed z-40"
        backgroundColor="hsl(var(--background))"
        height="120px"
      />
      <ProgressiveBlur
        position="bottom"
        className={`fixed z-40 transition-opacity duration-300 ${hideBottomBlur ? "opacity-0" : "opacity-100"}`}
        backgroundColor="hsl(var(--background))"
        height="120px"
      />

      <SpotlightNavbar
        items={NAV_ITEMS}
        logo={
          <Link to="/">
            <div className="flex items-center shrink-0 hover:opacity-80 transition-opacity cursor-pointer bg-black rounded-full px-4 py-2 shadow-sm border border-white/5">
              <img src="/logo.svg" alt="MutinyX Logo" className="h-4 sm:h-5 w-auto object-contain" />
            </div>
          </Link>
        }
        mobileExtraItems={[
          { label: "Log in", href: "/login", className: "bg-black/5 text-black hover:bg-black/10 border border-black/10" },
          { label: "Download App", href: "/download", className: "bg-brand text-black hover:bg-brand/90 shadow-md" },
        ]}
        actions={
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <Link to="/login">
              <Button variant="ghost" size="sm" className="font-semibold text-sm text-foreground/80 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 rounded-full px-3.5 sm:px-4 transition-all">
                Log in
              </Button>
            </Link>
            <Link to="/download">
              <Button size="sm" className="font-semibold text-sm bg-brand text-black hover:bg-brand/90 border-transparent shadow-sm rounded-full px-4 sm:px-5 transition-all hover:scale-[1.02] active:scale-[0.98]">
                Download App
              </Button>
            </Link>
          </div>
        }
      />

      <main className="flex-1">
        {/* --- SECTION 1: HERO --- */}
        <section className="relative isolate pt-36 pb-12 md:pt-44 md:pb-16 overflow-hidden bg-gradient-to-b from-brand/20 via-brand/5 to-background">
          <RevealDots maskCutout="none" />
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="container mx-auto px-4 relative z-10 flex flex-col items-center text-center max-w-4xl"
          >
            <motion.div variants={fadeInUp} className="inline-flex items-center rounded-full px-4 py-1.5 text-xs font-bold text-foreground mb-8 bg-white/40 backdrop-blur-md shadow-[4px_4px_10px_rgba(0,0,0,0.05),-4px_-4px_10px_rgba(255,255,255,0.8)] border border-white/60">
              ✨ MutinyX for Creators
            </motion.div>

            <motion.h1 variants={fadeInUp} className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight mb-6 text-foreground leading-[1.1]">
              The Collaboration Network for Creators
            </motion.h1>

            <motion.p variants={fadeInUp} className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
              Discover brand campaigns, collaborate seamlessly, deliver your best work, and get paid—all from one place.
            </motion.p>

            <motion.div variants={fadeInUp} className="flex flex-row gap-3 sm:gap-4 justify-center items-center relative w-full max-w-[420px] mx-auto px-2">
              <AppStoreButton
                onClick={() => window.open("https://apps.apple.com/in/app/mutiny-talent/id6760656203", "_blank", "noopener,noreferrer")}
                className="flex-1 sm:flex-none w-auto sm:w-48 h-12 sm:h-14 rounded-xl sm:rounded-2xl bg-foreground text-background hover:bg-foreground/90 shadow-md text-xs sm:text-sm px-2.5 sm:px-4"
              />
              <PlayStoreButton
                variant="outline"
                onClick={() => window.open("https://play.google.com/store/apps/details?id=com.mutiny.talent&pcampaignid=web_share", "_blank", "noopener,noreferrer")}
                className="flex-1 sm:flex-none w-auto sm:w-48 h-12 sm:h-14 rounded-xl sm:rounded-2xl bg-card border-border hover:bg-secondary text-foreground shadow-sm text-xs sm:text-sm px-2.5 sm:px-4"
              />
            </motion.div>
          </motion.div>

          {/* HeroVisual sits outside the constrained text container so cards can overflow */}
          <HeroVisual />
        </section>

        <section id="features" className="relative overflow-hidden pt-24 pb-8 bg-background">
          <div className="container mx-auto px-4 mb-16 text-center max-w-4xl">
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight mb-6">
              Everything You Need to Work With Brands
            </h2>
            <p className="text-lg text-muted-foreground mb-10">
              Whether you’re applying for campaigns or getting invited by brands, MutinyX keeps your entire workflow organized.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {[
                "Discover campaigns that match your niche",
                "Receive direct brand invitations",
                "Sign MOUs digitally",
                "Submit content for review",
                "Chat with brands in one place",
                "Track approvals in real time",
                "Get paid seamlessly"
              ].map((item, i) => (
                <div key={i} className="px-4 py-2 bg-neutral-100 dark:bg-neutral-800 rounded-full text-sm font-medium text-foreground">
                  {item}
                </div>
              ))}
            </div>
          </div>
          <CollectionVisual />
        </section>

        {/* --- SECTION 4: MUTINY TALENT (FOR CREATORS) --- */}
        <section id="how-it-works" className="pt-10 pb-24 relative overflow-hidden bg-neutral-50 dark:bg-neutral-900/30">
          <div className="container mx-auto px-4 max-w-6xl space-y-10 relative z-10">
            {/* Heading — always first */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center rounded-full px-4 py-1.5 text-xs font-bold text-foreground mb-3 bg-white/40 backdrop-blur-md shadow-[4px_4px_10px_rgba(0,0,0,0.05),-4px_-4px_10px_rgba(255,255,255,0.8)] border border-white/60">
                For Creators
              </div>
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground flex flex-col sm:flex-row items-start sm:items-center gap-4">
                Introducing <AwardBadge type="product-of-the-day" place={1} />
              </h2>
            </motion.div>

            <HowItWorks features={[
              {
                icon: Search,
                title: "Campaign Discovery",
                description: "Find campaigns tailored to your content, audience, and category. No more searching through DMs or endless emails.",
                colorTheme: "blue"
              },
              {
                icon: UserPlus,
                title: "Get Invited by Brands",
                description: "Great creators don’t always have to apply. Brands can discover your profile and invite you directly to collaborate.",
                colorTheme: "purple"
              },
              {
                icon: FileText,
                title: "Built-in Digital MOU",
                description: "Know exactly what’s expected before you start. Every collaboration includes a clear agreement covering deliverables, timelines, usage rights, and payments.",
                colorTheme: "orange"
              },
              {
                icon: UploadCloud,
                title: "Simple Content Submission",
                description: "Upload your content, receive feedback, make revisions, and get approvals—all inside the campaign workspace.",
                colorTheme: "blue"
              },
              {
                icon: MessageSquare,
                title: "Built-in Messaging",
                description: "No more switching between WhatsApp, email, and Instagram. Keep every conversation linked to the campaign.",
                colorTheme: "purple"
              },
              {
                icon: MetaVerifiedIcon,
                title: (
                  <span className="flex items-center gap-2">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Meta_Platforms_Inc._logo.svg/960px-Meta_Platforms_Inc._logo.svg.png?utm_source=commons.wikimedia.org&utm_campaign=index&utm_content=thumbnail" alt="Meta" className="h-[0.8em] object-contain" />
                    Approved
                  </span>
                ),
                description: "Securely connect your Instagram through official Meta integrations. Safe. Reliable. Trusted.",
                colors: {
                  bg: "bg-[#1B3D81]/10",
                  text: "text-[#1B3D81]",
                  border: "border-[#1B3D81]/20"
                }
              },
              {
                icon: Banknote,
                title: "Get Paid Without Chasing",
                description: "Focus on creating while MutinyX handles the workflow from collaboration to payout.",
                colorTheme: "blue"
              }
            ]} />
          </div>
        </section>

        <FaqSection
          badge="Creator FAQs"
          title="Everything Creators Need to Know"
          description="Have questions about getting paid, signing MOUs, or connecting your socials? We're here to help."
          items={creatorFaqs}
        />

        <ContactSection />

        {/* --- SECTION 5: FINAL CTA --- */}
        <section className="py-12 md:py-24 bg-background relative z-10">
          <div className="container mx-auto px-4">
            <div className="bg-brand rounded-[2rem] md:rounded-[3rem] py-16 md:py-24 px-6 md:px-12 flex flex-col items-center justify-center text-center max-w-6xl mx-auto shadow-sm">
              <h2 className="text-3xl md:text-5xl lg:text-5xl font-semibold tracking-tight mb-4 text-black max-w-3xl leading-[1.15]">
                Ready to Collaborate Better?
              </h2>
              <p className="text-lg md:text-xl text-black/70 mb-10 max-w-2xl font-medium font-geist">
                Join creators using MutinyX to work smarter with brands.
              </p>
              <Link to="/download">
                <AntiMetalButton label="Download MutinyX app" className="w-full sm:w-64 text-base font-medium" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <div ref={ctaRef}>
        <SiteFooter />
      </div>
    </div>
  );
}
