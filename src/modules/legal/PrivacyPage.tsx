import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    ArrowLeft,
    Cookie,
    Database,
    Eye,
    FileText,
    Globe2,
    LockKeyhole,
    Mail,
    Share2,
    ShieldCheck,
    Trash2,
    UserRound,
    Youtube,
} from 'lucide-react';
import { Button } from '@/shared/ui/button';

const LAST_UPDATED = 'October 1, 2026';
const SUPPORT_EMAIL = 'developer@mutinytalent.com';
const linkClass = 'font-semibold text-foreground underline decoration-yellow-500/60 underline-offset-4 hover:text-yellow-600';

const staggerContainer = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const fadeUp = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export default function PrivacyPage() {
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div className="min-h-screen bg-background text-foreground relative overflow-hidden selection:bg-yellow-400/30">
            <div className="absolute top-[12%] right-[-10%] w-[600px] h-[600px] bg-yellow-400/5 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-8%] left-[-10%] w-[500px] h-[500px] bg-yellow-400/5 rounded-full blur-[100px] pointer-events-none" />

            <main className="container mx-auto px-4 py-10 md:py-16 max-w-5xl relative z-10">
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }}>
                    <Link to="/">
                        <Button variant="ghost" className="mb-8 -ml-4 font-semibold text-muted-foreground hover:text-foreground hover:bg-yellow-400/10 rounded-full transition-colors">
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back to Home
                        </Button>
                    </Link>
                </motion.div>

                <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-8">
                    <motion.header variants={fadeUp} className="max-w-3xl mb-10">
                        <div className="inline-flex items-center rounded-full border border-border px-3 py-1 text-xs font-bold bg-secondary text-muted-foreground mb-6">
                            <ShieldCheck className="w-3.5 h-3.5 mr-2 text-yellow-500" />
                            Data Protection
                        </div>
                        <h1 className="text-4xl md:text-6xl font-display font-extrabold tracking-tight mb-4">
                            Privacy Policy
                        </h1>
                        <p className="text-lg text-muted-foreground font-medium mb-5">
                            Last updated: <span className="text-foreground">{LAST_UPDATED}</span>
                        </p>
                        <p className="text-muted-foreground leading-7">
                            This Privacy Policy explains how MUTINY TALENT PRIVATE LIMITED (&quot;MutinyX&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) collects, uses, stores, shares, retains, and deletes personal information when you use MutinyX, MutinyTalent, our creator integrations, and our related websites and services (collectively, the &quot;Services&quot;).
                        </p>
                    </motion.header>

                    <motion.aside variants={fadeUp} className="rounded-2xl border border-yellow-500/25 bg-yellow-400/10 p-5 md:p-6">
                        <div className="flex gap-4">
                            <Youtube className="w-6 h-6 shrink-0 mt-0.5 text-yellow-600" />
                            <div>
                                <h2 className="font-bold text-lg mb-2">Google and YouTube data at a glance</h2>
                                <p className="text-sm md:text-base text-muted-foreground leading-7">
                                    Connecting YouTube is optional. MutinyX requests read-only access to show your channel profile, video statistics, and private YouTube Analytics reports in your own dashboard. We do not upload, edit, or delete your YouTube content, and we never request or store your Google password. You can disconnect YouTube, revoke access through Google, and request deletion of stored Google user data at any time.
                                </p>
                            </div>
                        </div>
                    </motion.aside>

                    <motion.div variants={fadeUp} className="bg-card/70 backdrop-blur-xl border border-border/60 shadow-xl shadow-black/5 rounded-3xl p-6 md:p-10 lg:p-12">
                        <div className="space-y-12">
                            <Section icon={<FileText />} title="1. Scope and who controls your data">
                                <p>
                                    This policy applies to information processed through the Services, including <a className={linkClass} href="https://www.mutinyx.in">www.mutinyx.in</a> and <a className={linkClass} href="https://integrations.mutinyx.in">integrations.mutinyx.in</a>. MUTINY TALENT PRIVATE LIMITED is responsible for the processing described here. Third-party services have their own privacy policies and practices.
                                </p>
                            </Section>

                            <Section icon={<Eye />} title="2. Information we collect">
                                <Subsection title="Information you provide">
                                    <p>We may collect your name, email address, account credentials, profile and business information, campaign details, communications, support requests, and transaction-related information that you choose to provide.</p>
                                </Subsection>
                                <Subsection title="Google and YouTube Authorized Data">
                                    <p>When you choose to connect YouTube, we use OAuth 2.0 and request only these read-only scopes:</p>
                                    <ul>
                                        <li><code>https://www.googleapis.com/auth/youtube.readonly</code> — to identify the channel you authorize and retrieve its channel ID, title, handle, profile image, subscriber count, total view count, video count, and recent video metadata and statistics such as titles, thumbnails, publication dates, views, likes, and comments.</li>
                                        <li><code>https://www.googleapis.com/auth/yt-analytics.readonly</code> — to retrieve private analytics for the authorized channel, including views, estimated watch time, average view duration, subscribers gained and lost, per-video analytics, and traffic-source reports.</li>
                                    </ul>
                                    <p>We also receive and securely store the OAuth access token, refresh token, token expiry, and granted-scope information needed to maintain the connection. We do not request your emails, contacts, Google password, monetary YouTube analytics, or permission to upload, edit, or delete YouTube content.</p>
                                </Subsection>
                                <Subsection title="Technical and usage information">
                                    <p>We may collect IP address, browser and device information, session identifiers, timestamps, security logs, and information about how you interact with the Services. We use essential cookies or similar technologies to keep you signed in, protect sessions, and provide requested functionality.</p>
                                </Subsection>
                            </Section>

                            <Section icon={<Database />} title="3. How we use information">
                                <ul>
                                    <li>Provide, operate, secure, and troubleshoot the Services.</li>
                                    <li>Authenticate users and maintain requested social-account connections.</li>
                                    <li>Display the authorizing creator&apos;s channel, video, watch-time, subscriber, and traffic-source analytics.</li>
                                    <li>Support campaigns, collaboration workflows, reporting, payments, and customer support.</li>
                                    <li>Detect fraud, abuse, and security incidents and comply with applicable law.</li>
                                    <li>Communicate service, security, support, and policy updates.</li>
                                </ul>
                                <p>We do not use Google user data for advertising, retargeting, credit decisions, surveillance, or training general-purpose artificial-intelligence models. We do not sell Google user data or personal information.</p>
                            </Section>

                            <Section icon={<Youtube />} title="4. Google API Services and Limited Use">
                                <p>
                                    MutinyX uses YouTube API Services. Your use of YouTube is also governed by the <a className={linkClass} href="https://www.youtube.com/t/terms" target="_blank" rel="noreferrer">YouTube Terms of Service</a>. You can review the <a className={linkClass} href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Google Privacy Policy</a> for information about Google&apos;s practices.
                                </p>
                                <p>
                                    MutinyX&apos;s use and transfer to any other app of information received from Google APIs will adhere to the <a className={linkClass} href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">Google API Services User Data Policy</a>, including the Limited Use requirements.
                                </p>
                            </Section>

                            <Section icon={<Share2 />} title="5. When we share information">
                                <p>We may share non-Google information with collaborators you choose to work with through the Services, and with vendors that provide infrastructure, database hosting, security, communications, analytics, payment, or customer-support services on our behalf. Those providers may process information only to deliver contracted services and must protect it appropriately.</p>
                                <p>Google and YouTube Authorized Data is available only to the authorizing user and service providers acting on our behalf under appropriate confidentiality and security obligations. We do not disclose it to brands, advertisers, data brokers, or other unauthorised third parties.</p>
                                <p>We may disclose information when required by law, to protect users and the Services, or as part of a corporate transaction where permitted by law and subject to appropriate notice and safeguards.</p>
                            </Section>

                            <Section icon={<LockKeyhole />} title="6. How we protect information">
                                <p>We use reasonable administrative, technical, and organisational safeguards designed to protect information from loss, misuse, unauthorised access, alteration, or disclosure. These measures include encrypted transport, encryption or equivalent protection for stored OAuth tokens, access controls, session protection, monitoring, and restricted operational access.</p>
                                <p>No method of storage or transmission is completely secure. If we identify a data incident, we will investigate and provide notifications when required by applicable law.</p>
                            </Section>

                            <Section icon={<Trash2 />} title="7. Retention, disconnection, revocation, and deletion">
                                <Subsection title="How long we retain Google and YouTube data">
                                    <ul>
                                        <li>OAuth tokens are retained only while your YouTube connection remains active and they are necessary to provide the features you requested.</li>
                                        <li>YouTube Analytics data and authorized channel/video statistics may be retained while your connection is active and the information remains necessary for your dashboard and historical reports. We verify continued authorization at least every 30 days.</li>
                                        <li>Other stored YouTube API Data is refreshed or deleted within 30 calendar days, as required by YouTube&apos;s policies.</li>
                                        <li>When information is no longer needed for the disclosed purpose, or when authorization ends, we delete it unless retention is required by applicable law.</li>
                                    </ul>
                                </Subsection>
                                <Subsection title="Disconnect or revoke access">
                                    <p>You can disconnect YouTube inside the MutinyX integrations dashboard. This stops MutinyX from making new YouTube API requests for that connection. You can also revoke MutinyX directly from your <a className={linkClass} href="https://security.google.com/settings/security/permissions" target="_blank" rel="noreferrer">Google Account security permissions</a>.</p>
                                    <p>After we receive or detect a revocation, we delete the Google and YouTube Authorized Data associated with that consent as soon as possible and no later than 7 calendar days.</p>
                                </Subsection>
                                <Subsection title="Request deletion">
                                    <p>
                                        To request deletion of stored Google/YouTube data or other personal information, email <a className={linkClass} href={`mailto:${SUPPORT_EMAIL}?subject=Google%20Data%20Deletion%20Request`}>{SUPPORT_EMAIL}</a> with the subject &quot;Google Data Deletion Request&quot; and identify the MutinyX account and connected channel. We may verify your identity before processing the request. Valid Google/YouTube data deletion requests are completed as soon as possible and within 7 calendar days.
                                    </p>
                                    <p>Deleting information from MutinyX does not delete information held by YouTube. To delete videos, comments, or other content from YouTube itself, you must use YouTube or another authorised application that supports that action.</p>
                                </Subsection>
                                <Subsection title="Other records">
                                    <p>Account, campaign, transaction, support, security, and compliance records are retained only for as long as necessary to provide the Services, resolve disputes, prevent abuse, enforce agreements, and meet legal, tax, accounting, or regulatory obligations. Retention periods vary according to the record and applicable law.</p>
                                </Subsection>
                            </Section>

                            <Section icon={<UserRound />} title="8. Your choices and rights">
                                <p>Depending on where you live, you may have rights to request access, correction, deletion, restriction, objection, or a copy of your personal information, and to withdraw consent where processing relies on consent. To exercise a right, contact us using the details below. We may need to verify your identity and may retain limited information where legally required.</p>
                            </Section>

                            <Section icon={<Cookie />} title="9. Cookies and session storage">
                                <p>We use essential cookies and similar storage to authenticate users, maintain secure sessions, remember necessary preferences, and prevent abuse. We do not use Google user data for interest-based advertising. Browser controls can block cookies, but essential parts of the Services may stop working.</p>
                            </Section>

                            <Section icon={<Globe2 />} title="10. International processing">
                                <p>Our service providers may process information in countries other than your own. Where required, we use appropriate contractual, organisational, and technical safeguards for international transfers.</p>
                            </Section>

                            <Section icon={<ShieldCheck />} title="11. Children">
                                <p>The Services are not directed to children under 13, and we do not knowingly collect personal information from children under 13. If you believe a child has provided information to us, contact us so we can investigate and delete it where appropriate.</p>
                            </Section>

                            <Section icon={<FileText />} title="12. Changes to this policy">
                                <p>We may update this Privacy Policy to reflect changes to the Services, law, or our data practices. We will update the date at the top and provide additional notice where a material change requires it. If we materially change how we use Google user data, we will provide notice and obtain consent where required before using that data for the new purpose.</p>
                            </Section>

                            <Section icon={<Mail />} title="13. Contact us">
                                <p>For privacy questions, complaints, access requests, or deletion requests, contact:</p>
                                <address className="not-italic rounded-xl border border-border bg-secondary/40 p-4">
                                    <strong>MUTINY TALENT PRIVATE LIMITED</strong><br />
                                    Email: <a className={linkClass} href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
                                </address>
                            </Section>
                        </div>
                    </motion.div>
                </motion.div>
            </main>
        </div>
    );
}

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
    return (
        <section className="flex gap-4 md:gap-6 group">
            <div className="shrink-0 mt-1 hidden sm:block">
                <div className="w-12 h-12 rounded-2xl bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center text-yellow-600 group-hover:scale-105 group-hover:bg-yellow-400/20 transition-all duration-300 [&>svg]:w-6 [&>svg]:h-6">
                    {icon}
                </div>
            </div>
            <div className="min-w-0 flex-1">
                <h2 className="text-xl md:text-2xl font-bold text-foreground mb-4 group-hover:text-yellow-600 transition-colors">{title}</h2>
                <div className="space-y-4 text-muted-foreground leading-7 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:mb-2 [&_code]:break-all [&_code]:rounded [&_code]:bg-secondary [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-xs [&_code]:text-foreground">
                    {children}
                </div>
            </div>
        </section>
    );
}

function Subsection({ title, children }: { title: string; children: ReactNode }) {
    return (
        <div className="space-y-3">
            <h3 className="font-bold text-foreground">{title}</h3>
            {children}
        </div>
    );
}
