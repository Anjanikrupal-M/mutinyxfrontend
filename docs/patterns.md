# Code Patterns — MutinyX

> Validated patterns from the existing codebase. Follow these when adding new code.
> Anti-patterns at the bottom — read these to avoid common mistakes.

---

## 1. Page Component Pattern

Every route-level page follows this exact structure:

```typescript
// src/modules/[module]/pages/MyFeaturePage.tsx

import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/shared/components/PageHeader';
import { Button } from '@/shared/ui/button';
// [module-specific imports]

export default function MyFeaturePage() {
  // ── 1. Router hooks ──────────────────────────────
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  // ── 2. Data (mock today, React Query tomorrow) ───
  const data = MOCK_DATA.find(item => item.id === id);

  // ── 3. Local UI state ───────────────────────────
  const [isModalOpen, setIsModalOpen] = useState(false);
  const activeTab = searchParams.get('tab') ?? 'overview';

  // ── 4. Handlers ─────────────────────────────────
  function handleTabChange(tab: string) {
    setSearchParams({ tab });
  }

  // ── 5. Guard clauses ────────────────────────────
  if (!data) return <NotFoundPage />;

  // ── 6. Render ───────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      <PageHeader
        title={data.name}
        description="Optional subtitle"
        actions={
          <Button onClick={() => setIsModalOpen(true)}>
            Action
          </Button>
        }
      />
      {/* content */}
    </div>
  );
}
```

**Rules:**
- Root div MUST have `max-w-5xl mx-auto animate-fade-in`
- Always use `<PageHeader>` — never raw `<h1>`
- Tab state goes in search params: `?tab=overview` (not useState)
- Guard: check for missing data before main render

---

## 2. Tab Navigation Pattern (URL-Based)

Tabs use `useSearchParams` so they survive page refresh and can be deep-linked.

```typescript
const [searchParams, setSearchParams] = useSearchParams();
const activeTab = searchParams.get('tab') ?? 'overview';

// Render:
<Tabs value={activeTab} onValueChange={(tab) => setSearchParams({ tab })}>
  <TabsList>
    <TabsTrigger value="overview">Overview</TabsTrigger>
    <TabsTrigger value="applications">Applications</TabsTrigger>
  </TabsList>
  <TabsContent value="overview">...</TabsContent>
  <TabsContent value="applications">...</TabsContent>
</Tabs>
```

---

## 3. Card Component Pattern

All data cards follow a consistent visual structure:

```typescript
// Data card with header + content
<div className="bg-card border border-border rounded-xl p-5">
  <div className="flex items-center justify-between mb-4">
    <div>
      <h3 className="font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </div>
    <StatusBadge status={item.status} />
  </div>
  {/* card body content */}
</div>
```

---

## 4. Grid Layout Pattern

Responsive grids always go 1 → 2 → 3 columns:

```typescript
// Standard responsive grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {items.map(item => (
    <ItemCard key={item.id} item={item} />
  ))}
</div>

// 2-column max (for wider content)
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
```

---

## 5. Search + Filter Pattern

Used in CampaignListPage and DiscoverPage:

```typescript
import { useDebounce } from '@/shared/hooks/useDebounce';

// State
const [searchQuery, setSearchQuery] = useState('');
const [activeFilter, setActiveFilter] = useState<string>('all');
const debouncedSearch = useDebounce(searchQuery, 300);

// Filtered data
const filtered = items.filter(item => {
  const matchesSearch = !debouncedSearch ||
    item.name.toLowerCase().includes(debouncedSearch.toLowerCase());
  const matchesFilter = activeFilter === 'all' || item.status === activeFilter;
  return matchesSearch && matchesFilter;
});

// Render
<div className="flex gap-3 mb-6">
  <Input
    placeholder="Search..."
    value={searchQuery}
    onChange={e => setSearchQuery(e.target.value)}
    className="max-w-sm"
  />
  <div className="flex gap-2">
    {FILTER_OPTIONS.map(f => (
      <button
        key={f.value}
        onClick={() => setActiveFilter(f.value)}
        className={cn(
          'px-3 py-1.5 rounded-lg text-sm font-medium transition-premium',
          activeFilter === f.value
            ? 'bg-foreground text-background'
            : 'bg-muted text-muted-foreground hover:bg-muted/80'
        )}
      >
        {f.label}
      </button>
    ))}
  </div>
</div>
```

---

## 6. Modal / Dialog Pattern

Use shadcn Dialog for all modals:

```typescript
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog';

// State: lifted to parent
const [isOpen, setIsOpen] = useState(false);

// Render:
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent className="max-w-lg">
    <DialogHeader>
      <DialogTitle>Modal Title</DialogTitle>
    </DialogHeader>
    {/* modal content */}
    <div className="flex justify-end gap-2 mt-6">
      <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
      <Button onClick={handleConfirm}>Confirm</Button>
    </div>
  </DialogContent>
</Dialog>
```

---

## 7. Status Badge Pattern

Use the `StatusBadge` component — never build custom status pills:

```typescript
import { StatusBadge } from '@/shared/components/StatusBadge';

// For campaign status
<StatusBadge status={campaign.status} />

// For payment status
<StatusBadge status={influencer.paymentStatus} />

// For any custom label
<StatusBadge status="custom-label" />
```

StatusBadge handles 24+ status types and maps them to correct colors.

---

## 8. Stat Card Pattern

Use the `StatCard` component for all metric displays:

```typescript
import { StatCard } from '@/shared/components/StatCard';
import { TrendingUp } from 'lucide-react';

<StatCard
  icon={TrendingUp}
  label="Total Reach"
  value="2.4M"
  trend={{ direction: 'up', value: 12, label: 'vs last month' }}
/>
```

---

## 9. Empty State Pattern

When a list has no items:

```typescript
import { EmptyState } from '@/shared/components/EmptyState';
import { FileSearch } from 'lucide-react';

{items.length === 0 && (
  <EmptyState
    icon={FileSearch}
    title="No campaigns found"
    description="Create your first campaign to get started"
    action={{
      label: 'Create Campaign',
      onClick: () => navigate('/campaigns/create'),
    }}
  />
)}
```

---

## 10. Zustand Store Pattern

```typescript
// src/shared/stores/myStore.ts  (or modules/[x]/stores/myStore.ts)
import { create } from 'zustand';

interface MyState {
  items: Item[];
  isLoading: boolean;
  addItem: (item: Item) => void;
  setLoading: (loading: boolean) => void;
}

export const useMyStore = create<MyState>((set) => ({
  items: [],
  isLoading: false,
  addItem: (item) => set(state => ({ items: [...state.items, item] })),
  setLoading: (isLoading) => set({ isLoading }),
}));

// Usage in component:
const { items, addItem } = useMyStore();
```

---

## 11. Notification Toast Pattern

```typescript
import { toast } from 'sonner';

// Success
toast.success('Campaign launched successfully!');

// Error
toast.error('Failed to save changes. Please try again.');

// Info / loading
const toastId = toast.loading('Saving...');
// Later:
toast.dismiss(toastId);
toast.success('Saved!');
```

---

## 12. Icon Usage Pattern

All icons use Lucide React. Browse at lucide.dev.

```typescript
import { Plus, ChevronRight, ExternalLink, AlertCircle } from 'lucide-react';

// Standard size in text
<Plus className="w-4 h-4" />

// Slightly larger (with button)
<Plus className="w-4 h-4 mr-2" />

// For stat cards / feature icons
<TrendingUp className="w-5 h-5 text-primary" />
```

**Icon sizing convention:**
- `w-3 h-3` → tiny indicators
- `w-4 h-4` → inline with text
- `w-5 h-5` → medium standalone
- `w-6 h-6` → large standalone
- `w-8 h-8` → hero/illustration

---

## 13. Progress Bar Pattern

```typescript
// Tailwind-only progress (with yellow accent)
<div className="w-full bg-muted rounded-full h-1.5 mt-2">
  <div
    className="bg-primary h-1.5 rounded-full transition-all duration-300"
    style={{ width: `${Math.min(campaign.progress, 100)}%` }}
  />
</div>
```

---

## 14. Navigation Pattern

```typescript
import { useNavigate, Link } from 'react-router-dom';

// Programmatic navigation
const navigate = useNavigate();
navigate('/campaigns');
navigate(`/campaigns/${id}`);
navigate(-1); // go back

// Declarative navigation
<Link to={`/campaigns/${campaign.id}`}>
  {campaign.name}
</Link>
```

---

## 15. Conditional Class Pattern (cn utility)

```typescript
import { cn } from '@/lib/utils';

// Conditional classes
<div className={cn(
  'px-3 py-2 rounded-lg transition-premium',
  isActive && 'bg-foreground text-background',
  isDisabled && 'opacity-50 cursor-not-allowed',
  className // always accept and spread external className
)} />
```

---

## 16. Form Pattern (React Hook Form + Zod)

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/shared/ui/form';
import { Input } from '@/shared/ui/input';
import { Button } from '@/shared/ui/button';

const formSchema = z.object({
  name: z.string().min(2, 'Minimum 2 characters'),
  email: z.string().email('Invalid email'),
  budget: z.number().min(100, 'Minimum ₹100'),
});

type FormValues = z.infer<typeof formSchema>;

function MyForm({ onSubmit }: { onSubmit: (data: FormValues) => void }) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', email: '', budget: 0 },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Enter name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Saving...' : 'Save'}
        </Button>
      </form>
    </Form>
  );
}
```

---

## ANTI-PATTERNS — NEVER DO THESE

### ✗ Anti-pattern: Inline mock data in components
```typescript
// WRONG
function MyPage() {
  const campaigns = [
    { id: '1', name: 'Summer Sale', ... },
    { id: '2', name: 'Winter Push', ... },
  ];
}

// CORRECT
import { MOCK_CAMPAIGNS } from '@/mocks/data';
function MyPage() {
  const campaigns = MOCK_CAMPAIGNS;
}
```

### ✗ Anti-pattern: Relative imports across module boundaries
```typescript
// WRONG — breaks module isolation
import { CampaignCard } from '../../campaigns/components/CampaignCard';

// CORRECT — if needed across modules, move to shared/
import { CampaignCard } from '@/shared/components/CampaignCard';
```

### ✗ Anti-pattern: Hardcoded colors
```typescript
// WRONG
<div style={{ color: '#fedc03', backgroundColor: '#0a0a0a' }}>

// CORRECT — use tokens
<div className="text-primary bg-foreground">
```

### ✗ Anti-pattern: Zustand for server data
```typescript
// WRONG — campaigns come from API, use React Query
const campaignStore = create(() => ({ campaigns: [] }));

// CORRECT
const { data: campaigns } = useQuery({ queryKey: ['campaigns'], ... });
```

### ✗ Anti-pattern: Missing page wrapper
```typescript
// WRONG — no animation, no max-width constraint
function BadPage() {
  return <div>{/* content */}</div>;
}

// CORRECT
function GoodPage() {
  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      {/* content */}
    </div>
  );
}
```

### ✗ Anti-pattern: New type duplicating existing one
```typescript
// WRONG — Campaign already exists in shared/types/campaign.ts
interface MyCampaign {
  id: string;
  name: string;
  // ...
}

// CORRECT
import type { Campaign } from '@/shared/types/campaign';
```

### ✗ Anti-pattern: Direct Radix UI import
```typescript
// WRONG — bypasses shadcn abstraction
import * as Dialog from '@radix-ui/react-dialog';

// CORRECT — use shadcn wrapper
import { Dialog, DialogContent } from '@/shared/ui/dialog';
```

### ✗ Anti-pattern: Yellow as large background
```typescript
// WRONG — yellow is accent only
<div className="bg-primary p-8">

// CORRECT — yellow only for small indicators
<div className="border-l-[3px] border-primary pl-3">
<div className="bg-primary h-1.5 w-full rounded-full"> {/* progress bar ok */}
```
