import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, QrCode, Zap } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { AppStoreButton } from '@/shared/ui/app-store-button';
import { PlayStoreButton } from '@/shared/ui/play-store-button';
import { Carousel } from '@/shared/ui/apple-cards-carousel';
import { RevealDots } from '@/components/ui/reveal-dots';

// Assets
import mutinyTalentAppImg from '@/assets/mutiny-talent-app.png';
import mutinyTalent1 from '@/assets/mutiny-talent/mutinytalent1.png';
import mutinyTalent2 from '@/assets/mutiny-talent/mutinytalent2.png';
import mutinyTalent3 from '@/assets/mutiny-talent/mutinytalent3.png';
import mutinyTalent4 from '@/assets/mutiny-talent/mutinytalent4.png';
import mutinyTalent5 from '@/assets/mutiny-talent/mutinytalent5.png';
import mutinyTalent6 from '@/assets/mutiny-talent/mutinytalent6.png';
import mutinyDownloadQr from '@/assets/mutiny-download-qr.svg';

const fadeUp = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
} as const;

const staggerContainer = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
} as const;

// --- Clean 9:16 Card Component ---
const SimpleFeatureCard = ({
    src,
    category,
    title,
    desc
}: {
    src: string,
    category: string,
    title: string,
    desc: string
}) => (
    <div className="flex flex-col gap-4 w-[280px] md:w-[320px] group cursor-grab active:cursor-grabbing">
        {/* Crisp Edge-to-Edge Screenshot Container (9:16 Ratio) */}
        <div className="relative w-full aspect-9/16 rounded-3xl overflow-hidden shadow-lg border border-border/40 group-hover:shadow-2xl group-hover:border-yellow-400/50 transition-all duration-500 bg-background">
            <img
                src={src}
                alt={title}
                className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-700"
            />
        </div>

        {/* Short & Punchy Text Content */}
        <div className="flex flex-col px-1">
            <span className="text-yellow-600 font-bold text-xs tracking-wider uppercase mb-1">
                {category}
            </span>
            <h3 className="text-xl md:text-2xl font-display font-semibold text-foreground leading-tight mb-2">
                {title}
            </h3>
            <p className="text-muted-foreground text-sm font-medium leading-relaxed">
                {desc}
            </p>
        </div>
    </div>
);

// --- Shortened Copy ---
const carouselData = [
    {
        category: "Analytics",
        title: "Track Your Growth",
        src: mutinyTalent1,
        desc: "Monitor your earnings, profile views, and active pipeline at a single glance.",
    },
    {
        category: "Workflow",
        title: "Manage Deliverables",
        src: mutinyTalent2,
        desc: "Organize active campaigns and move tasks from script to submission effortlessly.",
    },
    {
        category: "Discover",
        title: "Find Your Niche",
        src: mutinyTalent3,
        desc: "Filter and apply to brand partnerships perfectly matched to your audience.",
    },
    {
        category: "Communication",
        title: "Direct Negotiations",
        src: mutinyTalent4,
        desc: "Chat directly with brands, negotiate rates, and finalize terms in real-time.",
    },
    {
        category: "Campaigns",
        title: "Clear Project Briefs",
        src: mutinyTalent5,
        desc: "Review detailed requirements, budgets, and timelines before you apply.",
    },
    {
        category: "Profile",
        title: "Showcase Your Value",
        src: mutinyTalent6,
        desc: "Build a verified portfolio of your past work that top brands can trust.",
    },
];

export default function DownloadPage() {
    useEffect(() => {
        window.scrollTo(0, 0);

        // Device detection redirect for mobile users scanning the QR code
        const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;

        if (/android/i.test(userAgent)) {
            window.location.replace("https://play.google.com/store/apps/details?id=com.mutiny.talent&pcampaignid=web_share");
        } else if (/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream) {
            window.location.replace("https://apps.apple.com/in/app/mutiny-talent/id6760656203");
        }
        // Fallback: desktop users stay on this page to see the QR code
    }, []);

    const cards = carouselData.map((card, index) => (
        <SimpleFeatureCard key={index} {...card} />
    ));

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-yellow-400/30 overflow-x-hidden animate-fade-in relative">
            <RevealDots maskCutout="none" />
            {/* Background Glows */}
            <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-yellow-400/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[10%] right-[-5%] w-[400px] h-[400px] bg-yellow-400/5 rounded-full blur-[100px] pointer-events-none" />

            {/* Header / Navigation (Synced with Legal Pages) */}
            <header className="container mx-auto px-6 md:px-8 pt-8 md:pt-12 relative z-20 max-w-6xl">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="flex items-center justify-between"
                >
                    <Link to="/creators">
                        <Button variant="ghost" className="-ml-4 font-semibold text-muted-foreground hover:text-foreground hover:bg-yellow-400/10 rounded-full transition-colors">
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back to Creators
                        </Button>
                    </Link>

                    <Link to="/">
                        <div className="flex items-center shrink-0 hover:opacity-80 transition-opacity cursor-pointer bg-black rounded-full px-4 py-2 shadow-sm border border-white/5">
                            <img src="/logo.svg" alt="MutinyX Logo" className="h-4 sm:h-5 w-auto object-contain" />
                        </div>
                    </Link>
                </motion.div>
            </header>

            {/* Top Section: Download UI */}
            <section className="container mx-auto px-6 md:px-8 flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-16 relative z-10 py-12 md:py-16 max-w-6xl">

                {/* Left Column: Text & CTA */}
                <motion.div
                    variants={staggerContainer}
                    initial="hidden"
                    animate="visible"
                    className="flex-1 max-w-xl w-full flex flex-col items-center text-center lg:items-start lg:text-left"
                >
                    <motion.div variants={fadeUp} className="inline-flex items-center rounded-full px-4 py-1.5 text-xs font-bold text-foreground mb-6 bg-white/40 backdrop-blur-md shadow-[4px_4px_10px_rgba(0,0,0,0.05),-4px_-4px_10px_rgba(255,255,255,0.8)] border border-white/60">
                        For Creators
                    </motion.div>

                    <motion.h1 variants={fadeUp} className="text-4xl md:text-5xl lg:text-6xl font-display font-semibold tracking-tight mb-6 text-foreground leading-[1.1]">
                        Download <br className="hidden lg:block" />
                        <span className="text-transparent bg-clip-text bg-linear-to-r from-yellow-500 to-yellow-300">MutinyTalent</span>
                    </motion.h1>

                    <motion.p variants={fadeUp} className="text-lg text-muted-foreground mb-10 font-medium">
                        Scan the QR code to download the app for iOS or Android. Start managing your campaigns and payments on the go.
                    </motion.p>

                    {/* QR Code Box */}
                    <motion.div variants={fadeUp} className="mb-10 p-4 bg-card border border-border rounded-2xl shadow-xl shadow-black/5 inline-block">
                        <div className="w-40 h-40 md:w-48 md:h-48 bg-white rounded-xl border border-border/50 flex flex-col items-center justify-center relative overflow-hidden group">
                            <img
                                src={mutinyDownloadQr}
                                alt="Scan to download"
                                className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-500"
                            />
                            <div className="absolute inset-0 bg-linear-to-tr from-transparent via-white/20 to-transparent pointer-events-none"></div>
                        </div>
                    </motion.div>

                    <motion.div variants={fadeUp} className="w-full h-px bg-border/60 mb-8 relative flex justify-center lg:justify-start">
                        <span className="absolute top-1/2 -translate-y-1/2 bg-background px-4 text-sm font-bold text-muted-foreground">
                            Or download directly from
                        </span>
                    </motion.div>

                    {/* Store Buttons */}
                    <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4 w-full justify-center lg:justify-start">
                        <AppStoreButton
                            onClick={() => window.open("https://apps.apple.com/in/app/mutiny-talent/id6760656203", "_blank", "noopener,noreferrer")}
                            className="flex-1 sm:flex-none w-full sm:w-48 h-14 rounded-2xl bg-foreground text-background hover:bg-foreground/90 shadow-md"
                        />
                        <PlayStoreButton
                            variant="outline"
                            onClick={() => window.open("https://play.google.com/store/apps/details?id=com.mutiny.talent&pcampaignid=web_share", "_blank", "noopener,noreferrer")}
                            className="flex-1 sm:flex-none w-full sm:w-48 h-14 rounded-2xl bg-card border-border hover:bg-secondary text-foreground shadow-sm"
                        />
                    </motion.div>
                </motion.div>

                {/* Right Column: Phone Image (HIDDEN ON MOBILE) */}
                <motion.div
                    initial={{ opacity: 0, x: 40, scale: 0.95 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    transition={{ duration: 0.8 }}
                    className="hidden lg:flex flex-1 justify-end relative w-full"
                >
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] sm:w-[400px] h-[500px] bg-yellow-400/20 blur-[100px] rounded-full z-0" />

                    <img
                        src={mutinyTalentAppImg}
                        alt="MutinyTalent mobile app interface"
                        className="relative z-10 w-full max-w-[500px] drop-shadow-2xl"
                    />
                </motion.div>
            </section>

            {/* Bottom Section: Custom Cards Carousel */}
            <section className="w-full bg-secondary/30 border-t border-border mt-8 relative z-10">
                <div className="py-20 pb-32">
                    <div className="max-w-7xl px-6 md:px-12 mx-auto mb-6 text-center md:text-left">
                        <h2 className="text-3xl md:text-5xl font-semibold text-foreground font-display tracking-tight mb-2">
                            A studio in your pocket.
                        </h2>
                        <p className="text-lg text-muted-foreground font-medium">
                            Everything a creator needs to scale their business.
                        </p>
                    </div>
                    <Carousel items={cards} />
                </div>
            </section>
        </div>
    );
}


