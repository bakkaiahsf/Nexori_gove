# NexoriOS — Keys, Git & Vercel Deploy Guide

> Complete setup to get every API key + wire GitHub → Vercel so every `git push` deploys automatically.

---

## Overview — What Keys You Need

| Key | Service | Used For | Free Tier |
|---|---|---|---|
| `GITHUB_PAT` | GitHub | MCP connector, CI/CD | ✅ Free |
| `VERCEL_TOKEN` | Vercel | Auto-deploy from GitHub Actions | ✅ Free |
| `VERCEL_ORG_ID` | Vercel | CI/CD targeting | ✅ Free |
| `VERCEL_PROJECT_ID` | Vercel | CI/CD targeting | ✅ Free |
| `DATABASE_URL` | Supabase | Prisma ORM (pooled connection) | ✅ Free (500MB) |
| `DIRECT_URL` | Supabase | Prisma migrations (direct connection) | ✅ Free |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase | Frontend client | ✅ Free |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase | Frontend client (public) | ✅ Free |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase | Server-side admin operations | ✅ Free |
| `ANTHROPIC_API_KEY` | Anthropic | Claude APIs (primary AI) | 💳 Pay-as-you-go |
| `OPENAI_API_KEY` | OpenAI | text-embedding-3-small (RAG) | 💳 Pay-as-you-go |
| `NEXTAUTH_SECRET` | NextAuth.js | Session encryption | ✅ Generated locally |
| `NEXTAUTH_URL` | NextAuth.js | Auth callback URL | ✅ Your domain |
| `FIGMA_API_KEY` | Figma | Design MCP connector | ✅ Free |

---

## Step 1 — GitHub PAT (Personal Access Token)

**What it's for:** MCP GitHub connector + GitHub Actions can push to your repo.

1. Go to → **https://github.com/settings/tokens?type=beta**
2. Click **"Generate new token"** → **Fine-grained token**
3. Settings:
   - **Token name:** `nexori-os-dev`
   - **Expiration:** 90 days (renew quarterly)
   - **Repository access:** Select **"Only select repositories"** → choose `nexori-governance-os`
   - **Permissions → Repository:**
     - Contents: **Read and write**
     - Pull requests: **Read and write**
     - Issues: **Read and write**
     - Actions: **Read and write**
     - Metadata: **Read** (auto-selected)
4. Click **Generate token** → **Copy immediately** (shown only once)
5. Save as: `GITHUB_PAT=ghp_xxxxxxxxxxxxxxxxxxxx`

---

## Step 2 — Create GitHub Repository

```bash
# In your terminal (once scaffold is ready):
cd ~/Developer/AI-Projects/nexori-governance-os
git init
git add .
git commit -m "chore: initial NexoriOS scaffold"

# Create repo on GitHub (install GitHub CLI first if needed: brew install gh)
gh repo create nexori-governance-os \
  --private \
  --description "NexoriOS — Enterprise Governance Operating Platform" \
  --source=. \
  --remote=origin \
  --push
```

Alternatively via browser:
1. Go to **https://github.com/new**
2. Repository name: `nexori-governance-os`
3. Visibility: **Private**
4. Do NOT initialise with README (you already have files)
5. Create → copy the remote URL → run:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/nexori-governance-os.git
   git branch -M main
   git push -u origin main
   ```

---

## Step 3 — Supabase (PostgreSQL + pgvector)

**What it's for:** Database (Prisma), auth, pgvector for RAG embeddings.

1. Go to → **https://supabase.com** → Sign in with GitHub
2. Click **"New project"**
   - Organisation: your personal org or create `nexori-agency`
   - Project name: `nexori-os`
   - Database password: **generate a strong one — save it now**
   - Region: **West EU (Ireland)** — closest to UK banking clients, GDPR compliant
   - Plan: **Free** to start
3. Wait ~2 minutes for provisioning
4. Go to **Project Settings → Database**
   - Scroll to **"Connection string"**
   - Tab: **URI** → copy **"Transaction pooler"** URL → this is your `DATABASE_URL`
   - Tab: **URI** → copy **"Direct connection"** URL → this is your `DIRECT_URL`
   - Replace `[YOUR-PASSWORD]` in both URLs with the password you saved

5. Go to **Project Settings → API**
   - Copy **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - Copy **anon / public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Copy **service_role / secret** key → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ Never expose this in frontend

6. Enable pgvector:
   - Go to **SQL Editor** in Supabase dashboard
   - Run: `CREATE EXTENSION IF NOT EXISTS vector;`
   - Click **Run** → confirm success

> **Format of URLs:**
> - `DATABASE_URL` (pooler): `postgresql://postgres.xxxx:[PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true`
> - `DIRECT_URL`: `postgresql://postgres.xxxx:[PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`

---

## Step 4 — Anthropic API Key

**What it's for:** Claude APIs — governance analysis, evidence drafting, RAG LLM layer.

1. Go to → **https://console.anthropic.com**
2. Sign in (or create account with `bakkaiahsf@gmail.com`)
3. Click **"API Keys"** in left sidebar
4. Click **"Create Key"**
   - Name: `nexori-os-dev`
5. Copy the key → save as `ANTHROPIC_API_KEY=sk-ant-xxxx`

> **Cost note:** With `claude-sonnet-4-6` at ~$3/MTok input + $15/MTok output, development usage will be roughly $5–15/month. Set a spend limit at **https://console.anthropic.com/settings/limits** → recommended: $50/month during development.

---

## Step 5 — OpenAI API Key

**What it's for:** `text-embedding-3-small` for pgvector RAG embeddings. Very cheap ($0.02/MTok).

1. Go to → **https://platform.openai.com/api-keys**
2. Click **"+ Create new secret key"**
   - Name: `nexori-os-embeddings`
   - Project: Default (or create `nexori-os`)
3. Copy the key → save as `OPENAI_API_KEY=sk-proj-xxxx`

> **Cost note:** Embedding costs are minimal. 1M tokens of text ≈ $0.02. For governance documents, expect < $1/month.

---

## Step 6 — Figma API Key

**What it's for:** Figma MCP connector — Claude Code can read your Figma designs directly.

1. Go to → **https://www.figma.com/developers/api#access-tokens**
   Or: Figma → top-left menu → **Help and account** → **Account settings** → scroll to **Personal access tokens**
2. Click **"Create new token"**
   - Description: `nexori-os-mcp`
   - Expiration: **No expiration** (or 1 year)
   - Scopes: **File content: Read-only** + **Dev resources: Read-only**
3. Copy the token → save as `FIGMA_API_KEY=figd_xxxx`

---

## Step 7 — NextAuth Secret

**What it's for:** Encrypting NextAuth.js sessions. Generate locally — never reuse across environments.

```bash
# Run this in your terminal to generate a secure secret:
openssl rand -base64 32
```

Save the output as `NEXTAUTH_SECRET=<generated-value>`

---

## Step 8 — Vercel Setup & Token

### 8a. Create Vercel Account & Project

1. Go to → **https://vercel.com** → Sign in with GitHub
2. Click **"Add New Project"**
3. Import your `nexori-governance-os` GitHub repository
4. Framework: **Next.js** (auto-detected)
5. Root directory: `/` (default)
6. Do NOT deploy yet — click **"Environment Variables"** first (we'll add them below)
7. Click **"Deploy"** once env vars are set

### 8b. Get Vercel Token + IDs (for GitHub Actions CI/CD)

**Vercel Token:**
1. Go to → **https://vercel.com/account/tokens**
2. Click **"Create"**
   - Name: `nexori-os-github-actions`
   - Scope: **Full Account**
   - Expiration: 1 year
3. Copy → save as `VERCEL_TOKEN=xxxxxxxx`

**Vercel Org ID + Project ID:**
```bash
# Install Vercel CLI
npm i -g vercel

# Link local project to Vercel (run from your project root)
vercel link

# This creates .vercel/project.json — open it:
cat .vercel/project.json
# Output: {"orgId":"team_xxxx","projectId":"prj_xxxx"}
```

Save:
- `VERCEL_ORG_ID=team_xxxx`
- `VERCEL_PROJECT_ID=prj_xxxx`

> Add `.vercel/` to `.gitignore` — do not commit this folder.

---

## Step 9 — Add All Env Vars to Vercel Dashboard

Go to **Vercel → nexori-governance-os → Settings → Environment Variables**

Add each variable below. For each one, set environments to: ✅ Production ✅ Preview ✅ Development (unless noted otherwise).

| Variable | Environment | Value |
|---|---|---|
| `DATABASE_URL` | All | Supabase pooler URL |
| `DIRECT_URL` | All | Supabase direct URL |
| `NEXT_PUBLIC_SUPABASE_URL` | All | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | All | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | All | Supabase service role key |
| `ANTHROPIC_API_KEY` | All | Anthropic key |
| `OPENAI_API_KEY` | All | OpenAI key |
| `NEXTAUTH_SECRET` | All | Generated secret |
| `NEXTAUTH_URL` | Production only | `https://nexori-os.vercel.app` |
| `NEXTAUTH_URL` | Preview only | `https://$VERCEL_URL` (Vercel auto-sets this) |
| `FIGMA_API_KEY` | Development only | Figma token |
| `GITHUB_PAT` | Development only | GitHub PAT |

---

## Step 10 — Add Secrets to GitHub Repository

Go to **GitHub → nexori-governance-os → Settings → Secrets and variables → Actions → New repository secret**

Add these (used by GitHub Actions CI/CD):

| Secret Name | Value |
|---|---|
| `VERCEL_TOKEN` | Your Vercel token |
| `VERCEL_ORG_ID` | From `.vercel/project.json` |
| `VERCEL_PROJECT_ID` | From `.vercel/project.json` |
| `DATABASE_URL` | Supabase pooler URL |
| `DIRECT_URL` | Supabase direct URL |
| `ANTHROPIC_API_KEY` | Anthropic key |
| `OPENAI_API_KEY` | OpenAI key |
| `NEXTAUTH_SECRET` | Generated secret |

---

## Step 11 — Local .env.local File

Create this file in your project root (never commit it):

```bash
# Copy from .env.example
cp .env.example .env.local
# Then fill in all values
```

Verify `.env.local` is in `.gitignore`:
```bash
grep ".env.local" .gitignore || echo ".env.local" >> .gitignore
```

---

## Step 12 — Test the Full Loop

Once everything is wired:

```bash
# 1. Make a change
echo "// test" >> src/app/page.tsx

# 2. Commit and push
git add .
git commit -m "test: verify CI/CD pipeline"
git push origin main

# 3. Watch GitHub Actions
# → Go to: https://github.com/YOUR_USERNAME/nexori-governance-os/actions
# → See: typecheck → lint → deploy to Vercel

# 4. Vercel auto-deploys
# → Preview URL appears in the GitHub PR / Actions log
# → Production URL: https://nexori-os.vercel.app
```

For feature branches (preview deploys):
```bash
git checkout -b feature/governance-timeline
# ... make changes ...
git push origin feature/governance-timeline
# → Vercel creates a unique preview URL: https://nexori-os-git-feature-governance-timeline-xxxx.vercel.app
# → GitHub Actions runs typecheck + lint before deploying
```

---

## Iteration Workflow (Daily)

```
Code locally → git push → GitHub Actions (typecheck + lint) → Vercel preview deploy
                                                                     ↓
                                                         Test on preview URL
                                                                     ↓
                                              Merge PR → Auto-deploy to production
```

Every push to any branch = a unique preview URL. Every merge to `main` = production deploy. Zero manual steps after initial setup.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `prisma migrate dev` fails | Use `DIRECT_URL` not `DATABASE_URL` for migrations |
| Vercel build fails on env vars | Check all vars are added to Vercel dashboard for "Preview" environment |
| `NEXTAUTH_URL` wrong on preview | Set to `https://$VERCEL_URL` for Preview environment |
| pgvector extension missing | Run `CREATE EXTENSION IF NOT EXISTS vector;` in Supabase SQL Editor |
| GitHub Actions can't find secrets | Verify secret names match exactly (case-sensitive) |
| Figma MCP not connecting | Ensure `FIGMA_API_KEY` is set in `.env.local` for local Claude Code sessions |

---

*Last updated: 2026-05-22*
