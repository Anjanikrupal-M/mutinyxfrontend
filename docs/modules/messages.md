# Module: Messages

> Campaign-scoped chat between brand and influencers.

## Files

| File | Purpose |
|------|---------|
| `MessagesPage.tsx` | 3-column chat layout (172 lines) |

## Route

`/messages`

## Mock Data Used

- `MOCK_MESSAGES` — conversations + message threads

## Layout

```
┌──────────────┬─────────────────────────────┐
│              │                             │
│ Conversation │     Chat Area               │
│    List      │  ┌────────────────────────┐ │
│              │  │ Campaign context bar   │ │
│ [Active]     │  ├────────────────────────┤ │
│  • Conv 1    │  │                        │ │
│  • Conv 2    │  │  Messages timeline     │ │
│              │  │                        │ │
│ [Pending]    │  │                        │ │
│  • Conv 3    │  ├────────────────────────┤ │
│              │  │  Input area            │ │
│ [Archived]   │  └────────────────────────┘ │
│  • Conv 4    │                             │
└──────────────┴─────────────────────────────┘
```

## Conversation Status Rules

| Status | Input | Description |
|--------|-------|-------------|
| `active` | Enabled | Normal messaging |
| `pending` | Locked | Campaign not yet accepted by influencer |
| `archived` | Read-only | Completed/closed campaign |

## Key Types

```typescript
Conversation {
  id: string
  campaignId: string
  campaignName: string
  influencer: { id, name, avatar }
  status: ConversationStatus    // 'active' | 'pending' | 'archived'
  messages: Message[]
  unreadCount: number
  lastMessage: string
  updatedAt: string
}

Message {
  id: string
  sender: 'brand' | 'influencer'
  content: string
  timestamp: string
}
```

## WebSocket Events

- `chat:message` (inbound) → append message to active conversation
- `chat:send` (outbound) → send new message
- `campaign:join` → subscribe to campaign on conversation open
- `campaign:leave` → unsubscribe on close

## API Endpoints

```typescript
API.messages.conversations           GET /messages
API.messages.getConversation(id)     GET /messages/:id
API.messages.sendMessage(id)         POST /messages/:id
```
