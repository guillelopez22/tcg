# Railway Deployment — La Grieta API

## Overview

La Grieta deploys to [Railway](https://railway.app) as separate services inside a single project. This document covers the API service setup. The same project hosts the managed PostgreSQL and Redis add-ons that the API connects to.

```
Railway Project: la-grieta
├── Service: api          ← NestJS, built from Dockerfile
├── Service: postgres     ← Railway-managed PostgreSQL 16
└── Service: redis        ← Railway-managed Redis 7
```

---

## Prerequisites

- Railway account with a project created (free tier works for dev; Pro for production)
- Railway CLI installed: `npm install -g @railway/cli`
- Docker installed locally (to test builds before pushing)
- GitHub repo connected to Railway for automatic deploys

---

## First-Time Setup

### 1. Create the Railway Project

```bash
# Login to Railway
railway login

# Create a new project (or link an existing one)
railway init
# Name it: la-grieta
```

### 2. Provision PostgreSQL

In the Railway dashboard:

1. Inside your project, click **+ New Service**
2. Select **Database → PostgreSQL**
3. Railway provisions PostgreSQL 16 automatically
4. Click the Postgres service → **Variables** tab
5. Copy the `DATABASE_URL` value (format: `postgresql://user:pass@host:port/dbname`)

Or via CLI:
```bash
railway add --service postgres
```

Railway automatically injects `DATABASE_URL` into the Postgres service. You need to **reference** this variable in your API service (see step 5).

### 3. Provision Redis

1. Click **+ New Service → Database → Redis**
2. Railway provisions Redis 7 automatically
3. Copy the `REDIS_URL` value from the Redis service Variables tab

Or via CLI:
```bash
railway add --service redis
```

### 4. Create the API Service

1. Click **+ New Service → GitHub Repo**
2. Select the `la-grieta` repository
3. Railway detects `railway.toml` at the repo root and uses the Dockerfile builder automatically
4. The service is named `api` — rename it in Settings if needed

### 5. Configure Environment Variables

In the API service → **Variables** tab, set the following. Use **Reference Variables** (`${{Postgres.DATABASE_URL}}`) where possible to avoid duplicating secrets.

#### Required — Infrastructure (use Reference Variables)

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `REDIS_URL` | `${{Redis.REDIS_URL}}` |

> Railway injects the service name as the reference prefix. If your Postgres service is named "postgres", use `${{postgres.DATABASE_URL}}`. Adjust to match your actual service names.

#### Required — Application

| Variable | Value | Notes |
|----------|-------|-------|
| `NODE_ENV` | `production` | |
| `API_PORT` | `3001` | Railway also injects `$PORT`; the app should use `process.env.PORT \|\| process.env.API_PORT` |
| `API_PREFIX` | `api` | |
| `JWT_SECRET` | *(generate a strong secret)* | Min 32 chars. Use `openssl rand -hex 32` |
| `JWT_ACCESS_TOKEN_TTL` | `900` | 15 minutes in seconds |
| `JWT_REFRESH_TOKEN_TTL` | `2592000` | 30 days in seconds |
| `CORS_ORIGINS` | `https://lagrieta.app,https://www.lagrieta.app` | Comma-separated |

#### Required — Cloudflare R2

| Variable | Value |
|----------|-------|
| `R2_ACCOUNT_ID` | From Cloudflare dashboard |
| `R2_ACCESS_KEY_ID` | R2 API token Access Key ID |
| `R2_SECRET_ACCESS_KEY` | R2 API token Secret Access Key |
| `R2_BUCKET_NAME` | `la-grieta-uploads` |
| `R2_PUBLIC_URL` | `https://uploads.lagrieta.app` |

#### Optional — Rate Limiting (defaults shown)

| Variable | Default |
|----------|---------|
| `THROTTLE_PUBLIC_LIMIT` | `100` |
| `THROTTLE_PUBLIC_TTL` | `60000` |
| `THROTTLE_AUTH_LIMIT` | `1000` |
| `THROTTLE_AUTH_TTL` | `60000` |
| `THROTTLE_LOGIN_LIMIT` | `10` |
| `THROTTLE_LOGIN_TTL` | `60000` |

> For a full list of all variables, see `.env.example` at the repo root.

### 6. Set the Health Check

Railway reads the health check configuration from `railway.toml`:

```toml
[deploy.healthcheck]
path = "/api/health"
timeoutSeconds = 120
intervalSeconds = 10
```

The NestJS API must expose `GET /api/health` returning HTTP 200. Implement this with `@nestjs/terminus`:

```typescript
// apps/api/src/modules/health/health.controller.ts
@Controller('health')
export class HealthController {
  constructor(private health: HealthCheckService, private db: TypeOrmHealthIndicator) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([]);
  }
}
```

> The global prefix `/api` is set in `main.ts`, so the route is registered as `@Controller('health')` — not `@Controller('api/health')`.

### 7. Deploy

```bash
# Deploy from local branch (useful for testing)
railway up

# Or push to main — GitHub auto-deploy fires via the Railway GitHub integration
git push origin main
```

---

## Database Migrations

Migrations run automatically at container startup via the API's bootstrap sequence. The `packages/db/src/migrate.ts` script runs Drizzle migrations before the NestJS app starts accepting traffic.

Railway's health check `timeoutSeconds = 120` gives migrations 2 minutes to complete before Railway considers the deploy failed. For large migration sets, increase this value.

**Manual migration run** (e.g. for emergencies):

```bash
# Open a Railway shell into the running API container
railway run --service api pnpm --filter @la-grieta/db db:migrate
```

---

## Environments

Railway supports multiple environments (Production, Staging) within one project.

| Environment | Branch | Purpose |
|-------------|--------|---------|
| `production` | `main` | Live traffic |
| `staging` | `staging` | Pre-release testing (optional) |

To create a staging environment:

1. Railway dashboard → your project → **Environments** → **+ New Environment**
2. Name it `staging`
3. Set `NODE_ENV=staging` and point `DATABASE_URL` to a separate staging database
4. Enable auto-deploy from the `staging` branch

---

## Custom Domain

1. Railway dashboard → API service → **Settings → Domains**
2. Click **+ Custom Domain** → enter `api.lagrieta.app`
3. Railway shows a CNAME record to add in Cloudflare:
   - **Type**: CNAME
   - **Name**: `api`
   - **Target**: `<your-railway-generated-host>.up.railway.app`
   - **Proxy**: DNS only (grey cloud) — Railway handles TLS termination
4. Once DNS propagates, Railway provisions a Let's Encrypt certificate automatically

---

## Monitoring & Logs

```bash
# Stream live logs from the API service
railway logs --service api

# Or in the Railway dashboard: API service → Logs tab
```

Railway retains logs for 7 days on the free tier, 30 days on Pro.

For structured log search, forward Railway logs to an external sink (Datadog, Logtail, etc.) via Railway's **Log Drains** feature (Pro plan).

---

## Rollback

Railway keeps a deployment history. To roll back:

1. Dashboard → API service → **Deployments** tab
2. Find the last known-good deploy
3. Click **Redeploy** on that entry

Or via CLI:
```bash
railway deployments --service api
# Note the deployment ID
railway rollback <deployment-id> --service api
```

---

## Troubleshooting

### Build fails: "pnpm: command not found"

The Dockerfile enables pnpm via `corepack enable`. Ensure the `PNPM_VERSION` build arg in `railway.toml` matches `packageManager` in root `package.json`.

### Container exits immediately after start

Check Railway logs for startup errors. Common causes:
- Missing required environment variable (NestJS config validation throws on startup)
- `DATABASE_URL` not set or Postgres not yet healthy
- Port mismatch — ensure the app listens on `process.env.PORT || 3001`

### Health check times out

- Verify `GET /api/health` returns 200 (test locally with `curl http://localhost:3001/api/health`)
- Increase `timeoutSeconds` in `railway.toml` if migrations are slow
- Check that `API_PREFIX=api` is set; the route is `/api/health` not `/health`

### bcrypt hanging (Alpine Linux)

This project uses `bcryptjs` (pure JS). If you see bcrypt-related hangs, check that no package is pulling in native `bcrypt`. Run:

```bash
railway run --service api node -e "require('bcrypt')"
# Should fail with "Cannot find module 'bcrypt'" — that's correct
```
