# worker-logs Implementation Plan

## Overview

Centralized logging service for Cloudflare Workers using sharded D1 storage via Durable Objects, with KV as an app registry/coordinator. Accessible via RPC binding (internal) or REST API with API key (external). Includes health monitoring for registered URLs via DO alarms.

## Storage Architecture

### Sharded D1 via Durable Objects

Each registered app gets its own `AppLogsDO` instance with isolated SQLite storage:

```typescript
import { DurableObject } from 'cloudflare:workers'

// Each DO instance has its own SQLite storage (via ctx.storage.sql)
export class AppLogsDO extends DurableObject<Env> {
  sql: SqlStorage

  constructor(ctx: DurableObjectState, env: Env) {
    // Required: call super() when extending DurableObject base class
    super(ctx, env)
    // Access SQLite via ctx.storage.sql (not state.storage.sql)
    this.sql = ctx.storage.sql
    this.initSchema()
  }

  private initSchema() {
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS logs (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        level TEXT NOT NULL CHECK (level IN ('DEBUG', 'INFO', 'WARN', 'ERROR')),
        message TEXT NOT NULL,
        context TEXT,
        request_id TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level);
    `)
  }
}
```

### KV Namespace (`LOGS_KV`) - App Registry

- `apps` → `["app1", "app2", ...]` (list of registered apps)
- `app:{app_id}` → `{ name, healthUrls: [...], createdAt, apiKey }` (app config)
- `stats:{app_id}:{date}` → `{debug, info, warn, error}` counts (daily aggregations)

### Health Check Storage (per DO)

```sql
CREATE TABLE IF NOT EXISTS health_checks (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  status INTEGER,
  latency_ms INTEGER,
  checked_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_health_url ON health_checks(url, checked_at DESC);
```

## Project Structure

```
worker-logs/
├── src/
│   ├── index.ts              # Hono app + LoggerService entrypoint
│   ├── types.ts              # Env, LogEntry, Result types
│   ├── result.ts             # Ok/Err result type utilities
│   ├── durable-objects/
│   │   └── app-logs-do.ts    # Per-app DO with SQLite storage + health alarms
│   ├── middleware/
│   │   └── auth.ts           # API key validation middleware
│   └── services/
│       ├── registry.ts       # KV app registry operations
│       └── stats.ts          # KV aggregation operations
├── wrangler.jsonc            # Modern JSONC config
├── package.json
└── tsconfig.json
```

## API Design

### Ingest Endpoint

```
POST /logs
Headers:
  X-API-Key: <api_key>       # Required for external access
  X-Request-ID: <request_id> # Optional, for tracing

Body:
{
  "level": "INFO",
  "message": "User logged in",
  "context": { "userId": "123", "ip": "1.2.3.4" }
}

// Or batch:
{
  "logs": [
    { "level": "INFO", "message": "..." },
    { "level": "ERROR", "message": "...", "context": {...} }
  ]
}
```

### Query Endpoint

```
GET /logs?app_id=myapp&level=ERROR&since=2024-01-01T00:00:00Z&limit=100
Headers:
  X-API-Key: <api_key>
```

### Health/Stats Endpoints

```
GET /health                    # Service status
GET /stats/:app_id             # Daily log counts (from KV)
GET /health/:app_id            # Health check history for app's URLs
POST /apps/:app_id/health-urls # Register URLs for health monitoring
```

## Worker Binding Interface (RPC-style)

Using Cloudflare's `WorkerEntrypoint` for clean RPC-style bindings:

```typescript
// In worker-logs/src/index.ts:
import { WorkerEntrypoint } from 'cloudflare:workers'

export class LoggerService extends WorkerEntrypoint<Env> {
  async log(app_id: string, level: LogLevel, message: string, context?: Record<string, any>) {
    // Direct D1 insert - no HTTP overhead
    return insertLog(this.env.LOGS_DB, { app_id, level, message, context })
  }

  async logBatch(app_id: string, logs: LogEntry[]) {
    return insertBatch(this.env.LOGS_DB, app_id, logs)
  }

  async query(app_id: string, filters: QueryFilters) {
    return queryLogs(this.env.LOGS_DB, app_id, filters)
  }
}

// In consuming worker's wrangler.toml:
[[services]]
binding = "LOGGER"
service = "worker-logs"
entrypoint = "LoggerService"

// Usage in consuming worker:
await env.LOGGER.log('my-worker', 'INFO', 'User logged in', { userId: '123' })
await env.LOGGER.logBatch('my-worker', [
  { level: 'INFO', message: 'Step 1' },
  { level: 'INFO', message: 'Step 2' }
])
```

RPC bindings are internal-only and trusted - no auth required.

## Authentication Strategy

1. **External API**: Require `X-API-Key` header
   - Keys stored as Wrangler secrets (e.g., `API_KEY_MYAPP=abc123`)
   - Map keys to app_id in env config or simple object
   - Example: `API_KEYS = { "abc123": "myapp", "def456": "otherapp" }`

2. **RPC Binding**: No auth required
   - Internal workers call methods directly
   - `app_id` passed as first parameter to all methods

## Health Monitoring (DO Alarms)

Each `AppLogsDO` uses alarms to periodically check registered URLs. Key points from Cloudflare docs:
- Only one alarm per DO instance at a time
- Alarms have guaranteed at-least-once execution with exponential backoff retries
- Check for existing alarm in constructor before setting a new one

```typescript
// In app-logs-do.ts
export class AppLogsDO extends DurableObject<Env> {
  // Alarm handler receives optional alarmInfo with retry details
  async alarm(alarmInfo?: { retryCount: number; isRetry: boolean }) {
    if (alarmInfo?.isRetry) {
      console.log(`Alarm retry attempt ${alarmInfo.retryCount}`)
    }

    const urls = await this.getHealthUrls()
    for (const url of urls) {
      const start = Date.now()
      try {
        const res = await fetch(url, { method: 'HEAD' })
        await this.recordHealthCheck(url, res.status, Date.now() - start)
      } catch (e) {
        await this.recordHealthCheck(url, 0, Date.now() - start)
      }
    }
    // Schedule next alarm (e.g., 5 minutes) - use ctx.storage not this.state
    await this.ctx.storage.setAlarm(Date.now() + 5 * 60 * 1000)
  }

  // Check existing alarm before setting new one in any init method
  async initHealthChecks(urls: string[]) {
    const existingAlarm = await this.ctx.storage.getAlarm()
    if (!existingAlarm) {
      await this.ctx.storage.setAlarm(Date.now() + 5 * 60 * 1000)
    }
  }
}
```

## Log Pruning (Manual)

Instead of auto-retention, provide a prune function:

```typescript
// In AppLogsDO
async pruneLogs(before: string): Promise<Result<{ deleted: number }>> {
  const result = this.sql.exec(`DELETE FROM logs WHERE timestamp < ?`, before)
  return Ok({ deleted: result.changes })
}

// API endpoint
POST /apps/:app_id/prune
Body: { "before": "2024-01-01T00:00:00Z" }
```

## Response Format (Result Types)

Using Ok/Err result types for clarity:

```typescript
// src/result.ts
type Ok<T> = { ok: true; data: T }
type Err<E> = { ok: false; error: E }
type Result<T, E = ApiError> = Ok<T> | Err<E>

interface ApiError {
  code: string
  message: string
  details?: Record<string, unknown>
}

// Helper functions
const Ok = <T>(data: T): Ok<T> => ({ ok: true, data })
const Err = <E>(error: E): Err<E> => ({ ok: false, error })

// Usage in handlers
app.get('/logs', async (c) => {
  const result = await queryLogs(...)
  if (!result.ok) {
    return c.json(result, 400)
  }
  return c.json(result)
})
```

## Next Steps

### Phase 2: Core Types & Result Utilities
- `src/types.ts` - Env, LogLevel, LogEntry, QueryFilters interfaces
- `src/result.ts` - Ok/Err result type utilities

### Phase 3: Durable Object Implementation
- `src/durable-objects/app-logs-do.ts`:
  - SQLite schema initialization (logs + health_checks tables)
  - `log()` / `logBatch()` methods
  - `query()` with filters
  - `pruneLogs(before)` for manual cleanup
  - `setHealthUrls()` / `alarm()` for health monitoring

### Phase 4: Registry & Stats Services
- `src/services/registry.ts` - KV app registry (list/get/register apps)
- `src/services/stats.ts` - KV daily aggregations

### Phase 5: Auth Middleware
- `src/middleware/auth.ts` - API key validation from KV registry

### Phase 6: Main App & Routes
- `src/index.ts`:
  - Export `LoggerService` (WorkerEntrypoint) for RPC
  - Export `AppLogsDO` for Durable Object binding
  - Hono routes: POST /logs, GET /logs, GET /health, etc.

### Phase 7: Testing & Documentation
- Local dev with `wrangler dev`
- Test RPC and API flows
- Update README with usage examples

## wrangler.jsonc Structure

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "worker-logs",
  "main": "src/index.ts",
  "compatibility_date": "2024-12-01",
  "compatibility_flags": ["nodejs_compat_v2"],

  // Observability for debugging
  "observability": { "enabled": true },

  // Durable Object bindings
  "durable_objects": {
    "bindings": [
      { "name": "APP_LOGS_DO", "class_name": "AppLogsDO" }
    ]
  },

  // DO migrations
  "migrations": [
    { "tag": "v1", "new_sqlite_classes": ["AppLogsDO"] }
  ],

  // KV for app registry
  "kv_namespaces": [
    { "binding": "LOGS_KV", "id": "<kv-id>" }
  ],

  // Environment overrides
  "env": {
    "preview": {
      "kv_namespaces": [
        { "binding": "LOGS_KV", "id": "<preview-kv-id>" }
      ]
    },
    "production": {
      "kv_namespaces": [
        { "binding": "LOGS_KV", "id": "<prod-kv-id>" }
      ]
    }
  }
}
```

## Future Enhancements (Out of Scope)

- Web UI for log viewing
- Admin API for managing API keys
- Log streaming via WebSocket
- Export to external services (Datadog, etc.)
- Advanced querying (full-text search)
