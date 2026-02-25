import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { Ok, Err, ErrorCode } from './result'
import type { Env, LogInput, LogBatchInput, LogEntry, AggregatedLogEntry } from './types'
import * as registry from './services/registry'
import { requireApiKey, requireAdminKey, requireApiKeyOrAdmin } from './middleware/auth'
import { dashboard } from './dashboard/index'
import { getAppDO, countByLevel } from './utils'

// Re-export AppLogsDO for wrangler to find
export { AppLogsDO } from './durable-objects/app-logs-do'

// Re-export RPC entrypoint for service bindings
export { LogsRPC } from './rpc'

// Re-export types for consumers
export type { LogInput, LogEntry, AggregatedLogEntry, LogLevel, QueryFilters, DailyStats } from './types'

type Variables = {
  appId: string
}

const app = new Hono<{ Bindings: Env; Variables: Variables }>()

app.use('*', cors())

// Mount dashboard routes
app.route('/dashboard', dashboard)

// Service info
app.get('/', (c) => {
  return c.json(
    Ok({
      service: 'worker-logs',
      version: '0.4.0', // x-release-please-version
      description: 'Centralized logging service for Cloudflare Workers',
      endpoints: {
        'GET /dashboard': 'Web UI for browsing logs (requires admin key)',
        'POST /logs': 'Write log entries (requires API key)',
        'GET /logs': 'Query log entries (requires API key or admin)',
        'GET /health/:app_id': 'Get health check history (public)',
        'GET /stats/:app_id': 'Get daily stats (requires API key or admin)',
        'POST /apps/:app_id/prune': 'Delete old logs (requires API key)',
        'POST /apps/:app_id/health-urls': 'Set health check URLs (requires API key)',
        'GET /apps': 'List registered apps (requires admin key)',
        'POST /apps': 'Register a new app (requires admin key)',
        'GET /apps/:app_id': 'Get app details (requires API key or admin)',
        'DELETE /apps/:app_id': 'Delete an app (requires API key or admin)',
      },
    })
  )
})

// POST /logs - Write log(s) (requires API key)
app.post('/logs', requireApiKey, async (c) => {
  const appId = c.get('appId')
  const body = await c.req.json<LogInput | LogBatchInput>()
  const stub = getAppDO(c.env, appId)

  // Check if batch or single
  if ('logs' in body) {
    const res = await stub.fetch(new Request('http://do/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }))
    const result = await res.json() as { ok: boolean }

    // Record stats in DO (atomic, no race condition)
    if (result.ok) {
      const counts = countByLevel(body.logs)
      await stub.fetch(new Request('http://do/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ counts }),
      }))
    }

    return c.json(result)
  } else {
    const res = await stub.fetch(new Request('http://do/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }))
    const result = await res.json() as { ok: boolean }

    // Record stats in DO (atomic, no race condition)
    if (result.ok) {
      await stub.fetch(new Request('http://do/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: body.level }),
      }))
    }

    return c.json(result)
  }
})

// GET /logs - Query logs (requires API key or admin)
// When admin auth is used without X-App-ID, returns aggregated logs from all registered apps.
// When X-App-ID is provided (admin or API key auth), returns single-app logs as before.
app.get('/logs', requireApiKeyOrAdmin, async (c) => {
  // API key auth: appId is set by middleware after validation
  // Admin auth with X-App-ID header: use that app directly
  const appId = c.get('appId') || c.req.header('X-App-ID')

  // Single-app query (API key auth or admin with explicit X-App-ID)
  if (appId) {
    const stub = getAppDO(c.env, appId)
    const url = new URL(c.req.url)

    const res = await stub.fetch(new Request(`http://do/logs${url.search}`, {
      method: 'GET',
    }))
    return c.json(await res.json())
  }

  // Admin aggregated query: no appId means admin auth without X-App-ID
  if (!c.env.LOGS_KV) {
    return c.json(Err({ code: ErrorCode.INTERNAL_ERROR, message: 'KV namespace not configured' }), 500)
  }

  const appsResult = await registry.listApps(c.env.LOGS_KV)
  if (!appsResult.ok) {
    return c.json(appsResult, 500)
  }

  const appIds = appsResult.data
  if (appIds.length === 0) {
    return c.json(Ok([] as AggregatedLogEntry[]))
  }

  const url = new URL(c.req.url)
  const globalLimit = url.searchParams.has('limit')
    ? parseInt(url.searchParams.get('limit')!, 10)
    : 100
  const perAppLimit = Math.max(10, Math.ceil(globalLimit / appIds.length))

  // Build per-app query string with overridden limit; offset is omitted (not meaningful in aggregated mode)
  const perAppParams = new URLSearchParams(url.search)
  perAppParams.set('limit', String(perAppLimit))
  perAppParams.delete('offset')
  const queryString = perAppParams.toString() ? `?${perAppParams.toString()}` : ''

  const results = await Promise.all(
    appIds.map(async (id) => {
      try {
        const stub = getAppDO(c.env, id)
        const res = await stub.fetch(new Request(`http://do/logs${queryString}`, { method: 'GET' }))
        const json = await res.json() as { ok: boolean; data: LogEntry[] }
        if (json.ok && Array.isArray(json.data)) {
          return json.data.map((entry): AggregatedLogEntry => ({ ...entry, app_id: id }))
        }
        return [] as AggregatedLogEntry[]
      } catch {
        // Skip apps that fail to respond rather than failing the entire request
        return [] as AggregatedLogEntry[]
      }
    })
  )

  const merged = results.flat()
  merged.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  const truncated = merged.slice(0, globalLimit)

  return c.json(Ok(truncated))
})

// GET /health/:app_id - Get health check history
app.get('/health/:app_id', async (c) => {
  const appId = c.req.param('app_id')
  const stub = getAppDO(c.env, appId)
  const url = new URL(c.req.url)

  const res = await stub.fetch(new Request(`http://do/health${url.search}`, {
    method: 'GET',
  }))
  return c.json(await res.json())
})

// GET /stats/:app_id - Get daily stats (requires API key or admin)
app.get('/stats/:app_id', requireApiKeyOrAdmin, async (c) => {
  const appId = c.req.param('app_id')
  const authenticatedAppId = c.get('appId')

  // If using API key auth, must match the requested app
  if (authenticatedAppId && appId !== authenticatedAppId) {
    return c.json(Err({ code: ErrorCode.UNAUTHORIZED, message: 'App ID mismatch' }), 403)
  }

  const days = c.req.query('days') ? parseInt(c.req.query('days')!) : 7
  const stub = getAppDO(c.env, appId)

  const res = await stub.fetch(new Request(`http://do/stats?days=${days}`, {
    method: 'GET',
  }))
  return c.json(await res.json())
})

// POST /apps/:app_id/prune - Delete old logs (requires API key)
app.post('/apps/:app_id/prune', requireApiKey, async (c) => {
  const appId = c.req.param('app_id')
  const authenticatedAppId = c.get('appId')

  if (appId !== authenticatedAppId) {
    return c.json(Err({ code: ErrorCode.UNAUTHORIZED, message: 'App ID mismatch' }), 403)
  }

  const body = await c.req.json<{ before: string }>()

  if (!body.before) {
    return c.json(Err({ code: ErrorCode.BAD_REQUEST, message: '"before" timestamp required' }), 400)
  }

  const stub = getAppDO(c.env, appId)
  const res = await stub.fetch(new Request('http://do/prune', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }))
  return c.json(await res.json())
})

// POST /apps/:app_id/health-urls - Set health check URLs (requires API key or admin)
app.post('/apps/:app_id/health-urls', requireApiKeyOrAdmin, async (c) => {
  const appId = c.req.param('app_id')
  const authenticatedAppId = c.get('appId')

  // If using API key auth, must match the requested app
  if (authenticatedAppId && appId !== authenticatedAppId) {
    return c.json(Err({ code: ErrorCode.UNAUTHORIZED, message: 'App ID mismatch' }), 403)
  }

  const body = await c.req.json<{ urls: string[] }>()

  if (!body.urls || !Array.isArray(body.urls)) {
    return c.json(Err({ code: ErrorCode.BAD_REQUEST, message: '"urls" array required' }), 400)
  }

  const stub = getAppDO(c.env, appId)
  const res = await stub.fetch(new Request('http://do/health-urls', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }))
  return c.json(await res.json())
})

// GET /apps - List registered apps (admin only)
app.get('/apps', requireAdminKey, async (c) => {
  if (!c.env.LOGS_KV) {
    return c.json(Err({ code: ErrorCode.INTERNAL_ERROR, message: 'KV namespace not configured' }), 500)
  }

  const result = await registry.listApps(c.env.LOGS_KV)
  if (!result.ok) {
    return c.json(result, 500)
  }

  return c.json(Ok(result.data))
})

// POST /apps - Register a new app (requires admin key)
app.post('/apps', requireAdminKey, async (c) => {
  if (!c.env.LOGS_KV) {
    return c.json(Err({ code: ErrorCode.INTERNAL_ERROR, message: 'KV namespace not configured' }), 500)
  }

  const body = await c.req.json<{ app_id: string; name: string; health_urls?: string[] }>()

  if (!body.app_id || !body.name) {
    return c.json(Err({ code: ErrorCode.BAD_REQUEST, message: '"app_id" and "name" required' }), 400)
  }

  const result = await registry.registerApp(c.env.LOGS_KV, body.app_id, body.name, body.health_urls)
  if (!result.ok) {
    return c.json(result, 500)
  }

  return c.json(Ok(result.data), 201)
})

// GET /apps/:app_id - Get app details (requires API key or admin)
app.get('/apps/:app_id', requireApiKeyOrAdmin, async (c) => {
  const appId = c.req.param('app_id')
  const authenticatedAppId = c.get('appId')

  // If using API key auth, must match the requested app
  if (authenticatedAppId && appId !== authenticatedAppId) {
    return c.json(Err({ code: ErrorCode.UNAUTHORIZED, message: 'App ID mismatch' }), 403)
  }

  if (!c.env.LOGS_KV) {
    return c.json(Err({ code: ErrorCode.INTERNAL_ERROR, message: 'KV namespace not configured' }), 500)
  }

  const result = await registry.getApp(c.env.LOGS_KV, appId)
  if (!result.ok) {
    return c.json(result, 500)
  }

  if (!result.data) {
    return c.json(Err({ code: ErrorCode.NOT_FOUND, message: `App '${appId}' not found` }), 404)
  }

  // Don't expose API key
  const { api_key: _, ...safeData } = result.data
  return c.json(Ok(safeData))
})

// DELETE /apps/:app_id - Delete an app (requires API key or admin)
app.delete('/apps/:app_id', requireApiKeyOrAdmin, async (c) => {
  const appId = c.req.param('app_id')
  const authenticatedAppId = c.get('appId')

  // If using API key auth, must match the requested app
  if (authenticatedAppId && appId !== authenticatedAppId) {
    return c.json(Err({ code: ErrorCode.UNAUTHORIZED, message: 'App ID mismatch' }), 403)
  }

  if (!c.env.LOGS_KV) {
    return c.json(Err({ code: ErrorCode.INTERNAL_ERROR, message: 'KV namespace not configured' }), 500)
  }

  const result = await registry.deleteApp(c.env.LOGS_KV, appId)
  if (!result.ok) {
    return c.json(result, 500)
  }

  return c.json(Ok(result.data))
})

// Export the Hono app as the default fetch handler
export default app
