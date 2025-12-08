# Build Lab

Turn app ideas into live products in 48-72 hours. No waiting, no $50k agency fees.

## What is Build Lab?

Build Lab is an automated SaaS factory that takes your app idea through an intake form and deploys a working application within hours. The system uses pre-built templates, automatic branding injection, and one-click Vercel deployment.

## Live Site

**Production:** https://lab-thebuildlabzs-projects.vercel.app

## How It Works

```
User fills intake form → API saves to Supabase → GitHub Action triggered
                                                        ↓
Email sent with live URL ← Vercel deploys app ← Template cloned & branded
```

1. **Intake** (`/intake`) - 7-step form captures app idea, features, integrations
2. **Template Matching** - Keywords match to pre-built templates (contractor-crm, freelancer-invoices, etc.)
3. **Auto Deploy** - GitHub Action clones template, injects branding via sed, deploys to Vercel
4. **Status Tracking** (`/status/:id`) - Real-time progress with polling
5. **Email Notifications** - Welcome email + deployment confirmation via Resend

## Tech Stack

- **Frontend:** React 19 + Vite + React Router
- **API:** Vercel Serverless Functions (ESM)
- **Database:** Supabase (PostgreSQL)
- **Deployment:** Vercel + GitHub Actions
- **Email:** Resend API

## Quick Start

```bash
# Clone
git clone https://github.com/thebuildlabz/lab.git
cd lab

# Install
npm install

# Configure (copy and edit with your keys)
cp .env.example .env.local

# Run locally (API proxies to production)
npm run dev
```

## Environment Variables

```bash
# Database
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=eyJhbGci...

# GitHub (triggers deploys)
GITHUB_TOKEN=ghp_xxx
FACTORY_REPO=thebuildlabz/factory

# Email
RESEND_API_KEY=re_xxx

# Internal
STATUS_API_KEY=your-secret
VITE_API_URL=https://your-site.vercel.app
```

## Project Structure

```
lab/
├── api/                    # Vercel serverless functions
│   ├── intake.js           # POST /api/intake - creates project
│   └── project/
│       ├── [id].js         # GET /api/project/:id - status
│       └── update.js       # POST /api/project/update - from GitHub Action
├── src/
│   ├── pages/
│   │   ├── Home.jsx        # Landing page
│   │   ├── Intake.jsx      # 7-step intake form
│   │   ├── Status.jsx      # Project tracking
│   │   └── Demos.jsx       # Template showcase
│   ├── App.jsx             # Router
│   └── App.css             # Styles
├── database/
│   └── schema.sql          # Supabase schema
├── DEPLOYMENT.md           # Full deployment guide
└── vercel.json             # Vercel config
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/intake` | POST | Submit new project |
| `/api/project/[id]` | GET | Get project status |
| `/api/project/update` | POST | Update status (from GitHub Action) |

## Related Repos

- **[factory](https://github.com/thebuildlabz/factory)** - Templates + GitHub Action workflow

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete setup instructions including:
- Supabase database setup
- GitHub Actions configuration
- Vercel environment variables
- Troubleshooting guide

## License

MIT
