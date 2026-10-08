import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { ContactSection } from '@/shared/ui/contact-section';

export default function ContactPage() {
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
                <ContactSection />
            </div>
        </div>
    );
}
