import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
    ArrowLeft, 
    Scale, 
    FileText, 
    UserCheck, 
    CreditCard, 
    Briefcase 
} from 'lucide-react';
import { Button } from '@/shared/ui/button';

const staggerContainer = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const fadeUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
};

export default function TermsPage() {
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div className="min-h-screen bg-background text-foreground relative overflow-hidden selection:bg-yellow-400/30">
            {/* Background Orbs */}
            <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-yellow-400/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[10%] right-[-5%] w-[400px] h-[400px] bg-yellow-400/5 rounded-full blur-[100px] pointer-events-none" />

            <div className="container mx-auto px-4 py-12 md:py-20 max-w-4xl relative z-10">
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
                    <Link to="/">
                        <Button variant="ghost" className="mb-8 -ml-4 font-semibold text-muted-foreground hover:text-foreground hover:bg-yellow-400/10 rounded-full transition-colors">
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back to Home
                        </Button>
                    </Link>
                </motion.div>

                <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-8">
                    {/* Header */}
                    <motion.div variants={fadeUp} className="text-center md:text-left mb-12">
                        <div className="inline-flex items-center rounded-full border border-border px-3 py-1 text-xs font-bold bg-secondary text-muted-foreground mb-6">
                            <Scale className="w-3.5 h-3.5 mr-2 text-yellow-500" />
                            Legal Documentation
                        </div>
                        <h1 className="text-4xl md:text-6xl font-display font-extrabold tracking-tight mb-4 text-foreground">
                            Terms and Conditions
                        </h1>
                        <p className="text-lg text-muted-foreground font-medium">
                            Last updated: <span className="text-foreground">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                        </p>
                    </motion.div>

                    {/* Content Card */}
                    <motion.div variants={fadeUp} className="bg-card/50 backdrop-blur-xl border border-border/60 shadow-xl shadow-black/5 rounded-3xl p-6 md:p-12">
                        <div className="space-y-12">
                            <Section 
                                icon={<FileText className="w-6 h-6 text-yellow-500" />}
                                title="1. Acceptance of Terms"
                                content="By accessing and using MutinyX and MutinyTalent, you agree to be bound by these Terms and Conditions. If you do not agree with any part of these terms, you may not use our services. These terms establish a legally binding agreement between you and MUTINY TALENT PRIVATE LIMITED."
                            />
                            
                            <Section 
                                icon={<Briefcase className="w-6 h-6 text-yellow-500" />}
                                title="2. Description of Service"
                                content="MUTINY TALENT PRIVATE LIMITED provides a B2B SaaS platform (MutinyX) connecting brands with creators, and a creator-facing app (MutinyTalent) for managing campaigns, workflows, and payments. We act as the technical intermediary to facilitate these connections securely."
                            />

                            <Section 
                                icon={<UserCheck className="w-6 h-6 text-yellow-500" />}
                                title="3. User Accounts"
                                content="You are responsible for safeguarding your account credentials. You must notify us immediately of any unauthorized use of your account. Brands and creators are subject to platform verification, and we reserve the right to suspend accounts that violate our community standards."
                            />

                            <Section 
                                icon={<CreditCard className="w-6 h-6 text-yellow-500" />}
                                title="4. Payments and Escrow"
                                content="All campaign payments are processed through our secure milestone-based escrow system. Funds are held safely and released to creators only upon satisfactory completion of agreed-upon deliverables, exactly as approved by the brand."
                            />

                            <Section 
                                icon={<Scale className="w-6 h-6 text-yellow-500" />}
                                title="5. Intellectual Property"
                                content="Content created during campaigns is subject to the usage rights negotiated within the platform's Memorandum of Understanding (MOU). MutinyX retains all rights to the platform infrastructure, code, algorithms, and design."
                            />
                        </div>
                    </motion.div>
                </motion.div>
            </div>
        </div>
    );
}

function Section({ icon, title, content }: { icon: React.ReactNode, title: string, content: string }) {
    return (
        <div className="flex gap-4 md:gap-6 group">
            <div className="shrink-0 mt-1">
                <div className="w-12 h-12 rounded-2xl bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center group-hover:scale-110 group-hover:bg-yellow-400/20 transition-all duration-300">
                    {icon}
                </div>
            </div>
            <div>
                <h2 className="text-xl font-bold text-foreground mb-3 group-hover:text-yellow-600 transition-colors">{title}</h2>
                <p className="text-muted-foreground leading-relaxed text-base">{content}</p>
            </div>
        </div>
    );
}

