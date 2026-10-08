import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { http } from '@/core/http';
import { API } from '@/core/api';
import { getSupportInfo } from './api';
import { Mail, MessageSquare, Phone, LifeBuoy, HelpCircle, Loader2, Clock, CheckCircle2, XCircle, PhoneCall, Crown, LockKeyhole, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/shared/stores/authStore';
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

    return (
        <div className="w-full h-full p-6 lg:p-10 w-full space-y-8 animate-in fade-in zoom-in-95 duration-300">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Support Center</h1>
                <p className="text-muted-foreground">We're here to help. Contact us or browse the FAQs below.</p>
            </div>

            <Tabs defaultValue="contact" className="w-full">
                <TabsList className="mb-6">
                    <TabsTrigger value="contact">Contact & FAQs</TabsTrigger>
                    <TabsTrigger value="history">Ticket History</TabsTrigger>
                </TabsList>
                
                <TabsContent value="contact">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {/* Contact Options */}
                        <div className="md:col-span-1 space-y-4">
                            <Card className="bg-card">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-lg">
                                        <LifeBuoy className="h-5 w-5 text-yellow-600" />
                                        Contact Us
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4 text-sm text-muted-foreground">
                                    <div className="flex items-center gap-3">
                                        <Mail className="h-4 w-4" />
                                        <span>{supportInfo?.email || 'connect@mutinytalent.com'}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Phone className="h-4 w-4" />
                                        <span>{supportInfo?.phone || '+91 79958 96438'}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <MessageSquare className="h-4 w-4" />
                                        <span>Live Chat (9 AM - 5 PM EST)</span>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="bg-card">
                                <CardHeader>
                                    <CardTitle className="text-lg">Send a Ticket</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                        <Input 
                                            placeholder="Subject" 
                                            maxLength={200}
                                            value={subject}
                                            onChange={(e) => setSubject(sanitizeInput(e.target.value))}
                                        />
                                        <p className="text-xs text-muted-foreground text-right">{subject.length}/200</p>
                                    </div>
                                    <div className="space-y-2">
                                        <Textarea 
                                            placeholder="Describe your problem..." 
                                            rows={4} 
                                            maxLength={2000}
                                            className="resize-none" 
                                            value={message}
                                            onChange={(e) => setMessage(sanitizeInput(e.target.value))}
                                        />
                                        <p className="text-xs text-muted-foreground text-right">{message.length}/2000</p>
                                    </div>
                                    <Button 
                                        onClick={async () => {
                                            handleSendTicket();
                                            // Refetch history right after a short delay so the new ticket shows up if user switches tabs
                                            setTimeout(() => refetchHistory(), 500);
                                        }}
                                        className="w-full font-semibold"
                                        disabled={mutation.isPending || !subject.trim() || !message.trim()}
                                    >
                                        {mutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Submit Ticket"}
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>

                        {/* FAQs */}
                        <div className="md:col-span-2">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <HelpCircle className="h-5 w-5 text-yellow-600" />
                                        Frequently Asked Questions
                                    </CardTitle>
                                    <CardDescription>Quick answers to common questions about MutinyX.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {faqsLoading ? (
                                        <div className="space-y-3">
                                            {Array.from({ length: 4 }).map((_, i) => (
                                                <div key={i} className="space-y-2 py-3 border-b last:border-b-0">
                                                    <Skeleton className="h-4 w-3/4" />
                                                    <Skeleton className="h-3 w-full" />
                                                    <Skeleton className="h-3 w-2/3" />
                                                </div>
                                            ))}
                                        </div>
                                    ) : faqs.length === 0 ? (
                                        <div className="text-center py-10 text-muted-foreground">
                                            <HelpCircle className="w-10 h-10 mx-auto text-muted-foreground/20 mb-3" />
                                            <p className="text-sm">No FAQs available at the moment.</p>
                                        </div>
                                    ) : (
                                        <Accordion type="single" collapsible className="w-full">
                                            {faqs.map((faq, i) => (
                                                <AccordionItem key={faq.id ?? i} value={`item-${faq.id ?? i}`}>
                                                    <AccordionTrigger className="text-left font-semibold">{faq.question}</AccordionTrigger>
                                                    <AccordionContent className="text-muted-foreground leading-relaxed">
                                                        {faq.answer}
                                                    </AccordionContent>
                                                </AccordionItem>
                                            ))}
                                        </Accordion>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="history">
                    <Card>
                        <CardHeader>
                            <CardTitle>My Tickets</CardTitle>
                            <CardDescription>Track the status of your recent support queries.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {historyLoading ? (
                                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                            ) : tickets.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                                    <p>You haven't submitted any tickets yet.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {tickets.map((t: any) => (
                                        <div key={t.id} className="border rounded-lg p-4 bg-card/50 flex flex-col gap-3 transition-colors hover:bg-card overflow-hidden">
                                            <div className="flex justify-between items-start gap-4">
                                                <h3 className="font-semibold text-base min-w-0 break-all">{t.subject}</h3>
                                                <div className="shrink-0">{getStatusBadge(t.status)}</div>
                                            </div>
                                            <p className="text-sm text-muted-foreground line-clamp-2 whitespace-pre-wrap break-all">{t.message}</p>
                                            <div className="flex justify-between items-center mt-2 pt-3 border-t">
                                                <span className="text-xs text-muted-foreground">
                                                    Submitted on {format(new Date(t.createdAt), 'MMM d, yyyy h:mm a')}
                                                </span>
                                                {t.adminNotes && (
                                                    <span className="text-xs font-medium text-yellow-600 bg-yellow-50 px-2 py-1 rounded-md">
                                                        Admin replied
                                                    </span>
                                                )}
                                            </div>
                                            {t.adminNotes && (
                                                <div className="mt-2 p-3 bg-muted/30 rounded-md text-sm border-l-2 border-yellow-500 overflow-hidden">
                                                    <span className="font-semibold text-xs uppercase text-muted-foreground block mb-1">Admin Response:</span>
                                                    <span className="whitespace-pre-wrap break-all">{t.adminNotes}</span>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}