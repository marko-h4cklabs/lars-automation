# BlackOps DM Intelligence Platform

AI-powered Instagram DM automation for high-ticket fitness coaching. Handles lead qualification, conversation management, call booking, and team coordination — operating in **autopilot** (fully autonomous AI) or **copilot** (AI-assisted human setter) mode.

Built for 30,000+ DMs/day throughput.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router, TypeScript strict) |
| Database | Supabase (PostgreSQL + Auth + Realtime + RLS) |
| Cache / Queue | Upstash Redis + QStash |
| AI | Claude Sonnet (responses) + Haiku (triage/scoring) |
| DM Integration | ManyChat API (Instagram) |
| Voice | ElevenLabs TTS + OpenAI Whisper STT |
| Notifications | Slack Incoming Webhooks (Block Kit) + In-app (Realtime) |
| Scheduling | Calendly (webhook integration) |
| Frontend | Tailwind CSS, Zustand, TanStack Query, recharts |

---

## Architecture Overview

```
Instagram DM
    |
    v
ManyChat Webhook ──> /api/webhooks/manychat/dm
    |
    v
Rate Limit Check ──> Redis (per-user 60/min, global 500/min)
    |
    v
QStash Queue ──> /api/workers/process
    |
    ├──> Context Assembly (cached settings + KB search + message history)
    ├──> AI Triage (Haiku: classify intent, score lead 0-100)
    ├──> AI Response (Sonnet: generate reply using persona + knowledge base)
    ├──> Lead Stage Update (new → contacted → qualifying → call_offered → booked)
    ├──> ManyChat Send (reply via Instagram DM)
    └──> Notifications (Slack + in-app based on settings)
```

**Additional webhook flows:**
- `/api/webhooks/manychat/story-reply` — Story reply ingestion
- `/api/webhooks/manychat/comment` — Comment tracking
- `/api/webhooks/manychat/follow` — New follower leads
- `/api/webhooks/manychat/keyword` — Keyword trigger matching
- `/api/webhooks/manychat/voice` — Voice message transcription (Whisper)
- `/api/webhooks/calendly` — Call booked confirmation

**Background workers:**
- `/api/workers/process` — Main message processing pipeline
- `/api/workers/autopilot` — Autonomous AI response loop
- `/api/workers/followup` — Scheduled follow-up message delivery
- `/api/workers/summarize` — Conversation summarization
- `/api/workers/notifications` — Notification dispatch

---

## Pages

| Route | Description |
|-------|-------------|
| `/dashboard` | Analytics dashboard with KPIs, charts, funnel, setter performance |
| `/inbox` | Real-time conversation view with AI copilot suggestions |
| `/crm` | Lead pipeline (Kanban + table view) with filters and bulk actions |
| `/knowledge` | Knowledge base management with embedding and retrieval testing |
| `/persona` | AI persona configuration with live preview |
| `/voice` | Voice note templates and ElevenLabs integration |
| `/templates` | Message template library with variable insertion |
| `/learning` | AI learning center — review conversations, provide feedback |
| `/testing` | Conversation simulator for testing AI responses |
| `/settings/*` | Distribution, qualification, keywords, follow-ups, autopilot, copilot, notifications, integrations, team |

---

## Environment Variables

Copy `.env.local.example` to `.env.local` and fill in:

```bash
# ── Supabase ──
NEXT_PUBLIC_SUPABASE_URL=         # Project URL from Supabase dashboard
NEXT_PUBLIC_SUPABASE_ANON_KEY=    # anon/public key
SUPABASE_SERVICE_ROLE_KEY=        # service_role key (server-side only)

# ── AI ──
ANTHROPIC_API_KEY=                # Anthropic API key (Claude)
OPENAI_API_KEY=                   # OpenAI API key (Whisper transcription)

# ── ElevenLabs ──
ELEVENLABS_API_KEY=               # ElevenLabs API key
ELEVENLABS_VOICE_ID=              # Cloned voice ID

# ── Upstash ──
UPSTASH_REDIS_REST_URL=           # Upstash Redis REST URL
UPSTASH_REDIS_REST_TOKEN=         # Upstash Redis REST token
QSTASH_TOKEN=                     # QStash publish token
QSTASH_CURRENT_SIGNING_KEY=       # QStash signature verification
QSTASH_NEXT_SIGNING_KEY=          # QStash next rotation key

# ── ManyChat ──
MANYCHAT_API_KEY=                 # ManyChat API key
MANYCHAT_PAGE_ID=                 # Instagram page ID in ManyChat

# ── Slack ──
SLACK_WEBHOOK_ALERTS=             # Incoming webhook for hot leads + bookings
SLACK_WEBHOOK_SYSTEM=             # Incoming webhook for system alerts (optional, falls back to ALERTS)

# ── Calendly ──
CALENDLY_WEBHOOK_SECRET=          # Calendly webhook signing secret

# ── App ──
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Setup Guide

### 1. Supabase Project

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the migrations in order:
   ```
   lib/database/migrations/001_initial_schema.sql    # Tables, RLS, triggers
   lib/database/migrations/002_match_kb_documents.sql # KB vector search function
   lib/database/migrations/003_analytics_views.sql    # Analytics RPC functions
   lib/database/migrations/004_notification_settings.sql # Notification settings table
   lib/database/migrations/005_performance_indexes.sql   # Performance indexes + materialized views
   lib/database/migrations/006_app_settings_and_storage.sql # App settings KV store + media bucket
   lib/database/migrations/007_auth_user_trigger.sql  # Auto-create user row on auth signup
   ```
3. Enable the **pgvector** extension (required for knowledge base embeddings):
   - SQL Editor → `create extension if not exists vector;`
4. Go to **Settings → API** and copy the URL, anon key, and service role key into `.env.local`
5. Go to **Authentication → URL Configuration** and add your app URL to allowed redirect URLs
6. Enable **Realtime** on these tables (Database → Replication):
   - `messages`
   - `notifications`
   - `conversations`
   - `leads`

### 2. Upstash Redis + QStash

1. Create a Redis database at [upstash.com](https://upstash.com)
2. Copy the REST URL and token into `.env.local`
3. Create a QStash instance in the same Upstash account
4. Copy the QStash token and both signing keys into `.env.local`
5. **QStash Cron Jobs** (set up after deployment):
   ```
   # Follow-up check — every 5 minutes
   URL: https://your-domain.com/api/workers/followup
   Schedule: */5 * * * *
   Method: POST
   Body: {}

   # Conversation summarization — every 15 minutes
   URL: https://your-domain.com/api/workers/summarize
   Schedule: */15 * * * *
   Method: POST
   Body: {}

   # Materialized view refresh — every hour
   URL: https://your-domain.com/api/workers/notifications
   Schedule: 0 * * * *
   Method: POST
   Body: { "event": "refresh_views" }
   ```

### 3. ManyChat Configuration

1. Go to [manychat.com](https://manychat.com) → your Instagram account
2. Get your API key from **Settings → API**
3. Set up **External Request** flows pointing to your deployed webhooks:

   | ManyChat Trigger | Webhook URL | Method |
   |-----------------|-------------|--------|
   | New DM received | `https://your-domain.com/api/webhooks/manychat/dm` | POST |
   | Story reply | `https://your-domain.com/api/webhooks/manychat/story-reply` | POST |
   | Comment on post | `https://your-domain.com/api/webhooks/manychat/comment` | POST |
   | New follower | `https://your-domain.com/api/webhooks/manychat/follow` | POST |
   | Keyword trigger | `https://your-domain.com/api/webhooks/manychat/keyword` | POST |

4. **Expected payload format** (all ManyChat webhooks):
   ```json
   {
     "subscriber_id": "manychat_subscriber_id",
     "instagram_id": "instagram_user_id",
     "username": "their_handle",
     "full_name": "Their Name",
     "profile_pic": "https://...",
     "message": "The DM text content",
     "source": "dm"
   }
   ```
   For keyword triggers, add: `"keyword": "the matched keyword"`
   For story replies, add: `"story_url": "https://..."`

5. **Voice messages**: Configure the voice webhook as a ManyChat Custom Field trigger or use the API to forward audio URLs:
   ```json
   {
     "subscriber_id": "...",
     "instagram_id": "...",
     "username": "...",
     "audio_url": "https://...",
     "source": "voice"
   }
   ```

### 4. ElevenLabs Voice Setup

1. Create an account at [elevenlabs.io](https://elevenlabs.io)
2. Go to **Voice Lab** → **Add Generative or Cloned Voice**
3. Upload 3-5 minutes of clean audio from the coach
4. Copy the API key from **Profile → API Keys**
5. Copy the voice ID from the cloned voice's settings
6. Add both to `.env.local`

### 5. Slack Notifications

1. Go to [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → **From scratch**
2. Go to **Incoming Webhooks** → Enable → **Add New Webhook to Workspace**
3. Select the **alerts channel** (for hot leads + bookings) → Copy URL to `SLACK_WEBHOOK_ALERTS`
4. (Optional) Add another webhook for a **system channel** (offline + AI takeover) → Copy URL to `SLACK_WEBHOOK_SYSTEM`
5. Test from the app: **Settings → Notifications → Test Alerts**

### 6. Calendly Integration

1. Go to [developer.calendly.com](https://developer.calendly.com)
2. Create a webhook subscription pointing to `https://your-domain.com/api/webhooks/calendly`
3. Subscribe to the `invitee.created` event
4. Copy the webhook signing secret to `CALENDLY_WEBHOOK_SECRET`

---

## Development

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Type check
npx tsc --noEmit

# Build for production
npm run build
```

---

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import into Vercel
3. Set all environment variables from `.env.local`
4. Set the **Root Directory** to the project root
5. Build command: `npm run build`
6. Output directory: `.next`

**Important Vercel settings:**
- Function region: `iad1` (or closest to your Supabase region)
- Function timeout: 60s (for AI response generation)

### Post-Deployment Checklist

- [ ] All environment variables set in Vercel
- [ ] Supabase migrations run (001 through 007)
- [ ] Supabase Realtime enabled on `messages`, `notifications`, `conversations`, `leads`
- [ ] ManyChat webhooks pointing to production URLs
- [ ] QStash cron jobs created (followup every 5min, summarize every 15min)
- [ ] Calendly webhook registered
- [ ] Slack webhooks tested from Settings page
- [ ] Supabase Storage `media` bucket exists (created by migration 006, verify in dashboard)
- [ ] First admin user created (sign up → auto-creates user row via trigger 007 → promote to admin)
- [ ] Persona configured in Settings → Autopilot
- [ ] Knowledge base documents uploaded
- [ ] Distribution rules set (round-robin or AI-assigned)

---

## Database Migrations

Run in order via Supabase SQL Editor:

| File | Description |
|------|-------------|
| `001_initial_schema.sql` | Core tables (users, leads, conversations, messages, etc.), RLS policies, triggers |
| `002_match_kb_documents.sql` | pgvector similarity search function for knowledge base |
| `003_analytics_views.sql` | RPC functions for dashboard metrics (daily metrics, setter performance, funnel) |
| `004_notification_settings.sql` | Notification settings table with default row |
| `005_performance_indexes.sql` | Compound indexes, materialized views (mv_daily_metrics, mv_lead_stats), query timeout |
| `006_app_settings_and_storage.sql` | Key-value `app_settings` table for voice/template settings + `media` storage bucket |
| `007_auth_user_trigger.sql` | Auto-insert `public.users` row when a user signs up via Supabase Auth |

---

## Monitoring

### Vercel
- Enable **Analytics** in project settings for Web Vitals
- Check **Functions** tab for cold start times and error rates
- Set up **Alerts** for function errors and high latency

### Supabase
- **Database → Reports** for query performance
- Set up **Alerts** for connection pool exhaustion
- Monitor **Realtime** connections in dashboard

### Upstash
- **Redis → Analytics** for cache hit rates
- **QStash → Logs** for failed job deliveries
- Set up **Alerts** for queue depth > 500

### Application-Level
- AI cost tracking: `audit_log` table with `entity_type = 'ai_usage'`
- Error tracking: `audit_log` table with `entity_type = 'error'`
- Dead letter queue: Redis key `dlq:*` entries (visible in Upstash console)

---

## First-Time Data Seeding

After running migrations and deploying:

1. **Create admin user**: Sign up through the app (migration 007 auto-creates a `users` row with `setter` role), then promote to admin in Supabase SQL Editor:
   ```sql
   UPDATE users SET role = 'admin' WHERE email = 'your@email.com';
   ```

2. **Configure persona**: Go to Settings → Autopilot and fill in the AI persona (name, tone, rules)

3. **Upload knowledge base**: Go to Knowledge → upload FAQ documents, pricing info, objection handling scripts. Click "Embed" to generate vector embeddings.

4. **Set distribution rules**: Settings → Distribution → choose round-robin or AI-assigned

5. **Add qualification fields**: Settings → Qualification → define the fields the AI should collect (budget, timeline, goals, etc.)

6. **Set keyword triggers**: Settings → Keywords → add trigger words and their auto-responses

7. **Configure follow-up sequences**: Settings → Follow-ups → create drip sequences for unresponsive leads

8. **Test the flow**: Go to Testing → simulate a conversation to verify AI responses before going live

---

## Project Structure

```
app/
├── (auth)/login/           # Auth pages
├── (dashboard)/            # Protected dashboard pages
│   ├── dashboard/          # Analytics
│   ├── inbox/              # Conversation management
│   ├── crm/                # Lead pipeline
│   ├── knowledge/          # Knowledge base
│   ├── persona/            # AI persona config
│   ├── voice/              # Voice notes
│   ├── templates/          # Message templates
│   ├── learning/           # AI learning center
│   ├── testing/            # Conversation simulator
│   └── settings/           # All settings pages
├── api/
│   ├── analytics/          # Dashboard data
│   ├── auth/               # Authentication
│   ├── conversations/      # Conversation CRUD + AI suggestions
│   ├── knowledge/          # KB CRUD + embedding + retrieval
│   ├── leads/              # Lead CRUD + timeline
│   ├── learning/           # Learning center data + feedback
│   ├── metrics/            # Live metrics SSE
│   ├── notifications/      # Notification CRUD
│   ├── persona/            # Persona CRUD + preview
│   ├── settings/           # Unified settings API
│   ├── templates/          # Template CRUD + usage tracking
│   ├── testing/            # Conversation simulation
│   ├── voice/              # Voice generation + delivery
│   ├── webhooks/           # ManyChat + Calendly inbound
│   └── workers/            # Background job processors
components/
├── layout/                 # Sidebar, TopBar
├── notifications/          # NotificationBell, NotificationPanel
├── ui/                     # Shared UI components
└── ErrorBoundary.tsx       # React error boundary
lib/
├── ai.ts                   # Claude API wrapper
├── ai-cost.ts              # Token counting + cost tracking
├── cache.ts                # Redis caching layer
├── errors.ts               # Structured error handling
├── manychat.ts             # ManyChat API client
├── notifications.ts        # Notification creation + routing
├── queue-health.ts         # DLQ + queue monitoring
├── rate-limit.ts           # Rate limiting (per-user + global)
├── security.ts             # Env validation + sanitization
├── slack.ts                # Slack webhooks + Block Kit
├── supabase-server.ts      # Server-side Supabase client
├── utils.ts                # Shared utilities
├── workers/
│   └── contextAssembly.ts  # AI context building pipeline
└── database/
    ├── schema.sql           # Full schema reference
    └── migrations/          # Ordered SQL migrations
```

---

## License

Private. All rights reserved.
