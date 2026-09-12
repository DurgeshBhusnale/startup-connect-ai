# Startup Connect AI

AI-driven matching platform connecting early-stage Indian founders with the right investors and mentors — with plain-language explanations for every match.

**Status:** Week 1 of 6-week MVP sprint. See `docs/StartupConnectAI_6Week_Sprint_Plan.docx` for the full build calendar.

---

## Quick start

### Prerequisites
- Node.js 20+
- Python 3.12+
- A Supabase project ([free tier](https://supabase.com))
- A Clerk account ([free tier ≤ 10k MAU](https://clerk.com))
- A Qdrant Cloud cluster ([free 1GB tier](https://cloud.qdrant.io))
- A Groq API key ([free tier](https://console.groq.com))

### Setup

```bash
# 1. Clone
git clone https://github.com/YOUR_USERNAME/startup-connect-ai.git
cd startup-connect-ai

# 2. Copy env vars and fill in
cp .env.example .env
# Edit .env with your real keys

# 3. Frontend
cd apps/web
npm install
npm run dev
# → http://localhost:3000

# 4. Backend (new terminal)
cd apps/api
python -m venv .venv
source .venv/bin/activate   # macOS/Linux
# .venv\Scripts\activate    # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload
# → http://localhost:8000

# 5. Supabase (new terminal, from repo root)
npx supabase start
npx supabase db push
```

---

## Documentation

All strategy, design, and specification docs live in `/docs`:

| Document | Purpose |
|---|---|
| `StartupConnectAI_Research_Report.docx` | Market research, literature review, design decisions |
| `StartupConnectAI_Business_Architecture.docx` | Actors, MoSCoW use cases, personas, monetization |
| `StartupConnectAI_Wardley_Mapping.docx` | Build/buy strategy (W1–W15) |
| `StartupConnectAI_Technical_Architecture.docx` | System design, data model, ML pipeline, deployment |
| `StartupConnectAI_PRD.docx` | Engineer-executable user stories (M1–M10, S1–S9) |
| `StartupConnectAI_UI_Design_Brief.docx` | Design system + screen prompts (S-01 to S-28) |
| `StartupConnectAI_6Week_Sprint_Plan.docx` | Week-by-week build calendar |

Also: `CLAUDE.md` — project memory for Claude Code sessions.

---

## Tech stack

- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind CSS, deployed on Vercel
- **Backend:** FastAPI (Python 3.12), deployed on Railway
- **Database:** Supabase Postgres with RLS
- **Vector DB:** Qdrant Cloud
- **Object storage:** Cloudflare R2
- **Auth:** Clerk
- **LLM:** Groq (Llama-3.1-70b) primary, OpenAI GPT-4o-mini fallback
- **Embeddings:** sentence-transformers/all-MiniLM-L6-v2 (384-dim, self-hosted)
- **Queue:** Upstash Redis + BullMQ

Full breakdown in `docs/StartupConnectAI_Technical_Architecture.docx`.

---

## Repository structure

```
apps/
  web/       # Next.js frontend
  api/       # FastAPI backend
docs/        # Strategy + design docs (read-only reference)
supabase/    # DB migrations
designs/     # Screen designs from Stitch/Figma
```

---

## Contributing

Solo build for now. If you'd like to help, ping [@durgesh].

## License

Proprietary — not for redistribution.
