# worker-logs

> **Fork of [whoabuddy/worker-logs](https://github.com/whoabuddy/worker-logs)**
> This fork maintains aibtcdev-specific deployment environments.

Centralized logging service for Cloudflare Workers using SQLite-backed Durable Objects.

## Architecture

- **Hono.js** - HTTP routing framework
- **Durable Objects (DO)** - Per-app isolated SQLite storage for logs and stats
- **KV Namespace** - App registry (app_id -> metadata + plaintext API key)
  Note: API keys are stored in plaintext in KV. TODO: implement key hashing before storing.
- **RPC Entrypoint** - `LogsRPC` for service bindings between workers

## Key Files

| Path | Purpose |
|------|---------|
| `src/index.ts` | HTTP API routes, main worker entry |
| `src/rpc.ts` | `LogsRPC` WorkerEntrypoint for service bindings |
| `src/dashboard.ts` | Web dashboard UI for browsing logs |
| `src/durable-objects/app-logs-do.ts` | Durable Object with SQLite for logs + stats |
| `src/services/registry.ts` | App registration, API key management |
| `src/services/stats.ts` | KV-based daily stats aggregation (legacy) |
| `src/middleware/auth.ts` | API key + admin key authentication |
| `src/result.ts` | Ok/Err result type utilities |
| `src/types.ts` | TypeScript type definitions |

## Testing

```bash
npm test           # Run vitest with Cloudflare pool
npm run test:watch # Watch mode
```

Tests use `@cloudflare/vitest-pool-workers` with `isolatedStorage: false` (required for SQLite DOs).

## Authentication

### API Endpoints

| Endpoint | Auth Required |
|----------|---------------|
| `POST /logs` | API Key |
| `GET /logs` | API Key OR Admin Key (with `X-App-ID`) |
| `POST /apps/:id/prune`, `POST /apps/:id/health-urls` | API Key (matching app) |
| `DELETE /apps/:id` | API Key (matching app) OR Admin Key |
| `GET /apps` | Admin Key |
| `POST /apps` | Admin Key |
| `GET /apps/:id`, `GET /stats/:id` | API Key (own app) OR Admin Key |
| `GET /health/:id` | Public (for monitoring) |
| `GET /` | Public (service info) |

### Headers

- **Admin Key**: `X-Admin-Key` header
- **API Key**: `X-Api-Key` + `X-App-ID` headers

### Dashboard

The web dashboard (`/dashboard`) uses cookie-based session auth with the admin key.

## Development Commands

```bash
npm run dev        # Local dev server
npm run cf-typegen # Generate types from wrangler.jsonc
npm run deploy     # Deploy to Cloudflare (prefer CI/CD)
```

## Secrets

Set via `wrangler secret put`:
- `ADMIN_API_KEY` - Admin authentication for app registration

## Data Model

### logs table (per-DO SQLite)
```sql
id TEXT PRIMARY KEY,
timestamp TEXT NOT NULL,
level TEXT NOT NULL,  -- DEBUG | INFO | WARN | ERROR
message TEXT NOT NULL,
context TEXT,         -- JSON
request_id TEXT
```

### daily_stats table (per-DO SQLite)
```sql
date TEXT PRIMARY KEY,  -- YYYY-MM-DD
debug INTEGER DEFAULT 0,
info INTEGER DEFAULT 0,
warn INTEGER DEFAULT 0,
error INTEGER DEFAULT 0
```

### health_checks table (per-DO SQLite)
```sql
id TEXT PRIMARY KEY,
url TEXT NOT NULL,
status INTEGER,       -- HTTP status code (0 = failed)
latency_ms INTEGER,
checked_at TEXT NOT NULL
```

### config table (per-DO SQLite)
```sql
key TEXT PRIMARY KEY,
value TEXT NOT NULL   -- JSON (e.g., health_urls array)
```

### KV Registry
- Key: `app:{app_id}` -> `{ name, api_key, created_at, health_urls }` (see `AppConfig` in `src/types.ts`)
- Key: `apps` -> `string[]` (list of app IDs)

### LogsRPC Copy-Paste Pattern

Consuming repos (landing-page, x402-api, x402-sponsor-relay) copy-paste the `LogsRPC` type definition
rather than importing it from a shared package. This is because worker service bindings require the
type to be available at compile time in each consumer, and there is no published npm package for
worker-logs types.

This is a known pattern. A future improvement would be to extract `LogsRPC` and related types into a
shared `@aibtc/worker-logs` npm package so consumers import instead of copy-paste.

## Fork Maintenance

This repo is a fork of [whoabuddy/worker-logs](https://github.com/whoabuddy/worker-logs) with aibtcdev-specific deployment environments.

### What stays upstream
- All source code, features, and bug fixes
- Documentation updates
- Local development configuration

### What's fork-specific
- `wrangler.jsonc` environments for staging/production
- Domain routes (`logs.aibtc.dev`, `logs.aibtc.com`)
- KV namespace bindings for aibtcdev Cloudflare account

### Deployment Environments

| Environment | Domain | Deploy Command |
|-------------|--------|----------------|
| Local dev | localhost:8787 | `npm run dev` |
| Staging | logs.aibtc.dev | `npm run deploy -- --env staging` |
| Production | logs.aibtc.com | `npm run deploy -- --env production` |

### Syncing with upstream

```bash
# Fetch upstream changes
git fetch upstream

# Rebase fork commits on top of upstream
git rebase upstream/main

# Force push to update fork
git push --force-with-lease origin main
```

The fork should stay minimal - ideally 1 commit ahead of upstream containing only environment configuration.
