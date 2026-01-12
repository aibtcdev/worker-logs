# Integrating worker-logs into Cloudflare Workers

This guide covers how to add centralized logging to your Cloudflare Workers using the `worker-logs` service.

## Quick Start (Service Binding - Recommended)

For workers on the **same Cloudflare account**, use a service binding for the best performance.

### 1. Add Service Binding

In your worker's `wrangler.toml` or `wrangler.jsonc`:

```jsonc
// wrangler.jsonc
{
  "services": [
    { "binding": "LOGS", "service": "worker-logs", "entrypoint": "LogsRPC" }
  ]
}
```

```toml
# wrangler.toml
[[services]]
binding = "LOGS"
service = "worker-logs"
entrypoint = "LogsRPC"
```

### 2. Update Environment Types

Add the binding to your `Env` interface:

```ts
// src/types.ts or wherever you define Env
import type { Service } from 'cloudflare:workers'
import type { LogsRPC } from 'worker-logs'

export interface Env {
  // ... your other bindings
  LOGS: Service<LogsRPC>
}
```

### 3. Use the Logging Service

```ts
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const appId = 'my-worker-name'  // Use a consistent identifier for your app

    try {
      // Log an info message
      await env.LOGS.info(appId, 'Request received', {
        url: request.url,
        method: request.method
      })

      // Your worker logic here...
      const result = await doSomething()

      return new Response('OK')
    } catch (error) {
      // Log errors
      await env.LOGS.error(appId, 'Request failed', {
        error: error.message,
        stack: error.stack
      })

      return new Response('Error', { status: 500 })
    }
  }
}
```

## RPC Methods Reference

### Convenience Methods (Recommended)

```ts
// Simple logging with automatic level
await env.LOGS.info(appId, 'message', { optional: 'context' })
await env.LOGS.warn(appId, 'message', { optional: 'context' })
await env.LOGS.error(appId, 'message', { optional: 'context' })
await env.LOGS.debug(appId, 'message', { optional: 'context' })
```

### Full Control Methods

```ts
// Single log with full options
await env.LOGS.log(appId, {
  level: 'INFO',        // 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'
  message: 'Something happened',
  context: { key: 'value' },  // Optional metadata
  request_id: 'abc-123',      // Optional request correlation
})

// Batch logging (more efficient for multiple logs)
await env.LOGS.logBatch(appId, [
  { level: 'INFO', message: 'Step 1 complete' },
  { level: 'INFO', message: 'Step 2 complete' },
  { level: 'WARN', message: 'Step 3 had issues', context: { warning: 'timeout' } },
])

// Query logs
const logs = await env.LOGS.query(appId, {
  level: 'ERROR',           // Filter by level
  since: '2024-01-01',      // ISO timestamp
  until: '2024-01-02',      // ISO timestamp
  request_id: 'abc-123',    // Filter by request
  limit: 100,               // Max results
  offset: 0,                // Pagination
})

// Get daily stats
const stats = await env.LOGS.getStats(appId, 7)  // Last 7 days
// Returns: [{ date: '2024-01-07', debug: 0, info: 45, warn: 3, error: 1 }, ...]
```

## Creating a Logger Helper

For cleaner code, create a logger helper in your worker:

```ts
// src/logger.ts
import type { Service } from 'cloudflare:workers'
import type { LogsRPC } from 'worker-logs'

export function createLogger(logs: Service<LogsRPC>, appId: string, requestId?: string) {
  const ctx = requestId ? { request_id: requestId } : undefined

  return {
    debug: (msg: string, context?: Record<string, unknown>) =>
      logs.debug(appId, msg, { ...ctx, ...context }),
    info: (msg: string, context?: Record<string, unknown>) =>
      logs.info(appId, msg, { ...ctx, ...context }),
    warn: (msg: string, context?: Record<string, unknown>) =>
      logs.warn(appId, msg, { ...ctx, ...context }),
    error: (msg: string, context?: Record<string, unknown>) =>
      logs.error(appId, msg, { ...ctx, ...context }),
  }
}
```

Usage:

```ts
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const requestId = crypto.randomUUID()
    const log = createLogger(env.LOGS, 'my-worker', requestId)

    await log.info('Request started', { url: request.url })

    // All logs will include the request_id for correlation
    await log.info('Processing...')
    await log.info('Done')

    return new Response('OK')
  }
}
```

## Alternative: HTTP API (External Access)

For workers on different accounts or external services, use the HTTP API with authentication.

### 1. Register Your App (Requires Admin Key)

```bash
curl -X POST https://logs.wbd.host/apps \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: your-admin-key" \
  -d '{"app_id": "my-external-app", "name": "My External App"}'

# Response includes api_key - save this securely!
# {"ok":true,"data":{"name":"My External App","api_key":"abc123...",...}}
```

> **Note**: App registration requires the admin key. Contact the service administrator to register new apps.

### 2. Add Secrets to Your Worker

```bash
# Add as secrets (don't commit to code!)
wrangler secret put LOGS_API_KEY
# Enter: abc123...
```

```jsonc
// wrangler.jsonc - add as variable
{
  "vars": {
    "LOGS_APP_ID": "my-external-app"
  }
}
```

### 3. Send Logs via HTTP

```ts
async function sendLog(env: Env, level: string, message: string, context?: object) {
  await fetch('https://logs.wbd.host/logs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-App-ID': env.LOGS_APP_ID,
      'X-Api-Key': env.LOGS_API_KEY,
    },
    body: JSON.stringify({ level, message, context }),
  })
}
```

## HTTP API Reference

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/logs` | POST | API Key | Write log(s) |
| `/logs` | GET | API Key | Query logs |
| `/apps` | POST | Admin Key | Register new app (returns API key) |
| `/apps` | GET | Admin Key | List registered apps |
| `/apps/:id` | GET | API Key or Admin | Get app details |
| `/apps/:id` | DELETE | API Key | Delete app (owner only) |
| `/apps/:id/prune` | POST | API Key | Delete old logs |
| `/apps/:id/health-urls` | POST | API Key | Set health check URLs |
| `/stats/:id` | GET | API Key or Admin | Get daily stats |
| `/health/:id` | GET | None | Get health check history |

## Best Practices

1. **Use consistent app IDs**: Match your worker name (e.g., `my-api-worker`)

2. **Add request correlation**: Generate a `request_id` at the start of each request and include it in all logs

3. **Log at appropriate levels**:
   - `DEBUG`: Detailed debugging (disable in production)
   - `INFO`: Normal operations, request starts/ends
   - `WARN`: Unexpected but handled situations
   - `ERROR`: Failures requiring attention

4. **Batch when possible**: Use `logBatch()` if you're logging multiple entries at once

5. **Don't await in hot paths**: For non-critical logs, consider fire-and-forget:
   ```ts
   // Don't block response for logging
   ctx.waitUntil(log.info('Request complete'))
   return response
   ```

## Viewing Logs

Access logs through:

- **Web Dashboard**: `https://logs.wbd.host/dashboard` (requires admin key login)
- **HTTP API**: `GET https://logs.wbd.host/logs` with appropriate headers
- **Stats**: `GET https://logs.wbd.host/stats/{app_id}` for daily aggregates
