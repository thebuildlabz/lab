# Build Lab - Complete Deployment Guide

Turn app ideas into live products in 48-72 hours. This guide covers everything from local development to production deployment.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Local Development](#local-development)
4. [Database Setup (Supabase)](#database-setup-supabase)
5. [Email Setup (Resend)](#email-setup-resend)
6. [GitHub Setup](#github-setup)
7. [Vercel Deployment](#vercel-deployment)
8. [End-to-End Testing](#end-to-end-testing)
9. [Troubleshooting](#troubleshooting)
10. [API Reference](#api-reference)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         BUILD LAB                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   Frontend   │    │     API      │    │   Database   │       │
│  │   (React)    │───▶│  (Vercel)    │───▶│  (Supabase)  │       │
│  │              │    │              │    │              │       │
│  │ - Home       │    │ - /intake    │    │ - projects   │       │
│  │ - Intake     │    │ - /project   │    │ - events     │       │
│  │ - Status     │    │ - /update    │    │              │       │
│  │ - Demos      │    │              │    │              │       │
│  └──────────────┘    └──────┬───────┘    └──────────────┘       │
│                             │                                    │
│                             ▼                                    │
│                    ┌──────────────┐                              │
│                    │   GitHub     │                              │
│                    │   Actions    │                              │
│                    │              │                              │
│                    │ Deploy       │                              │
│                    │ Template     │                              │
│                    └──────┬───────┘                              │
│                           │                                      │
│                           ▼                                      │
│  ┌────────────────────────────────────────────────────────┐     │
│  │                    FACTORY                              │     │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │     │
│  │  │ contractor  │  │ freelancer  │  │  booking    │     │     │
│  │  │    crm      │  │  invoices   │  │  platform   │     │     │
│  │  └─────────────┘  └─────────────┘  └─────────────┘     │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Flow

1. **Founder** fills intake form at `/intake`
2. **API** saves to Supabase, triggers GitHub Action
3. **GitHub Action** clones template, injects branding, deploys to Vercel
4. **Founder** receives email with live app URL
5. **Status page** shows real-time progress

---

## Prerequisites

- Node.js 18+ installed
- Git installed
- Accounts on:
  - [GitHub](https://github.com) (for code hosting + Actions)
  - [Vercel](https://vercel.com) (for deployment)
  - [Supabase](https://supabase.com) (for database)
  - [Resend](https://resend.com) (for emails - optional)

---

## Local Development

### 1. Clone and Install

```bash
git clone https://github.com/thebuildlabz/lab.git
cd lab
npm install
```

### 2. Create Environment File

```bash
cp .env.example .env.local
```

Edit `.env.local` with your values (see [Environment Variables](#environment-variables)).

### 3. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:5173`

### 4. Test Demo Mode

Without API credentials, the app runs in demo mode:
- Intake form saves to localStorage
- Status page simulates progress
- No emails sent

---

## Database Setup (Supabase)

### 1. Create Project

1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Choose organization and name (e.g., "buildlab-factory")
4. Set database password
5. Select region closest to users

### 2. Get Credentials

Go to **Project Settings → API**:
- Copy `URL` → `SUPABASE_URL`
- Copy `anon public` key → `SUPABASE_KEY`

### 3. Run Schema

Go to **SQL Editor → New Query** and paste:

```sql
-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  project_id TEXT UNIQUE NOT NULL,
  app_name TEXT NOT NULL,
  email TEXT NOT NULL,
  founder_name TEXT,
  problem TEXT,
  features TEXT[],
  integrations TEXT[],
  template TEXT NOT NULL,
  timeline TEXT DEFAULT '72h',
  price INTEGER DEFAULT 2500,
  status TEXT DEFAULT 'pending',
  progress INTEGER DEFAULT 0,
  deployed_url TEXT,
  github_branch TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_projects_project_id ON projects(project_id);
CREATE INDEX IF NOT EXISTS idx_projects_email ON projects(email);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

-- Event log
CREATE TABLE IF NOT EXISTS project_events (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  project_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_project ON project_events(project_id);
```

Click **Run** to execute.

### 4. Verify

Go to **Table Editor** - you should see `projects` and `project_events` tables.

---

## Email Setup (Resend)

### 1. Create Account

1. Go to [resend.com](https://resend.com)
2. Sign up with email
3. Verify email address

### 2. Get API Key

1. Go to **API Keys**
2. Click **Create API Key**
3. Copy key → `RESEND_API_KEY`

### 3. Verify Domain (Production)

For production emails (not going to spam):
1. Go to **Domains**
2. Add your domain
3. Add DNS records as instructed
4. Wait for verification

### 4. Update EMAIL_FROM

```
EMAIL_FROM=Build Lab <hello@yourdomain.com>
```

---

## GitHub Setup

### 1. Create Personal Access Token

1. Go to [github.com/settings/tokens](https://github.com/settings/tokens)
2. Click **Generate new token (classic)**
3. Select scopes:
   - `repo` (full control)
   - `workflow` (update workflows)
4. Copy token → `GITHUB_TOKEN`

### 2. Add Secrets to Factory Repo

Go to `github.com/thebuildlabz/factory/settings/secrets/actions`

Add these secrets:

| Secret | Value |
|--------|-------|
| `VERCEL_TOKEN` | Your Vercel token |
| `VERCEL_ORG_ID` | Your Vercel org/team ID |
| `STATUS_API_URL` | `https://your-site.vercel.app` |
| `STATUS_API_KEY` | Random string (generate with `openssl rand -hex 32`) |

### 3. Push Workflow

```bash
cd factory
git add .github/workflows/deploy-template.yml
git commit -m "Add deploy template workflow"
git push origin main
```

---

## Vercel Deployment

### 1. Get Vercel Credentials

**Token:**
1. Go to [vercel.com/account/tokens](https://vercel.com/account/tokens)
2. Create token → `VERCEL_TOKEN`

**Org ID:**
1. Go to Vercel Dashboard
2. Click team/account settings
3. Copy Team ID → `VERCEL_ORG_ID`

### 2. Deploy Build Lab Site

```bash
cd thebuildlabz
vercel --prod
```

Or connect to GitHub in Vercel dashboard.

### 3. Add Environment Variables

In Vercel project settings → Environment Variables:

| Variable | Value |
|----------|-------|
| `SUPABASE_URL` | Your Supabase URL |
| `SUPABASE_KEY` | Your Supabase anon key |
| `GITHUB_TOKEN` | Your GitHub PAT |
| `RESEND_API_KEY` | Your Resend key |
| `STATUS_API_KEY` | Same as GitHub secret |
| `VITE_API_URL` | Your deployed URL |
| `FACTORY_REPO` | `thebuildlabz/factory` |

### 4. Update GitHub Secret

After deployment, update `STATUS_API_URL` in GitHub secrets with your Vercel URL.

---

## Environment Variables

### Build Lab Site (.env.local)

```bash
# Database
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=eyJhbGci...

# GitHub (for triggering deploys)
GITHUB_TOKEN=ghp_xxxx
FACTORY_REPO=thebuildlabz/factory

# Vercel
VERCEL_TOKEN=vck_xxxx
VERCEL_ORG_ID=team_xxxx

# Email
RESEND_API_KEY=re_xxxx
EMAIL_FROM=Build Lab <hello@buildlab.com>

# Internal
STATUS_API_KEY=your-random-secret
VITE_API_URL=https://your-site.vercel.app
```

### Factory Repo (GitHub Secrets)

```
VERCEL_TOKEN=vck_xxxx
VERCEL_ORG_ID=team_xxxx
STATUS_API_URL=https://your-site.vercel.app
STATUS_API_KEY=your-random-secret
```

---

## End-to-End Testing

### 1. Local Test (Demo Mode)

```bash
npm run dev
# Go to http://localhost:5173/intake
# Fill form with test data
# Submit → should redirect to /status/prj_xxx
# Watch progress animate
```

### 2. Database Test

1. Set `SUPABASE_URL` and `SUPABASE_KEY` in `.env.local`
2. Submit intake form
3. Check Supabase Table Editor → `projects` table
4. Should see new row with your test data

### 3. Email Test

1. Set `RESEND_API_KEY` in `.env.local`
2. Submit intake with real email
3. Check inbox for welcome email

### 4. Full Deploy Test

1. Ensure all secrets are set (GitHub + Vercel)
2. Submit intake form on production site
3. Watch GitHub Actions tab → should see workflow run
4. Check email for deploy notification
5. Click link → should see live app

---

## Troubleshooting

### "Workflow dispatch not found"

**Cause:** Workflow file not on main branch
**Fix:**
```bash
cd factory
git pull origin main
git add .github/workflows/deploy-template.yml
git commit -m "Add workflow"
git push origin main
```

### "GitHub dispatch failed: 401"

**Cause:** Invalid or expired GitHub token
**Fix:**
1. Generate new token at github.com/settings/tokens
2. Ensure `repo` and `workflow` scopes selected
3. Update `GITHUB_TOKEN` in Vercel env vars

### "Vercel deploy failed"

**Cause:** Template has build errors
**Fix:**
1. Check GitHub Actions logs
2. Clone template locally and run `npm install && npm run build`
3. Fix any TypeScript/build errors

### "Email not received"

**Cause:** Domain not verified or wrong from address
**Fix:**
1. Check Resend dashboard for errors
2. Verify domain in Resend settings
3. Update `EMAIL_FROM` to match verified domain

### "Status page shows 'Project Not Found'"

**Cause:** Project not saved to database
**Fix:**
1. Check Supabase connection (URL and key correct?)
2. Check Vercel logs for database errors
3. Verify RLS policies allow inserts

### "Progress stuck at 30%"

**Cause:** GitHub Action not updating status
**Fix:**
1. Check `STATUS_API_URL` and `STATUS_API_KEY` match
2. Verify GitHub Action is running (Actions tab)
3. Check curl command in workflow for errors

---

## API Reference

### POST /api/intake

Create new project from intake form.

**Request:**
```json
{
  "appIdea": "Invoice app for freelancers",
  "problem": "Freelancers waste time on manual invoicing",
  "name": "John Doe",
  "email": "john@example.com",
  "features": ["User authentication", "Payment processing"],
  "integrations": ["Stripe (payments)"],
  "timeline": "72h",
  "targetCustomer": "freelancers"
}
```

**Response:**
```json
{
  "success": true,
  "projectId": "prj_abc123",
  "template": "freelancer-invoices",
  "price": 4500,
  "status": "building",
  "statusUrl": "/status/prj_abc123",
  "message": "Building your freelancer-invoices app..."
}
```

### GET /api/project/[id]

Get project status.

**Response:**
```json
{
  "projectId": "prj_abc123",
  "appName": "Invoice app for freelancers",
  "status": "deployed",
  "progress": 100,
  "deployUrl": "https://prj-abc123.vercel.app",
  "template": "freelancer-invoices",
  "createdAt": "2024-01-15T10:30:00Z",
  "completedAt": "2024-01-15T10:35:00Z",
  "events": [...]
}
```

### POST /api/project/update

Update project status (called by GitHub Action).

**Headers:**
```
Authorization: Bearer {STATUS_API_KEY}
```

**Request:**
```json
{
  "projectId": "prj_abc123",
  "status": "deployed",
  "deployUrl": "https://prj-abc123.vercel.app",
  "email": "john@example.com"
}
```

---

## File Structure

```
thebuildlabz/
├── api/
│   ├── intake.js              # Intake form handler
│   └── project/
│       ├── [id].js            # Get project status
│       └── update.js          # Update from GitHub Action
├── src/
│   ├── pages/
│   │   ├── Home.jsx           # Landing page
│   │   ├── Intake.jsx         # 7-step form
│   │   ├── Status.jsx         # Project tracking
│   │   └── Demos.jsx          # Demo showcase
│   ├── App.jsx                # Router
│   └── App.css                # Styles
├── database/
│   └── schema.sql             # Supabase schema
├── factory/
│   ├── .github/workflows/
│   │   └── deploy-template.yml
│   └── templates/
│       ├── contractor-crm/
│       ├── freelancer-invoices/
│       ├── booking-platform/
│       └── basic-crud/
├── .env.example               # Environment template
├── vercel.json                # Vercel config
└── DEPLOYMENT.md              # This file
```

---

## Quick Commands

```bash
# Development
npm run dev                    # Start local server
npm run build                  # Build for production

# Deployment
vercel --prod                  # Deploy to Vercel

# Factory
cd factory
git add . && git commit -m "Update" && git push

# Database
# Run SQL in Supabase SQL Editor

# Generate secret
openssl rand -hex 32
```

---

## Support

- **Issues:** github.com/thebuildlabz/lab/issues
- **Email:** builds@buildlab.com

---

## License

MIT License - Build what you want.
