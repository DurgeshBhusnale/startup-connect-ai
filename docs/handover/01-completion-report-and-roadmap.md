# Startup Connect AI: Completion Report & Roadmap

Code state: commit `b06654c` on `main` (GitHub). This report compares the build with the PRD (`docs/StartupConnectAI_PRD.docx`, stories M1–M10 and S1–S9).

**How to read the status column**

| Status | Meaning |
|---|---|
| ✅ Complete | Every acceptance criterion is implemented (small, documented deviations only) |
| 🟡 Complete with deviations | The core user flow works; one or more ACs are replaced or deferred on purpose (listed) |
| 🟠 Partial / groundwork | The data model and UI are ready, but the main value depends on another story |
| ⬜ Not started | No code yet |

**What was verified:** every story was checked with backend integration scripts using the Riya / Aditya / Meera test personas (real Supabase, Groq and Qdrant), plus API lint and type checks (`ruff`, `mypy --strict`), web type-check and lint, and a production `next build`.
**Not verified yet:** signed-in screens clicked through end to end in a browser (use `02-test-plan.md`), and deployment (use `03-technical-handover-and-deployment.md`).

---

## 1. Summary

| ID | Story | Status | Screens |
|---|---|---|---|
| W1 | Foundation: landing, auth, role and consent onboarding, app shell | ✅ | S-01, S-02, S-09 |
| M1 | Founder onboarding with AI profile auto-builder | 🟡 | S-03, S-04 |
| M2 | Investor onboarding with structured thesis | 🟡 | S-07, S-09 |
| M3 | Mentor onboarding with expertise and availability | ✅ | S-08, S-12 |
| M4 | Founder posts: text, image, milestone | 🟡 | S-15, S-10 |
| M5 | Momentum signal aggregator (L2) | ⬜ Paused at your request | S-05, S-10 timeline |
| M6 | Verified vs self-reported badges | 🟠 | S-10, S-11, S-12, S-14 |
| M7 | Hybrid matching engine | 🟡 | S-13, S-09 |
| M8 | Match explanations ("why this match") | ✅ | S-13, S-14 |
| M9 | Match feedback: accept, reject, save, intros | ✅ | S-13, S-16, S-17, S-22 |
| M10 | Private matches and DPDP consent | 🟡 | S-02, S-23, S-24, S-25, S-28 |
| S1 | Video posts | ⬜ Deferred on purpose (needs a video host; impact noted below) | S-15 video tab |
| S2 | RAG semantic search | ✅ | S-21 |
| S3 | Meeting scheduler (Cal.com) | ✅ | S-19 |
| S4 | Meeting outcome tracking | ✅ | S-20 |
| S5 | AI-drafted intro message | ✅ (shipped inside M9) | S-16 |
| S6 | In-app messaging | ✅ (WebSocket, beyond the PRD's polling) | S-18 |
| S7 | Trust & responsiveness badges | ✅ | S-13, S-14, S-17 |
| S8 | Third-party endorsements | ✅ (mutual matches instead of "verified") | S-14, S-10, S-11, S-12 |
| S9 | Milestone cards and ask pins | ✅ | S-15, S-10, S-14 |

Screens not built: **S-05** (connect L2 sources, part of M5), **S-06** (first post in onboarding), **S-26** (billing, PRD says it may defer to v1.2), and the S-15 video tab (S1).

Cross-cutting items not built yet: email and WhatsApp notifications (in-app only, as agreed for v1), an analytics provider (events are only written to API logs), CI pipeline, automated test suite in the repo, error monitoring, production deployment.

---

## 2. Detail by module

### W1: Foundation
**Delivered**
- **S-01 landing and S-02 auth:** landing page, plus Clerk `<SignIn>` / `<SignUp>` inside the S-02 card (email, Google and LinkedIn, depending on Clerk settings).
- **Onboarding `/onboarding`:** role selection (founder, investor or mentor) and DPDP consents, stored in `users`, `profiles` and `consent_log`.
- **S-09 app shell:** left sidebar (canonical), top bar, mobile menu and bottom tabs. Badges for unread notifications, pending intros and unread messages; offline banner.
- **Other pages:** Terms and Privacy pages; 404, 500 and global error pages.
- **API:** FastAPI with Clerk JWT verification on every request, RFC 7807 errors, and `/health`.
- **Database:** Supabase schema with RLS on user-owned tables, 15 migrations.

**Deviation:** consents are collected on `/onboarding` right after Clerk sign-up, not on the Clerk form itself (Clerk owns that form).

### M1: Founder onboarding with AI auto-builder (🟡)
**Delivered**
- **Upload (S-03):** PDF drop zone (20 MB limit, checked on both client and server) and LinkedIn URL input. "Build my profile" with a loading state; "Fill manually instead".
- **Extraction:** the deck is parsed in memory and never stored. Groq extracts startup name, sector, stage, ask, team size, city, business model, top 3 competitors and description, plus a confidence map.
- **Review (S-04):** prefilled fields. Fields below 0.7 confidence get an amber highlight and the "Please verify — auto-extracted with low confidence" tooltip.
- **Failures:** extraction failure or malformed output leads to manual entry with a message. Image-only decks go to manual entry.
- **Stored data:** the raw LLM output is kept in `l1_data.raw_extraction`, and the draft is persisted server-side so a closed tab can resume.
- **Guard:** an existing founder profile redirects to Home.
- **API:** `POST /v1/profiles/autobuild`, `POST /v1/profiles`, `GET /v1/profiles/founder`.

**Deviations and gaps**
- **LinkedIn (AC6):** the URL is validated for format and stored only. LinkedIn data can't be fetched without a partner API, so "profile is private" can't be detected.
- **Steps 3–4 (AC5):** S-05 (connect sources) and S-06 (first post) aren't in onboarding. The stepper shows 2 steps and "Continue" finishes onboarding.
- **Analytics:** events aren't sent to an analytics tool.

**Next scope**
- **v1.1:**
  - add S-05 (together with M5) and S-06 (reusing the M4 composer)
  - send the 5 onboarding analytics events to PostHog
  - retry and backoff metrics for extraction
- **v2 (C1):** LinkedIn OAuth to verify identity.

### M2: Investor onboarding (🟡)
**Delivered**
- **Thesis form (S-07):** shared sector taxonomy, stages, cheque min–max with validation, geographies (India-first) and no-go tags.
- **Prior investments:** add manually (3–10) or skip. The persistent Home banner "Add your prior investments…" stays until dismissed.
- **Home states:** the investor empty state uses the PRD copy.
- **Editing:** prefilled form ("Save changes").
- **Extras:** optional Crunchbase URL and "hide cheque amounts" setting.
- **API:** `POST /v1/investor/thesis`, `POST /v1/investor/prior-investments`, `/skip`, `/onboarding-banner/dismiss`, `GET /v1/investor/profile`.

**Deviations and gaps**
- **AC4:** the Crunchbase URL is stored and shown as a link, but the investment list isn't imported. Crunchbase has no free API; the PRD itself defers this.

**Next scope**
- **v1.1:** Crunchbase import once there's API budget, or CSV import of prior investments.
- **v2 (C2):** investor analytics dashboard.

### M3: Mentor onboarding (✅)
**Delivered**
- **Expertise form:** expertise areas, stage focus, availability (1, 2, 4 or unlimited per month) and optional session fee.
- **Warnings:** "unlimited availability" soft-warning modal, and a soft warning when the fee is above ₹10,000.
- **Verification step:** LinkedIn URL or 2 founder reference emails, stored as `pending`.
- **Home state:** mentor empty state.
- **Profile (S-12):** mentor profile page.
- **API:** `POST /v1/mentor/expertise`, `POST /v1/mentor/verification-request`, `GET /v1/mentor/profile`.

**Gap**
- Verification requests aren't reviewed: there's no admin tool, no email to references, and no verified badge.

**Next scope**
- **v1.1:** an admin review queue (internal page or Supabase dashboard flow). Approval sets a verified mentor badge; after that, switch S8 endorsements to verified-only.

### M4: Founder posts (🟡)
**Delivered**
- **Composer (S-15):** Text, Image and Milestone tabs.
  - Text: 500-character counter (amber below 50, red at 0, hard stop).
  - Image: up to 4 images, 5 MB each, JPG/PNG/WebP, with thumbnails and remove buttons.
  - Milestone: type, value, date and description.
- **Image handling:** `POST /v1/media/upload` → Pillow validates, re-encodes (strips EXIF/GPS) and makes thumbnails → private Supabase Storage bucket `post-media` with signed URLs.
- **Moderation:** text is checked by the Groq `gpt-oss-safeguard-20b` policy model and blocked with the PRD message. If moderation is down, the post publishes as `pending_review` (fail open).
- **Timeline:** Posts tab on My Profile (S-10) with Edit (re-moderated, "Edited" label) and Delete (confirm, soft delete). 20 posts per page. The Updates tab on Match Detail shows posts to matched viewers only.
- **Purge and matching:** the `purge_posts` worker hard-deletes after 30 days. The latest 5 posts are added to the founder's matching embedding.
- **API:** `GET/POST /v1/profiles/me/posts`, `PATCH/DELETE /v1/profiles/me/posts/:id`, `GET /v1/profiles/:id/posts`.

**Deviations**
- Supabase Storage is used instead of Cloudflare R2 (R2 keys were placeholders); images upload through the API.
- Image posts are published as `pending_review` because images aren't scanned yet.
- No video tab, as the PRD requires for v1.

**Next scope**
- **v1.1:** an admin queue for `pending_review` posts, and image moderation (vision model or a service).
- **S1:** video.

### M5: Momentum signal aggregator (⬜ paused)
**Current state:** nothing is built. My Profile shows a "Connected sources / Momentum" placeholder.

**Planned scope (agreed direction)**
- **Sources:**
  - GitHub public activity: commits in the last 30 days, stars, top language (public API).
  - Product Hunt launches in the last 90 days with upvotes (needs a developer token).
  - LinkedIn and Crunchbase stay link-only.
- **Data model:** `momentum_items`, `aggregator_runs` and connected sources per profile.
- **Job:** a nightly worker (`python -m app.workers.aggregate_momentum`).
- **Screens:**
  - Connect-sources step (S-05) plus an equivalent card in settings.
  - Timeline on S-10 and S-14 with source icons and "Verified from [source]".
  - "Include in profile" toggle.
- **Failures:** failed runs are logged; users are notified when a token expires.
- **Matching:** momentum items feed the embedding text.
- **Unlocks:** M6 verified badges.

### M6: Verified vs self-reported badges (🟠)
**Delivered**
- **API:** `GET /v1/profiles/:id/badges`, visible to the owner and matched viewers.
- **Neutral claims (AC2):** self-reported claims show no badge.
- **Stale claims (AC5):** "Last updated [date]" when a claim is older than 60 days, tracked per field.
- **Endorsed badge (AC3):** "Endorsed by [name] (and N others)" is now live through S8, including the "Endorser account inactive" edge case.

**Gaps**
- **AC1 and AC4:** "Verified" badges and the source/date/link tooltip wait on M5 (no external sources yet).
- **AC3 click-through:** endorsers have no public profile page to link to.
- **Analytics:** badge hover and click events aren't sent.

**Next scope**
- **v1.1 (with M5):** verified badges, the "source no longer connected" state, and removing verification when a verified milestone is edited.

### M7: Hybrid matching engine (🟡)
**Delivered**
- **Embeddings:** MiniLM (384-dim) embeddings of profile text stored in Qdrant, embedded locally or Qdrant Cloud.
- **Filters:** founder ↔ investor sector overlap (minus no-gos); founder ↔ mentor stage overlap.
- **Content score:** sector, stage, cheque, geography, prior portfolio, plus semantic similarity. Matches below 0.5 are hidden; up to 8 are shown.
- **Recompute:** on first view, profile change, background refresh after 12 hours, or the Refresh button. Existing rows are updated in place.
- **Screens:** Match List (S-13) with fit %, Recommended and Saved tabs; top matches on Home.
- **States:** fallbacks for incomplete profile, matching paused, service unavailable and no candidates. Degraded mode works without vector scores.
- **Stored columns:** `fit_score`, `content_score`, `collab_score`, explanation and features.
- **API:** `GET /v1/matches`, `POST /v1/matches/recompute`, `GET /v1/matches/:id`.

**Deviations**
- **AC4:** no collaborative model is trained yet, so `collab_score` = 0 and ranking is content-only (α = 1.0). The α switch point exists in code.
- **Filters:** sector and stage filters on S-13 aren't built; the PRD marks them v1.1.
- **Queue:** there's no job queue; recompute runs in the request plus FastAPI background tasks.

**Next scope**
- **v1.1:**
  - Weekly collaborative model trained on `feedback_events` plus meeting outcomes (S4). Turn on α = 0.7 once a user has 10+ feedback events, and only if offline P@10 / NDCG@10 beat the content baseline.
  - Match List filters.
  - An Upstash + RQ queue for recompute.
  - Latency metrics.

### M8: Match explanations (✅)
**Delivered**
- **Grounded rewrite:** each scoring signal carries a reason, an optional concern, and citations from the profile or thesis. The LLM only rephrases those signals.
- **Guards:**
  - Unknown signals, numbers not in the facts, and gendered pronouns are stripped and replaced by template sentences.
  - Short explanations are truncated.
  - If Groq is down, the template explanation is used.
- **Screens:**
  - Cards show the short explanation.
  - S-14 "Explain this match" shows each factor as a bullet plus concerns, with hover tooltips on cited values ("From founder's profile" / "From investor's thesis").
- **Caching:** per signals hash; failures retry after 15 minutes.
- **API:** `GET /v1/matches/:id/explanation`.

**Next scope**
- **v1.1:** send `explanation_generated` / `explanation_viewed_full` to analytics, and add "Was this helpful?" feedback on explanations.

### M9: Match feedback and intros (✅)
**Delivered**
- **Actions on S-13 and S-14:**
  - Founder: Request intro.
  - Investor or mentor: Accept match / Accept intro.
  - Everyone: Save / Unsave, and Not a fit with reasons (wrong sector, stage or geo; not the right person; other; or skip).
  - Hidden cards can be restored.
- **Intro flow:** the intro modal (S-16) opens with an AI-drafted message (S5: regenerate / write from scratch, fact-checked). The intro queue (S-17) lets the partner accept or decline with a reason. Both accept → "Mutual match".
- **Notifications (S-22):** new matches, intro received, mutual match, and interest (partner accepted first).
- **Data:** a `feedback_events` row for every action (no-op repeats deduplicated). 403/404 for someone else's match or a missing one.
- **API:** `POST /v1/matches/:id/action`, `/draft-intro`, `/intro`, `GET /v1/matches/saved`, `GET /v1/intros`, `POST /v1/intros/:id/respond`, and the notifications endpoints.

### M10: Privacy and DPDP (🟡)
**Delivered**
- **Consents:** required Terms/Privacy and matching consent; optional email (default on) and WhatsApp (default off). Stored in an append-only `consent_log` with the policy version.
- **Settings screens:**
  - Settings → Privacy & Data (S-25): consent toggles.
  - Withdrawing matching consent hides the profile and pauses matching, with a notice.
  - Notification topic preferences (S-24, in-app).
  - Account settings (S-23): Clerk email, password, MFA and sessions.
- **Data export:** JSON download of own data (profile, matches, intros, posts, meetings, own outcome notes, sent messages, endorsements), limited to 5 per day.
- **Account deletion:** type your email to confirm → immediate soft delete (hidden, pending intros cancelled, other side notified) → `/account-deletion` page with **Restore** for 30 days → the `purge_accounts` worker deletes the Clerk user, profiles, vectors, storage and notifications (the consent log is kept).
- **Private profiles:** Match Detail, posts, badges and trust are visible only to matched parties; others see "This profile is private". No public deal lists.

**Deviations**
- **AC4:** the export is an immediate download, not an email link within 24 hours (no email channel yet).
- **Restore:** done from the in-app page instead of a magic-link email.
- **AC8:** the "Request to match" button on the private state isn't built.
- **AC7:** the public profile toggle is v1.2 per the PRD.
- **Email and WhatsApp:** stored as consent scopes only; neither channel exists yet.

**Next scope**
- **v1.1:** email channel (Resend or SendGrid) for the export link, restore magic link and notification emails that respect consent; "Request to match".
- **v1.2:** public profile toggle; forced re-consent when the policy version changes (the version check exists).

### S1: Video posts (⬜ deferred on purpose)
**What S1 is.** Founders post short videos on their profile: a 30-second founder intro or a product demo.
- **Upload:** one video per post, up to 90 seconds and 100 MB, MP4/MOV/WebM.
- **Thumbnail:** generated from the first frame, with an option to choose another frame.
- **Playback:** inline, muted by default with tap to unmute, served from a CDN with adaptive bitrate for mobile.
- **Limit:** free founders can keep 3 videos; more needs Founder Pro.
- **Screen and API:** the Video tab in the Compose Post modal (S-15), `POST /v1/media/upload-video`, and posts of `kind: 'video'`.
- **Why it matters:** investors and mentors get a more human sense of the founder and product than text and images give.

**Why it isn't built now.**
- **Hosting decision:** it needs a video host. The PRD suggests **Cloudflare Stream** (upload API, thumbnails, adaptive bitrate, about $1 per 1,000 minutes stored); the alternatives are Mux, or Supabase Storage without transcoding (not recommended).
- **New account and costs:** that means another paid account, keys and running costs.
- **Moderation:** a moderation plan for video.
- **Priority:** the Business Architecture places S1 after text and image posts are proven.

**What happens if S1 isn't completed now.**
- **For users:** nothing breaks. Founders keep posting text, image and milestone updates (M4/S9), and the composer has no Video tab (exactly what the PRD requires for v1), so nothing looks unfinished.
- **Product impact:** profiles are less "human". Founders who pitch better on camera can't show that, which may slightly lower intro acceptance for early-stage founders with thin traction. This is a nice-to-have, not a blocker for matching, intros, meetings or messaging.
- **Business impact:** the "3 free videos, unlimited on Founder Pro" upsell can't be used yet. That's acceptable because billing (S-26) isn't built either.
- **Technical impact:** none.
  - Posts already use a `kind` column (text / image / milestone), so adding `video` later is a small migration plus a new upload endpoint.
  - The composer tabs and timeline cards are built to accept a new kind.
  - No data needs migrating, and existing posts, moderation, purge jobs and privacy export keep working.
- **Cost impact:** you avoid video hosting and moderation costs until there are real users.
- **Risk if left too long:** founders may paste YouTube or Loom links into text posts instead. That's harmless, but those videos can't be moderated or served inline. Plan S1 for v1.1 once founders ask for it.

**Planned scope**
- **Composer:** a Video tab with one video per post (≤ 90 s, ≤ 100 MB, MP4/MOV/WebM), direct upload with progress, and thumbnail choice.
- **API:** `POST /v1/media/upload-video`.
- **Playback:** inline player, muted by default, adaptive streaming.
- **Limits:** 3 videos per founder on the free plan (upgrade prompt once billing exists).
- **Moderation:** manual review queue for video.

### S2: RAG semantic search (✅)
**Delivered**
- **Opening search:** Cmd/Ctrl-K from any page, or the top-bar search, opens the S-21 modal. `/search` is the full-page version used on mobile.
- **Before searching:** role-specific "Try one of these" examples, recent searches (last 5 shown, clearable) and keyboard navigation (↑↓ / ↵ / esc).
- **Query parsing:** `POST /v1/search` runs Groq and a deterministic keyword parser together. Every value is checked against the shared taxonomy, which is also the prompt-injection defence. If the LLM fails, the keywords alone are used, with a note.
- **Ranking:** share of requested attributes matched (sector, stage, geography, expertise, cheque/ask) blended with the semantic similarity of the query to profile embeddings in Qdrant. If Qdrant is down, ranking uses attributes only. Top 50, loaded 8 at a time.
- **Results:** each shows role, headline, a grounded fit summary and matched-attribute chips citing their source ("investor's thesis", "founder's profile", "mentor's expertise"), plus "Showing results for" chips.
- **Privacy:**
  - Matched profiles show a name, fit % and "View profile".
  - Unmatched profiles are anonymous ("Fintech founder · Seed") with **Request match**, which creates the match both ways and notifies the other side.
  - Pairs with no sector or stage overlap show "No overlap yet".
- **Empty state:** the PRD's "No profiles match — try broadening your query…".
- **Also:** search history is included in the data export.

**Deviations**
- The response is an object (`items`, `total`, `next_offset`, `interpreted`) rather than a bare list.
- Fit summaries are template sentences, not LLM prose, so they can't hallucinate.
- The `search_result_clicked` analytics event isn't wired, and `search_opened` isn't logged; `search_query_submitted` is written to the API logs.
- Left out of the screenshot: the "Hybrid Vector Search" and "Semantic memory active" labels.

**Next scope**
- **v1.1:** search analytics in PostHog, saved searches, filters in the results (stage, cheque), and the ask pin and posts added to the search text.

**Original plan (for reference)**
- **Opening the modal:** Cmd/Ctrl-K or the top-bar search. Input placeholder: "Ask anything…".
- **Suggestions:** "Try one of these" chips, recent queries (stored per user) and keyboard navigation (↑↓, Enter, Esc).
- **API:** `POST /v1/search {query, limit}`.
  1. Parse filters with the LLM: sector, stage, city and cheque as structured JSON, validated against the taxonomy.
  2. Run a Qdrant vector search on the opposite side plus Postgres filters.
  3. Rank the results.
  4. Build a snippet with citations from profile fields.
- **Results:** 5–10 cards with matched attributes. Clicking opens Match Detail if matched, otherwise a "Request match" flow.
- **Fallbacks:** "No profiles match" message; vector-only results when the LLM times out; prompt-injection sanitising; pagination beyond 50.
- **Privacy:** results only show fields safe to reveal before a match (headline, sector, stage, city); full profiles stay private (M10).
- **Leave out of the screenshot:** "Hybrid Vector Search" and "Semantic memory active" labels.

### S3: Meeting scheduler (✅)
**Delivered**
- **Booking link:** users save a Cal.com link (Settings → Account → Scheduling).
- **Scheduler page:** mutual matches see "Schedule a meeting" → `/matches/[id]/schedule` with the other party's Cal.com calendar embedded and name and email prefilled. Either party's link works: share your own, or ask them to add theirs.
- **Booking record:** stored from the embed event (idempotent). The other party is notified.
- **Confirmation:** date and time in IST, duration, attendees, video link, Google Calendar link and .ics download.
- **Reminders:** 24 hours and 1 hour before, via the `meeting_notifications` worker.

**Gaps**
- Cancellations or reschedules made inside Cal.com aren't synced.
- Bookings aren't verified against Cal.com's API.

**Next scope**
- **v1.1:** a "Cancel / Reschedule" action in-app; guidance on connecting Google Calendar inside Cal.com.
- **v1.2:** Cal.com Platform (OAuth + webhooks) to sync and verify bookings.

### S4: Meeting outcomes (✅)
**Delivered**
- **Outcome screen (S-20) at `/meetings/[id]/outcome`:** Great fit / Not a fit / Undecided / Meeting didn't happen, plus private notes (≤ 500 characters, never shown to the other party).
- **Per-party records:** each party logs their own outcome and can update it; conflicting answers are both kept. `completed_at` is set on the first real outcome.
- **Prompts:** 2 hours after the meeting ends, a final reminder at 7 days, and `outcome_unknown` at 14 days (a late answer clears it).

**Next scope**
- **v1.1:** feed outcomes into the weekly retraining (founder outcomes weighted slightly higher); email prompts.

### S5: AI intro draft (✅)
**Delivered (as part of M9)**
- **Draft:** 2–4 sentences grounded in the founder's facts and the match signals.
- **Editing:** Regenerate / Write from scratch; empty box with a placeholder if the LLM fails.
- **Limits and guards:** 500 characters; numbers, links and pronouns are checked.
- **Analytics logs:** `intro_draft_regenerated` and `intro_draft_edited_before_send`.

**Next scope**
- **v1.1:** use recent posts as extra context (the PRD mentions posts) and add a tone option.

### S6: Messaging (✅)
**Delivered**
- **Storage and API:** Postgres `messages`, one thread per mutual pair. `GET/POST /v1/messages/:matchId`, the thread list, and mark-read.
- **Realtime:** **WebSocket** `/v1/ws` (the token is sent in the first frame and the origin is checked), falling back to 10-second polling when disconnected.
- **Screens (S-18):** two-column Messages screen (single column on mobile); Messages tab and Message button on Match Detail.
- **Details:**
  - Messages: up to 2,000 characters with a counter and optimistic sending with retry.
  - Receipts and alerts: read receipts, unread nav badge, one notification per conversation.
  - Rules and export: read-only when no longer mutual, 20 messages per minute, sent messages included in the data export.

**Gaps**
- Search inside a conversation (PRD v1.2).
- Attachments, typing indicators and presence (left out on purpose).

**Next scope**
- **v1.1:** Redis pub-sub so the API can run more than one instance; email digest of unread messages.
- **v1.2:** in-thread search; optional attachments (deck PDF) with scanning.

### S7: Trust badges (✅)
**Delivered**
- **Nightly job (`compute_trust`):**
  - Signals: response rate within 7 days (intros and messages), meeting completion, and follow-through from mutual match to meeting.
  - Scoring: 180-day lookback, averaged over a rolling 30 days.
- **Labels only:** "Highly responsive" / "Usually responds within 24hr" / "Response time varies"; "Response history: limited" when low. Nothing shows under 10 interactions.
- **Where it shows:** match cards, intro queue cards and Match Detail. `GET /v1/profiles/:id/trust`.

**Gaps**
- Not shown on the user's own profile (S-11/S-12 brief).
- No explanation page for users.

**Next scope**
- **v1.1:** own-profile badge with tips to improve; tune thresholds with real data (the Business Architecture suggests launching broadly once there are 500+ users).

### S8: Endorsements (✅)
**Delivered**
- **Who can endorse:** mutual-match investors and mentors. Founders can't, and self-endorsement is blocked.
- **Endorse flow:** "Endorse this claim" with a confirmation dialog on founder facts and milestone posts.
- **Badges:** "Endorsed by…" shown everywhere. The founder sees "You've been endorsed by X people" and highlighted claims; endorsers see an "Endorsements given" card.
- **Edge cases:** editing or deleting a claim removes its endorsements and notifies the endorser; an inactive endorser's endorsement stays and is labelled.
- **API:** `POST /v1/endorsements`, `DELETE /v1/endorsements/:id`, `GET /v1/profiles/:id/endorsements`, `GET /v1/me/endorsements`.

**Deviation**
- The PRD requires a "verified" endorser; verification isn't live, so a mutual match is the bar.

**Next scope**
- **v1.1:** require verified mentor or investor status once M3 verification ships; public endorser mini-profile for the badge click-through.

### S9: Milestones and ask pins (✅)
**Delivered**
- **Milestone cards:** structured milestones (built in M4) shown with distinct cards, plus a soft warning for implausible values ("10^12 users") that still lets the post save.
- **Ask pin:** a "Your ask" card on My Profile → Edit (1–140 characters). It shows as a banner at the top of the founder's own profile and on Match Detail.
- **API:** `POST/DELETE /v1/profiles/me/ask-pin`.

**Next scope**
- **v1.1:** include the ask pin in matching and search text; `milestone_posted` analytics.

---

## 3. Definition of Done checklist (PRD §8)

| DoD item | State |
|---|---|
| ACs pass by manual test | Backend flows verified by scripts; **manual UI pass still to do** (test plan) |
| Endpoints return documented shapes | Yes; some add fields (e.g. S6 thread info) |
| Edge cases handled or deferred in code comments | Yes; deferrals listed above and in `CLAUDE.md` |
| Analytics events fire | **Partial:** events written to API logs; no PostHog/Mixpanel yet |
| Screens match design system | Yes (tokens, left-sidebar shell); fake stats and claims from Stitch left out on purpose |
| Mobile 375px, no horizontal scroll | Built responsive; **confirm in manual test** |
| Empty, loading, error states | Yes for every screen built |
| Keyboard accessibility | Labels, focus rings, native dialogs; **confirm in manual test** |
| No console errors in production build | Build clean; **confirm in browser** |
| Commit references story ID | Yes (`[M1]`…`[S8]`) |

---

## 4. Roadmap

### 4.1 v1.0 launch readiness (next 1–2 weeks, before beta users)
1. **Security:** rotate the Supabase, Clerk and Groq keys; production Clerk instance with your own Google/LinkedIn OAuth apps.
2. **Deploy:** Supabase Pro, Railway API plus 4 cron jobs, Vercel, Qdrant Cloud (see doc 03).
3. **Manual QA:** run `02-test-plan.md` on desktop and at 375px; fix what it finds.
4. **CI:** GitHub Actions running ruff, mypy, tsc and `next build` on every PR.
5. **Automated tests:** move the story integration scripts into `apps/api/tests` (pytest) against a test Supabase branch.
6. **Monitoring:** Railway and Vercel logs, uptime check on `/health`, and optionally Sentry for web and API errors.
7. **Analytics:** wire PostHog with the event names from PRD §7 (the backend already logs most of them).
8. **Admin basics:** SQL snippets or a minimal internal page to review pending mentor verifications and `pending_review` posts.

### 4.2 v1.1 (first 3 months after launch): finish SHOULD and deferred MUST items

| # | Feature / module | Scope |
|---|---|---|
| 1 | **S2 RAG search** | Cmd-K modal (S-21), LLM query parsing, vector plus filter ranking, cited snippets, recent queries, request match |
| 2 | **S1 video posts** | Cloudflare Stream upload, thumbnails, inline player, 3-video limit, moderation queue |
| 3 | **M5 momentum aggregator** | GitHub and Product Hunt sources, S-05 connect step, S-10 timeline, nightly worker, hide toggle |
| 4 | **M6 verified badges** | Verified-from-source badges and tooltips (depends on M5) |
| 5 | **Mentor / investor verification** | Admin review, verified badge, S8 endorsements verified-only |
| 6 | **Notifications: email** | Resend/SendGrid: new matches, intros, messages digest, meeting reminders and outcome prompts, export link, restore link (consent-aware) |
| 7 | **Collaborative ranking** | Weekly training on feedback plus outcomes, α = 0.7 after 10 events, offline metrics gate |
| 8 | **Match List filters** | Sector and stage filters on S-13 |
| 9 | **Onboarding S-06** | Optional first post during founder onboarding |
| 10 | **"Request to match"** | On the private profile state (M10 AC8) and from search results |
| 11 | **Scheduling** | In-app cancel/reschedule; Google Calendar guidance |
| 12 | **Scale basics** | Upstash Redis: job queue (recompute, exports) plus pub-sub for WebSockets across instances |
| 13 | **Trust on own profile** | Badge on S-11/S-12 with improvement tips |
| 14 | **Crunchbase / CSV import** | Prior investments import for investors |

### 4.3 v1.2

| Feature | Scope |
|---|---|
| **Billing (S-26)** | Founder Pro (unlimited videos, more matches), Investor Standard / Pro; Razorpay or Stripe India; plan limits |
| **Public profile toggle** | M10 AC7: opt-in public founder profile |
| **Messaging v1.2** | In-thread search, attachments (PDF) with scanning, email digests |
| **Cal.com Platform** | OAuth-managed users, webhooks for booking sync and verification |
| **WhatsApp notifications** | 360dialog, consent-gated |
| **Moderation console** | Review queue for posts, videos and reports; user reporting and blocking |
| **Re-consent flow** | Force re-consent when the policy version changes |

### 4.4 v2 (3–9 months after launch, COULD tier)

| ID | Feature | Build when |
|---|---|---|
| C1 | LinkedIn OAuth verification + KYC-lite for investors | Trust concerns appear in feedback |
| C2 | Investor analytics dashboard (deal-flow trends, benchmarks) | Paid investor conversion < 15% |
| C3 | Accelerator / incubator tier (bulk cohort onboarding) | 2+ paying pilot accelerators |
| C4 | Founder peer circles | Founder engagement drops after matching |
| C5 | Mobile apps (iOS / Android) | Mobile web > 40% of sessions |
| C6 | Hindi / Marathi / Tamil onboarding and posts | Tier-2/3 users > 30% |
| C7 | Public SEO founder pages | SEO becomes an acquisition channel |
| C8 | Aggregator expansion (X, YourStory, Inc42, YouTube) | Initial momentum sources stable |

**Won't build (v1 and v2), per Business Architecture:** public feed, escrow or payments between parties, legal doc generation, public deal rooms, live video pitching, full CRM, valuation tools, public-market or IPO advisory.
