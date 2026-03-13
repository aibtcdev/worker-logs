/**
 * Overview API endpoint for multi-app aggregation
 */

import type { Context } from 'hono'
import type { Env, DailyStats, LogEntry } from '../../types'
import type { OverviewResponse, AppSummary, OverviewChartResponse, AppChartData } from '../types'
import { calculateTrend, determineHealthStatus } from '../components/charts'
import { getAppList, getAppName } from '../helpers'

/**
 * Get overview data for all apps
 */
export async function getOverview(c: Context<{ Bindings: Env }>): Promise<OverviewResponse> {
  const apps = await getAppList(c)

  if (apps.length === 0) {
    return {
      apps: [],
      totals: {
        today: { debug: 0, info: 0, warn: 0, error: 0 },
        yesterday: { debug: 0, info: 0, warn: 0, error: 0 },
      },
      recent_errors: [],
    }
  }

  // Fetch data for all apps in parallel
  const appDataPromises = apps.map(appId => getAppData(c, appId))
  const appData = await Promise.all(appDataPromises)

  // Aggregate totals
  const totals = {
    today: { debug: 0, info: 0, warn: 0, error: 0 },
    yesterday: { debug: 0, info: 0, warn: 0, error: 0 },
  }

  const appSummaries: AppSummary[] = []
  const allRecentErrors: Array<LogEntry & { app_id: string }> = []

  for (const data of appData) {
    if (!data) continue

    // Aggregate totals
    totals.today.debug += data.today_stats.debug
    totals.today.info += data.today_stats.info
    totals.today.warn += data.today_stats.warn
    totals.today.error += data.today_stats.error
    totals.yesterday.debug += data.yesterday_stats.debug
    totals.yesterday.info += data.yesterday_stats.info
    totals.yesterday.warn += data.yesterday_stats.warn
    totals.yesterday.error += data.yesterday_stats.error

    // Calculate error trend
    const errorTrend = calculateTrend(data.today_stats.error, data.yesterday_stats.error)

    // Get health status
    const healthStatus = determineHealthStatus(data.health_checks)

    appSummaries.push({
      id: data.id,
      name: data.name,
      today_stats: data.today_stats,
      yesterday_stats: data.yesterday_stats,
      error_trend: errorTrend,
      health_status: healthStatus,
      last_error: data.last_error,
    })

    // Add recent errors with app_id
    for (const error of data.recent_errors) {
      allRecentErrors.push({ ...error, app_id: data.id })
    }
  }

  // Sort apps by error count (descending) to show problematic apps first
  appSummaries.sort((a, b) => b.today_stats.error - a.today_stats.error)

  // Sort recent errors by timestamp and take top 10
  allRecentErrors.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  const recent_errors = allRecentErrors.slice(0, 10)

  return {
    apps: appSummaries,
    totals,
    recent_errors,
  }
}

/**
 * Get per-app daily stats for the overview bar chart
 */
export async function getOverviewChart(
  c: Context<{ Bindings: Env }>,
  days: number
): Promise<OverviewChartResponse> {
  const apps = await getAppList(c)

  if (apps.length === 0) {
    return { dates: [], apps: [] }
  }

  // Fetch stats for all apps in parallel
  const appStatsPromises = apps.map(async (appId) => {
    try {
      const name = await getAppName(c, appId)
      const id = c.env.APP_LOGS_DO.idFromName(appId)
      const stub = c.env.APP_LOGS_DO.get(id)
      const res = await stub.fetch(new Request(`http://do/stats?days=${days}`))
      const data = await res.json() as { ok: boolean; data: DailyStats[] }
      return { appId, name, stats: data.ok ? (data.data || []) : [] }
    } catch {
      return { appId, name: appId, stats: [] as DailyStats[] }
    }
  })

  const appStats = await Promise.all(appStatsPromises)

  // Build a unified sorted date list across all apps
  const dateSet = new Set<string>()
  for (const { stats } of appStats) {
    for (const s of stats) {
      dateSet.add(s.date)
    }
  }
  const dates = Array.from(dateSet).sort()

  // Build per-app aligned arrays
  const chartApps: AppChartData[] = appStats.map(({ appId, name, stats }) => {
    const byDate = new Map<string, DailyStats>()
    for (const s of stats) {
      byDate.set(s.date, s)
    }
    return {
      id: appId,
      name,
      errors: dates.map(d => byDate.get(d)?.error ?? 0),
      warnings: dates.map(d => byDate.get(d)?.warn ?? 0),
    }
  })

  // Only include apps that have at least one error or warning to keep the chart readable
  const activeApps = chartApps.filter(a => a.errors.some(v => v > 0) || a.warnings.some(v => v > 0))

  return {
    dates,
    apps: activeApps.length > 0 ? activeApps : chartApps,
  }
}

/**
 * Get aggregated data for a single app
 */
async function getAppData(c: Context<{ Bindings: Env }>, appId: string): Promise<{
  id: string
  name: string
  today_stats: DailyStats
  yesterday_stats: DailyStats
  health_checks: Array<{ status: number; checked_at: string }>
  recent_errors: LogEntry[]
  last_error?: { message: string; timestamp: string }
} | null> {
  try {
    const id = c.env.APP_LOGS_DO.idFromName(appId)
    const stub = c.env.APP_LOGS_DO.get(id)

    // Fetch stats, health, and recent errors in parallel
    const [statsRes, healthRes, errorsRes, name] = await Promise.all([
      stub.fetch(new Request('http://do/stats?days=2')),
      stub.fetch(new Request('http://do/health?limit=10')),
      stub.fetch(new Request('http://do/logs?level=ERROR&limit=5')),
      getAppName(c, appId),
    ])

    const statsData = await statsRes.json() as { ok: boolean; data: DailyStats[] }
    const healthData = await healthRes.json() as { ok: boolean; data: Array<{ status: number; checked_at: string }> }
    const errorsData = await errorsRes.json() as { ok: boolean; data: LogEntry[] }

    const today_stats = statsData.ok && statsData.data?.[0]
      ? statsData.data[0]
      : { date: new Date().toISOString().split('T')[0], debug: 0, info: 0, warn: 0, error: 0 }

    const yesterday_stats = statsData.ok && statsData.data?.[1]
      ? statsData.data[1]
      : { date: new Date().toISOString().split('T')[0], debug: 0, info: 0, warn: 0, error: 0 }

    const health_checks = healthData.ok ? (healthData.data || []) : []
    const recent_errors = errorsData.ok ? (errorsData.data || []) : []

    const last_error = recent_errors.length > 0
      ? { message: recent_errors[0].message, timestamp: recent_errors[0].timestamp }
      : undefined

    return {
      id: appId,
      name,
      today_stats,
      yesterday_stats,
      health_checks,
      recent_errors,
      last_error,
    }
  } catch (e) {
    console.error(`Failed to get app data for ${appId}:`, e)
    return null
  }
}
