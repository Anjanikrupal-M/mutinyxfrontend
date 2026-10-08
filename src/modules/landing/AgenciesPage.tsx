import { useRef, useState, useEffect, type MouseEvent } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/shared/ui/button";
import { AntiMetalButton } from "@/components/ui/anti-metal-button";
import { RevealDots } from "@/components/ui/reveal-dots";
import { motion, Variants, AnimatePresence } from "framer-motion";
import {
  Zap,
  BrainCircuit,
  Target,
  LayoutDashboard,
  CheckSquare,
  BarChart3,
  ScanSearch,
  Users,
  TrendingUp,
  Layers,
  Building2,
  Sparkles
} from "lucide-react";
import { SpotlightNavbar } from "@/shared/ui/spotlight-navbar";
import { useSmoothScroll } from "@/shared/hooks/useSmoothScroll";
import { ProgressiveBlur } from "@/components/ui/progressive-blur";
import { ContainerScroll } from "@/components/ui/container-scroll-animation";
import { SiteFooter } from "@/shared/ui/site-footer";
import { ContactSection } from "@/shared/ui/contact-section";
import { FaqSection } from "./components/FaqSection";
import img1 from "@/assets/landing_page_photos/analytics_and_boosting_1.jpg";
import img2 from "@/assets/landing_page_photos/analytics_and_boosting_2.jpg";
import img3 from "@/assets/landing_page_photos/applicants_dashboard_1.jpg";
import img4 from "@/assets/landing_page_photos/applicants_dashboard_2.jpg";
import img5 from "@/assets/landing_page_photos/launch_and_negotiate_1.jpg";
import img6 from "@/assets/landing_page_photos/launch_and_negotiate_2.jpg";
import img7 from "@/assets/landing_page_photos/the_tracking_module_1.jpg";
import img8 from "@/assets/landing_page_photos/the_tracking_module_2.jpg";

const carouselImages = [img1, img2, img3, img4, img5, img6, img7, img8];
import { PopupModal } from "react-calendly";

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
};

export default function AgenciesPage() {
  const [hideBottomBlur, setHideBottomBlur] = useState(false);
  const [isCalendlyOpen, setIsCalendlyOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const ctaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % carouselImages.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

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
    { label: "FAQ", href: "#faq" },
    { label: "Contact", href: "#contact" },
  ];

  const agencyFaqs = [
    {
      id: "multi-client-workspace",
      question: "How does multi-client workspace management work?",
      answer: "Agencies get a centralized master dashboard allowing one-click switching between isolated workspaces for each client—keeping campaigns, reporting, creator rosters, and approvals completely segregated."
    },
    {
      id: "team-roles-and-approvals",
      question: "Can I manage internal team roles and client review workflows?",
      answer: "Yes. You can assign account managers, media planners, and reviewers with granular permissions. Client stakeholders can also be given view-and-approve access without exposing internal agency margins."
    },
    {
      id: "scale-agency-headcount",
      question: "How does MutinyX help agencies scale without adding headcount?",
      answer: "By automating repetitive manual tasks like creator outreach, digital MOU generation, script revision loops, and milestone payouts, your existing agency team can manage 5x more campaigns effortlessly."
    },
    {
      id: "white-label-reporting",
      question: "Can we generate unified performance reports for clients?",
      answer: "Yes, you can generate comprehensive, live performance dashboards and campaign status boards to present real-time ROI, impressions, and engagement metrics directly to clients."
    },
    {
      id: "agency-onboarding",
      question: "How fast can an agency onboard existing clients?",
      answer: "You can onboard and set up client workspaces within minutes. Our team also provides dedicated migration support to import your existing creator lists and brand assets seamlessly."
    }
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-brand/30 selection:text-foreground relative">
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
          { label: "Get Started", href: "/register", className: "bg-brand text-black hover:bg-brand/90 shadow-md" },
        ]}
        actions={
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <Link to="/login">
              <Button variant="ghost" size="sm" className="font-semibold text-sm text-foreground/80 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 rounded-full px-3.5 sm:px-4 transition-all">
                Log in
              </Button>
            </Link>
            <Link to="/register">
              <Button size="sm" className="font-semibold text-sm bg-brand text-black hover:bg-brand/90 border-transparent shadow-sm rounded-full px-4 sm:px-5 transition-all hover:scale-[1.02] active:scale-[0.98]">
                Get Started
              </Button>
            </Link>
          </div>
        }
      />

      <main className="flex-1 flex flex-col justify-center min-h-[80vh]">
        {/* --- SECTION 1: HERO --- */}
        <div className="relative isolate overflow-hidden bg-gradient-to-b from-brand/20 via-brand/5 to-background">
          <RevealDots maskCutout="none" />
          <section className="pt-8 flex-1 flex flex-col justify-center">
            <div className="flex flex-col">
              <ContainerScroll
                titleComponent={
                  <>
                    <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="inline-flex items-center rounded-full px-4 py-1.5 text-xs font-bold text-foreground mb-8 bg-white/40 backdrop-blur-md shadow-[4px_4px_10px_rgba(0,0,0,0.05),-4px_-4px_10px_rgba(255,255,255,0.8)] border border-white/60">
                      ✨ MutinyX for Agencies
                    </motion.div>
                    <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold text-black dark:text-white mb-6 leading-[1.1]">
                      The Operating System for <br />
                      <span className="text-4xl md:text-[3.8rem] lg:text-[4.8rem] font-semibold mt-1 leading-none">
                        Modern Influencer Agencies
                      </span>
                    </h1>
                    <p className="text-base md:text-lg text-muted-foreground mb-10 max-w-2xl mx-auto">
                      Manage multiple clients, scale campaign execution, and grow revenue—without increasing headcount.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center mb-24">
                      <AntiMetalButton
                        label="Book a Demo"
                        className="w-full sm:w-48 font-medium"
                        onClick={() => setIsCalendlyOpen(true)}
                      />
                    </div>
                  </>
                }
              >
                <div className="relative w-full h-full mx-auto rounded-2xl overflow-hidden bg-background">
                  <AnimatePresence>
                    <motion.img
                      key={currentImageIndex}
                      src={carouselImages[currentImageIndex]}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 1 }}
                      alt="Agency Dashboard Carousel"
                      className="absolute inset-0 object-cover w-full h-full object-left-top"
                      draggable={false}
                    />
                  </AnimatePresence>
                </div>
              </ContainerScroll>
            </div>
          </section>

          {/* --- SECTION 2: FEATURES (FOR AGENCIES) --- */}
          <section id="features" className="pt-16 pb-28 md:pt-20 relative">
            {/* Background glow */}
            <div className="absolute inset-0 pointer-events-none -z-10">
              <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-brand/8 blur-[140px] rounded-full" />
            </div>

            <div className="container mx-auto px-4 max-w-6xl">
              {/* Section Header */}
              <motion.div
                initial={{ opacity: 0, y: 40, filter: "blur(8px)" }}
                whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                className="text-center mb-20"
              >
                <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold text-foreground mb-6 bg-white/40 backdrop-blur-md shadow-[4px_4px_10px_rgba(0,0,0,0.05),-4px_-4px_10px_rgba(255,255,255,0.8)] border border-white/60">
                  <Zap className="w-3.5 h-3.5" /> Built for Agencies That Want to Scale
                </div>
                <h2 className="text-4xl md:text-5xl font-semibold tracking-tight mb-5 text-foreground leading-[1.15] max-w-3xl mx-auto">
                  Manage creators, campaigns, approvals, analytics, contracts, and clients from a single workspace.
                </h2>
              </motion.div>

              {/* BENTO GRID */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 auto-rows-auto">
                {/* Row 1 */}
                <BentoCard
                  index={0}
                  colSpan="md:col-span-6"
                  accent="brand"
                  icon={<Layers className="w-8 h-8" />}
                  tag="Multi-Client"
                  title="Multi-Client Management"
                  description="Switch seamlessly between clients while keeping campaigns, reporting, and teams completely organized."
                  large
                />
                <BentoCard
                  index={1}
                  colSpan="md:col-span-6"
                  icon={<Target className="w-7 h-7" />}
                  tag="Discovery"
                  title="AI-Powered Creator Discovery"
                  description="Find creators using Brand Fit Scores tailored to each client's campaign objectives."
                  large
                />

                {/* Row 2 */}
                <BentoCard
                  index={2}
                  colSpan="md:col-span-4"
                  icon={<BrainCircuit className="w-7 h-7" />}
                  tag="AI-Powered"
                  title="AI Campaign Strategist"
                  description="Launch smarter campaigns using AI that remembers each client's brand guidelines, campaign history, and performance insights."
                />
                <BentoCard
                  index={3}
                  colSpan="md:col-span-4"
                  accent="dark"
                  icon={<CheckSquare className="w-7 h-7" />}
                  tag="Management"
                  title="End-to-End Campaign Management"
                  description="Manage campaign launches, script reviews, approvals, submissions, messaging, contracts, and payouts in one place."
                />
                <BentoCard
                  index={4}
                  colSpan="md:col-span-4"
                  icon={<LayoutDashboard className="w-7 h-7" />}
                  tag="Pipeline"
                  title="Campaign Status Board"
                  description="Track every creator and campaign stage across every client in real time."
                />

                {/* Row 3 */}
                <BentoCard
                  index={5}
                  colSpan="md:col-span-6"
                  accent="brand"
                  icon={<BarChart3 className="w-8 h-8" />}
                  tag="Analytics"
                  title="Real-Time Analytics"
                  description="Monitor campaign performance across all clients with unified dashboards and actionable insights."
                  large
                />
                <BentoCard
                  index={6}
                  colSpan="md:col-span-6"
                  accent="dark"
                  icon={<TrendingUp className="w-8 h-8" />}
                  tag="Scale & Efficiency"
                  title="Increase Revenue Without Increasing Headcount"
                  description="Automate repetitive workflows so your team can manage more campaigns, serve more clients, and scale efficiently."
                  large
                />

                {/* Row 4 */}
                <BentoCard
                  index={7}
                  colSpan="md:col-span-6"
                  icon={<ScanSearch className="w-7 h-7" />}
                  tag="Originality"
                  title="Duplicate Script Detection"
                  description="Ensure creators aren't submitting similar ideas across campaigns and maintain originality for every client."
                />
                <BentoCard
                  index={8}
                  colSpan="md:col-span-6"
                  icon={<Users className="w-7 h-7" />}
                  tag="Collaboration"
                  title="Team Collaboration"
                  description="Assign work, manage internal approvals, and coordinate teams effortlessly."
                />
              </div>
            </div>
          </section>
        </div>

        <FaqSection
          badge="Agency FAQs"
          title="Frequently Asked Questions for Agencies"
          description="Learn how modern influencer marketing agencies scale client rosters, streamline workflows, and boost profitability with MutinyX."
          items={agencyFaqs}
        />

        {/* --- SECTION 3: CONTACT --- */}
        <ContactSection />

        {/* --- SECTION 4: FINAL CTA --- */}
        <section className="py-12 md:py-24 relative z-10">
          <div className="container mx-auto px-4">
            <div className="bg-brand rounded-[2rem] md:rounded-[3rem] py-16 md:py-24 px-6 md:px-12 flex flex-col items-center justify-center text-center max-w-6xl mx-auto shadow-sm">
              <h2 className="text-3xl md:text-5xl lg:text-5xl font-semibold tracking-tight mb-4 text-black max-w-3xl leading-[1.15]">
                The Platform Built for the Next Generation of Agencies
              </h2>
              <p className="text-lg md:text-xl text-black/70 mb-10 max-w-2xl font-medium font-geist">
                Manage every client, every creator, and every campaign from one operating system.
              </p>
              <AntiMetalButton
                label="Book a Demo"
                className="w-full sm:w-48 text-base font-medium"
                onClick={() => setIsCalendlyOpen(true)}
              />
            </div>
          </div>
        </section>
      </main>

      <div ref={ctaRef}>
        <SiteFooter />
      </div>

      <PopupModal
        url="https://calendly.com/connect-mutinytalent/30min"
        onModalClose={() => setIsCalendlyOpen(false)}
        open={isCalendlyOpen}
        rootElement={document.getElementById("root") || document.body}
      />
    </div>
  );
}

// --- Helper Components ---
function BentoCard({
  icon, tag, title, description, colSpan = "", accent = "default", large = false, index = 0,
}: {
  icon: React.ReactNode;
  tag: string;
  title: string;
  description: string;
  colSpan?: string;
  accent?: "brand" | "dark" | "default";
  large?: boolean;
  index?: number;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (rect.width / 2);
    const dy = (e.clientY - cy) / (rect.height / 2);
    cardRef.current.style.transform = `perspective(900px) rotateY(${dx * 6}deg) rotateX(${-dy * 6}deg) scale3d(1.02,1.02,1.02)`;
  };

  const handleMouseLeave = () => {
    if (!cardRef.current) return;
    cardRef.current.style.transform = `perspective(900px) rotateY(0deg) rotateX(0deg) scale3d(1,1,1)`;
  };

  const bgClass =
    accent === "brand"
      ? "bg-brand text-black border-brand/30"
      : accent === "dark"
        ? "bg-foreground text-background border-foreground/20"
        : "bg-white text-foreground border-border/50";

  const iconBgClass =
    accent === "brand"
      ? "bg-black/10"
      : accent === "dark"
        ? "bg-white/10"
        : "bg-brand/10";

  const iconColorClass =
    accent === "brand"
      ? "text-black"
      : accent === "dark"
        ? "text-brand"
        : "text-brand-700";

  const tagClass =
    accent === "brand"
      ? "bg-black/10 text-black/70"
      : accent === "dark"
        ? "bg-white/10 text-white/60"
        : "bg-brand/10 text-brand-700";

  const descClass =
    accent === "brand"
      ? "text-black/70"
      : accent === "dark"
        ? "text-white/60"
        : "text-muted-foreground";

  return (
    <motion.div
      className={`${colSpan} relative`}
      initial={{ opacity: 0, y: 32, filter: "blur(6px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.6, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
    >
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ transition: "transform 0.25s cubic-bezier(0.22,1,0.36,1)", transformStyle: "preserve-3d" }}
        className={`relative rounded-3xl border p-7 h-full overflow-hidden cursor-default select-none shadow-[0_4px_24px_rgba(0,0,0,0.06)] ${bgClass} ${large ? "min-h-[220px]" : "min-h-[170px]"}`}
      >
        {/* Shine overlay */}
        <div className="pointer-events-none absolute inset-0 rounded-3xl opacity-0 hover:opacity-100 transition-opacity duration-500 bg-[radial-gradient(600px_circle_at_var(--mouse-x,50%)_var(--mouse-y,50%),rgba(255,255,255,0.06),transparent_40%)]" />

        <div className="flex flex-col h-full gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${iconBgClass} ${iconColorClass}`}>
              {icon}
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${tagClass}`}>{tag}</span>
          </div>
          <div className="flex-1 flex flex-col justify-end">
            <h3 className={`font-semibold mb-1.5 leading-tight ${large ? "text-2xl" : "text-lg"}`}>{title}</h3>
            <p className={`text-sm font-medium leading-relaxed font-geist ${descClass}`}>{description}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
