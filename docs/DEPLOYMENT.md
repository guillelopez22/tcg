# La Grieta — Production Deployment Runbook

This document covers the full production deployment for La Grieta:
- API (NestJS) + PostgreSQL + Redis → Railway
- Web (Next.js) → Vercel

For deeper Railway-specific config see `docs/deployment/railway.md`.
For R2 bucket setup see `docs/deployment/r2.md`.

---

## Prerequisites

- Railway account with a project created
- Vercel account connected to the GitHub repo
- Cloudflare R2 bucket created (see `docs/deployment/r2.md`)
- Stripe account (Connect enabled) — optional for marketplace phase
- GitHub repo secrets configured for CI (see CI section below)

---

## 1. Railway — API Service

### 1.1 Services to provision

| Service | Type | Notes |
|---|---|---|
| `api` | Docker (root Dockerfile) | NestJS app |
| `postgres` | Railway PostgreSQL add-on | v16 |
| `redis` | Railway Redis add-on | v7 |

### 1.2 Provisioning steps

1. In your Railway project, click **New Service → Database → PostgreSQL**.
2. Click **New Service → Database → Redis**.
3. Click **New Service → GitHub Repo**, select this repo, set root directory to `/` (root Dockerfile handles everything).
4. In the API service **Settings**, set:
   - **Builder**: Dockerfile
   - **Dockerfile path**: `Dockerfile`
   - **Start command**: `node dist/main.js`
   - **Health check path**: `/api/health`
   - **Health check timeout**: `120`

### 1.3 Environment variables

Set these in the Railway API service **Variables** tab. Use Railway's **Reference Variables** to link add-on credentials automatically.

```
# Linked from Railway add-ons (use the reference variable syntax)
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}

# Application
NODE_ENV=production
API_PORT=3001
API_PREFIX=api

# Auth — generate with: openssl rand -base64 32
JWT_SECRET=<32+ char random base64 string>
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# CORS — set to your Vercel domain after first Vercel deploy
CORS_ORIGINS=https://your-app.vercel.app,https://lagrieta.app

# Cloudflare R2
R2_ACCOUNT_ID=<cloudflare account id>
R2_ACCESS_KEY_ID=<r2 api token key id>
R2_SECRET_ACCESS_KEY=<r2 api token secret>
R2_BUCKET_NAME=la-grieta-prod
R2_PUBLIC_URL=https://pub-<hash>.r2.dev

# Stripe (when marketplace is live)
# STRIPE_SECRET_KEY=sk_live_...
# STRIPE_WEBHOOK_SECRET=whsec_...
```

All variables are documented in `.env.example` at the repo root.

### 1.4 Migrations

Drizzle migrations run automatically on every API startup before the server begins accepting traffic. No manual migration step is required after deploy.

If you need to run migrations manually (e.g., from a local machine against prod):

```bash
DATABASE_URL="<prod connection string>" pnpm --filter @la-grieta/db exec drizzle-kit migrate
```

### 1.5 Verifying the API deploy

```bash
curl https://<your-railway-domain>/api/health
# Expected: {"status":"ok"}
```

---

## 2. Railway — Web Service

### 2.1 Provisioning

1. In the same Railway project, click **New Service → GitHub Repo**.
2. Select this repo.
3. In the service **Settings**, set:
   - **Service name**: `web`
   - **Builder**: Dockerfile
   - **Dockerfile path**: `apps/web/Dockerfile`
   - **Health check path**: `/`
   - **Health check timeout**: `60`

### 2.2 Environment variables

Set these in the Railway web service **Variables** tab:

```
# Build-time vars (NEXT_PUBLIC_ are inlined during docker build)
NEXT_PUBLIC_API_URL=https://<your-railway-api-domain>/api
NEXT_PUBLIC_R2_PUBLIC_URL=https://pub-<hash>.r2.dev

# Runtime
PORT=3000
HOSTNAME=0.0.0.0
```

**Important:** `NEXT_PUBLIC_*` vars are baked in at build time. If you change them, Railway must rebuild (not just restart).

### 2.3 Custom domain

1. In Railway web service settings, add your custom domain (e.g., `lagrieta.app`).
2. Add a CNAME record in your DNS provider pointing to Railway's domain.
3. Once the domain is verified, update `CORS_ORIGINS` in the API service to include it.

---

## 3. Database Seeding

Run these from your local machine after the first successful Railway deploy. Requires `DATABASE_URL` to be set in your local environment (copy from Railway dashboard).

### 3.1 Card data (required — app is useless without this)

```bash
# Seed all cards from the bundled riftbound-tcg-data repo
pnpm --filter @la-grieta/seed exec tsx src/seed-cards.ts
```

This reads from `riftbound-tcg-data/` (the cloned apitcg repo) — no network calls.

### 3.2 Tournament decks

```bash
# Seed pre-built tournament decks into the community deck pool
pnpm --filter @la-grieta/seed exec tsx src/seed-tournament-decks.ts
```

### 3.3 Official tournament results

```bash
# Scrape and store official tournament metadata
pnpm --filter @la-grieta/seed exec tsx src/scrape-official-tournaments.ts
```

### 3.4 RiftDecks community decks (optional)

```bash
# Scrape trending decks from riftdecks.com
pnpm --filter @la-grieta/seed exec tsx src/scrape-riftdecks.ts
```

---

## 4. CI/CD Pipeline

The GitHub Actions workflow at `.github/workflows/ci.yml` runs on every push:

| Job | Triggers |
|---|---|
| `install` | Always |
| `type-check` | After install |
| `lint` | After install |
| `test` | After install (spins up Postgres + Redis) |
| `build` | After type-check + lint |

**Railway** auto-deploys from `main` branch when CI passes (configure this in Railway service → Settings → Deploy Triggers → GitHub).

**Vercel** auto-deploys from `main` on every push. Preview deployments are created for pull requests automatically.

---

## 5. Post-Deploy Verification Checklist

After every production deploy, verify the following manually or via your monitoring tool:

- [ ] `GET /api/health` returns `{"status":"ok"}`
- [ ] Card browser loads at `/cards` with card images visible
- [ ] Login and register flows complete without errors
- [ ] Collection CRUD: add a card, verify it persists, remove it
- [ ] Deck builder: create a draft deck, add cards, publish
- [ ] Match: create a match, get the QR/code, join from a second tab
- [ ] News feed: at least one article visible on the dashboard
- [ ] R2 uploads: upload a listing image, verify it renders from the public URL

---

## 6. Rollback

### Railway rollback

1. Open Railway project → API service → **Deployments** tab.
2. Find the last known-good deployment.
3. Click **Redeploy** on that entry.

Railway reruns the same Docker image — no rebuild required.

### Vercel rollback

1. Open Vercel project → **Deployments**.
2. Find the target deployment, click the three-dot menu → **Promote to Production**.

---

## 7. Secrets Rotation

| Secret | Rotation procedure |
|---|---|
| `JWT_SECRET` | Update Railway env var → redeploy. All existing sessions are invalidated — users must log in again. |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | Create new R2 token in Cloudflare, update Railway env vars, redeploy, then delete old token. |
| `DATABASE_URL` | Rotate Railway Postgres credentials in the add-on settings — Railway updates the reference variable automatically. |

---

## 8. Environment Variable Reference

See `.env.example` at the repo root for the complete list with descriptions and default values.
