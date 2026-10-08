# Other Modules: Profile, Notifications, Settings

---

## Profile Module

**Route:** `/profile`
**File:** `modules/profile/ProfilePage.tsx` (~142 lines)

### Sections

| Section | Fields |
|---------|--------|
| Brand Identity | Logo/avatar upload, Brand Name, Brand Type (Product/Service/Food/etc.) |
| Online Presence | Website URL, City/Region |
| Language & Market | Primary Language, Secondary Languages (multi-select, 10+ options) |
| Industry | Multi-select: FMCG, E-Commerce, SaaS, Fashion, Food & Beverage, etc. |
| About | Bio/description textarea |

### Multi-Select Pattern

Profile uses button-based multi-select (not a dropdown):
```typescript
<div className="flex flex-wrap gap-2">
  {OPTIONS.map(opt => (
    <button
      key={opt}
      onClick={() => toggleSelection(opt)}
      className={cn(
        'px-3 py-1.5 rounded-lg text-sm border transition-premium',
        selected.includes(opt)
          ? 'bg-foreground text-background border-foreground'
          : 'border-border hover:border-foreground'
      )}
    >
      {opt}
    </button>
  ))}
</div>
```

### API Endpoints

```typescript
API.profile.get           GET /brand/profile
API.profile.update        PUT /brand/profile
API.profile.uploadAvatar  POST /brand/profile/avatar
```

---

## Notifications Module

**Route:** `/notifications`
**File:** `modules/notifications/NotificationsPage.tsx` (~72 lines)

### Notification Types and Colors

| Type | Color | Icon |
|------|-------|------|
| `application` | Blue | `UserPlus` |
| `script` | Purple | `FileText` |
| `submission` | Green | `Upload` |
| `negotiation` | Orange | `DollarSign` |
| `payment` | Yellow | `CreditCard` |
| `chat` | Teal | `MessageSquare` |
| `system` | Gray | `Bell` |

### Actions

- Click notification → navigate to linked campaign/resource
- Individual "mark as read" → removes yellow unread dot
- "Mark all read" button → clears all unread indicators
- Unread count propagates to Topbar bell badge via `notificationStore`

### API Endpoints

```typescript
API.notifications.list              GET /notifications
API.notifications.markRead(id)      POST /notifications/:id/read
API.notifications.markAllRead       POST /notifications/read-all
```

---

## Settings Module

**Route:** `/settings`
**File:** `modules/settings/SettingsPage.tsx` (~99 lines)

### Tabs

| Tab | Content | Status |
|-----|---------|--------|
| Account | Name, Email, Phone with save button | Functional |
| Security | Password change (current + new + confirm) | Functional UI |
| Notifications | Toggle switches for 6 notification types | Functional UI |
| Billing | Placeholder | Not implemented |

### Notification Preference Toggles

- Campaign Updates
- New Applications
- Script Reviews
- Work Submissions
- Payment Updates
- Chat Messages

Each is a `Switch` component from `@/shared/ui/switch`.

### Notes

- No API connected yet — form changes are UI-only
- Billing tab is a placeholder for future Stripe/payment integration
