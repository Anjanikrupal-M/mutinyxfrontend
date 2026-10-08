import React, { useRef, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/shared/ui/button";
import { AntiMetalButton } from "@/components/ui/anti-metal-button";
import { motion, Variants } from "framer-motion";
import {
  ArrowRight,
  Search,
  Target,
  Users,
  LineChart,
  Megaphone,
  Briefcase,
  Layers,
  Building2,
  Sparkles
} from "lucide-react";
import { SearchIcon } from "@/components/animate-ui/icons/search";
import { MessageCircleCodeIcon } from "@/components/animate-ui/icons/message-circle-code";
import { ChartSplineIcon } from "@/components/animate-ui/icons/chart-spline";
import { BadgeCheckIcon } from "@/components/animate-ui/icons/badge-check";
import { UsersIcon } from "@/components/animate-ui/icons/users";
import { PartyPopperIcon } from "@/components/animate-ui/icons/party-popper";
import { SendIcon } from "@/components/animate-ui/icons/send";
import { SiteFooter } from "@/shared/ui/site-footer";
import { ContactSection } from "@/shared/ui/contact-section";
import { FaqSection } from "./components/FaqSection";
import { SpotlightNavbar } from "@/shared/ui/spotlight-navbar";
import { useSmoothScroll } from "@/shared/hooks/useSmoothScroll";
import { ProgressiveBlur } from "@/components/ui/progressive-blur";
import AppDistributionHero from "./components/AppDistributionHero";
import { GlobeCdn } from "@/components/ui/cobe-globe-cdn";
import { Scroll01 } from "@/components/ui/scroll-01";
import { BackgroundShapes } from "@/components/ui/background-shapes";
import { HoverEmojiBubble } from "@/components/ui/hover-emoji-bubble";
import { LogoCloud } from "@/components/ui/logo-cloud-3";
import { HeroVisual } from "./components/HeroVisual";
import { GradientTracing } from "@/components/ui/gradient-tracing";
import { RevealDots } from "@/components/ui/reveal-dots";
import brand16 from "@/assets/brands/image 16.png";
import brand17 from "@/assets/brands/image 17.png";
import brand18 from "@/assets/brands/image 18.png";
import brand19 from "@/assets/brands/image 19.png";
import brand20 from "@/assets/brands/image 20.png";
import brand21 from "@/assets/brands/image 21.png";
import brand22 from "@/assets/brands/image 22.png";
import brand23 from "@/assets/brands/image 23.png";
import brand24 from "@/assets/brands/image 24.png";
import brand25 from "@/assets/brands/image 25.png";
import brand26 from "@/assets/brands/image 26.png";
import brand27 from "@/assets/brands/image 27.png";
import brand28 from "@/assets/brands/image 28.png";
import brand29 from "@/assets/brands/image 29.png";
import brand30 from "@/assets/brands/image 30.png";

const logos = [
  { src: brand16, alt: "Brand 16" },
  { src: brand17, alt: "Brand 17" },
  { src: brand18, alt: "Brand 18" },
  { src: brand19, alt: "Brand 19" },
  { src: brand20, alt: "Brand 20" },
  { src: brand21, alt: "Brand 21" },
  { src: brand22, alt: "Brand 22" },
  { src: brand23, alt: "Brand 23" },
  { src: brand24, alt: "Brand 24" },
  { src: brand25, alt: "Brand 25" },
  { src: brand26, alt: "Brand 26" },
  { src: brand27, alt: "Brand 27" },
  { src: brand28, alt: "Brand 28" },
  { src: brand29, alt: "Brand 29" },
  { src: brand30, alt: "Brand 30" },
];

// --- Subcomponents ---
const FeatureCard = ({ icon: Icon, title, description, delay, isActive }: { icon: any, title: string, description: string, delay: number, isActive?: boolean }) => {
  const [isHovered, setIsHovered] = React.useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay }}
      className="flex flex-col items-center text-center group relative z-10"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="bg-background rounded-3xl relative z-10">
        <div className={`w-16 h-16 rounded-3xl flex items-center justify-center mb-6 transition-transform duration-300 ${isHovered || isActive ? 'scale-110 bg-brand/20 text-brand-700' : 'bg-brand/10 text-brand-700 group-hover:scale-110'}`}>
          <Icon size={32} isHovered={isHovered || isActive} />
        </div>
      </div>
      <h3 className="text-xl font-semibold mb-3">{title}</h3>
      <p className="text-muted-foreground font-medium text-sm md:text-base">
        {description}
      </p>
    </motion.div>
  );
};

// --- Animation Variants ---
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

const staggerText: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.1 }
  }
};

const popInWord: Variants = {
  hidden: { opacity: 0, scale: 0.6, y: 10, filter: "blur(4px)" },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { type: "spring", damping: 14, stiffness: 200 }
  }
};

export default function LandingPage() {
  const ctaRef = useRef<HTMLElement>(null);
  const [hideBottomBlur, setHideBottomBlur] = useState(false);
  const [activeFeature, setActiveFeature] = useState<number | null>(null);
  const [isTextHovered, setIsTextHovered] = useState(false);
  const [forceTextReset, setForceTextReset] = useState(false);
  const [autoPlayHover, setAutoPlayHover] = useState(false);
  const isHoverActive = (isTextHovered && !forceTextReset) || autoPlayHover;

  const [isSection4Hovered, setIsSection4Hovered] = useState(false);
  const [forceSection4Reset, setForceSection4Reset] = useState(false);
  const [autoPlayHoverSection4, setAutoPlayHoverSection4] = useState(false);
  const isHoverActiveSection4 = (isSection4Hovered && !forceSection4Reset) || autoPlayHoverSection4;

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (isTextHovered) {
      setForceTextReset(false);
      timeout = setTimeout(() => {
        setForceTextReset(true);
      }, 4500); // 3 loops of 1.5s
    } else {
      setForceTextReset(false);
    }
    return () => clearTimeout(timeout);
  }, [isTextHovered]);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (isSection4Hovered) {
      setForceSection4Reset(false);
      timeout = setTimeout(() => {
        setForceSection4Reset(true);
      }, 4500); // 3 loops of 1.5s
    } else {
      setForceSection4Reset(false);
    }
    return () => clearTimeout(timeout);
  }, [isSection4Hovered]);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev === null || prev >= 3 ? 0 : prev + 1));
    }, 3200);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setHideBottomBlur(entry.isIntersecting);
      },
      {
        rootMargin: "0px 0px -10% 0px", // Trigger slightly before reaching CTA
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

  // Enable butter-smooth momentum scrolling
  useSmoothScroll();

  // Smooth scroll to top function
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
    { label: "FAQ", href: "#faq" },
    { label: "Contact", href: "#contact" },
  ];

  const mainLandingFaqs = [
    {
      id: "what-is-mutinyx",
      question: "What is MutinyX?",
      answer: "MutinyX is an AI-powered influencer marketing and creator collaboration ecosystem that connects brands, agencies, and creators with end-to-end campaign tracking, digital MOUs, and automated payouts."
    },
    {
      id: "who-is-it-for",
      question: "Who is MutinyX designed for?",
      answer: "MutinyX is built for brand marketing teams, influencer agencies managing multiple clients, and creators looking for verified, paid brand collaborations.",
      customContent: (
        <div className="flex flex-wrap gap-3 mt-3">
          <Link to="/for-brands">
            <Button size="sm" className="rounded-full bg-brand text-black hover:bg-brand/90 font-semibold border-transparent">Brands & Agencies</Button>
          </Link>
          <Link to="/creators">
            <Button size="sm" className="rounded-full bg-brand text-black hover:bg-brand/90 font-semibold border-transparent">Creators</Button>
          </Link>
        </div>
      )
    },
    {
      id: "how-ai-strategist-works",
      question: "How does the AI Campaign Strategist work?",
      answer: "The AI strategist learns from past campaigns, creator performance metrics, and brand guidelines to recommend high-converting creator matches, content angles, and budget allocations."
    },
    {
      id: "digital-mous-and-safety",
      question: "Are campaign agreements and payments secure?",
      answer: "Yes. Every collaboration includes automated digital MOUs specifying usage rights and milestones, with payments handled safely and transparently upon content approval."
    },
    {
      id: "how-to-get-started",
      question: "How do I get started?",
      answer: "Brands and agencies can register an account or book a live demo. Creators can download the Mutiny Talent app on iOS and Android to start collaborating with brands immediately.",
      action: {
        label: "Download MutinyX app",
        href: "/download"
      }
    }
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-brand/30 selection:text-foreground relative">
      {/* Background Grid (Subtle 25% opacity) */}

      {/* Progressive blurs at the top and bottom of the landing page */}
      <ProgressiveBlur
        position="top"
        className="fixed z-40"
        backgroundColor="hsl(var(--background))"
        height="120px"
      />
      <ProgressiveBlur
        position="bottom"
        className={`fixed z-40 transition-opacity duration-300 ${hideBottomBlur ? "opacity-0" : "opacity-100"
          }`}
        backgroundColor="hsl(var(--background))"
        height="120px"
      />

      {/* --- NAVIGATION (Single Unified Spotlight Pill) --- */}
      <SpotlightNavbar
        items={NAV_ITEMS}
        logo={
          <div onClick={scrollToTop}>
            <div className="flex items-center shrink-0 hover:opacity-80 transition-opacity cursor-pointer bg-black rounded-full px-4 py-2 shadow-sm border border-white/5">
              <img src="/logo.svg" alt="MutinyX Logo" className="h-4 sm:h-5 w-auto object-contain" />
            </div>
          </div>
        }
        mobileExtraItems={[
          { label: "Log in", href: "/login", className: "bg-black/5 text-black hover:bg-black/10 border border-black/10" },
          { label: "Get Started", href: "/register", className: "bg-brand text-black hover:bg-brand/90 shadow-md" },
        ]}
        actions={
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <Link to="/login">
              <Button
                variant="ghost"
                size="sm"
                className="font-semibold text-sm text-foreground/80 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 rounded-full px-3.5 sm:px-4 transition-all"
              >
                Log in
              </Button>
            </Link>
            <Link to="/register">
              <Button
                size="sm"
                className="font-semibold text-sm bg-brand text-black hover:bg-brand/90 border-transparent shadow-sm rounded-full px-4 sm:px-5 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                Get Started
              </Button>
            </Link>
          </div>
        }
      />

      <main className="flex-1">
        {/* --- SECTION 1: HERO --- */}
        <section className="relative isolate pt-36 md:pt-44 overflow-hidden bg-gradient-to-b from-brand/20 via-brand/5 to-background">
          <RevealDots />
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="container mx-auto px-4 relative z-10 flex flex-col items-center justify-center max-w-5xl"
          >
            {/* Centered Content */}
            <div className="text-center flex flex-col items-center">
              <motion.div variants={fadeInUp} className="inline-flex items-center rounded-full px-4 py-1.5 text-xs font-bold text-foreground mb-8 bg-white/40 backdrop-blur-md shadow-[4px_4px_10px_rgba(0,0,0,0.05),-4px_-4px_10px_rgba(255,255,255,0.8)] border border-white/60">
                ✨ Where Creators, Brands and Agencies Connect.
              </motion.div>

              <motion.h1 variants={staggerText} className="text-4xl sm:text-5xl md:text-[4rem] font-semibold tracking-tight mb-6 text-foreground leading-[1.2] sm:leading-[1.15] text-center">
                <motion.span variants={popInWord} className="inline-block">One network.</motion.span> <br className="hidden sm:block" />
                <motion.span variants={popInWord} className="inline-block">Every</motion.span>{" "}
                <motion.span variants={popInWord} className="inline-block">
                  collaboration.
                </motion.span>
              </motion.h1>

              <motion.p variants={fadeInUp} className="text-base sm:text-lg text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed font-medium font-geist text-center">
                MutinyX brings brands, creators, and agencies together to discover the right opportunities, build better collaborations, and get more done—without the usual back-and-forth.
              </motion.p>

              <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto">
                <Link to="/register" className="w-full sm:w-auto flex justify-center">
                  <AntiMetalButton className="w-full sm:w-44" />
                </Link>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => document.getElementById('app-distribution')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                  className="w-full sm:w-auto bg-transparent border-foreground/20 text-foreground hover:bg-foreground/5 gap-2 h-14 px-8 text-base font-medium transition-colors rounded-full"
                >
                  Explore MutinyX
                </Button>
              </motion.div>

              {/* Brand Logo Cloud */}
              <motion.div variants={fadeInUp} className="mt-16 sm:mt-24 w-full max-w-4xl mx-auto flex flex-col items-center overflow-hidden px-4">
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-6">Trusted by brands that get culture</p>
                <div className="w-full">
                  <LogoCloud logos={logos} />
                </div>
              </motion.div>
            </div>

            {/* Bottom Visual */}
            <motion.div id="app-distribution" variants={fadeInUp} className="relative flex justify-center items-center w-full mt-2 md:mt-4 mb-4 md:mb-8">
              <AppDistributionHero />
            </motion.div>
          </motion.div>

          {/* Animated subtle blob gradients */}
          <motion.div
            animate={{
              x: [0, 40, -20, 0],
              y: [0, -40, 20, 0],
              scale: [1, 1.1, 0.95, 1],
            }}
            transition={{
              duration: 25,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-br from-brand/25 to-orange-400/15 rounded-full blur-[120px] -z-10 pointer-events-none translate-x-1/3 -translate-y-1/3"
          />
          <motion.div
            animate={{
              x: [0, -30, 20, 0],
              y: [0, 40, -30, 0],
              scale: [1, 0.95, 1.05, 1],
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gradient-to-tr from-brand/18 to-emerald-400/10 rounded-full blur-[100px] -z-10 pointer-events-none -translate-x-1/2 translate-y-1/3"
          />
        </section>

        {/* --- SECTION 2: THREE SIDES --- */}
        <section id="features" className="pt-2 md:pt-4 pb-20 md:pb-32 relative bg-background">
          <div className="container mx-auto px-4 max-w-7xl">
            <Scroll01
              title={
                <>
                  One Network. Three Sides.<br className="hidden sm:block" />
                  <motion.span
                    initial={{ scale: 0.8, rotate: 4, opacity: 0, y: 20 }}
                    whileInView={{ scale: 1, rotate: -1, opacity: 1, y: 0 }}
                    viewport={{ once: false, amount: 0.8 }}
                    transition={{ type: "spring", stiffness: 250, damping: 20 }}
                    className="bg-foreground text-brand px-6 py-1.5 mt-3 rounded-2xl inline-block shadow-lg border border-foreground/10"
                  >
                    Endless Possibilities.
                  </motion.span>
                </>
              }
              items={[
                {
                  tag: "For Brands",
                  title: "Find creators who actually fit your brand.",
                  description: "Discover relevant creators, launch campaigns, manage collaborations, and measure what matters—all in one place.",
                  footer: "Discover. Collaborate. Grow.",
                  media: "/images/brands.jpg",
                  accent: "default",
                  actionUrl: "/for-brands",
                  actionText: "Explore MutinyX for Brands"
                },
                {
                  tag: "For Creators",
                  title: "Stop chasing opportunities. Let them find you.",
                  description: "Discover campaigns that match your niche, apply in seconds, collaborate with brands, and build a track record that gets you noticed.",
                  footer: "More creators → Relevant collaborations → Greater opportunities.",
                  media: <HeroVisual />,
                  accent: "dark",
                  actionUrl: "/creators",
                  actionText: "Explore MutinyX for Creators"
                },
                {
                  tag: "For Agencies",
                  title: "Run influencer campaigns without the chaos.",
                  description: "Discover talent, manage campaigns, coordinate creators, and track performance from one connected platform.",
                  footer: "Plan. Execute. Scale.",
                  media: "https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=2070&auto=format&fit=crop",
                  accent: "brand",
                  actionUrl: "/agencies",
                  actionText: "Explore MutinyX for Agencies"
                }
              ]}
            />
          </div>
        </section>

        {/* --- SECTION 3: THE RIGHT PEOPLE --- */}
        <section className="pt-12 md:pt-24 pb-8 md:pb-12 relative overflow-hidden bg-background">
          <div className="container mx-auto px-4">
            <div className="bg-brand/5 border border-brand/10 rounded-[2rem] md:rounded-[3rem] p-8 md:p-12 lg:p-20 max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-10 lg:gap-16 relative overflow-hidden">

              {/* Left: Text Content */}
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                onViewportEnter={() => {
                  setAutoPlayHover(true);
                  setTimeout(() => setAutoPlayHover(false), 2000);
                }}
                className="z-10 max-w-xl flex flex-col items-start"
              >
                <h2
                  className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-foreground mb-6 leading-tight cursor-default"
                  onMouseEnter={() => setIsTextHovered(true)}
                  onMouseLeave={() => setIsTextHovered(false)}
                >
                  The Right Pe
                  <motion.span
                    animate={{ width: isHoverActive ? "0.9em" : "auto" }}
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    className="relative inline-flex items-center justify-center align-baseline overflow-visible"
                  >
                    <motion.span
                      animate={{ opacity: isHoverActive ? 0 : 1, scale: isHoverActive ? 0.5 : 1 }}
                      transition={{ duration: 0.2 }}
                      className="inline-block"
                    >
                      o
                    </motion.span>
                    <motion.span
                      animate={{ opacity: isHoverActive ? 1 : 0, scale: isHoverActive ? 1 : 0.5 }}
                      transition={{ duration: 0.2 }}
                      className="absolute flex items-center justify-center pointer-events-none"
                    >
                      <UsersIcon size="0.85em" strokeWidth={2.5} className="text-foreground translate-y-[1px]" isHovered={isHoverActive} />
                    </motion.span>
                  </motion.span>
                  ple.<br />
                  The Right Camp
                  <motion.span
                    animate={{ width: isHoverActive ? "0.9em" : "auto" }}
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    className="relative inline-flex items-center justify-center align-baseline overflow-visible"
                  >
                    <motion.span
                      animate={{ opacity: isHoverActive ? 0 : 1, scale: isHoverActive ? 0.5 : 1 }}
                      transition={{ duration: 0.2 }}
                      className="inline-block"
                    >
                      ai
                    </motion.span>
                    <motion.span
                      animate={{ opacity: isHoverActive ? 1 : 0, scale: isHoverActive ? 1 : 0.5 }}
                      transition={{ duration: 0.2 }}
                      className="absolute flex items-center justify-center pointer-events-none"
                    >
                      <PartyPopperIcon size="0.85em" strokeWidth={2.5} className="text-foreground translate-y-[1px]" isHovered={isHoverActive} />
                    </motion.span>
                  </motion.span>
                  gns.
                </h2>
                <p className="text-lg font-medium text-muted-foreground mb-10">
                  MutinyX makes influencer marketing more relevant.
                </p>

                <div className="flex flex-col gap-5 text-base md:text-lg font-medium text-foreground mb-12">
                  <div className="flex items-center gap-4">
                    <div className="w-2.5 h-2.5 rounded-full bg-brand shrink-0" />
                    <span>Creators discover campaigns that fit them.</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-2.5 h-2.5 rounded-full bg-brand shrink-0" />
                    <span>Brands find creators who fit their goals.</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-2.5 h-2.5 rounded-full bg-brand shrink-0" />
                    <span>Agencies get everything they need to execute at scale.</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 sm:gap-5 text-sm font-bold bg-white/60 backdrop-blur border border-brand/20 rounded-full py-3.5 px-6 sm:px-8 shadow-sm">
                  <span className="text-foreground">Less noise.</span>
                  <span className="text-brand-600">•</span>
                  <span className="text-foreground">Better matches.</span>
                  <span className="text-brand-600">•</span>
                  <span className="text-foreground">Stronger collaborations.</span>
                </div>
              </motion.div>

              {/* Right: Interactive Globe */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="relative h-[340px] sm:h-[420px] lg:h-[520px] w-full max-w-[520px] shrink-0"
              >
                <GlobeCdn className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 scale-110 sm:scale-125" />
              </motion.div>
            </div>
          </div>
        </section>

        {/* --- SECTION 4: DISCOVERY TO DELIVERY --- */}
        <section className="pt-8 md:pt-16 pb-20 md:pb-32 relative overflow-hidden bg-background">
          <div className="container mx-auto px-4 max-w-6xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16 md:mb-24 z-10 relative cursor-default"
              onViewportEnter={() => {
                setAutoPlayHoverSection4(true);
                setTimeout(() => setAutoPlayHoverSection4(false), 2000);
              }}
              onMouseEnter={() => setIsSection4Hovered(true)}
              onMouseLeave={() => setIsSection4Hovered(false)}
            >
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
                From Disc
                <motion.span
                  animate={{ width: isHoverActiveSection4 ? "0.9em" : "auto" }}
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  className="relative inline-flex items-center justify-center align-baseline overflow-visible"
                >
                  <motion.span
                    animate={{ opacity: isHoverActiveSection4 ? 0 : 1, scale: isHoverActiveSection4 ? 0.5 : 1 }}
                    transition={{ duration: 0.2 }}
                    className="inline-block"
                  >
                    o
                  </motion.span>
                  <motion.span
                    animate={{ opacity: isHoverActiveSection4 ? 1 : 0, scale: isHoverActiveSection4 ? 1 : 0.5 }}
                    transition={{ duration: 0.2 }}
                    className="absolute flex items-center justify-center pointer-events-none"
                  >
                    <SearchIcon size="0.85em" strokeWidth={2.5} className="text-foreground translate-y-[2px]" isHovered={isHoverActiveSection4} />
                  </motion.span>
                </motion.span>
                very to Deli
                <motion.span
                  animate={{ width: isHoverActiveSection4 ? "0.9em" : "auto" }}
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  className="relative inline-flex items-center justify-center align-baseline overflow-visible"
                >
                  <motion.span
                    animate={{ opacity: isHoverActiveSection4 ? 0 : 1, scale: isHoverActiveSection4 ? 0.5 : 1 }}
                    transition={{ duration: 0.2 }}
                    className="inline-block"
                  >
                    v
                  </motion.span>
                  <motion.span
                    animate={{ opacity: isHoverActiveSection4 ? 1 : 0, scale: isHoverActiveSection4 ? 1 : 0.5 }}
                    transition={{ duration: 0.2 }}
                    className="absolute flex items-center justify-center pointer-events-none"
                  >
                    <SendIcon size="0.85em" strokeWidth={2.5} className="text-foreground translate-y-[2px]" isHovered={isHoverActiveSection4} />
                  </motion.span>
                </motion.span>
                ery.
              </h2>
            </motion.div>

            <div className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 md:gap-8">
              {/* Connecting Gradient Line (Desktop Only) */}
              <div className="hidden lg:block absolute top-[32px] left-[12.5%] right-[12.5%] -translate-y-1/2 z-0 pointer-events-none">
                <GradientTracing
                  width={1000}
                  height={100}
                  path="M 0,50 Q 166.7,110 333.3,50 T 666.7,50 T 1000,50"
                  baseColor="rgba(0,0,0,0.1)"
                  gradientColors={["#FFD700", "#FFD700", "#FFD700"]}
                  strokeWidth={2}
                  animationDuration={4}
                />
              </div>
              <FeatureCard
                icon={SearchIcon}
                title="Discover"
                description="Find the right creators, brands, campaigns, and opportunities."
                delay={0.1}
                isActive={activeFeature === 0}
              />
              <FeatureCard
                icon={MessageCircleCodeIcon}
                title="Collaborate"
                description="Bring everyone into one place and keep campaigns moving."
                delay={0.2}
                isActive={activeFeature === 1}
              />
              <FeatureCard
                icon={ChartSplineIcon}
                title="Measure"
                description="Track performance and understand what actually worked."
                delay={0.3}
                isActive={activeFeature === 2}
              />
              <FeatureCard
                icon={BadgeCheckIcon}
                title="Grow"
                description="Turn successful collaborations into long-term relationships."
                delay={0.4}
                isActive={activeFeature === 3}
              />
            </div>
          </div>
        </section>

        <FaqSection items={mainLandingFaqs} />

        <ContactSection />

        {/* --- SECTION 5: JOIN US (CTA) --- */}
        <section ref={ctaRef} className="py-12 md:py-24 bg-background relative z-10 w-full overflow-hidden">
          <RevealDots maskCutout="none" />
          <div className="container mx-auto px-4 relative z-10">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="bg-brand rounded-[2rem] md:rounded-[3rem] py-16 md:py-24 px-6 md:px-12 flex flex-col items-center justify-center text-center max-w-6xl mx-auto shadow-sm relative overflow-hidden"
            >
              {/* Technical glyph pattern background */}
              <div className="absolute inset-0 z-0 pointer-events-none opacity-5">
                <BackgroundShapes
                  width={1200}
                  height={800}
                  colors={["#000000"]}
                  strokeWidth={4}
                  cellSize={50}
                />
              </div>

              <div className="relative z-10 flex flex-col items-center w-full">
                <h2 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight mb-10 text-black max-w-4xl leading-[1.3] md:leading-[1.2]">
                  Influencer Marketing, <br className="md:hidden" />
                  <motion.span
                    initial={{ rotate: 0 }}
                    whileInView={{ rotate: -3 }}
                    viewport={{ margin: "-50px", once: false }}
                    transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.2 }}
                    className="inline-block md:ml-3 bg-black text-brand px-6 py-2 rounded-full shadow-xl border border-black/10 mt-2 md:mt-0 origin-center"
                  >
                    Connected.
                  </motion.span>
                </h2>

                <div className="flex flex-col items-center gap-2 text-black/70 text-lg md:text-xl font-medium mb-8">
                  <p>No more scattered <HoverEmojiBubble text="DMs." emoji="💬" /></p>
                  <p>No more <HoverEmojiBubble text="spreadsheets" emoji="📄" /> everywhere.</p>
                  <p>No more <HoverEmojiBubble text="guessing" emoji="🤔" /> <HoverEmojiBubble text="who" emoji="❓" /> to work with.</p>
                </div>

                <p className="text-black text-lg md:text-xl font-bold mb-12 max-w-4xl mx-auto">
                  Just one network built for the people making influencer marketing happen.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full px-4 sm:px-0">
                  <Link to="/register" className="w-full sm:w-auto">
                    <AntiMetalButton label="Join MutinyX" className="w-full sm:w-48" />
                  </Link>
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      {/* --- SECTION 6: FOOTER --- */}
      <SiteFooter />
    </div >
  );
}


