import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useSearchParams } from 'react-router-dom';
import {
    Plus, Loader2, Layers, Calendar, TrendingUp,
    Users, X, BookOpen, Tag, ToggleLeft, ToggleRight,
    Sparkles, ChevronLeft, ChevronRight, ArrowRight, ArrowUpRight, Inbox,
    Check, PenLine, Image as ImageIcon, UploadCloud, RefreshCw, Trash2, Globe, Lock,
} from 'lucide-react';
import { InfoTooltip } from '@/shared/components/InfoTooltip';
import { HireManagerButton } from '@/shared/components/HireManagerButton';
import { PageExplainer } from '@/shared/components/PageExplainer';
import { EmptyState } from '@/shared/components/EmptyState';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { Tile, Field, Counter, ErrorText, OptionCard, Note, ProgressRing, fieldClass, fieldBorder, useTypingPlaceholder } from '@/shared/components/BentoUi';
import { usePrograms, useCreateProgram, useUploadProgramThumbnail, useProgramEnrollmentRealtime } from '../hooks/usePrograms';
import type { Program } from '@/shared/types/campaign';
import { ApiImage } from '@/shared/components/ApiImage';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuthStore } from '@/shared/stores/authStore';
import { useProfileGate } from '@/shared/hooks/useProfileGate';

// ─── Niche options ────────────────────────────────────────────────────────────

const NICHE_OPTIONS = [
    'Fashion', 'Beauty', 'Tech', 'Food', 'Travel', 'Fitness',
    'Gaming', 'Lifestyle', 'Finance', 'Education', 'Health',
    'Sports', 'Music', 'Art', 'Comedy', 'Parenting', 'Business',
];

// ─── Program Card ─────────────────────────────────────────────────────────────

// Status dot on the cover chip, in the brand palette (same language as the campaign cards).
const PROGRAM_STATUS_DOT: Record<string, string> = {
    active: 'bg-brand shadow-[0_0_8px_rgb(250_203_3_/_0.9)]',
    paused: 'bg-orange-400',
    completed: 'bg-white',
    archived: 'bg-white/45',
};
const PROGRAM_STATUS_LABEL: Record<string, string> = { active: 'Active', paused: 'Paused', completed: 'Completed', archived: 'Archived' };

// Cards fade up one after another (literal classes so Tailwind sees them).
const CARD_DELAYS = ['[animation-delay:0ms]', '[animation-delay:50ms]', '[animation-delay:100ms]', '[animation-delay:150ms]', '[animation-delay:200ms]', '[animation-delay:250ms]', '[animation-delay:300ms]', '[animation-delay:350ms]'];

/** One cell of the stat strip at the foot of the card. */
function ProgramStat({ icon: Icon, label, value }: { icon: typeof Layers; label: string; value: string | number }) {
    return (
        <div className="min-w-0 px-2.5 py-1.5">
            <p className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                <Icon className="h-3 w-3 shrink-0" />
                <span className="truncate">{label}</span>
            </p>
            <p className="mt-0.5 truncate text-sm font-bold tabular-nums text-foreground">{value}</p>
        </div>
    );
}

/**
 * Program card — drawn as a deck, because a program is a stack of campaigns: two layers peek
 * above the card and fan out on hover while the card lifts. Inside it follows the campaign and
 * creator cards: a framed cover with the name over a dark scrim, a frosted status chip, a live
 * "Enrolling" pill, then the description and niches, then a divided stat strip.
 */
function ProgramCard({ program, className }: { program: Program; className?: string }) {
    const enrollmentCount = program.enrollmentCount ?? 0;
    const campaignCount = program.campaignCount ?? 0;
    const niches = program.niches ?? [];

    return (
        <Link
            to={`/programs/${program.id}`}
            className={cn('group relative flex h-full animate-fade-up flex-col pt-3', className)}
        >
            {/* The deck: two layers behind the card that fan out on hover. */}
            <span aria-hidden className="absolute inset-x-7 top-0 h-8 rounded-t-[20px] border border-border bg-card/50 transition-transform duration-500 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] group-hover:-translate-y-2" />
            <span aria-hidden className="absolute inset-x-3.5 top-1.5 h-8 rounded-t-[22px] border border-border bg-card/80 transition-transform duration-500 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] group-hover:-translate-y-1" />

            <div className="relative flex flex-1 flex-col rounded-[24px] border border-border bg-card p-1.5 shadow-card transition-all duration-300 group-hover:border-foreground/20 group-hover:shadow-float">
                {/* ── Cover ── */}
                <div className="relative h-32 shrink-0 overflow-hidden rounded-[19px] bg-foreground">
                    {program.thumbnailUrl ? (
                        <ApiImage
                            src={program.thumbnailUrl}
                            alt={program.name}
                            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                            placeholderClassName="bg-foreground"
                        />
                    ) : (
                        <span className="relative block h-full w-full overflow-hidden">
                            <span aria-hidden className="absolute -bottom-6 right-3 select-none font-display text-[120px] font-bold leading-none text-brand/30 transition-transform duration-700 group-hover:-translate-y-1 group-hover:scale-105">
                                {program.name.charAt(0).toUpperCase()}
                            </span>
                        </span>
                    )}
                    <span aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/30" />

                    {/* Status — frosted chip, the dot carries the state. */}
                    <span className="absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded-full border border-white/15 bg-black/45 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-md">
                        <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', PROGRAM_STATUS_DOT[program.status] ?? 'bg-white/45')} />
                        {PROGRAM_STATUS_LABEL[program.status] ?? program.status}
                    </span>

                    {/* Enrollment open — a live pill with a pulsing dot. */}
                    {program.enrollmentOpen && (
                        <span className="absolute right-2.5 top-2.5 flex items-center gap-1.5 rounded-full bg-brand px-2.5 py-1 text-[11px] font-bold text-black shadow-[0_4px_14px_-4px_rgb(250_203_3_/_0.9)]">
                            <span className="relative flex h-1.5 w-1.5">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-black/60" />
                                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-black" />
                            </span>
                            Enrolling
                        </span>
                    )}

                    {/* Name over the scrim; the yellow arrow slides in on hover (the whole card is the link). */}
                    <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-2.5">
                        <div className="min-w-0 text-white">
                            <h3 className="line-clamp-2 font-display text-[15px] font-semibold leading-tight tracking-tight" title={program.name}>
                                {program.name}
                            </h3>
                            <p className="mt-0.5 text-[11px] text-white/65">
                                {campaignCount === 0 ? 'No phases yet' : `${campaignCount} phase${campaignCount === 1 ? '' : 's'}`}
                            </p>
                        </div>
                        <span className="grid h-7 w-7 shrink-0 translate-y-2 place-items-center rounded-full bg-brand text-black opacity-0 shadow-lg transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100" aria-hidden>
                            <ArrowUpRight className="h-3.5 w-3.5" />
                        </span>
                    </div>
                </div>

                {/* ── Body ── */}
                <div className="flex flex-1 flex-col px-1.5 pb-0.5 pt-2.5">
                    <p className="line-clamp-2 text-xs leading-[18px] text-foreground/75">
                        {program.description || <span className="italic text-muted-foreground">No description</span>}
                    </p>

                    {(niches.length > 0 || program.agentName) && (
                        <div className="mt-2 flex min-w-0 items-center gap-1">
                            {niches.slice(0, 2).map((n) => (
                                <span key={n} className="min-w-0 shrink truncate rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-foreground/70" title={n}>
                                    {n}
                                </span>
                            ))}
                            {niches.length > 2 && (
                                <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground" title={niches.slice(2).join(', ')}>
                                    +{niches.length - 2}
                                </span>
                            )}
                            {program.agentName && (
                                <span className="ml-auto flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground" title={`Run by ${program.agentName}`}>
                                    <span className="grid h-5 w-5 place-items-center rounded-full bg-foreground text-[9px] font-bold text-brand">
                                        {program.agentName.charAt(0).toUpperCase()}
                                    </span>
                                    <span className="max-w-[80px] truncate font-medium text-foreground/80">{program.agentName}</span>
                                </span>
                            )}
                        </div>
                    )}

                    {/* Stat strip pinned to the bottom so numbers line up across a row of cards. */}
                    <div className="mt-auto pt-2.5">
                        <div className="grid grid-cols-3 divide-x divide-border rounded-xl border border-border bg-secondary/40 transition-colors duration-300 group-hover:bg-secondary/70">
                            <ProgramStat icon={Layers} label="Campaigns" value={campaignCount} />
                            <ProgramStat icon={Users} label="Enrolled" value={enrollmentCount} />
                            <ProgramStat
                                icon={Calendar}
                                label="Created"
                                value={new Date(program.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </Link>
    );
}

// ─── Create Program Modal ─────────────────────────────────────────────────────

const PROGRAM_NAME_EXAMPLES = ['Nike Q3 Influencer Drive', 'Monsoon Skincare Squad', 'Festive Foodies 2026'];
const PROGRAM_DESCRIPTION_MAX = 600;

/**
 * Create Program — built from the campaign builder's pieces (tiles, fields, counters, choice
 * cards, progress ring) so both creation flows feel like one product. Form on the left in three
 * tiles; on the right a live preview of the program card exactly as it will appear in the list.
 */
function CreateProgramModal({ onClose, existingPrograms = [] }: { onClose: () => void, existingPrograms?: Program[] }) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [enrollmentOpen, setEnrollmentOpen] = useState(false);
    const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
    const [coverImagePreview, setCoverImagePreview] = useState<string>('');
    const [dragging, setDragging] = useState(false);
    const [errors, setErrors] = useState<{ name?: string; description?: string; coverImage?: string }>({});
    const { mutate: createProgram, isPending: isCreating } = useCreateProgram();
    const { mutateAsync: uploadThumbnail, isPending: isUploading } = useUploadProgramThumbnail();
    const namePlaceholder = useTypingPlaceholder(PROGRAM_NAME_EXAMPLES, name.length === 0);
    const busy = isCreating || isUploading;

    const requiredDone = [name.trim() && !errors.name, description.trim()].filter(Boolean).length;
    const ready = requiredDone === 2;

    const acceptImage = (file: File | undefined) => {
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setErrors((p) => ({ ...p, coverImage: 'Please select an image file (PNG, JPG, WEBP)' }));
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setErrors((p) => ({ ...p, coverImage: 'Image must be less than 5MB' }));
            return;
        }
        setErrors((p) => ({ ...p, coverImage: undefined }));
        setCoverImageFile(file);
        setCoverImagePreview(URL.createObjectURL(file));
    };

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        acceptImage(e.target.files?.[0]);
        e.target.value = '';
    };

    const handleCreate = () => {
        const newErrors: { name?: string; description?: string } = {};
        if (!name.trim()) newErrors.name = 'Program name is required';
        else if (errors.name) newErrors.name = errors.name;
        if (!description.trim()) newErrors.description = 'Description is required';
        setErrors((p) => ({ ...p, ...newErrors }));

        if (Object.keys(newErrors).length > 0) return;

        createProgram(
            {
                name: name.trim(),
                description: description.trim(),
                enrollmentOpen,
            },
            {
                onSuccess: async (createdProgram) => {
                    if (coverImageFile) {
                        try {
                            await uploadThumbnail({ id: createdProgram.id, file: coverImageFile });
                        } catch (err) {
                            toast.error('Program created, but failed to upload image.');
                        }
                    }
                    onClose();
                },
                onError: (error: any) => {
                    const msg = error?.response?.data?.error?.message || error?.message || 'Failed to create program';
                    if (msg.toLowerCase().includes('already exists')) {
                        setErrors(p => ({ ...p, name: msg }));
                    } else {
                        toast.error(msg);
                    }
                }
            }
        );
    };

    // What the new program's card will look like in the list, from what has been typed so far.
    const previewProgram = {
        id: 'preview',
        name: name.trim() || 'Your program name',
        description: description.trim() || null,
        enrollmentOpen,
        status: 'active',
        thumbnailUrl: coverImagePreview || null,
        campaignCount: 0,
        enrollmentCount: 0,
        niches: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    } as Program;

    const modal = (
        /* Overlay — rendered in a portal so it always sits above everything */
        <div
            className="fixed inset-0 z-[9999] flex animate-fade-in items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
        >
            <div
                className="flex max-h-[92dvh] w-full max-w-[980px] animate-scale-in flex-col overflow-hidden rounded-[28px] border border-border bg-background shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* ── Header: title on a warm wash, and the builder's "N left / Ready" progress pill ── */}
                <div className="relative shrink-0 overflow-hidden border-b border-border bg-card px-6 py-5">
                    <span aria-hidden className="pointer-events-none absolute -left-10 -top-20 h-48 w-72 rounded-full bg-brand/25 blur-3xl" />
                    <div className="relative flex items-center gap-3">
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand text-black shadow-[0_6px_18px_-6px_rgb(250_203_3_/_0.9)]">
                            <Layers className="h-5 w-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Programs · New</p>
                            <h2 className="font-display text-xl font-semibold leading-tight tracking-tight">Create a program</h2>
                        </div>
                        <span className="hidden h-9 shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs text-muted-foreground shadow-sm sm:flex">
                            {ready ? (
                                <span className="grid h-5 w-5 animate-pop place-items-center rounded-full bg-foreground text-background">
                                    <Check className="h-3 w-3 stroke-[3]" />
                                </span>
                            ) : (
                                <ProgressRing done={requiredDone} total={2} />
                            )}
                            {ready
                                ? <span className="font-medium text-foreground">Ready</span>
                                : <><span className="font-semibold tabular-nums text-foreground">{2 - requiredDone}</span> left</>}
                        </span>
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={busy}
                            aria-label="Close"
                            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border bg-card text-muted-foreground transition-all duration-200 hover:rotate-90 hover:border-foreground hover:text-foreground disabled:opacity-50"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* ── Body: form tiles on the left, live card preview on the right ── */}
                <div className="flex min-h-0 flex-1 gap-5 overflow-y-auto bg-secondary/40 p-5">
                    <div className="grid min-w-0 flex-1 grid-cols-12 content-start gap-4">
                        <Tile icon={PenLine} title="Program identity" description="The name and story creators see first." className="[animation-delay:60ms]">
                            <Field label="Program name" htmlFor="program-name" required error={errors.name}>
                                <div className="relative">
                                    <input
                                        id="program-name"
                                        autoFocus
                                        autoComplete="off"
                                        maxLength={60}
                                        type="text"
                                        value={name}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setName(val);
                                            const duplicate = existingPrograms.find(p => p.name.trim().toLowerCase() === val.trim().toLowerCase() && p.status !== 'archived');
                                            if (duplicate) {
                                                setErrors(p => ({ ...p, name: 'A program with this name already exists in your brand portal.' }));
                                            } else if (errors.name) {
                                                setErrors(p => ({ ...p, name: undefined }));
                                            }
                                        }}
                                        placeholder={namePlaceholder}
                                        className={cn(fieldClass, 'h-11 pr-16', fieldBorder(Boolean(errors.name)))}
                                    />
                                    <Counter length={name.length} max={60} className="right-4 top-1/2 -translate-y-1/2" />
                                </div>
                            </Field>

                            <Field label="Description" htmlFor="program-description" required error={errors.description}>
                                <div className="relative">
                                    <textarea
                                        id="program-description"
                                        maxLength={PROGRAM_DESCRIPTION_MAX}
                                        value={description}
                                        onChange={(e) => { setDescription(e.target.value); if (errors.description) setErrors((p) => ({ ...p, description: undefined })); }}
                                        placeholder="What is this program about? Give influencers a clear idea of the goals."
                                        className={cn(fieldClass, 'block h-[112px] resize-none pb-8 pt-3 leading-6', fieldBorder(Boolean(errors.description)))}
                                    />
                                    <Counter length={description.length} max={PROGRAM_DESCRIPTION_MAX} className="bottom-2.5 right-4" />
                                </div>
                            </Field>
                        </Tile>

                        <Tile icon={ImageIcon} title="Cover image" description="16:9 works best · PNG, JPG or WEBP up to 5MB." optional className="[animation-delay:120ms]">
                            {coverImagePreview ? (
                                <div className="group/cover relative aspect-[16/7] overflow-hidden rounded-2xl border border-border">
                                    <img src={coverImagePreview} alt="Cover preview" className="h-full w-full object-cover transition-transform duration-700 group-hover/cover:scale-105" />
                                    <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                                    <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2">
                                        <span className="min-w-0 truncate rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-md">
                                            {coverImageFile?.name}
                                        </span>
                                        <span className="flex shrink-0 gap-1.5">
                                            <label className="flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-white/90 px-3 text-xs font-semibold text-foreground backdrop-blur transition-colors hover:bg-white">
                                                <input type="file" className="hidden" accept="image/png, image/jpeg, image/webp" onChange={handleImageSelect} />
                                                <RefreshCw className="h-3.5 w-3.5" /> Replace
                                            </label>
                                            <button
                                                type="button"
                                                onClick={() => { setCoverImageFile(null); setCoverImagePreview(''); }}
                                                className="flex h-8 items-center gap-1.5 rounded-full bg-white/90 px-3 text-xs font-semibold text-foreground backdrop-blur transition-colors hover:bg-white hover:text-[#E50914]"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" /> Remove
                                            </button>
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <label
                                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                                    onDragLeave={() => setDragging(false)}
                                    onDrop={(e) => { e.preventDefault(); setDragging(false); acceptImage(e.dataTransfer.files?.[0]); }}
                                    className={cn(
                                        'group/drop flex aspect-[16/6] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed text-center transition-all duration-200',
                                        errors.coverImage ? 'border-destructive' : dragging ? 'border-foreground bg-brand/15' : 'border-border bg-card hover:border-foreground/40 hover:bg-brand/[0.06]',
                                    )}
                                >
                                    <input type="file" className="hidden" accept="image/png, image/jpeg, image/webp" onChange={handleImageSelect} />
                                    <span className={cn('grid h-11 w-11 place-items-center rounded-full transition-all duration-300 group-hover/drop:-translate-y-0.5', dragging ? 'bg-brand text-black' : 'bg-brand/15 text-foreground ring-1 ring-brand/40 group-hover/drop:bg-brand')}>
                                        <UploadCloud className="h-5 w-5" />
                                    </span>
                                    <span className="text-[13px] font-semibold">{dragging ? 'Drop to upload' : 'Drag an image here, or click to browse'}</span>
                                    <span className="text-xs text-muted-foreground">Shown at the top of the program card</span>
                                </label>
                            )}
                            <ErrorText message={errors.coverImage} />
                        </Tile>

                        <Tile icon={Users} title="Enrollment" description="Who can join this program." className="[animation-delay:180ms]">
                            <div className="grid gap-2 sm:grid-cols-2">
                                <OptionCard
                                    icon={Globe}
                                    title="Open enrollment"
                                    description="Creators can discover and apply"
                                    selected={enrollmentOpen}
                                    onSelect={() => setEnrollmentOpen(true)}
                                />
                                <OptionCard
                                    icon={Lock}
                                    title="Invite only"
                                    description="You add creators yourself"
                                    selected={!enrollmentOpen}
                                    onSelect={() => setEnrollmentOpen(false)}
                                />
                            </div>
                            <Note key={String(enrollmentOpen)}>
                                {enrollmentOpen
                                    ? 'The program shows an “Enrolling” badge and creators can apply right away. You can close it any time.'
                                    : 'The program stays hidden from creators. Add them to its campaigns yourself; you can open enrollment later.'}
                            </Note>
                        </Tile>
                    </div>

                    {/* Live preview — the card as it will look in the programs list. */}
                    <aside className="sticky top-0 hidden w-[300px] shrink-0 self-start animate-fade-up [animation-delay:200ms] lg:block">
                        <div className="mb-2 flex items-center justify-between px-1">
                            <div>
                                <p className="text-sm font-semibold leading-5">Live preview</p>
                                <p className="text-xs leading-4 text-muted-foreground">Updates as you type</p>
                            </div>
                            <span className="flex items-center gap-1.5 rounded-full bg-card px-2 py-1 text-[10px] font-semibold text-muted-foreground shadow-sm">
                                <span className="relative flex h-1.5 w-1.5">
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand" />
                                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand" />
                                </span>
                                Live
                            </span>
                        </div>
                        <div className="pointer-events-none select-none" aria-hidden>
                            <ProgramCard program={previewProgram} />
                        </div>
                        <ul className="mt-4 space-y-2 rounded-2xl border border-border bg-card p-3.5 text-xs text-foreground/80">
                            <li className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />Add campaigns to it as phases after creating.</li>
                            <li className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />Enrolled creators can be picked for every phase.</li>
                        </ul>
                    </aside>
                </div>

                {/* ── Footer: the builder's step navigation look ── */}
                <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border bg-card px-6 py-4">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={busy}
                        className="flex h-10 items-center gap-1.5 rounded-full px-4 text-[13px] font-medium text-foreground/80 transition-colors hover:bg-secondary disabled:opacity-40"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleCreate}
                        disabled={busy}
                        className="group flex h-11 items-center gap-2 rounded-full bg-brand px-6 text-sm font-bold text-black shadow-card transition-all hover:-translate-y-0.5 hover:shadow-float active:translate-y-0 active:scale-[0.98] disabled:translate-y-0 disabled:opacity-60"
                    >
                        {busy ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                {isUploading ? 'Uploading cover…' : 'Creating…'}
                            </>
                        ) : (
                            <>
                                <Sparkles className="h-4 w-4 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110" />
                                Create program
                                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );

    return createPortal(modal, document.body);
}

// ─── Programs List Page ───────────────────────────────────────────────────────

export default function ProgramsListPage() {
    const [params, setParams] = useSearchParams();
    const [showCreate, setShowCreate] = useState(false);
    const [page, setPage] = useState(1);
    const limit = 12; // 12 divides the 1/2/3/4-column grid, so the last row is always full — matches every other list page
    const agentOnly = params.get('agentOnly') === 'true';

    const user = useAuthStore(s => s.user);
    const isBrandOwner = user?.role === 'brand_owner';
    // Program creation requires a complete brand profile incl. a connected social account.
    const { requireCompleteProfile } = useProfileGate();
    const openCreate = () => {
        if (!requireCompleteProfile()) return;
        setShowCreate(true);
    };

    const { data, isLoading, error } = usePrograms({ page, limit, agentOnly: agentOnly ? 'true' : undefined });
    // Keep enrollment counts on the cards live as influencers enrol.
    useProgramEnrollmentRealtime();
    const programsList = (data as any)?.data ?? [];
    const meta = (data as any)?.meta;

    const totalPages = meta ? (meta.totalPages ?? Math.ceil(meta.total / limit)) : 1;

    // Helper to generate the pagination range with ellipsis
    const getPaginationRange = (currentPage: number, total: number) => {
        const delta = 2;
        const range: number[] = [];
        const rangeWithDots: (number | '...')[] = [];
        let l: number | undefined;

        for (let i = 1; i <= total; i++) {
            if (i === 1 || i === total || (i >= currentPage - delta && i <= currentPage + delta)) {
                range.push(i);
            }
        }

        for (const i of range) {
            if (l !== undefined) {
                if (i - l === 2) {
                    rangeWithDots.push(l + 1);
                } else if (i - l > 2) {
                    rangeWithDots.push('...');
                }
            }
            rangeWithDots.push(i);
            l = i;
        }

        return rangeWithDots;
    };

    const paginationRange = getPaginationRange(page, totalPages);

    return (
        <div className="w-full animate-fade-in">
            {/* Same header motion as the dashboard, Influencers and Campaigns: the trail slides in,
                the title rises, the info icon pops, then the subtitle and the buttons fade up. */}
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div className="min-w-0">
                    <p className="flex animate-slide-in-left items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground [animation-delay:80ms]">
                        Programs <ChevronRight className="h-3 w-3" />
                        <span className="text-foreground">{agentOnly ? 'Agents created' : 'All programs'}</span>
                    </p>
                    <h1 className="flex flex-wrap items-center gap-x-[0.28em] font-display text-2xl font-semibold leading-8 tracking-tight sm:text-[28px]">
                        <span className="-mb-1.5 overflow-hidden pb-1.5">
                            <span className="block animate-rise [animation-delay:150ms]">Programs</span>
                        </span>
                        <span className="ml-1 inline-flex animate-pop [animation-delay:400ms]">
                            <InfoTooltip
                                text="Always-open campaigns influencers can enroll in any time. See the card below for how programs work."
                                side="bottom"
                                iconClassName="h-3.5 w-3.5"
                            />
                        </span>
                    </h1>
                    <p className="mt-1.5 animate-fade-up text-sm text-muted-foreground [animation-delay:320ms]">
                        Group your campaigns into multi-phase programs and let influencers enroll directly
                    </p>
                </div>
                <div className="flex animate-fade-up flex-wrap items-center gap-2 [animation-delay:200ms]">
                    <HireManagerButton className="h-10 gap-2 rounded-full border-border bg-card px-4 text-sm font-medium shadow-sm transition-colors hover:border-foreground hover:bg-card" />
                    <button
                        id="create-program-btn"
                        type="button"
                        onClick={openCreate}
                        className="flood-btn group/create flex h-10 items-center gap-2 rounded-full bg-foreground pl-1.5 pr-4 text-sm font-semibold text-background shadow-card duration-300 hover:shadow-float"
                    >
                        <span className="flood-btn-icon grid h-7 w-7 place-items-center rounded-full bg-brand text-black">
                            <Plus className="h-4 w-4 transition-transform duration-300 group-hover/create:rotate-90" />
                        </span>
                        <span className="flood-btn-label">New program</span>
                    </button>
                </div>
            </div>

            <PageExplainer
                label="What is a Program?"
                description="A Program is an always-open campaign. Once enrollment is on, influencers can apply any day — new applications keep coming in. You review them at your own pace, then pick whichever ones you like and group them together to start a new campaign."
                dismissKey="mutiny:explainer:programs"
                steps={[
                    { icon: ToggleRight, title: '1. Open enrollment', description: 'Turn enrollment on so influencers can discover and apply.', motion: 'toggle' },
                    { icon: Inbox, title: '2. Daily applications', description: 'New enrollments arrive continuously — no fixed deadline.', motion: 'inbox' },
                    { icon: Layers, title: '3. Group into a campaign', description: 'Pick the enrollments you want and start a campaign with them.', motion: 'stack' },
                ]}
            />

            {/* Status Tabs */}
            <div className="flex items-center gap-1 mb-6 border-b border-border overflow-x-auto scrollbar-hide">
                <button
                    onClick={() => {
                        const newParams = new URLSearchParams(params);
                        newParams.delete('agentOnly');
                        setParams(newParams);
                        setPage(1);
                    }}
                    className={cn(
                        'px-4 py-2.5 text-sm font-medium transition-premium relative whitespace-nowrap shrink-0 flex items-center gap-2',
                        !agentOnly
                            ? 'text-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                    )}
                >
                    All
                    {!agentOnly && (
                        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#fedc03]" />
                    )}
                </button>
                {isBrandOwner && (
                    <button
                        onClick={() => {
                            const newParams = new URLSearchParams(params);
                            newParams.set('agentOnly', 'true');
                            setParams(newParams);
                            setPage(1);
                        }}
                        className={cn(
                            'px-4 py-2.5 text-sm font-medium transition-premium relative whitespace-nowrap shrink-0 flex items-center gap-2',
                            agentOnly
                                ? 'text-foreground'
                                : 'text-muted-foreground hover:text-foreground'
                        )}
                    >
                        <Users className="w-3.5 h-3.5" />
                        Agents Created
                        {agentOnly && (
                            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#fedc03]" />
                        )}
                    </button>
                )}
            </div>

            {isLoading && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {/* Skeletons shaped like the deck cards, one per item a page holds. */}
                    {Array.from({ length: limit }, (_, i) => (
                        <div key={i} className="pt-3">
                            <div className="rounded-[24px] border border-border bg-card p-1.5">
                                <div className="h-32 animate-pulse rounded-[19px] bg-secondary" />
                                <div className="px-1.5 pb-0.5 pt-2.5">
                                    <div className="h-3 w-4/5 animate-pulse rounded-full bg-secondary" />
                                    <div className="mt-2 h-3 w-1/2 animate-pulse rounded-full bg-secondary" />
                                    <div className="mt-3 h-12 animate-pulse rounded-xl bg-secondary" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {error && !isLoading && (
                <div className="flex items-center justify-center min-h-[40vh]">
                    <p className="text-sm text-destructive">Failed to load programs. Please try again.</p>
                </div>
            )}

            {!isLoading && !error && (
                programsList.length === 0 ? (
                    <EmptyState
                        icon={TrendingUp}
                        title="No programs yet"
                        description="Create your first program to group campaigns into phases and let influencers enroll directly."
                        action={{
                            label: "Create Program",
                            onClick: openCreate
                        }}
                    />
                ) : (
                    <div className="flex flex-col gap-6">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {programsList.map((program: Program, i: number) => (
                                <ProgramCard key={program.id} program={program} className={CARD_DELAYS[Math.min(i, CARD_DELAYS.length - 1)]} />
                            ))}
                        </div>

                        {/* Pagination Controls */}
                        {totalPages > 1 && (
                            <div className="relative flex flex-col sm:flex-row items-center justify-center gap-4 mt-6 pt-4 border-t border-border/60">
                                <p className="text-xs text-muted-foreground sm:absolute sm:left-0">
                                    Showing {((page - 1) * limit) + 1}–{Math.min(page * limit, meta?.total ?? 0)} of {meta?.total ?? 0} programs
                                </p>
                                <div className="flex items-center gap-1.5">
                                    <button
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        disabled={page === 1 || isLoading}
                                        className="flex items-center justify-center w-8 h-8 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                        title="Previous Page"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>

                                    <div className="flex items-center gap-1">
                                        {paginationRange.map((p, idx) =>
                                            p === '...' ? (
                                                <span key={`ellipsis-${idx}`} className="w-8 h-8 flex items-center justify-center text-xs text-muted-foreground font-medium select-none">
                                                    …
                                                </span>
                                            ) : (
                                                <button
                                                    key={p}
                                                    onClick={() => setPage(p as number)}
                                                    disabled={isLoading}
                                                    className={cn(
                                                        'flex items-center justify-center w-8 h-8 rounded-lg border text-xs font-semibold transition-all',
                                                        page === p
                                                            ? 'border-[#fedc03] bg-[#fedc03] text-black shadow-xs'
                                                            : 'border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary'
                                                    )}
                                                >
                                                    {p}
                                                </button>
                                            )
                                        )}
                                    </div>

                                    <button
                                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                        disabled={page === totalPages || isLoading}
                                        className="flex items-center justify-center w-8 h-8 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                        title="Next Page"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )
            )}

            {showCreate && <CreateProgramModal onClose={() => setShowCreate(false)} existingPrograms={programsList} />}
        </div>
    );
}
