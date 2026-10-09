import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { http } from '@/core/http';
import { API } from '@/core/api';
import { getSupportInfo } from './api';
import { Mail, MessageSquare, Phone, LifeBuoy, HelpCircle, Loader2, Clock, CheckCircle2, XCircle, PhoneCall, Crown, LockKeyhole, Sparkles, ArrowUpRight, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/shared/stores/authStore';
import { PageHeader } from '@/shared/components/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Textarea } from '@/shared/ui/textarea';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/shared/ui/accordion';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/shared/ui/tabs';
import { Badge } from '@/shared/ui/badge';
import { Skeleton } from '@/shared/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { format } from 'date-fns';

// FAQs are now fetched dynamically from the API — admin-controlled.

export default function SupportPage() {
    const navigate = useNavigate();
    const [subject, setSubject] = useState("");
    const [message, setMessage] = useState("");
    const user = useAuthStore((state) => state.user);
    const { data: supportInfo } = useQuery({ queryKey: ['supportInfo'], queryFn: getSupportInfo });

    // Fetch FAQs dynamically from the backend (admin-controlled)
    const { data: faqsRes, isLoading: faqsLoading } = useQuery({
        queryKey: ['publicFaqs'],
        queryFn: async () => {
            const res = await http.get(API.support.faqs);
            return res.data;
        },
        staleTime: 5 * 60 * 1000, // cache for 5 minutes
    });
    const faqs: { id: string; question: string; answer: string }[] = faqsRes?.data ?? [];

    const sanitizeInput = (val: string) => {
        let cleaned = val.replace(/^\s+/, ''); // trim leading space
        cleaned = cleaned.replace(/<\/?\s*script[^>]*>/gi, '');
        return cleaned;
    };

    const sendSupportMessage = async (data: {
        subject: string;
        message: string;
        requester?: {
            name?: string;
            email?: string;
            role?: string;
            brandName?: string;
            brandId?: string;
            city?: string;
            website?: string;
        };
    }) => {
        const response = await http.post(API.support.contact, { ...data, isInternal: true });
        return response.data;
    };

    const mutation = useMutation({
        mutationFn: sendSupportMessage,
        onSuccess: () => {
            toast.success("Ticket submitted successfully!", {
                description: "Our support team will get back to you shortly."
            });
            setSubject("");
            setMessage("");
        },
        onError: () => {
            toast.error("Failed to submit ticket.", {
                description: "Please try again later or contact us directly."
            });
        }
    });

    const handleSendTicket = () => {
        const finalSubject = subject.trim();
        const finalMessage = message.trim();

        if (!finalSubject || !finalMessage) {
            toast.error("Invalid input", { description: "Please fill out all fields correctly." });
            return;
        }

        const isQuotedEmpty = (v: string) => v === '""' || v === "''";
        if (isQuotedEmpty(finalSubject) || isQuotedEmpty(finalMessage)) {
            toast.error("Invalid input", { description: "Input cannot be empty quotes." });
            return;
        }

        mutation.mutate({
            subject: finalSubject,
            message: finalMessage,
            requester: {
                name: user?.name,
                email: user?.email,
                role: user?.role,
                brandName: user?.brandName,
                brandId: user?.brandId,
                city: user?.city,
                website: user?.website,
            },
        });
    };

    const { data: historyRes, isLoading: historyLoading, refetch: refetchHistory } = useQuery({
        queryKey: ['supportTicketsHistory'],
        queryFn: async () => {
            const res = await http.get(API.support.history);
            return res.data;
        }
    });

    const tickets = historyRes?.data || [];

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'open':
                return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200"><Clock className="w-3 h-3 mr-1" /> Open</Badge>;
            case 'in_progress':
                return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200"><Loader2 className="w-3 h-3 mr-1" /> In Progress</Badge>;
            case 'resolved':
                return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><CheckCircle2 className="w-3 h-3 mr-1" /> Resolved</Badge>;
            case 'closed':
                return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200"><XCircle className="w-3 h-3 mr-1" /> Closed</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    // Contact channels shown as the row of tiles at the top of the Contact tab.
    const supportEmail = supportInfo?.email || 'connect@mutinytalent.com';
    const supportPhone = supportInfo?.phone || '+91 79958 96438';
    const contactMethods = [
        { icon: Mail, label: 'Email', value: supportEmail, href: `mailto:${supportEmail}` },
        { icon: Phone, label: 'Phone', value: supportPhone, href: `tel:${supportPhone.replace(/\s+/g, '')}` },
        { icon: MessageSquare, label: 'Live Chat', value: '9 AM - 5 PM EST', href: undefined },
    ];

    return (
        <div className="w-full animate-fade-in pb-10">
            <PageHeader
                title="Support Center"
                description="We're here to help. Contact us or browse the FAQs below."
                animated
                size="lg"
                hideHireManager
            />

            <Tabs defaultValue="contact" className="w-full">
                <TabsList className="mb-6 h-11 rounded-full bg-secondary p-1">
                    <TabsTrigger value="contact" className="rounded-full px-4 text-[13px] font-semibold data-[state=active]:shadow-sm">
                        Contact & FAQs
                    </TabsTrigger>
                    <TabsTrigger value="history" className="rounded-full px-4 text-[13px] font-semibold data-[state=active]:shadow-sm">
                        Ticket History
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="contact" className="mt-0 space-y-5">
                    {/* ── Contact Us: one tile per channel ── */}
                    <section className="animate-fade-up">
                        <div className="mb-3 flex items-center gap-2">
                            <LifeBuoy className="h-4 w-4 text-foreground/60" />
                            <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Contact Us</h2>
                        </div>
                        <div className="grid grid-cols-1 divide-y divide-foreground/[0.07] overflow-hidden rounded-3xl bg-card shadow-card ring-1 ring-foreground/[0.07] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                            {contactMethods.map((method, i) => {
                                const content = (
                                    <>
                                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand/20 text-foreground transition-colors duration-300 group-hover:bg-brand">
                                            <method.icon className="h-[18px] w-[18px]" />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{method.label}</span>
                                            <span className="mt-0.5 block truncate text-sm font-semibold">{method.value}</span>
                                        </span>
                                        {method.href && (
                                            <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
                                        )}
                                    </>
                                );
                                const tileClass = cn(
                                    'group flex animate-fade-up items-center gap-4 px-5 py-4 transition-colors duration-300',
                                    method.href && 'hover:bg-secondary/60',
                                    ['[animation-delay:60ms]', '[animation-delay:120ms]', '[animation-delay:180ms]'][i],
                                );
                                return method.href ? (
                                    <a key={method.label} href={method.href} className={tileClass}>{content}</a>
                                ) : (
                                    <div key={method.label} className={tileClass}>{content}</div>
                                );
                            })}
                        </div>
                    </section>

                    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-3">
                        {/* ── Send a Ticket: the highlighted primary action ── */}
                        <section className="relative order-1 animate-fade-up overflow-hidden rounded-3xl bg-card p-6 shadow-float ring-2 ring-brand [animation-delay:200ms] lg:sticky lg:top-24 lg:order-2">
                            <span aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-brand/25 blur-3xl" />
                            <div className="relative mb-5 flex items-center gap-3">
                                <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand text-black">
                                    <Send className="h-[18px] w-[18px]" />
                                </span>
                                <h2 className="font-display text-lg font-bold tracking-tight">Send a Ticket</h2>
                            </div>
                            <div className="relative space-y-4">
                                <div className="space-y-1.5">
                                    <Input
                                        placeholder="Subject"
                                        maxLength={200}
                                        value={subject}
                                        onChange={(e) => setSubject(sanitizeInput(e.target.value))}
                                        className="h-11 rounded-xl bg-secondary/50 focus-visible:bg-card"
                                    />
                                    <p className="text-right text-[11px] tabular-nums text-muted-foreground">{subject.length}/200</p>
                                </div>
                                <div className="space-y-1.5">
                                    <Textarea
                                        placeholder="Describe your problem..."
                                        rows={5}
                                        maxLength={2000}
                                        className="resize-none rounded-xl bg-secondary/50 focus-visible:bg-card"
                                        value={message}
                                        onChange={(e) => setMessage(sanitizeInput(e.target.value))}
                                    />
                                    <p className="text-right text-[11px] tabular-nums text-muted-foreground">{message.length}/2000</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        handleSendTicket();
                                        // Refetch history right after a short delay so the new ticket shows up if user switches tabs
                                        setTimeout(() => refetchHistory(), 500);
                                    }}
                                    disabled={mutation.isPending || !subject.trim() || !message.trim()}
                                    className="flood-btn group/send flex h-11 w-full items-center gap-2 rounded-full bg-foreground pl-1.5 pr-5 text-sm font-semibold text-background duration-300 hover:shadow-float disabled:pointer-events-none disabled:opacity-50"
                                >
                                    <span className="flood-btn-icon grid h-8 w-8 place-items-center rounded-full bg-brand text-black">
                                        {mutation.isPending ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Send className="h-3.5 w-3.5 transition-transform duration-300 group-hover/send:-rotate-12" />
                                        )}
                                    </span>
                                    <span className="flood-btn-label flex-1 pr-8 text-center">Submit Ticket</span>
                                </button>
                            </div>
                        </section>

                        {/* ── FAQs ── */}
                        <section className="order-2 animate-fade-up rounded-3xl bg-card p-6 shadow-card ring-1 ring-foreground/[0.07] [animation-delay:260ms] lg:order-1 lg:col-span-2">
                            <div className="mb-5 flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/20 text-foreground">
                                        <HelpCircle className="h-[18px] w-[18px]" />
                                    </span>
                                    <div>
                                        <h2 className="font-display text-lg font-bold tracking-tight">Frequently Asked Questions</h2>
                                        <p className="text-[13px] text-muted-foreground">Quick answers to common questions about MutinyX.</p>
                                    </div>
                                </div>
                                {faqs.length > 0 && (
                                    <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold tabular-nums text-muted-foreground">{faqs.length}</span>
                                )}
                            </div>

                            {faqsLoading ? (
                                <div className="space-y-2">
                                    {Array.from({ length: 4 }).map((_, i) => (
                                        <div key={i} className="space-y-2 rounded-2xl bg-secondary/50 p-4">
                                            <Skeleton className="h-4 w-3/4" />
                                            <Skeleton className="h-3 w-2/3" />
                                        </div>
                                    ))}
                                </div>
                            ) : faqs.length === 0 ? (
                                <div className="rounded-2xl bg-secondary/50 py-10 text-center text-muted-foreground">
                                    <HelpCircle className="mx-auto mb-3 h-10 w-10 text-muted-foreground/20" />
                                    <p className="text-sm">No FAQs available at the moment.</p>
                                </div>
                            ) : (
                                <Accordion type="single" collapsible className="w-full space-y-2">
                                    {faqs.map((faq, i) => (
                                        <AccordionItem
                                            key={faq.id ?? i}
                                            value={`item-${faq.id ?? i}`}
                                            className="rounded-2xl border-0 bg-secondary/50 px-4 transition-colors hover:bg-secondary data-[state=open]:bg-brand/10 data-[state=open]:ring-1 data-[state=open]:ring-brand/40"
                                        >
                                            <AccordionTrigger className="text-left text-sm font-semibold hover:no-underline">{faq.question}</AccordionTrigger>
                                            <AccordionContent className="text-[13px] leading-relaxed text-muted-foreground">
                                                {faq.answer}
                                            </AccordionContent>
                                        </AccordionItem>
                                    ))}
                                </Accordion>
                            )}
                        </section>
                    </div>
                </TabsContent>

                <TabsContent value="history" className="mt-0">
                    <section className="animate-fade-up rounded-3xl bg-card p-6 shadow-card ring-1 ring-foreground/[0.07]">
                        <div className="mb-5 flex items-center gap-3">
                            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/20 text-foreground">
                                <MessageSquare className="h-[18px] w-[18px]" />
                            </span>
                            <div>
                                <h2 className="font-display text-lg font-bold tracking-tight">My Tickets</h2>
                                <p className="text-[13px] text-muted-foreground">Track the status of your recent support queries.</p>
                            </div>
                        </div>

                        {historyLoading ? (
                            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                        ) : tickets.length === 0 ? (
                            <div className="rounded-2xl bg-secondary/50 py-10 text-center text-muted-foreground">
                                <MessageSquare className="mx-auto mb-3 h-12 w-12 text-muted-foreground/30" />
                                <p className="text-sm">You haven't submitted any tickets yet.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {tickets.map((t: any) => (
                                    <div key={t.id} className="flex flex-col gap-3 overflow-hidden rounded-2xl bg-secondary/40 p-4 ring-1 ring-foreground/[0.05] transition-colors hover:bg-secondary/70">
                                        <div className="flex items-start justify-between gap-4">
                                            <h3 className="min-w-0 break-all text-sm font-semibold">{t.subject}</h3>
                                            <div className="shrink-0">{getStatusBadge(t.status)}</div>
                                        </div>
                                        <p className="line-clamp-2 whitespace-pre-wrap break-all text-[13px] text-muted-foreground">{t.message}</p>
                                        <div className="flex items-center justify-between border-t border-foreground/[0.06] pt-3">
                                            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                <Clock className="h-3 w-3" />
                                                Submitted on {format(new Date(t.createdAt), 'MMM d, yyyy h:mm a')}
                                            </span>
                                            {t.adminNotes && (
                                                <span className="rounded-full bg-brand/20 px-2.5 py-1 text-[11px] font-semibold text-foreground">
                                                    Admin replied
                                                </span>
                                            )}
                                        </div>
                                        {t.adminNotes && (
                                            <div className="overflow-hidden rounded-xl border-l-[3px] border-brand bg-card p-3 text-sm">
                                                <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Admin Response:</span>
                                                <span className="whitespace-pre-wrap break-all">{t.adminNotes}</span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </TabsContent>
            </Tabs>
        </div>
    );
}
