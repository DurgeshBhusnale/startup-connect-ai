# Startup Connect AI: Manual Test Plan

A step-by-step plan to test every feature built so far (W1, M1–M4, M6–M10, S3–S9).
Run it on your local setup first, then again on the deployed site (doc 03). Record results in the **Result** column (Pass / Fail + note).

---

## 0. Before you start

### 0.1 Environment
- **Local:** web on `http://localhost:3000`, API on `http://localhost:8000` (`/docs` shows the API). See doc 03 §6.
- **Deployed:** your Vercel URL plus Railway API.
- Use **four separate browser sessions** so each persona stays signed in: Chrome profile 1, Chrome profile 2, Edge, and Firefox (or incognito windows).
- Keep the **Supabase Table Editor** open. Some tests check or adjust rows (meetings, trust).
- Screen sizes to cover: desktop (≥ 1280px) and mobile (DevTools → 375 × 812).

### 0.2 Test accounts
I don't create accounts or passwords for you (Clerk handles sign-up). Create them yourself as follows.

**Option A: Clerk development instance (local testing, easiest).**
Clerk dev instances accept test emails that contain `+clerk_test`. The email verification code for these is always **`424242`**, and no real email is sent.

| Persona | Role | Email to sign up with | Password |
|---|---|---|---|
| Riya Sharma | Founder | `riya+clerk_test@example.com` | choose your own (store it in your password manager) |
| Arjun Mehta | Founder (2nd founder) | `arjun+clerk_test@example.com` | your own |
| Aditya Kumar | Investor (good fit for Riya) | `aditya+clerk_test@example.com` | your own |
| Kavya Iyer | Investor (poor fit) | `kavya+clerk_test@example.com` | your own |
| Meera Iyer | Mentor | `meera+clerk_test@example.com` | your own |

**Option B: production / real inboxes.** Use Gmail plus-addressing on your own address, e.g. `yourname+riya@gmail.com`, `yourname+aditya@gmail.com`. All mail arrives in your inbox.

> Set the Clerk display name (first + last name) during sign-up. The app shows it on cards and messages.

### 0.3 Profile data to enter

**Riya (founder)**: upload `test-fixtures/rupeez-pitch-deck.pdf`
- LinkedIn: `https://www.linkedin.com/in/riya-sharma-test`
- Expected extraction: Rupeez · Fintech · Seed · ask ₹40,00,000 · team 3 · Pune · B2B SaaS subscription · competitors CredFlow, Chargebee, Zoho Invoice
- Bio: "Building Rupeez to fix receivables for India's D2C brands." Website: `rupeez.in`
- Ask pin: "Intros to D2C brands in Pune for our receivables pilot"

**Arjun (founder)**: use "Fill manually instead"
- Startup: KrishiLink · Sector: Agritech · Stage: Pre-seed · Ask ₹25,00,000 · Team 2 · City: Nagpur · Business model: Marketplace · Description: "Marketplace connecting farmers with cold-storage operators."

**Aditya (investor)**: good match for Riya
- Sectors: Fintech, SaaS · Stages: Pre-seed, Seed · Cheque ₹5,00,000 – ₹50,00,000 · Geographies: Pune, Bengaluru · No-gos: Crypto
- Prior investments (manual): Beacon (Fintech, Seed, ₹10,00,000, 2023) · BuildKit (SaaS, Pre-seed, ₹5,00,000, 2024) · Rupiya (Fintech, Seed, ₹15,00,000, 2025)
- Crunchbase URL (optional): `https://www.crunchbase.com/person/aditya-kumar-test`

**Kavya (investor)**: poor fit
- Sectors: Healthtech · Stages: Series B+ · Cheque ₹5,00,00,000 – ₹9,00,00,000 · Geographies: Rest of world · Skip prior investments

**Meera (mentor)**
- Expertise: GTM, Growth, Fundraising · Stages: Pre-seed, Seed · Availability: 2 sessions / month · Fee: blank (free)
- Verification: LinkedIn `https://www.linkedin.com/in/meera-iyer-test`

### 0.4 Test files (in `docs/handover/test-fixtures/`)
| File | Use |
|---|---|
| `rupeez-pitch-deck.pdf` | Normal deck extraction (M1) |
| `not-a-pitch-deck-resume.pdf` | Low-confidence / not-a-deck edge case |
| Create yourself: any JPG/PNG photo under 5 MB (×4) | Image posts |
| Create yourself: an image over 5 MB | Size rejection |
| Create yourself: a PDF over 20 MB (e.g. merge scanned pages) | Deck size rejection |
| Create yourself: a `.txt` renamed to `.jpg` | Non-image rejection |
| Create yourself: a free **Cal.com** account with one event type, e.g. `cal.com/<you>/30min` | Scheduling (S3) |

### 0.5 Running background jobs manually (local)
From `apps/api`:
```bash
.venv/Scripts/python.exe -m app.workers.meeting_notifications
.venv/Scripts/python.exe -m app.workers.compute_trust
.venv/Scripts/python.exe -m app.workers.purge_posts
.venv/Scripts/python.exe -m app.workers.purge_accounts
```
On Railway, open the cron service and click **Run now** (or wait for the schedule).

---

## 1. Public pages & authentication (W1)

| ID | Steps | Expected | Result |
|---|---|---|---|
| A-01 | Open `/` signed out | Landing page loads; CTA buttons go to sign-up; no console errors | |
| A-02 | Open `/terms` and `/privacy` | Pages load without sign-in | |
| A-03 | Open `/home` signed out | Redirected to sign-in | |
| A-04 | Sign up as Riya (email, code `424242` in dev) | Lands on `/onboarding` | |
| A-05 | On `/onboarding`, try Continue without choosing a role or ticking required consents | Blocked with a clear message | |
| A-06 | Choose **Founder**, tick Terms/Privacy and Matching (email optional on by default, WhatsApp off) → Continue | Goes to founder onboarding; Supabase `consent_log` has rows with the policy version | |
| A-07 | Sign out → sign in again | Returns to where onboarding left off / Home | |
| A-08 | Open `/some-random-page` | Branded 404 page with a link home | |
| A-09 | DevTools → Network → Offline, then navigate | Offline banner appears; disappears when back online | |

## 2. M1: Founder onboarding with AI auto-builder (Riya, Arjun)

| ID | Steps | Expected | Result |
|---|---|---|---|
| M1-01 | Step 1: check the page | PDF drop zone (drag or click), LinkedIn input with placeholder, "Build my profile", "Fill manually instead" | |
| M1-02 | Upload the >20 MB PDF | Rejected immediately: "Please compress your deck to under 20MB"; LinkedIn field keeps its value | |
| M1-03 | Enter LinkedIn `linkedin.com/company/foo` or `hello` | Inline LinkedIn format error | |
| M1-04 | Upload `rupeez-pitch-deck.pdf` + valid LinkedIn → Build | Loading state "Reading your deck…"; within ~60 s lands on Review | |
| M1-05 | Review screen | Name, sector, stage, ask, team, city, business model, 3 competitors, description prefilled to match §0.3 | |
| M1-06 | Look for amber highlighted fields | Low-confidence fields (if any) have an amber left border + tooltip "Please verify — auto-extracted with low confidence" | |
| M1-07 | Close the tab during review, reopen `/onboarding/founder` | Draft is restored, not lost | |
| M1-08 | Edit team size to 4 → Continue/Save | Saved; lands on Home; My Profile shows team 4 (change back to 3 later) | |
| M1-09 | Open `/onboarding/founder` again after completing | Redirected to Home | |
| M1-10 | (Arjun) Upload `not-a-pitch-deck-resume.pdf` | Mostly empty or low-confidence fields with a warning, or the manual-entry offer | |
| M1-11 | (Arjun) "Fill manually instead" → enter §0.3 data | Blank review form; validation on required fields; saves | |
| M1-12 | Validation: team size 0, ask 0, empty sector | Inline errors, cannot save | |
| M1-13 | Mobile 375px | No horizontal scroll; upload and form usable | |

## 3. M2: Investor onboarding (Aditya, Kavya)

| ID | Steps | Expected | Result |
|---|---|---|---|
| M2-01 | Sign up Aditya → role Investor + consents | Investor thesis form | |
| M2-02 | Submit with zero sectors | "Select at least one sector" style error | |
| M2-03 | Cheque min ₹50,00,000 > max ₹5,00,000 | Inline error, submit blocked | |
| M2-04 | Fill §0.3 thesis → Save & Continue | Prior investments screen | |
| M2-05 | Add 3 investments manually (sector suggestions, stage, optional cheque, year) → Save | Saved; lands on Home | |
| M2-06 | Kavya: complete thesis → **Skip for now** | Home shows a persistent banner "Add your prior investments…" | |
| M2-07 | Kavya: dismiss the banner, reload | Banner stays dismissed | |
| M2-08 | Aditya: Profile → Edit thesis | Form prefilled; button says "Save changes" | |
| M2-09 | Aditya My Profile (S-11) | Thesis, prior investments tab with count, hide-cheques setting reflected | |

## 4. M3: Mentor onboarding (Meera)

| ID | Steps | Expected | Result |
|---|---|---|---|
| M3-01 | Sign up Meera → Mentor + consents | Expertise form: areas, stages, availability, fee | |
| M3-02 | Save with no expertise area | Error, blocked | |
| M3-03 | Choose availability **Unlimited** → Save | Soft warning modal about high match volume; can confirm or change | |
| M3-04 | Enter fee ₹15,000 | Soft warning "Most founders don't pay for mentorship…"; still allowed | |
| M3-05 | Set §0.3 values (2/month, free) → Save | Verification step | |
| M3-06 | Choose LinkedIn verification → submit | Status "Verification pending" on profile | |
| M3-07 | (Alternative) references with 2 emails; try invalid email | Validation error for invalid email | |
| M3-08 | Meera Home + My Profile (S-12) | Mentor empty state copy; expertise card; "Verification pending" | |

## 5. M6 / S9: My Profile, bio, ask pin, badges (Riya)

| ID | Steps | Expected | Result |
|---|---|---|---|
| P-01 | Riya → My Profile | Header, "Currently seeking" card, venture parameters, startup card, tabs Overview / Posts / Momentum (placeholder) | |
| P-02 | Profile → Edit bio & website → enter §0.3 bio + `rupeez.in` → Save | Bio shows; website shown as `https://rupeez.in` link | |
| P-03 | Enter website `not a site` | Validation error | |
| P-04 | Top of profile with no ask | Dashed "Pin what you're asking for" prompt | |
| P-05 | Click it → "Your ask" card on Edit page → type 141 characters | Counter turns red; Pin disabled | |
| P-06 | Enter §0.3 ask (paste with line breaks) → Pin ask | "Pinned to the top of your profile."; line breaks collapsed | |
| P-07 | Back to My Profile | Green "Currently asking for" banner with Edit | |
| P-08 | Clear ask → back to profile | Banner gone, dashed prompt back | |
| P-09 | Re-add the ask (needed for later tests) | Banner shows | |
| P-10 | (Stale claim, optional) In Supabase set `profiles.l1_data.field_updated_at.team_size` to a date 70 days ago | "Last updated [date]" under Team | |

## 6. M4 / S9: Posts (Riya)

| ID | Steps | Expected | Result |
|---|---|---|---|
| PO-01 | Profile → **New post** | Composer modal with Text / Image / Milestone tabs (no Video) | |
| PO-02 | Text: type up to 500 characters | Counter: amber below 50 left, red at 0; can't type past 500 | |
| PO-03 | Post a clean text update ("Rupeez crossed 500 paying brands this month!") | Appears at top of Posts tab | |
| PO-04 | Post a scam text ("Invest ₹1 lakh today and get guaranteed 5x returns in 30 days, send money to my UPI") | Blocked: "This content can't be posted — please review our community guidelines"; not saved | |
| PO-05 | Image tab: add 4 images | Thumbnails with remove X; a 5th can't be added | |
| PO-06 | Add the >5 MB image | Rejected with a clear error | |
| PO-07 | Add the fake `.jpg` (text file) | Rejected | |
| PO-08 | Post images with a caption | Post appears with image grid; clicking opens the image | |
| PO-09 | Milestone tab: type Users, value "Crossed 1,000 paying SMB customers", date today, description | Distinct milestone card preview; post saves | |
| PO-10 | Milestone with value "10^12 users" | Soft amber warning "That number looks unusually large…"; still able to post | |
| PO-11 | Milestone date in the future | Error, cannot save | |
| PO-12 | Edit the text post → save | Content updated, "Edited" label | |
| PO-13 | Edit it into the scam text | Blocked by moderation, original stays | |
| PO-14 | Delete a post → confirm modal | Post disappears immediately | |
| PO-15 | Pagination (optional): create >20 posts | "Older posts" navigation appears | |

## 7. M7 / M8: Matching & explanations

| ID | Steps | Expected | Result |
|---|---|---|---|
| MA-01 | Riya → Matches | Loading skeleton, then Aditya (high fit, e.g. ≥ 70%) and Meera; **not** Kavya | |
| MA-02 | Card content | Name, role chip, headline, fit %, facts, "Why this match" sentence; ≥ 80% fit has an emerald left border | |
| MA-03 | Aditya → Matches | Riya appears with an explanation mentioning Fintech / Seed / cheque / Pune | |
| MA-04 | Kavya → Matches | Riya not shown (no sector overlap); empty-state copy | |
| MA-05 | Arjun (Agritech) → Matches | Only mentors with stage overlap (Meera) or empty state | |
| MA-06 | Click Refresh on Matches | Recomputes without duplicates | |
| MA-07 | Riya → open Aditya's card (Match Detail S-14) | Profile aside (avatar, headline, trust badge if any, fit %), Overview with thesis and prior investments | |
| MA-08 | "Explain this match" tab | Bullet list of contributing factors with scores; concerns (e.g. ask near range edge) | |
| MA-09 | Hover a highlighted value in the explanation | Tooltip "From founder's profile" / "From investor's thesis" | |
| MA-10 | Home (each persona) | Top matches preview on Home | |
| MA-11 | Edit Riya's sector to Healthtech → Matches | Aditya drops out; revert to Fintech afterwards and he returns | |
| MA-12 | Stop the API → reload Matches | "Couldn't load / check back" error state with Retry, no crash | |

## 8. M9 / S5: Feedback, intros, notifications

| ID | Steps | Expected | Result |
|---|---|---|---|
| F-01 | Riya on Matches: **Save** Meera | Button shows "Saved"; Saved tab lists Meera | |
| F-02 | Unsave from Saved tab | Removed from Saved | |
| F-03 | **Not a fit** on a match → pick "Wrong stage" | Card removed immediately; `feedback_events` row with reason | |
| F-04 | Open that match directly → **Undo / Restore** | Match returns | |
| F-05 | Riya → Aditya → **Request intro** | Modal with AI-drafted 2–4 sentence message using real facts (no invented numbers) | |
| F-06 | Click **Regenerate** | New draft | |
| F-07 | **Write from scratch** → send with 10 characters | Length error; then write a proper message → Send | |
| F-08 | After send | Riya's card shows "Intro requested" | |
| F-09 | Aditya → Notifications / sidebar badge | "Riya Sharma … requested an intro"; Intro queue badge = 1 | |
| F-10 | Aditya → Intro queue (S-17) | Card with message (Read more if long), fit %, facts, Accept / Decline | |
| F-11 | Aditya → **Accept intro** | "You're connected with Riya…"; both see **Mutual match** | |
| F-12 | Riya → Notifications | "Aditya Kumar accepted your intro request" | |
| F-13 | Meera → Matches → **Accept match** on Riya before Riya requests | Riya gets "interested" notification; Riya's card says Meera is interested | |
| F-14 | Riya → Request intro to Meera | Becomes mutual immediately | |
| F-15 | Arjun → request intro to Meera → Meera **Decline** with a reason | Arjun sees "Intro declined"; cannot resend | |
| F-16 | Notifications page (S-22) | Grouped by Today / Earlier; mark one read; **Mark all read** clears badge | |
| F-17 | Double-click Save quickly | No duplicate events; state consistent | |

## 9. M10: Privacy, consent, data, deletion

| ID | Steps | Expected | Result |
|---|---|---|---|
| PR-01 | Kavya tries Riya's Match Detail URL (copy from Riya's browser) | "This profile is private" state | |
| PR-02 | Kavya opens `/matches/not-a-uuid` | Same private state, no error page | |
| PR-03 | Settings → Privacy & Data | Consent list: Terms (locked), Matching, Email, WhatsApp, with toggles | |
| PR-04 | Toggle Email off/on | Saved; new `consent_log` rows (append-only) | |
| PR-05 | Arjun: turn **Matching** off | Warning; notification "Matching paused"; Arjun disappears from Meera's matches; Arjun's Matches shows paused state | |
| PR-06 | Arjun: turn Matching back on | Matching works again | |
| PR-07 | **Export my data** | JSON file downloads; contains profile, consents, matches, intros, posts, meetings, sent messages, endorsements | |
| PR-08 | Export 6 times in a day | 6th: limit message | |
| PR-09 | Settings → Notifications (S-24): turn off "New matches" | Topic muted (no new-match notifications) | |
| PR-10 | Settings → Account (S-23) | Email, password, 2FA rows open Clerk's modal; sessions list; sign out other sessions | |
| PR-11 | Arjun: **Delete my account** → wrong email typed | Delete button stays disabled / error | |
| PR-12 | Type correct email → confirm | Signed-in view goes to `/account-deletion` with Restore; Arjun disappears from others' matches; pending intro cancelled with notice to the other side | |
| PR-13 | Click **Restore** | Account back to normal | |
| PR-14 | (Optional, destructive) Delete again, set `users.hard_delete_at` to yesterday in Supabase, run `purge_accounts` | Clerk user deleted, profile rows gone, `users` row anonymised, consent_log kept | |

## 10. S3: Meeting scheduler (Riya ↔ Aditya, mutual)

| ID | Steps | Expected | Result |
|---|---|---|---|
| SC-01 | Riya → Match Detail (Aditya) | **Message** and **Schedule a meeting** buttons | |
| SC-02 | Schedule page, neither has a Cal.com link | "Aditya hasn't linked a calendar yet"; add-link form; "Ask Aditya to add a link" | |
| SC-03 | Click "Ask Aditya to add a link", click again | "We've let Aditya know" then "already notified in the last day"; Aditya's notification links to Settings → Account | |
| SC-04 | Aditya → Settings → Account → Scheduling → enter `calendly.com/x` | Error "Use your Cal.com booking link…" | |
| SC-05 | Enter his Cal.com link (`cal.com/<you>/30min`) → Save | Shows link with Change / Remove | |
| SC-06 | Riya → Schedule page | Aditya's Cal.com calendar embedded; Riya's name and email prefilled | |
| SC-07 | Book a slot 2+ days ahead | Confirmation: date, time range in IST, duration, attendees, video link (if Cal.com adds one), Add to Google Calendar, Download .ics, Back to match | |
| SC-08 | Add to Google Calendar / .ics | Opens Google Calendar prefilled / downloads a valid .ics | |
| SC-09 | Aditya → Notifications | "Riya Sharma booked a meeting with you" | |
| SC-10 | Both Match Details | "Upcoming meeting" row | |
| SC-11 | Reminders: set `meetings.scheduled_at` to 20 h from now (keep `created_at` older) → run `meeting_notifications` | Both get "Reminder: meeting … tomorrow"; running again sends nothing | |
| SC-12 | Kavya (not mutual) opens `/matches/<her match with Riya>/schedule` | "Connect first" state | |

## 11. S4: Meeting outcome

| ID | Steps | Expected | Result |
|---|---|---|---|
| OU-01 | In Supabase set the meeting's `scheduled_at`/`ends_at` to 3 h ago → run `meeting_notifications` | Both get "How did your meeting with … go?" | |
| OU-02 | Click the notification | S-20 page: 4 options, notes 0/500, "Only visible to you, never shared with …", Save / Skip for now | |
| OU-03 | Save without choosing | "Pick how the meeting went." | |
| OU-04 | Choose Great fit + notes → Save | "Thanks, outcome saved" | |
| OU-05 | Aditya opens the same meeting outcome page | His form is empty (Riya's notes not visible) | |
| OU-06 | Riya changes to Undecided | Updated, still one record | |
| OU-07 | Future meeting outcome page | "This meeting hasn't happened yet" | |
| OU-08 | Set `ends_at` to 8 days ago → run the worker | Aditya (no answer) gets "Last reminder…" | |

## 12. S6: Messaging (Riya ↔ Aditya, two browsers side by side)

| ID | Steps | Expected | Result |
|---|---|---|---|
| MS-01 | Riya → sidebar Messages | Thread list with Aditya (and Meera), role chip, match %, "No messages yet" | |
| MS-02 | Open Aditya's thread | Header with Profile and calendar buttons, "Start the conversation" empty state | |
| MS-03 | Send "Hi Aditya, thanks for accepting!" | Appears instantly (Sending… → Sent) | |
| MS-04 | Aditya's browser (on any page) | Within ~1–3 s: Messages badge increments; notification "New message from Riya Sharma" | |
| MS-05 | Aditya opens the thread | Message shown with avatar + time; badge clears; Riya's message shows **Read** | |
| MS-06 | Reply with Shift+Enter line breaks, then Enter | Multi-line message delivered live to Riya | |
| MS-07 | Send 5 more messages from Riya quickly | Only one unread notification for Aditya per conversation | |
| MS-08 | Paste 2,001 characters | Counter red, Send disabled | |
| MS-09 | Send 21 messages within a minute | "You're sending messages too quickly" on the 21st | |
| MS-10 | Stop the API briefly while sending | Message shows "Not sent · Retry"; Retry after restart sends once | |
| MS-11 | Disconnect Wi-Fi on Aditya for 30 s, reconnect | "Live updates are reconnecting…" note; messages catch up | |
| MS-12 | Match Detail → Messages tab | Same conversation embedded; "Open in Messages" | |
| MS-13 | Search box / Unread filter in thread list | Filters by name / unread | |
| MS-14 | Mobile 375px | List screen → tap thread → full-screen thread with back arrow | |
| MS-15 | Kavya opens `/messages/<Riya–Aditya match id>` | "Conversation not found" | |
| MS-16 | In Supabase set that intro's status to `cancelled` → reload thread | Read-only notice, history visible, no composer (set back to `accepted` after) | |

## 13. S7: Trust badges

A badge needs **10+ interactions** (intros answered, messages answered, meetings, follow-through), so most beta accounts won't show one yet.

| ID | Steps | Expected | Result |
|---|---|---|---|
| TR-01 | Run `compute_trust` with the test data above | Completes; `trust_scores` rows created; **no badge** (fewer than 10 interactions) | |
| TR-02 | Cards / Match Detail / Intro queue | No trust badge shown for new users | |
| TR-03 | (Badge check) In `trust_scores` set Aditya's row: `badge='high'`, `message='Highly responsive'` | Riya's match card shows green clock "Highly responsive"; Match Detail shows the pill | |
| TR-04 | Set `badge='low'`, `message='Response history: limited'` | Subtle grey "Response history: limited" disclaimer | |
| TR-05 | Confirm no numbers | No numeric trust score anywhere in UI or API response of `/v1/profiles/<id>/trust` | |
| TR-06 | Re-run `compute_trust` | Rows recomputed from real data (badge goes back to none) | |

## 14. S8: Endorsements (Aditya and Meera endorse Riya)

| ID | Steps | Expected | Result |
|---|---|---|---|
| EN-01 | Kavya (not mutual) views Riya | Can't open profile at all (private) | |
| EN-02 | Aditya → Riya Match Detail → Overview | "Endorse this claim" under each fact and the description | |
| EN-03 | Click Endorse on **Team** → dialog shows claim → Cancel | Nothing saved | |
| EN-04 | Endorse **Team** → Endorse | "You endorsed this · Undo"; badge "Endorsed by Aditya Kumar" | |
| EN-05 | Updates tab → milestone post → Endorse | Badge on milestone card | |
| EN-06 | Meera endorses **Team** too | Badge "Endorsed by Aditya Kumar and 1 other" | |
| EN-07 | Riya → Notifications | "Aditya Kumar endorsed a claim on your profile" (×2) and Meera's | |
| EN-08 | Riya → My Profile | Banner "You've been endorsed by 2 people"; Team card highlighted; milestone badge on Posts tab; **no** Endorse buttons for Riya | |
| EN-09 | Aditya → My Profile | "Endorsements given" card listing Team and Milestone with View profile links | |
| EN-10 | Aditya → Undo on Team | Badge now only Meera | |
| EN-11 | Riya edits team size 3 → 4 | Team endorsements removed; Meera gets "Rupeez changed a claim you endorsed" | |
| EN-12 | Riya edits the endorsed milestone value | Milestone endorsement removed; endorser notified | |
| EN-13 | Riya changes only her bio | Other endorsements stay | |

## 15. Cross-cutting checks (every screen)

| ID | Check | Expected | Result |
|---|---|---|---|
| X-01 | Mobile 375px on Home, Matches, Match Detail, Profile, Posts composer, Intro queue, Messages, Schedule, Outcome, Settings, Notifications | No horizontal scroll; bottom tabs work | |
| X-02 | Keyboard only (Tab / Shift+Tab / Enter / Esc) through onboarding, match actions, dialogs, messages | All controls reachable; visible focus ring; dialogs close with Esc | |
| X-03 | Loading states (DevTools → Network "Slow 3G") | Skeletons, not blank pages | |
| X-04 | Browser console on each page (production build) | No errors or React warnings | |
| X-05 | API down → reload several pages | Friendly error states with Retry; no stack traces | |
| X-06 | Sign out in one tab | Other tabs redirect to sign-in on next action | |
| X-07 | Copy / tone | No "users", ₹ formatting like ₹40L, times in IST where shown | |
| X-08 | Background jobs | All 4 workers run without errors (§0.5) | |

---

### Reporting bugs
For each failure note: test ID, persona, URL, what you did, expected vs actual, screenshot, and time (to find API logs). Share the list with Claude Code to fix story by story.
