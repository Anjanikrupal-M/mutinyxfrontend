import { useState } from 'react';
import { motion } from 'framer-motion';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { http } from '@/core/http';
import { API } from '@/core/api';
import { Mail, Phone, MapPin, Loader2 } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Textarea } from '@/shared/ui/textarea';
import { ContactCard } from '@/components/ui/contact-card';
import { RevealDots } from "@/components/ui/reveal-dots";

const fadeUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
};

export function ContactSection() {
    const [name, setName] = useState("");
    const [subject, setSubject] = useState("");
    const [message, setMessage] = useState("");
    const [email, setEmail] = useState("");

    const sanitizeInput = (val: string) => {
        let cleaned = val.replace(/^\s+/, '');
        cleaned = cleaned.replace(/<\/?\s*script[^>]*>/gi, '');
        return cleaned;
    };

    const sendContactMessage = async (data: { name: string, email: string, subject: string, message: string }) => {
        const response = await http.post(API.support.contact, data);
        return response.data;
    };

    const mutation = useMutation({
        mutationFn: sendContactMessage,
        onSuccess: () => {
            toast.success("Message sent successfully!", {
                description: "Our support team will get back to you shortly."
            });
            setName("");
            setEmail("");
            setSubject("");
            setMessage("");
        },
        onError: () => {
            toast.error("Failed to send message.", {
                description: "Please try again later or contact us directly via email."
            });
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const finalName = name.trim();
        const finalEmail = email.trim();
        const finalSubject = subject.trim();
        const finalMessage = message.trim();

        if (!finalName || !finalEmail || !finalSubject || !finalMessage) {
            toast.error("Invalid input", { description: "Please fill out all fields correctly." });
            return;
        }

        const isQuotedEmpty = (v: string) => v === '""' || v === "''";
        if (isQuotedEmpty(finalName) || isQuotedEmpty(finalEmail) || isQuotedEmpty(finalSubject) || isQuotedEmpty(finalMessage)) {
            toast.error("Invalid input", { description: "Input cannot be empty quotes." });
            return;
        }

        mutation.mutate({ name: finalName, email: finalEmail, subject: finalSubject, message: finalMessage });
    };

    return (
        <section id="contact" className="relative w-full py-16 md:py-24 overflow-hidden z-10 bg-background">
            <RevealDots maskCutout="none" />
            <div className="container mx-auto px-4 max-w-6xl relative z-10">
                <motion.div
                    variants={fadeUp}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-80px" }}
                >
                    <ContactCard
                        title="Get in touch"
                        description="Have questions about MutinyX or need help with your account? Fill out the form below and our team will get back to you promptly."
                        contactInfo={[
                            {
                                icon: Mail,
                                label: 'Email',
                                value: 'connect@mutinytalent.com',
                            },
                            {
                                icon: Phone,
                                label: 'Phone',
                                value: '+91 9391869151',
                            },
                            {
                                icon: MapPin,
                                label: 'Headquarters',
                                value: 'Mutiny Talent Private Limited\nBlock B, 4th Floor, Plot No. 206,\nKavuri Hills, Madhapur,\nHyderabad, Telangana 500033',
                                className: 'col-span-full md:col-span-2',
                            }
                        ]}
                    >
                        <form onSubmit={handleSubmit} className="w-full space-y-4">
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="contact-name" className="text-sm font-semibold">Name</Label>
                                <Input
                                    id="contact-name"
                                    type="text"
                                    placeholder="Your full name"
                                    className="bg-background"
                                    value={name}
                                    onChange={(e) => setName(sanitizeInput(e.target.value))}
                                    required
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="contact-email" className="text-sm font-semibold">Email</Label>
                                <Input
                                    id="contact-email"
                                    type="email"
                                    placeholder="you@company.com"
                                    className="bg-background"
                                    value={email}
                                    onChange={(e) => setEmail(sanitizeInput(e.target.value))}
                                    required
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="contact-subject" className="text-sm font-semibold">Subject</Label>
                                <Input
                                    id="contact-subject"
                                    type="text"
                                    placeholder="How can we help?"
                                    className="bg-background"
                                    maxLength={200}
                                    value={subject}
                                    onChange={(e) => setSubject(sanitizeInput(e.target.value))}
                                    required
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="contact-message" className="text-sm font-semibold">Message</Label>
                                <Textarea
                                    id="contact-message"
                                    placeholder="Type your message here..."
                                    rows={3}
                                    className="bg-background resize-none"
                                    maxLength={2000}
                                    value={message}
                                    onChange={(e) => setMessage(sanitizeInput(e.target.value))}
                                    required
                                />
                            </div>
                            <Button
                                className="w-full bg-foreground text-background hover:bg-foreground/90 font-medium py-5"
                                type="submit"
                                disabled={mutation.isPending || !name.trim() || !email.trim() || !subject.trim() || !message.trim()}
                            >
                                {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                {mutation.isPending ? "Sending..." : "Submit Message"}
                            </Button>
                        </form>
                    </ContactCard>
                </motion.div>
            </div>
        </section>
    );
}
