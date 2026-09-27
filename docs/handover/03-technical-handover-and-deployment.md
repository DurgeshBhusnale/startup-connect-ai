# Startup Connect AI: Technical Handover & Deployment Guide

Covers everything built through commit `b06654c` (MUST M1–M4, M6–M10; SHOULD S3–S9).
No secret values are in this document. Real values live only in your local `.env` and in Vercel / Railway settings.

---

## 1. System at a glance

| Part | Tech | Deploy target | Folder |
|---|---|---|---|
| Web app | Next.js 15.5, React 19, TypeScript, Tailwind 3 | **Vercel** | `apps/web` |
| API | FastAPI (Python 3.12), SQLAlchemy async, uvicorn | **Railway** (web service), or **Vercel** for free testing (§5) | `apps/api` |
| Background jobs | Python scripts in `app/workers` | **Railway** (cron services), or Vercel Cron hitting `/v1/jobs/*` (§5) | `apps/api` |
| Database + file storage | Supabase Postgres + Supabase Storage | Supabase (managed) | `supabase/migrations` |
| Auth | Clerk | Clerk (managed) | n/a |
| Vector search | Qdrant | **Qdrant Cloud** in production | n/a |
| Embeddings | sentence-transformers `all-MiniLM-L6-v2`, 384-dimension | in the API process on Railway; hosted API on Vercel (§5) | n/a |
| LLM | Groq, OpenAI-compatible API | Groq (managed) | n/a |
| Scheduling | Cal.com embed (in the browser) | Cal.com (each user's own account) | n/a |

Request flow: Browser → Vercel (Next.js server components and server actions) → Railway API (`https://<api>/v1/...`) with the Clerk session token → Supabase / Qdrant / Groq.
Realtime messaging: Browser → `wss://<api>/v1/ws` directly.

---

## 2. Third-party providers

| Provider | Used for | Status in code | Credentials / settings |
|---|---|---|---|
| **Supabase** | Postgres (all data), Storage bucket `post-media` (post images, private, signed URLs) | **In use** | `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| **Clerk** | Sign-up / sign-in (email, Google, LinkedIn), sessions, account settings modal, user deletion on purge | **In use** | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` (web + API), sign-in / up URL vars |
| **Groq** | Deck extraction (M1), match explanations (M8), intro drafts (S5), post moderation (M4) | **In use** | `GROQ_API_KEY`, `GROQ_MODEL` (default `openai/gpt-oss-120b`); moderation model `openai/gpt-oss-safeguard-20b` |
| **Qdrant** | Profile embeddings for matching (M7) | **In use** (embedded on-disk locally; **must be Qdrant Cloud in production**) | `QDRANT_URL`, `QDRANT_API_KEY`, `QDRANT_COLLECTION` (default `profiles`) |
| **Hugging Face** | Downloads the MiniLM model on first API start (~90 MB) when it runs in-process; serves the embeddings over its Inference API when it does not (§5, the Vercel path) | **In use** | no key needed for the download, optional `HF_TOKEN`; a free read token in `EMBEDDINGS_API_KEY` for the hosted API |
| **Cal.com** | Booking widget on `/matches/[id]/schedule` (S3) | **In use**, no platform key; each user pastes their own Cal.com link | none |
| **GitHub** | Source repo, auto-deploy trigger for Vercel and Railway | **In use** | repo access |
| Cloudflare R2 | Planned object storage | **Not used** (replaced by Supabase Storage) | `R2_*` in `.env` are unused, don't set in prod |
| Upstash Redis | Planned job queue / pub-sub | **Not used yet** (needed if the API runs >1 instance) | `UPSTASH_*` unused |
| OpenAI | Planned LLM fallback | **Not used** | `OPENAI_*` unused |
| Clerk webhooks | n/a | **Not used** | `CLERK_WEBHOOK_SECRET` unused |
| `NEXT_PUBLIC_SUPABASE_*`, `NEXT_PUBLIC_APP_URL` | n/a | **Not read by web code** | safe to omit |
| SendGrid / Resend, 360dialog WhatsApp | Email / WhatsApp notifications | **Not built** (in-app only in v1) | none |

> **Security action first:** keys were exposed earlier in development. Before production, **rotate** the Supabase service role key and DB password, the Clerk secret key, and the Groq API key, and use the new values only in Vercel / Railway.

---

## 3. Environment variables

### 3.1 Railway: API service and all cron services (same variables)

| Variable | Required | Value / notes |
|---|---|---|
| `ENVIRONMENT` | yes | `production` (also hides `/docs` and `/openapi.json`) |
| `LOG_LEVEL` | no | `info` |
| `DATABASE_URL` | yes | Supabase **transaction pooler** URL in SQLAlchemy form: `postgresql+asyncpg://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres` |
| `SUPABASE_URL` | yes | `https://<project-ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Supabase → Project Settings → API → service_role (**secret**) |
| `CLERK_SECRET_KEY` | yes | Clerk **production** instance secret key |
| `CORS_ORIGINS` | yes | Comma-separated exact web origins, e.g. `https://startupconnect.ai,https://www.startupconnect.ai`. **Also used for** the Clerk token `azp` check and the WebSocket origin check, so a wrong value means every API call returns 401. |
| `GROQ_API_KEY` | yes | Groq console key |
| `GROQ_MODEL` | no | `openai/gpt-oss-120b` |
| `QDRANT_URL` | **yes in prod** | Qdrant Cloud cluster URL (`https://xxxx.<region>.cloud.qdrant.io:6333`). If blank, the API writes vectors to the container disk and loses them on every redeploy. |
| `QDRANT_API_KEY` | yes in prod | Qdrant Cloud API key |
| `QDRANT_COLLECTION` | no | `profiles` |
| `CONSENT_POLICY_VERSION` | no | default `2026-09-13`; must match `apps/web/lib/privacy.ts` |
| `HF_TOKEN` | no | Hugging Face read token (avoids model download rate limits) |
| `EMBEDDINGS_API_URL` | **on Vercel** | Blank runs MiniLM in-process (Railway, local). Set it to call a hosted embedding API instead, which serverless needs (§5). With neither, matching and search fall back to structured-only ranking |
| `EMBEDDINGS_API_KEY` | with the above | Token for that API |
| `CRON_SECRET` | no (Railway) | Enables `GET /v1/jobs/*` for hosts that trigger jobs over HTTP (§5). Blank leaves those endpoints returning 404 |

### 3.2 Vercel: web project

| Variable | Required | Value / notes |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | yes | Railway API public URL, **no trailing slash**, e.g. `https://api.startupconnect.ai` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | yes | Clerk production publishable key (`pk_live_...`) |
| `CLERK_SECRET_KEY` | yes | Same Clerk production secret key |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | yes | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | yes | `/sign-up` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | yes | `/home` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | yes | `/onboarding` |

`NEXT_PUBLIC_*` values are baked in at build time, so **redeploy Vercel after changing them**.

---

## 4. Deployment steps (in this order)

### Step 1: Supabase (database + storage)
1. Create or choose the production project (Pro plan recommended so it doesn't pause and gets backups). Region: Mumbai (`ap-south-1`) for India.
2. Project Settings → Database: note the password. Copy the **Transaction pooler** connection string (port **6543**).
3. Apply all migrations from the repo root (15 files, `20260913120000_initial_schema.sql` → `20260917090000_endorsements.sql`):
   ```bash
   npx supabase db push --db-url "postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres"
   ```
   (Use `postgresql://`, not `+asyncpg`, for the CLI. Session port 5432 or the direct connection is safest for migrations.)
4. Check: Table Editor shows `users, profiles, matches, intro_requests, notifications, posts, meetings, meeting_outcomes, messages, trust_scores, endorsements, ...`, and Storage shows the private bucket **`post-media`** (created by migration `20260915200000_posts.sql`).
5. Copy `SUPABASE_URL` and the **service_role** key (API only, never the web app).

### Step 2: Clerk (production instance)
1. Clerk dashboard → create a **Production** instance (development keys must not be used in prod).
2. Add your domain (e.g. `startupconnect.ai`) and create the DNS records Clerk lists (CNAMEs for `clerk.`, `accounts.`, email). Wait for verification.
3. User & Authentication → enable **Email**, **Google**, **LinkedIn (OIDC)**. Production social logins need **your own** OAuth credentials:
   - Google Cloud Console → OAuth client → redirect URI shown by Clerk.
   - LinkedIn Developer app → "Sign In with LinkedIn using OpenID Connect" → redirect URI shown by Clerk.
4. Optional: enable MFA (used by Settings → Account).
5. Paths: sign-in `/sign-in`, sign-up `/sign-up`, after sign-up `/onboarding`, after sign-in `/home`.
6. Copy `pk_live_...` and `sk_live_...`.

### Step 3: Qdrant Cloud
1. cloud.qdrant.io → create a Free 1 GB cluster (region close to Railway, e.g. AWS ap-south-1 or Singapore).
2. Copy the cluster URL and create an API key.
3. Nothing else to do: the API creates the `profiles` collection (384-dim) and fills it when users open Matches.

### Step 4: Groq
1. console.groq.com → API Keys → create a production key.
2. Check that the project can use `openai/gpt-oss-120b` and `openai/gpt-oss-safeguard-20b`; enable billing for production limits.

### Step 5: Railway, API service
1. railway.app → New Project → **Deploy from GitHub repo** → select the repo.
2. Service → Settings:
   - **Root Directory:** `apps/api`
   - **Builder:** Railpack / Nixpacks (auto-detects `requirements.txt`).
   - **Build Command:** `pip install -r requirements.txt -r requirements-ml.txt` — the second file holds PyTorch (CPU build) and sentence-transformers for in-process embeddings. Without it the API still runs, but matching and search fall back to structured-only ranking.
   - **Python version:** add variable `NIXPACKS_PYTHON_VERSION=3.12` (or `RAILPACK_PYTHON_VERSION=3.12`), or add a `.python-version` file containing `3.12` to `apps/api`.
   - **Start Command:**
     ```bash
     uvicorn app.main:app --host 0.0.0.0 --port $PORT --proxy-headers --forwarded-allow-ips="*"
     ```
   - **Healthcheck Path:** `/health` (returns `{"status":"ok"}`), timeout 300 s (the first boot downloads the model).
   - **Replicas: 1.** Realtime messaging (S6) keeps WebSocket connections in memory. With 2+ replicas, users on different instances won't get live messages until Redis pub-sub is added.
   - Resources: at least **2 GB RAM** (torch + MiniLM ≈ 1–1.3 GB).
3. Variables: add everything from §3.1.
4. Networking → **Generate Domain** (or add a custom domain `api.startupconnect.ai` with Railway's CNAME). WebSockets work on Railway domains with no extra setting.
5. Deploy and watch the logs until uvicorn reports "Application startup complete".
6. Test: `curl https://<api-domain>/health` returns `{"status":"ok"}`. `curl https://<api-domain>/v1/me` returns 401 problem+json (expected without a token).

### Step 6: Railway cron services (background jobs)
Create **4 more services** in the same project, all from the same GitHub repo with **Root Directory `apps/api`** and the **same variables** (use Railway "Shared Variables" to avoid copying). For each: Settings → **Cron Schedule**, no domain, no healthcheck, Restart policy **Never**.

| Service name | Start command | Cron (UTC) | What it does |
|---|---|---|---|
| `meeting-notifications` | `python -m app.workers.meeting_notifications` | `*/15 * * * *` | 24h and 1h meeting reminders; outcome prompt 2h after the meeting, final reminder at 7 days, outcome_unknown at 14 days (S3/S4) |
| `compute-trust` | `python -m app.workers.compute_trust` | `30 20 * * *` (02:00 IST) | Nightly trust badges (S7) |
| `purge-accounts` | `python -m app.workers.purge_accounts` | `0 21 * * *` (02:30 IST) | Hard-deletes accounts 30 days after deletion request; deletes Clerk user, profile data, vectors, storage (M10) |
| `purge-posts` | `python -m app.workers.purge_posts` | `30 21 * * *` (03:00 IST) | Hard-deletes posts soft-deleted >30 days ago; removes unattached uploads >24h (M4) |

Each job must exit when finished (they do). Check a run via the service's Deployments → logs (e.g. `trust_recompute_finished profiles=N`).

### Step 7: Vercel, web app
1. vercel.com → Add New → Project → import the GitHub repo.
2. **Root Directory:** `apps/web`. Framework preset: **Next.js** (auto). Build `next build`, output default, install `npm install`. Node.js **20.x**.
3. Environment Variables: everything from §3.2 (Production, plus Preview if you want preview deploys to work).
4. Deploy. Then Settings → Domains → add `startupconnect.ai` (+ `www`) and set the DNS records Vercel shows.
5. **Go back to Railway** and make sure `CORS_ORIGINS` contains the exact final web origin(s) (`https://startupconnect.ai`, plus `https://<project>.vercel.app` if you use it). Redeploy the API after changing it.

### Step 8: Connect everything
- Clerk → Domains / allowed origins includes the Vercel domain.
- Vercel `NEXT_PUBLIC_API_URL` = Railway API domain → redeploy Vercel if changed.
- Railway `CORS_ORIGINS` = Vercel domain(s) → redeploy the API if changed.

---

## 5. Option B: put the API on Vercel too (free, for the testing phase)

Same Supabase, Clerk, Groq and Qdrant setup as §4 (steps 1–4), but the API runs as a Vercel Python
Function instead of a Railway service, so the whole stack sits on Vercel's free Hobby plan. Move to
Railway (§4, steps 5–6) before real users: the limits below are fine for testing and not for launch.

### 5.1 What changes on Vercel

| Area | On Railway | On Vercel (Hobby) |
|---|---|---|
| Embeddings | MiniLM runs in-process (PyTorch) | **Hosted API required.** Vercel bundles everything it installs into the function and allows 500 MB unzipped; with torch the bundle measured **1,129 MB** (2026-09-28). PyTorch and sentence-transformers therefore live in `requirements-ml.txt`, which only Railway and local dev install, and Vercel sets `EMBEDDINGS_API_URL` |
| Vector storage | Qdrant Cloud (or container disk) | **Qdrant Cloud only** — functions have no disk |
| Messaging (S6) | Persistent WebSocket | WebSockets work (Vercel beta) but a connection closes at the function's max duration and is pinned to one instance, so live delivery is best-effort. The app already falls back to a 10-second refresh, so messages still arrive |
| Background jobs | 4 cron services, every 15 min / nightly | Vercel Cron calls `GET /v1/jobs/*`. **Hobby allows one run per day per job**, so meeting reminders and outcome prompts are daily instead of every 15 minutes |
| Long requests | No limit in practice | 60 s max per request. Pitch-deck auto-build (M1) on a large deck can hit it |
| Cold starts | None (always-on) | First request after idle takes a few seconds |

### 5.2 Steps
1. **Qdrant Cloud** is required here: follow §4 step 3 and keep the URL and key.
2. **Hosted embeddings are required** (the function cannot carry PyTorch). Create a free token at huggingface.co → Settings → Access Tokens (read scope), then set on the API project:
   - `EMBEDDINGS_API_URL` = `https://router.huggingface.co/hf-inference/models/sentence-transformers/all-MiniLM-L6-v2/pipeline/feature-extraction`
   - `EMBEDDINGS_API_KEY` = that token
   Vectors stay 384-dimension, so anything already in Qdrant stays valid. Skip this and the API still runs, but matching and search drop the semantic half of the score and rank on sector, stage, cheque and geography alone.
3. **Create a second Vercel project** from the same GitHub repo (the first one is the web app):
   - **Root Directory:** `apps/api`
   - **Framework Preset:** Other. There's no build command; `apps/api/vercel.json` routes every path to `api/index.py`, which serves the FastAPI app.
   - Project Settings → Functions: Python 3.12.
4. **Environment variables:** everything from §3.1 except `QDRANT_URL` must be set (not blank), plus `EMBEDDINGS_API_URL`, `EMBEDDINGS_API_KEY` and `CRON_SECRET` (any long random string). Leave `PORT` alone — Vercel handles it.
5. **Deploy**, then check `https://<api-project>.vercel.app/health` returns `{"status":"ok"}`.
6. **Point the web app at it:** set `NEXT_PUBLIC_API_URL` to that URL in the web project and redeploy.
7. **Set `CORS_ORIGINS`** in the API project to the web app's exact URL (for example `https://startup-connect-ai.vercel.app`), then redeploy the API. Wrong value = every request 401.
8. **Cron:** `apps/api/vercel.json` already declares the four daily jobs. Vercel sends `Authorization: Bearer $CRON_SECRET` automatically once that variable is set. Check them under Project → Cron Jobs after the first deploy.
9. **Run a job by hand** when testing (no need to wait a day):
   ```bash
   curl -H "Authorization: Bearer <CRON_SECRET>" https://<api-project>.vercel.app/v1/jobs/compute-trust
   ```
   Jobs: `meeting-notifications`, `compute-trust`, `purge-accounts`, `purge-posts`. A wrong or missing secret returns 404.

**Build errors seen on this path (2026-09-28), for when the requirements change again:**

| Error | Cause |
|---|---|
| `Total bundle size (1129.56 MB) exceeds the maximum function size (500 MB)` | PyTorch was in `requirements.txt`. That is why it now lives in `requirements-ml.txt` and Vercel uses a hosted embedding API. Set `VERCEL_ANALYZE_BUILD_OUTPUT=1` to see the per-package breakdown in the build log |
| `only urllib3==1.26.13 is available ... qdrant-client cannot be used` | Vercel resolves with **uv**, not pip, and uv takes each package from the first index that lists it. Any `--extra-index-url` for the PyTorch wheels brings its old mirrors of common packages with it. If that index is ever needed here, set the build variable `UV_INDEX_STRATEGY=unsafe-best-match` |
| `no version of torch==2.14.0+cpu` | A `uv.toml` in `apps/api` replaces the whole `[tool.uv].index` field of the `pyproject.toml` Vercel generates from `requirements.txt`, dropping the PyTorch index. Re-declare the index in that file, or delete it |
| Build log shows an old commit hash | Vercel's **Redeploy** rebuilds the same commit. Use Deployments → Create Deployment, or push |

### 5.3 Moving to Railway later
Nothing in the database or the web app changes. Deploy §4 steps 5–6, point `NEXT_PUBLIC_API_URL` at
the Railway URL, update `CORS_ORIGINS`, and delete or pause the Vercel API project. If you ever set
`EMBEDDINGS_API_URL` and `EMBEDDINGS_API_KEY`, clear them so MiniLM runs in-process again (Railway installs `requirements-ml.txt`).

## 6. Post-deploy smoke test (15 minutes)

1. Open the site: landing page loads; `/sign-up` shows the Clerk card.
2. Sign up as a **founder** → `/onboarding`: pick role, accept consents → upload a text-based pitch-deck PDF and a LinkedIn URL → review screen is prefilled (this checks Groq) → save.
3. Open **Matches** (the first load computes matches; this checks Qdrant and the embeddings). With no investors yet, the empty state is expected.
4. In a second browser / incognito window, sign up as an **investor** (thesis: Fintech, Seed, a cheque range covering ₹40L, Pune) → open Matches → the founder appears with a % fit and an explanation.
5. Founder: Request intro → Investor: Intro queue → Accept → both get notifications.
6. **Messages:** send a message from one browser; it appears in the other within about a second (this checks the WebSocket and `CORS_ORIGINS`). Unread badge in the sidebar.
7. Founder: Profile → New post → Image post (this checks Supabase Storage); text post moderation works.
8. Settings → Privacy → Export my data downloads JSON.
9. Railway logs show no 5xx; a cron run of `meeting-notifications` completes.

If every API call fails with 401: `CORS_ORIGINS` doesn't exactly match the web origin (scheme and host, no trailing slash), or the Clerk keys are from different instances.
If matches are empty after redeploys: `QDRANT_URL` is blank (vectors were on the container disk).
If live messages don't arrive: more than one API replica, or a proxy that blocks WebSockets. The thread falls back to 10-second polling.

---

## 7. Local development (reference)

```bash
# Web
cd apps/web && npm install && npm run dev        # http://localhost:3000

# API (uv venv already at apps/api/.venv; Windows path shown)
cd apps/api
uv pip install --python .venv/Scripts/python.exe -r requirements.txt -r requirements-ml.txt
.venv/Scripts/python.exe -m uvicorn app.main:app --reload   # http://localhost:8000/docs

# Migrations (from repo root)
npx supabase db push --db-url "<postgres url>"
```
The API reads the repo-root `.env`. Blank `QDRANT_URL` locally = embedded Qdrant in `apps/api/.qdrant` (or similar local path).

Quality checks before pushing:
```bash
cd apps/api && .venv/Scripts/python.exe -m ruff check app && .venv/Scripts/python.exe -m mypy app
cd apps/web && npx tsc --noEmit && npx next build
```

---

## 8. Operations notes and known limits

| Topic | Current state | When to act |
|---|---|---|
| API scaling | 1 Railway replica (in-memory WebSocket hub) | Before scaling out, add Upstash Redis pub-sub in `app/services/realtime.py` |
| Background queue | None; recompute and explanations run in-request / as FastAPI background tasks | Add RQ + Upstash when requests slow down |
| Email / WhatsApp | Not built; notifications are in-app only | Week 7+ (SendGrid/Resend, 360dialog) |
| Cal.com sync | Bookings recorded from the embed event; cancellations / reschedules in Cal.com are **not** synced | Add a "cancel/reschedule" action or Cal.com Platform webhooks |
| Analytics | Events are written to API logs (`logger.info("event_name ...")`); no PostHog / Mixpanel yet | Week 6 analytics wiring |
| Backups | Supabase Pro daily backups | Enable PITR later |
| CI | None; Vercel and Railway auto-deploy on push to `main` | Add GitHub Actions: ruff, mypy, tsc, build |
| Admin access | Supabase / Clerk / Railway / Vercel dashboards | Give each teammate their own login; don't share accounts |
| Cost (1k users, est.) | Vercel Pro $20, Supabase Pro $25, Qdrant $0–25, Railway ~$20–30 (API + 4 crons), Groq ~$5, Clerk $0 | Review monthly |

API routes live under `/v1` (see `apps/api/app/routers/*.py`); the OpenAPI UI is at `/docs` in non-production.
Project conventions and every feature decision are in `CLAUDE.md`.

---

## 9. Moving to a new Supabase project

For when the current project is paused, out of free-tier room, or you want a clean production database.

### 9.1 Choose: clean start or copy the data
Everything in the database today is test data — your three accounts plus the seeded demo network — so a
clean start is usually faster and leaves no demo rows behind.

| | Clean start (recommended now) | Copy the data |
|---|---|---|
| Steps | 9.2 → 9.3 → 9.4 → 9.6 → 9.7 → 9.8 | 9.2 → 9.3 → 9.4 → 9.5 → 9.6 → 9.7 |
| Your Clerk logins | Unchanged; onboarding runs again (role + consents) | Unchanged; profiles come back as they were |
| Time | ~10 minutes | ~20 minutes |

### 9.2 Back up the old project (do this either way)
From the repo root, using the **old** project's Session pooler / direct URI (port 5432, starting
`postgresql://`, not `postgresql+asyncpg://`):

```bash
mkdir -p backups
npx supabase db dump --db-url "<OLD_SESSION_URL>" -f backups/schema.sql
npx supabase db dump --db-url "<OLD_SESSION_URL>" --data-only --use-copy -f backups/data.sql
```

`backups/` is git-ignored: the dump holds personal data, so keep it off GitHub. Uploaded images live in
Storage → `post-media`; download any you want to keep (seeded ones are regenerated).

### 9.3 Create the new project
Supabase → **New project**. Region Mumbai (`ap-south-1`), strong database password. Then copy from
Project Settings: **Database → Transaction pooler** URI (port 6543), **Database → Session pooler** URI
(port 5432), and **API → Project URL** plus the **service_role** key.

### 9.4 Create the schema
```bash
npx supabase db push --db-url "<NEW_SESSION_URL>"
```
This replays every migration in `supabase/migrations`. Check the Table Editor, and that Storage lists
the private `post-media` bucket.

### 9.5 Restore the data (only when copying)
```bash
psql "<NEW_SESSION_URL>" -v ON_ERROR_STOP=1 -c "set session_replication_role = replica;" -f backups/data.sql
```
`session_replication_role = replica` defers foreign-key and trigger checks for the session, so table
order in the dump can't fail the restore. Both arguments run in the same session.

### 9.6 Point the app at the new project
In the repo-root `.env`, and in Vercel / Railway (then redeploy):
- `DATABASE_URL` — the **transaction pooler** URI, rewritten as `postgresql+asyncpg://…:6543/postgres`
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — the new project's values

Restart the API, check `GET /health`, then load any signed-in page.

### 9.7 Reset the vector store
Profile ids change on a clean start, so old vectors point at rows that no longer exist:
- **Local (embedded Qdrant):** delete `apps/api/.qdrant-local`.
- **Qdrant Cloud:** delete the `profiles` collection in the dashboard.

The API recreates the collection and re-embeds profiles on the next Matches or search request.

### 9.8 Recreate accounts and demo data (clean start)
Sign in with each of the three accounts, finish `/onboarding` (role + consents), then re-run the seed:

```bash
cd apps/api && .venv/Scripts/python.exe -m app.seed.demo --founder <email> --investor <email> --mentor <email>
```

Keep the old project until the new one has been exercised, then delete it and store `backups/` safely.
