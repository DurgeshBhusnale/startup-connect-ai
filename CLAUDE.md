# CLAUDE.md — Startup Connect AI

Project memory for Claude Code. You are helping Durgesh build **Startup Connect AI**, a two-sided AI matching platform for the Indian startup ecosystem. This file is auto-loaded at the start of every session. Read it fully before responding to any prompt.

---

## Project overview

**What we're building:** An AI-driven platform that matches early-stage Indian startup founders with the right investors and mentors. Every match ships with a plain-language explanation ("why this match") so users trust the AI's decisions.

**Who it's for:** Three personas — Founders (raising seed/pre-seed), Investors (angels + micro-VCs), Mentors (sector experts). All three sides use the same app with different views.

**Stage:** Solo build. B.E. final-year project + intended future startup. Currently in Week 1 of a 6-week MVP sprint. First 5 real beta users onboarded by end of Week 6.

**Full context lives in `/docs`:**
- `StartupConnectAI_Research_Report.docx` — market research, competitor analysis, literature review, design decisions
- `StartupConnectAI_Business_Architecture.docx` — actors, MoSCoW use cases, 3 named personas, journeys, monetization
- `StartupConnectAI_Wardley_Mapping.docx` — build/buy decisions (W1–W15) — the strategic constitution
- `StartupConnectAI_Technical_Architecture.docx` — system design, data model, ML pipeline, deployment topology, cost projections
- `StartupConnectAI_PRD.docx` — engineer-executable user stories with acceptance criteria for M1–M10 (MUST) and S1–S9 (SHOULD)
- `StartupConnectAI_UI_Design_Brief.docx` — design system + Stitch prompts for all 28 screens (S-01 to S-28)
- `StartupConnectAI_6Week_Sprint_Plan.docx` — week-by-week build calendar

**When user references a story ID (M1–M10, S1–S9) or screen ID (S-01 to S-28)**, look it up in the PRD / UI Design Brief in `/docs` before implementing. Do NOT guess acceptance criteria from memory — read the actual document.

---

## Tech stack (LOCKED — do not suggest alternatives unless asked)

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS 3 | Modern React with SSR for SEO on landing pages (moved off 14: unpatched critical CVEs) |
| Auth | Clerk (hosted) | LinkedIn + Google + email OAuth, MFA, sessions handled |
| Backend API | FastAPI (Python 3.12) | Single process for v1; extract to services later |
| Primary DB | Supabase Postgres | Managed; RLS policies for auth |
| Vector DB | Qdrant Cloud (1GB free tier) | Semantic search + matching |
| Object storage | Cloudflare R2 | S3-compatible, cheap egress |
| Job queue | Upstash Redis + BullMQ (or RQ for Python) | Managed |
| LLM (primary) | Groq (`openai/gpt-oss-120b`; Groq retired Llama 3.1-70b in Jan 2025 and 3.3-70b in Jun 2026) | Fastest inference; OpenAI-compatible API |
| LLM (fallback) | OpenAI GPT-4o-mini / Anthropic Claude | For when Groq is down |
| Embeddings | sentence-transformers/all-MiniLM-L6-v2 (384-dim) | Small, fast, MTEB leader for its size |
| Frontend deploy | Vercel (Pro tier when needed) | Auto-deploys on push |
| Backend deploy | Railway | Managed containers |
| Email | SendGrid or Resend | Transactional email |
| WhatsApp | 360dialog (BSP) | Not v1 — deferred to Week 7+ |

**Wardley decisions to respect (from Wardley Mapping doc W1–W15):**
- W1: DO NOT build our own vector DB — Qdrant only
- W2: DO NOT train our own embedding model — sentence-transformers only
- W3: DO NOT build our own auth — Clerk only
- W4: DO NOT build our own chat/messaging SDK — deferred to v1.1
- W5: DO NOT build our own scheduler — Cal.com embed when needed
- W6: WE WILL build matching engine end-to-end in-house (this is the moat)
- W7: WE WILL build explanation generator with our own prompt templates
- W11: STANDARDISE on OpenAI-compatible LLM API spec — swap providers via env var

---

## Repository structure

```
/
├── apps/
│   ├── web/                    # Next.js frontend
│   │   ├── app/                # App Router pages
│   │   ├── components/         # React components
│   │   ├── lib/                # Client utilities
│   │   └── public/             # Static assets
│   └── api/                    # FastAPI backend
│       ├── app/
│       │   ├── main.py         # FastAPI entrypoint
│       │   ├── routers/        # API routes grouped by domain
│       │   ├── services/       # Business logic (profile, matching, explanation)
│       │   ├── models/         # Pydantic + SQLAlchemy models
│       │   ├── db/             # DB session, migrations
│       │   ├── workers/        # Async job handlers
│       │   └── config.py       # Env var loader
│       ├── tests/
│       └── requirements.txt
├── docs/                       # All strategy + design docs (read-only reference)
├── supabase/
│   └── migrations/             # SQL migration files
├── designs/                    # Stitch/Figma exports (S-XX.png)
├── .env.example
├── .gitignore
├── CLAUDE.md                   # this file
└── README.md
```

**Directory conventions:**
- Keep frontend and backend separated — deploy targets are different (Vercel vs Railway)
- No monorepo tool needed for v1 — simple folder split
- Migrations in `/supabase/migrations` with timestamped filenames (Supabase CLI convention)
- Never commit `.env` — only `.env.example` with placeholder values

---

## Coding conventions

### Frontend (Next.js + TypeScript)
- **App Router only** (no Pages Router)
- **Server Components by default**; add `"use client"` only when interactivity is needed
- **Tailwind** for all styling — no CSS-in-JS, no separate .css files except globals
- **Design tokens** in `apps/web/lib/design-tokens.ts` — import colors from there, never hardcode hex values
- **Types:** strict mode ON; no `any` unless explicitly justified in a comment
- **Component naming:** PascalCase for components, camelCase for utilities, kebab-case for files (`match-card.tsx`)
- **Imports order:** external libs → internal absolute imports (`@/lib/…`) → relative imports → types
- **API calls** use a thin fetch wrapper in `lib/api.ts` — never call `fetch` directly from components
- **Auth screens:** Clerk `<SignIn>` / `<SignUp>` rendered inside our S-02 card (styled via `components/auth/clerk-appearance.ts`). Role + DPDP consent are captured on `/onboarding` right after sign-up, then written by the API to `users`, `profiles`, `consent_log`
- **Icons:** inline SVGs in `components/icons.tsx` (no icon library)

### Backend (FastAPI + Python)
- **Python 3.12**, `ruff` for linting, `mypy` in strict mode
- **Pydantic v2** for request/response models — never accept raw dicts
- **Async everywhere** unless the underlying library forces sync
- **Naming:** snake_case for everything except Pydantic model classes (PascalCase)
- **Routers organized by domain:** `/routers/profiles.py`, `/routers/matches.py`, `/routers/intros.py`
- **Services separated from routers:** business logic in `services/`, HTTP concerns in `routers/`
- **JWT verification:** middleware validates Clerk JWT on every non-webhook request; `request.state.user_id` available to handlers
- **Errors:** RFC 7807 problem+json format; never leak internal error details in production

### Database (Supabase Postgres)
- **All primary keys are UUIDs** (`gen_random_uuid()`)
- **All timestamps are `timestamptz`** (UTC)
- **RLS enabled** on every user-owned table
- **JSONB** for flexible fields (e.g., `profiles.l1_data`) — not EAV or nullable-column soup
- **Indexes:** always index foreign keys and `created_at`/`occurred_at` columns queried in ORDER BY

---

## Design system (locked — revised 2026-09-13, supersedes the original teal/mint palette)

### Colors (use hex codes exactly)
| Token | Hex | Usage |
|---|---|---|
| Ink | `#0B0F19` | Primary text, primary buttons, high-contrast dark footer surfaces |
| Emerald | `#059669` | Brand accents, icons, fills, focus rings, large text only (≥24px, or ≥18.66px bold) |
| Emerald Bright | `#10B981` | Fit-score indicators, verified badge fills, accents on Ink surfaces — never as text on light backgrounds |
| Emerald Deep | `#047857` | Link text and any small emerald text on light backgrounds |
| White | `#FFFFFF` | Main background |
| Slate 50 | `#F8FAFC` | Card backgrounds, subtle sections |
| Slate 100 | `#F1F5F9` | Row bands, hover fills, secondary surfaces |
| Border | `#E2E8F0` | Card borders, dividers |
| Muted | `#64748B` | Metadata, subheaders, input borders — only on White or Slate 50 |
| Alert Red | `#B91C1C` | Errors, destructive actions |
| Alert Amber | `#D97706` | Warnings, low-confidence highlights (borders/icons, not body text) |

**Contrast rules (WCAG AA):** Emerald `#059669` is 3.77:1 on white and Emerald Bright `#10B981` is 2.54:1, so neither may be used for normal-size text on light backgrounds; use Emerald Deep (5.48:1). Muted drops to 4.34:1 on Slate 100, so keep it off that surface. Input borders use Muted, not Border, to meet the 3:1 non-text contrast minimum.

### Typography
- **Headings:** Georgia (serif) — H1 32px, H2 24px, H3 20px, H4 16px. Landing hero (S-01) only: 48–56px.
- **Body:** Inter (sans-serif) — 16px base, 14px small, 12px meta
- **Mono:** JetBrains Mono — for system metrics, code, API endpoints, IDs

### Spacing scale
`4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96` (px) — do not use values outside this scale.

### Radii & elevation
Cards 8px · Buttons & inputs 6px · Badges 4px · Modals 12px
Elevation: two levels only — flat (default) and card (`0 1px 3px rgba(0,0,0,0.06)`)

### Components (Tailwind classes — token names map to `lib/design-tokens.ts` via `tailwind.config.ts`; never use arbitrary hex like `bg-[#...]`)
- **Primary button:** `bg-ink text-white px-4 py-3 rounded-md hover:opacity-90`
- **Secondary button:** `bg-white border border-ink text-ink px-4 py-3 rounded-md`
- **Ghost button:** `text-emerald-deep px-4 py-3 hover:bg-slate-50 rounded-md`
- **Cards:** `bg-white border border-line rounded-lg p-6 shadow-card`
- **Inputs:** `border border-muted rounded-md px-3 py-3 focus:ring-2 focus:ring-emerald/30`
- **Footer:** `bg-ink text-white`

---

## Workflow rules

### Before starting any story
1. Read the story in the PRD (`docs/StartupConnectAI_PRD.docx` — story IDs M1–M10, S1–S9)
2. Read the referenced screens in the UI Design Brief (S-01 to S-28)
3. Confirm with me what's included / excluded before writing code

### During implementation
- **One story at a time.** Don't jump between M1 and M3 in the same session.
- **Ship a working version before polishing.** Get the happy path working end-to-end, then handle edge cases.
- **Test with real-looking data** (use the personas Riya/Aditya/Meera from the PRD) — never lorem ipsum.
- **Commit often** with story ID prefix: `[M1] add pitch deck upload endpoint`
- **Ask before adding dependencies.** Every new npm/pip package needs justification.

### When stuck
- Search the docs first. Answers to design questions almost always exist in Business Architecture or PRD.
- If a Wardley decision (W1–W15) blocks a natural implementation choice, respect the Wardley decision and find a workaround — don't override it silently.
- If the PRD is ambiguous, ask me for clarification. Don't make silent assumptions.

### Definition of Done for a story
From PRD Section 8 — all must be true:
1. Every acceptance criterion (AC1, AC2, …) passes by manual test
2. All API endpoints return the documented shape (happy path verified)
3. Edge cases handled OR explicitly deferred with a code comment
4. Analytics events fire with correct properties (once analytics is wired in Week 6)
5. Screens match the design system
6. Mobile web (375px) renders without horizontal scroll
7. Empty, loading, and error states all implemented (not just happy path)
8. Keyboard accessibility baseline met
9. No console errors or warnings in production build
10. Commit message references story ID

---

## Current sprint state

**We are in Week 1 of the 6-week plan.**

**Source of truth:** the PRD. `docs/StartupConnectAI_6Week_Sprint_Plan.docx` has story IDs and themes that contradict the PRD (e.g. it calls M2/M3 "profile management / match generation") — ignore it for scope and story definitions. The Week 1 deliverables below are authoritative.

**Designs:** every screen exists in Google Stitch. Never guess a layout — before building a screen, ask Durgesh which Stitch screen to use and wait for the screenshot.

**Week 1 goal:** By end of week, deploy a working shell where a user can sign up as any of 3 roles and land on their empty dashboard. Nothing else works yet — that's fine.

**Week 1 deliverables:**
- Next.js 15 + TypeScript + Tailwind scaffold, deployed to Vercel
- Clerk auth wired (LinkedIn + Google + email)
- Landing page (S-01) matching Stitch designs
- Sign Up / Sign In page (S-02) with role selector
- Empty app shell — sidebar + top nav (S-09 skeleton)
- Supabase project created, initial schema pushed (users + profiles + investor_thesis + mentor_expertise tables)
- Clean GitHub repo with README

**Status (2026-09-14):** Week 1 screens (S-01, S-02 + role/consent onboarding, S-09 shell) and M1 (S-03, S-04) are built; Vercel/Railway deploy still pending. M2 (S-07), M3 (S-08, S-12), and M6 groundwork (S-10, S-11) and M7 matching (S-13, S-09 top matches), M8 explanations (S-14), M9 feedback + intros (S-13 actions, S-16, S-17, S-22), and M10 privacy (S-23, S-24, S-25, S-28) are built. All MUST stories are in; next are M4/M5 (Week 7+) and S1–S9. Decisions:
- The left-sidebar app shell (S-09) is canonical — ignore top-nav layouts that appear in some Stitch screens.
- LinkedIn and Crunchbase URLs are validated and stored only (no data fetch or import).
- Decks are parsed in memory and never stored; image-only decks fall back to manual entry.
- Onboarding steppers show 2 steps (founder steps 3–4 ship with M5/M4).
- Founders and investors share one sector taxonomy: `apps/api/app/models/taxonomy.py` ↔ `apps/web/lib/taxonomy.ts`.
- Investor prior investments live in the `prior_investments` table; investor settings (hide cheques, Crunchbase URL, banner dismissal) live in `profiles.l1_data`.
- Mentor verification requests (LinkedIn URL or 2 founder reference emails) are stored as `pending` in `profiles.l1_data.verification`; no outreach and no verified badge until M6. S-12 shows no session stats, tabs, or response time until S3/S4/S7/S8 ship.
- M6 ships as groundwork (decided 2026-09-14): `GET /v1/profiles/:id/badges` returns empty `verified_items` / `endorsed_items` until M5 / S8; self-reported claims show "Last updated" after 60 days, using `l1_data.field_updated_at` (founder fields) or table `updated_at` (thesis, expertise). Optional bio (all roles) and website (founders) live in `profiles.l1_data`.
- M7 matching (2026-09-14): MiniLM embeddings of L1 text in Qdrant (embedded on-disk Qdrant when `QDRANT_URL` is blank; Qdrant Cloud when set). Basic filters: founder↔investor sector overlap (minus no-gos), founder↔mentor stage overlap. `content_score` = weighted structured features (sector, stage, cheque, geography) + semantic similarity (`app/services/match_scoring.py`); α = 1.0 until M9 feedback exists; fit < 0.5 hidden. Matches recompute on demand (first view, profile change, > 12h in background, or Refresh). Card explanations are template-based until M8. Display names are cached from Clerk in `users.display_name`. No job queue yet — Upstash/RQ comes when background load needs it.
- M8 explanations (2026-09-14): every scoring signal carries a role-neutral reason, an optional concern, and citations (value + source) in `matches.features`. The LLM only rephrases those signals: items citing unknown signals or numbers absent from the facts are dropped and replaced by the template sentence. Explanations are cached per signals hash in `matches.explanation`; cards show the template until the background LLM pass lands; Match Detail generates inline. Failures retry after 15 minutes. S-14 lives at `/matches/[matchId]` (Overview | Explain this match), visible only through the viewer's own match row. Excluded until their modules ship: Request Intro / Save / Not a Fit (M9), Activity tab (M4/M5), trust badge (S7), "Request to match" on the private state, AI pitch tip / intro draft (M9 S-16).
- M9 feedback + intros (2026-09-15): every save / unsave / not a fit (optional reason) / restore / accept / intro action writes `feedback_events` (no-op repeats are not logged). Saved and hidden matches plus any pair with an intro survive match refreshes. `intro_requests` holds one row per founder ↔ investor/mentor pair: `interested` (partner accepted first) → founder's intro makes it `accepted` (mutual); `pending` (founder asked) → partner accepts (`accepted`) or declines (`declined`, can't be re-sent). Founders request intros to investors and mentors; the partner's own match row is created from the founder's (scoring is symmetric). The S-16 AI draft may only use the founder's L1 facts and match signals (numbers, links, and gendered pronouns are checked); on failure the box starts empty (S5 AC4). ranking alpha stays 1.0 until the collaborative model is trained. Notifications are in-app only (`notifications` table): intro received, mutual match, partner interested, and new matches found by a background refresh. S-22 has no Stitch design; it follows the S-13/S-17 card system at `max-w-feed` (800px). Left out of the screenshots: trust badges (S7), ARR/traction chips, deck attachments, stats cards, "Filter sensitivity", "Archived", SOC2 footers.
- M10 privacy (2026-09-15): consent_log stays append-only; `POST /v1/consent` requires the current policy version (`CONSENT_POLICY_VERSION` ↔ `apps/web/lib/privacy.ts`). Terms & Privacy is locked (withdraw = delete account). Matching consent is withdrawable per the PRD edge case (the brief showed it locked): `users.matching_enabled` mirrors it and hides the profile from matching. Per-topic in-app mutes live in `users.notification_preferences`; email/WhatsApp are consent scopes only until those channels launch. Data export has no email in v1: `POST /v1/me/data-export` then an immediate JSON download through `/settings/privacy/export` (5/day, link valid 1h). Account deletion needs the typed Clerk email, soft-deletes immediately (hidden, pending intros cancelled with a notice), shows `/account-deletion` with Restore for 30 days, then `python -m app.workers.purge_accounts` (schedule a daily Railway cron) deletes the Clerk user, profiles, vectors, and notifications and anonymises the users row (consent_log is kept, FK restrict). Account settings (email, password, 2FA) open Clerk's own profile modal; sessions come from Clerk. Billing is not in the settings nav. S-24/S-28 had no Stitch designs.
- M4 posts (2026-09-15, started ahead of Week 7 at Durgesh's request): founders post Text / Image / Milestone updates (S-15) shown on S-10's Posts tab (Edit/Delete, 20 per page) and on S-14's Updates tab for matched viewers only. Images use **Supabase Storage** (private `post-media` bucket, signed URLs; decided instead of R2, whose keys were placeholders): browser → `POST /v1/media/upload` → Pillow validates, re-encodes (strips EXIF/GPS), makes a thumbnail; posts reference uploads by `media_ids`. Text is moderated with `openai/gpt-oss-safeguard-20b` on Groq against `app/prompts/moderation.py`; image posts and moderation outages publish as `pending_review` (fail open). Deletes are soft; `python -m app.workers.purge_posts` (daily cron) hard-deletes after 30 days and removes unattached uploads after 24h. The 5 latest posts join the founder's embedding text. Left out of the screenshots: drafts, audience selector / "1,420+ angels", "AI Polish", KPI chips, "Verified/Audited metric" labels.
- S3 meetings (2026-09-15, S-19): users save a Cal.com booking link (`profiles.cal_link`, stored as the `user/event` path) in Settings › Account › Scheduling. Mutual matches only (`intro_requests.status = accepted`) get "Schedule a meeting" on S-13/S-14, which opens `/matches/[matchId]/schedule` with the other party's link embedded inline (`@calcom/embed-react`, name/email prefilled). Either party's link works: if only the viewer has one, they share it (in-app `meeting_invite`); if neither does, they add theirs and/or ask the other side (`scheduling_link_request`, once per 24h). The embed's `bookingSuccessfulV2` event is posted to `POST /v1/meetings` (idempotent on the Cal.com booking uid; not verified with Cal.com, and cancellations/reschedules made in Cal.com aren't synced until we add its webhook). Confirmation shows date/time in IST, duration, attendee names, video link, Google Calendar link and .ics. Reminders are in-app at 24h and 1h via `python -m app.workers.meeting_notifications` (schedule a Railway cron every 15 minutes). Left out of the screenshots: allocation target, match score chips, AI prep dossier/session outline, response-time stats, "Verified match", duration chips, "Open in Messages" (S6), attendee emails, "encrypted memo".
- S4 meeting outcomes (2026-09-15, S-20 at `/meetings/[meetingId]/outcome`): each party logs one outcome in `meeting_outcomes` (`great_fit` / `not_a_fit` / `undecided` / `cancelled` = "Meeting didn't happen", which doesn't count against anyone) with optional private notes (≤ 500 chars, never shown to the other party, included in the author's own data export). Re-submitting replaces the earlier answer; conflicting answers from both sides are both kept. The first non-cancelled outcome sets `meetings.completed_at` (the PRD's completed=true). The meetings worker sends an in-app prompt 2h after the meeting ends, a final reminder after 7 days to parties who haven't answered, and after 14 days with no answer from either side sets `meetings.outcome_unknown_at` (a late answer clears it). No weekly retraining job exists yet: outcomes are stored for the collaborative model. Email prompts wait for the email channel.
- S9 ask pins (2026-09-15, no Stitch design; follows the S-10/S-14 card system): founders set one "Currently asking for" line (`profiles.ask_pin`, 1–140 chars after collapsing whitespace, DB check) in a "Your ask" card at the top of My Profile › Edit (`/profile/edit#ask-pin`) via `POST/DELETE /v1/profiles/me/ask-pin`. It shows as an emerald banner above the founder's own profile (with Edit, or a dashed "Pin what you're asking for" prompt when empty) and above S-14 Match Detail for matched investors/mentors (`MatchProfileCard.ask_pin`). The ask isn't part of the embedding text. Milestones (already built in M4) get a soft warning in the composer when the number looks implausible for the milestone type (`lib/milestone-plausibility.ts`); the post still saves.
- S6 messaging (2026-09-15, S-18): Postgres `messages` table (one thread per founder ↔ investor/mentor pair, 1–2000 chars, `client_ref` makes retried sends idempotent, `read_at` for receipts) instead of Sendbird/Stream (W4) at Durgesh's request, with **WebSockets now** rather than the PRD's v1.1 polling. REST: `GET /v1/messages/threads`, `GET /v1/messages/threads/:matchId`, `GET/POST /v1/messages/:matchId` (`limit`, `before`), `POST /v1/messages/:matchId/read`. Realtime: `wss://<api>/v1/ws`; the Clerk session token is sent as the first frame (never in the URL), the origin must be in `CORS_ORIGINS`, clients ping every 25s, and the server closes after 1h so tokens are re-checked. Events: `message.created`, `message.read`. The hub is in-process (`app/services/realtime.py`), so the API must run as one Railway instance until events go through Redis pub/sub. The web `RealtimeProvider` (in AppShell) reconnects with backoff; an open thread polls every 10s only while the socket is down. Writing needs a mutual match (`intro_requests.status = accepted`); if the connection ends, history stays read-only. 20 messages/min per sender. One unread `message_received` notification per conversation (topic "messages"); nav badge counts unread messages. Sent messages are in the data export. Left out of the screenshots: encryption claims, "Online" presence, AI quick prompts, attachments, Archived tab, filters, "Syndicated", "Precision queue" stats, in-thread search (PRD v1.2).
- S7 trust badges (2026-09-15, no Stitch design; follows the brief's badge copy): `python -m app.workers.compute_trust` (schedule a nightly Railway cron) scores each visible profile from the last 180 days: response rate (intros and message turns answered within 7 days, weight 0.5), meeting completion (completed vs outcome_unknown; "didn't happen" isn't counted, 0.25) and follow-through (mutual matches older than 14 days that led to a meeting, 0.25). Weights renormalise over signals with data. Daily raw scores go to `trust_score_history`; `trust_scores.score` is their mean over 30 days. Badges only, never numbers (tables are service-role only): high ≥ 0.75 with median reply ≤ 24h "Highly responsive"; ≥ 0.4 "Usually responds within 24hr" (median ≤ 24h) or "Response time varies"; < 0.4 "Response history: limited" (subtle disclaimer). No badge under 10 interactions. Shown via `MatchProfileCard.trust` on match cards, intro queue cards and S-14 (pill), and `GET /v1/profiles/:id/trust` (owner or matched viewers). Not yet shown on the user's own profile page.
- M5 momentum (paused 2026-09-15 at Durgesh's request; SHOULD stories first): GitHub public activity + Product Hunt launches (needs a developer token) auto-fetched; LinkedIn and Crunchbase stored as links only.
- Tailwind spacing is restricted to the token scale, so off-scale utilities (e.g. `w-40`, `h-5`) silently generate nothing; use fractions (`w-1/2`) or scale values.
- Screenshot sequence for upcoming modules (M3 → M6 → M7 → M8 → M9 → M10, then M4/M5 in Week 7+, then S1–S9) was agreed on 2026-09-14; M4/M5 stay deferred.

**Key change from original plan:** We are NOT using Lovable for scaffolding. Direct Claude Code from Day 1. This saves handoff friction but means Day 1-2 is spent on manual scaffolding instead of AI-generated scaffolding.

---

## What NOT to do

- ❌ Do not suggest tech stack alternatives (the stack is locked from Technical Architecture doc)
- ❌ Do not create Lovable-style components — we're not migrating from Lovable
- ❌ Do not implement L2 momentum aggregator (M5) or L3 posts (M4) in Weeks 1-6 — deferred to Week 7+
- ❌ Do not add WhatsApp or email notifications for v1 — in-app only until Week 7+
- ❌ Do not build custom auth flows — Clerk owns all auth screens
- ❌ Do not use `any` in TypeScript or accept raw dicts in FastAPI
- ❌ Do not hardcode API URLs or secrets — always env vars
- ❌ Do not commit `.env` files
- ❌ Do not skip mobile responsive design — every screen must work at 375px
- ❌ Do not add features not in the current week's plan without discussing first
