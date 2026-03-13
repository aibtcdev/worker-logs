/**
 * App detail page - single app view with advanced filtering
 */

import { htmlDocument, header } from '../components/layout'
import { splitDailyStatsChartConfigs, formatHealthStatus, determineHealthStatus, sparkline } from '../components/charts'
import { escapeHtml, styles } from '../styles'
import type { DailyStats, LogEntry, HealthCheck } from '../../types'
import type { BrandConfig } from '../brand'
import { DEFAULT_BRAND_CONFIG } from '../brand'

export interface AppDetailData {
  appId: string
  appName: string
  stats: DailyStats[]
  healthChecks: HealthCheck[]
  healthUrls: string[]
}

export function appDetailPage(data: AppDetailData, apps: string[], brand: BrandConfig = DEFAULT_BRAND_CONFIG): string {
  const { appId, appName, stats, healthChecks, healthUrls } = data

  // Calculate totals for the initial period
  const totals = stats.reduce((acc, day) => ({
    debug: acc.debug + day.debug,
    info: acc.info + day.info,
    warn: acc.warn + day.warn,
    error: acc.error + day.error,
  }), { debug: 0, info: 0, warn: 0, error: 0 })

  // Compute error rate for the initial period
  const totalLogs = totals.debug + totals.info + totals.warn + totals.error
  const errorRate = totalLogs > 0 ? Math.round((totals.error / totalLogs) * 100) : 0

  // Build sparkline data arrays (oldest-first for left-to-right trend)
  const statsOldestFirst = stats.slice().reverse()
  const debugSparkline = sparkline(statsOldestFirst.map(s => s.debug), { color: '#9CA3AF', showArea: true, width: 100, height: 20 })
  const infoSparkline = sparkline(statsOldestFirst.map(s => s.info), { color: '#60A5FA', showArea: true, width: 100, height: 20 })
  const warnSparkline = sparkline(statsOldestFirst.map(s => s.warn), { color: '#FBBF24', showArea: true, width: 100, height: 20 })
  const errorSparkline = sparkline(statsOldestFirst.map(s => s.error), { color: '#F87171', showArea: true, width: 100, height: 20 })

  // Prepare chart data (reverse to show oldest first)
  const chartLabels = stats.map(s => s.date).reverse()
  const { errorsWarningsConfig, trafficConfig } = splitDailyStatsChartConfigs(chartLabels, {
    errors: stats.map(s => s.error).reverse(),
    warnings: stats.map(s => s.warn).reverse(),
    info: stats.map(s => s.info).reverse(),
    debug: stats.map(s => s.debug).reverse(),
  })

  // Group health checks by URL
  const healthByUrl = new Map<string, HealthCheck[]>()
  for (const check of healthChecks) {
    const existing = healthByUrl.get(check.url) || []
    existing.push(check)
    healthByUrl.set(check.url, existing)
  }

  const content = `
  ${header({ currentView: 'app', currentApp: appId, apps, brand })}

  <main class="max-w-7xl mx-auto px-6 py-6" x-data="appDetailState()">
    <!-- App Header -->
    <div class="mb-6">
      <h2 class="text-2xl font-bold">${escapeHtml(appName)}</h2>
      ${appName !== appId ? `<div class="text-sm text-gray-500">${escapeHtml(appId)}</div>` : ''}
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div class="brand-card card-glow rounded-lg p-4">
        <div class="text-xs mb-1" style="color: var(--text-muted);">Debug (<span x-text="statsRange + 'd'">7d</span>)</div>
        <div class="text-2xl font-bold text-gray-400" x-text="statsTotals.debug">${totals.debug}</div>
        <div class="mt-2 h-5 w-full opacity-70">${debugSparkline}</div>
      </div>
      <div class="brand-card card-glow rounded-lg p-4">
        <div class="text-xs mb-1" style="color: var(--text-muted);">Info (<span x-text="statsRange + 'd'">7d</span>)</div>
        <div class="text-2xl font-bold text-blue-400" x-text="statsTotals.info">${totals.info}</div>
        <div class="mt-2 h-5 w-full opacity-70">${infoSparkline}</div>
      </div>
      <div class="brand-card card-glow rounded-lg p-4">
        <div class="text-xs mb-1" style="color: var(--text-muted);">Warn (<span x-text="statsRange + 'd'">7d</span>)</div>
        <div class="text-2xl font-bold text-yellow-400" x-text="statsTotals.warn">${totals.warn}</div>
        <div class="mt-2 h-5 w-full opacity-70">${warnSparkline}</div>
      </div>
      <div class="brand-card card-glow rounded-lg p-4">
        <div class="text-xs mb-1" style="color: var(--text-muted);">Error (<span x-text="statsRange + 'd'">7d</span>)</div>
        <div class="text-2xl font-bold text-red-400" x-text="statsTotals.error">${totals.error}</div>
        ${errorRate > 0 ? `<div class="text-xs mt-1" style="color: var(--text-muted);">${errorRate}% of all logs</div>` : ''}
        <div class="mt-2 h-5 w-full opacity-70">${errorSparkline}</div>
      </div>
    </div>

    <!-- Stats Charts -->
    <div class="brand-card rounded-lg p-4 mb-6">
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-medium">Log Activity (<span x-text="statsRange + 'd'">7d</span>)</h3>
        <div class="flex items-center gap-1">
          <button @click="setStatsRange(7)"
                  :class="statsRange === 7 ? 'bg-gray-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-400'"
                  class="px-3 py-1 text-xs rounded transition-colors">7d</button>
          <button @click="setStatsRange(14)"
                  :class="statsRange === 14 ? 'bg-gray-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-400'"
                  class="px-3 py-1 text-xs rounded transition-colors">14d</button>
          <button @click="setStatsRange(30)"
                  :class="statsRange === 30 ? 'bg-gray-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-400'"
                  class="px-3 py-1 text-xs rounded transition-colors">30d</button>
        </div>
      </div>
      <div x-show="statsLoading" class="flex justify-center py-4">
        <svg class="animate-spin h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
      <div x-show="!statsLoading">
        <div class="h-40 mb-4">
          <canvas id="errorsWarningsChart"></canvas>
        </div>
        <div class="h-48">
          <canvas id="trafficChart"></canvas>
        </div>
      </div>
    </div>

    <!-- Health Checks -->
    ${healthUrls.length > 0 ? `
    <div class="brand-card rounded-lg mb-6 overflow-hidden">
      <div class="px-4 py-3" style="border-bottom: 1px solid var(--border);">
        <h3 class="font-medium">Health Checks</h3>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-750">
            <tr class="text-left text-gray-400 border-b border-gray-700">
              <th class="px-4 py-3">URL</th>
              <th class="px-4 py-3">Status</th>
              <th class="px-4 py-3 text-right">Latency</th>
              <th class="px-4 py-3">Last Check</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-700">
            ${healthUrls.map(url => {
              const checks = healthByUrl.get(url) || []
              const status = determineHealthStatus(checks)
              const lastCheck = checks[0]
              const avgLatency = checks.length > 0
                ? Math.round(checks.reduce((sum, c) => sum + c.latency_ms, 0) / checks.length)
                : null
              return `
              <tr class="hover:bg-gray-750">
                <td class="px-4 py-3 font-mono text-xs text-gray-300">${escapeHtml(url)}</td>
                <td class="px-4 py-3">${formatHealthStatus(status)}</td>
                <td class="px-4 py-3 text-right text-gray-400">${avgLatency !== null ? avgLatency + 'ms' : '-'}</td>
                <td class="px-4 py-3 text-gray-500 text-xs">
                  ${lastCheck ? new Date(lastCheck.checked_at).toLocaleString() : 'Never'}
                </td>
              </tr>`
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
    ` : ''}

    <!-- Filters -->
    <div class="brand-card rounded-lg p-4 mb-4">
      <div class="flex flex-wrap items-start gap-4">
        <!-- Date Range -->
        <div class="flex flex-col gap-1">
          <label class="text-xs text-gray-400">Date Range</label>
          <select x-model="filters.dateRange" @change="applyFilters()" class="bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm">
            <option value="today">Today</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="custom">Custom</option>
          </select>
        </div>

        <!-- Custom Date Inputs -->
        <template x-if="filters.dateRange === 'custom'">
          <div class="flex items-end gap-2">
            <div class="flex flex-col gap-1">
              <label class="text-xs text-gray-400">From</label>
              <input type="date" x-model="filters.since" @change="applyFilters()" class="bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm">
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-xs text-gray-400">To</label>
              <input type="date" x-model="filters.until" @change="applyFilters()" class="bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm">
            </div>
          </div>
        </template>

        <!-- Level Filter -->
        <div class="flex flex-col gap-1">
          <label class="text-xs text-gray-400">Level</label>
          <div class="flex gap-1">
            <button @click="setLevel('')" :class="filters.level === '' ? 'bg-gray-600' : 'bg-gray-700 hover:bg-gray-600'" class="log-level px-3 py-1.5 text-sm rounded">All</button>
            <button @click="setLevel('DEBUG')" :class="filters.level === 'DEBUG' ? 'bg-gray-600' : 'bg-gray-700 hover:bg-gray-600'" class="log-level px-3 py-1.5 text-sm rounded text-gray-400">Debug</button>
            <button @click="setLevel('INFO')" :class="filters.level === 'INFO' ? 'bg-gray-600' : 'bg-gray-700 hover:bg-gray-600'" class="log-level px-3 py-1.5 text-sm rounded text-blue-400">Info</button>
            <button @click="setLevel('WARN')" :class="filters.level === 'WARN' ? 'bg-gray-600' : 'bg-gray-700 hover:bg-gray-600'" class="log-level px-3 py-1.5 text-sm rounded text-yellow-400">Warn</button>
            <button @click="setLevel('ERROR')" :class="filters.level === 'ERROR' ? 'bg-gray-600' : 'bg-gray-700 hover:bg-gray-600'" class="log-level px-3 py-1.5 text-sm rounded text-red-400">Error</button>
          </div>
        </div>

        <!-- Request ID -->
        <div class="flex flex-col gap-1">
          <label class="text-xs text-gray-400">Request ID</label>
          <input type="text" x-model="filters.requestId" @input.debounce.300ms="applyFilters()" placeholder="Filter by request ID..." class="bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm w-48">
        </div>

        <!-- Search -->
        <div class="flex flex-col gap-1">
          <label class="text-xs text-gray-400">Search</label>
          <input type="text" x-model="filters.search" @input.debounce.300ms="applyFilters()" placeholder="Search messages..." class="bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm w-48">
        </div>
      </div>

      <!-- Context Filters -->
      <div class="mt-4 pt-4 border-t border-gray-700">
        <div class="flex items-center gap-2 mb-2">
          <span class="text-xs text-gray-400">Context Filters</span>
          <button @click="addContextFilter()" class="text-xs" style="color: var(--accent);">+ Add filter</button>
        </div>
        <template x-for="(cf, index) in filters.contextFilters" :key="index">
          <div class="flex items-center gap-2 mb-2">
            <input type="text" x-model="cf.key" @input.debounce.300ms="applyFilters()" placeholder="Key (e.g., path)" class="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm w-32">
            <span class="text-gray-500">=</span>
            <input type="text" x-model="cf.value" @input.debounce.300ms="applyFilters()" placeholder="Value" class="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm w-40">
            <button @click="removeContextFilter(index)" class="text-gray-400 hover:text-red-400 text-sm">&times;</button>
          </div>
        </template>
      </div>

      <!-- Filter Actions -->
      <div class="mt-4 pt-4 border-t border-gray-700 flex items-center gap-4">
        <button @click="clearFilters()" class="text-sm text-gray-400 hover:text-gray-200">Clear filters</button>
        <label class="flex items-center gap-2 text-sm text-gray-400">
          <input type="checkbox" x-model="autoRefresh" @change="toggleAutoRefresh()" class="rounded bg-gray-700 border-gray-600">
          Auto-refresh
        </label>
        <button @click="loadLogs()" class="px-3 py-1.5 text-sm rounded flex items-center gap-1" style="background: var(--accent); color: white;">
          <svg class="w-4 h-4" :class="{ 'animate-spin': loading }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
          Refresh
        </button>
      </div>
    </div>

    <!-- Logs Table -->
    <div class="brand-card rounded-lg overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-gray-750 border-b border-gray-700">
          <tr class="text-left text-gray-400">
            <th class="px-4 py-3 w-44">Timestamp</th>
            <th class="px-4 py-3 w-20">Level</th>
            <th class="px-4 py-3">Message</th>
            <th class="px-4 py-3 w-32">Path</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-700">
          <template x-if="loading && logs.length === 0">
            <tr>
              <td colspan="4" class="px-4 py-8 text-center text-gray-500">
                <svg class="animate-spin h-6 w-6 mx-auto mb-2 text-gray-400" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Loading logs...
              </td>
            </tr>
          </template>
          <template x-if="!loading && logs.length === 0">
            <tr>
              <td colspan="4" class="px-4 py-12 text-center" style="color: var(--text-muted);">
                <div class="flex flex-col items-center gap-2">
                  <svg class="w-8 h-8 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                  <span class="font-medium">No logs match your current filters.</span>
                  <span class="text-xs opacity-70">Try adjusting the date range, level, or search query.</span>
                </div>
              </td>
            </tr>
          </template>
          <template x-for="log in logs" :key="log.id">
            <tr class="hover:bg-gray-750 cursor-pointer" @click="showLog(log)">
              <td class="px-4 py-2 text-gray-400 font-mono text-xs" x-text="formatTimestamp(log.timestamp)"></td>
              <td class="px-4 py-2">
                <span :class="'badge-' + log.level" class="px-2 py-0.5 rounded text-xs font-medium" x-text="log.level"></span>
              </td>
              <td class="px-4 py-2 truncate max-w-md" :class="'log-' + log.level" x-text="log.message"></td>
              <td class="px-4 py-2 text-gray-500 text-xs truncate" x-text="log.context?.path || '-'"></td>
            </tr>
          </template>
        </tbody>
      </table>

      <!-- Pagination -->
      <div class="flex items-center justify-between px-4 py-3 border-t border-gray-700">
        <div class="text-sm text-gray-400">
          Showing <span x-text="logs.length"></span> logs
        </div>
        <div class="flex gap-2">
          <button @click="prevPage()" :disabled="offset === 0" class="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed">
            Previous
          </button>
          <button @click="nextPage()" :disabled="logs.length < limit" class="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed">
            Next
          </button>
        </div>
      </div>
    </div>

    <!-- Log Detail Modal -->
    <div x-show="selectedLog" x-cloak
         class="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"
         @click.self="selectedLog = null">
      <div class="rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden" style="background: var(--bg-card); border: 1px solid var(--border);" @click.stop>
        <div class="flex items-center justify-between px-4 py-3" style="border-bottom: 1px solid var(--border);">
          <h3 class="font-medium">Log Details</h3>
          <button @click="selectedLog = null" class="icon-button text-gray-400 hover:text-gray-200">&times;</button>
        </div>
        <div class="p-4 overflow-auto max-h-[calc(80vh-60px)]">
          <pre class="text-sm whitespace-pre-wrap text-gray-300" x-text="JSON.stringify(selectedLog, null, 2)"></pre>
        </div>
      </div>
    </div>
  </main>

  <script>
    const APP_ID = '${appId}';

    // Chart instances — set in DOMContentLoaded, updated by loadStats()
    var ewChart = null;
    var trafficChart = null;

    function appDetailState() {
      return {
        logs: [],
        loading: false,
        selectedLog: null,
        autoRefresh: false,
        autoRefreshInterval: null,
        offset: 0,
        limit: 50,
        statsRange: 7,
        statsLoading: false,
        statsTotals: { debug: ${totals.debug}, info: ${totals.info}, warn: ${totals.warn}, error: ${totals.error} },
        filters: {
          dateRange: '7d',
          since: '',
          until: '',
          level: '',
          requestId: '',
          search: '',
          contextFilters: []
        },

        init() {
          this.loadLogs();
        },

        setStatsRange(days) {
          this.statsRange = days;
          this.loadStats();
        },

        async loadStats() {
          this.statsLoading = true;
          try {
            const res = await fetch('/dashboard/api/stats/' + APP_ID + '?days=' + this.statsRange);
            const data = await res.json();
            if (data.ok && data.data) {
              const stats = data.data.slice().reverse(); // oldest first
              const labels = stats.map(s => s.date);
              const errors = stats.map(s => s.error);
              const warnings = stats.map(s => s.warn);
              const info = stats.map(s => s.info);
              const debug = stats.map(s => s.debug);

              // Update totals
              const totals = stats.reduce((acc, s) => ({
                debug: acc.debug + s.debug,
                info: acc.info + s.info,
                warn: acc.warn + s.warn,
                error: acc.error + s.error,
              }), { debug: 0, info: 0, warn: 0, error: 0 });
              this.statsTotals = totals;

              // Update charts in-place
              if (ewChart) {
                ewChart.data.labels = labels;
                ewChart.data.datasets[0].data = errors;
                ewChart.data.datasets[1].data = warnings;
                ewChart.update();
              }
              if (trafficChart) {
                trafficChart.data.labels = labels;
                trafficChart.data.datasets[0].data = info;
                trafficChart.data.datasets[1].data = debug;
                trafficChart.update();
              }
            }
          } catch (err) {
            console.error('Failed to load stats:', err);
          } finally {
            this.statsLoading = false;
          }
        },

        setLevel(level) {
          this.filters.level = level;
          this.applyFilters();
        },

        addContextFilter() {
          this.filters.contextFilters.push({ key: '', value: '' });
        },

        removeContextFilter(index) {
          this.filters.contextFilters.splice(index, 1);
          this.applyFilters();
        },

        clearFilters() {
          this.filters = {
            dateRange: '7d',
            since: '',
            until: '',
            level: '',
            requestId: '',
            search: '',
            contextFilters: []
          };
          this.applyFilters();
        },

        applyFilters() {
          this.offset = 0;
          this.loadLogs();
        },

        buildQueryString() {
          const params = new URLSearchParams();
          params.set('limit', this.limit);
          params.set('offset', this.offset);

          if (this.filters.level) {
            params.set('level', this.filters.level);
          }

          // Date range
          if (this.filters.dateRange === 'today') {
            params.set('since', new Date().toISOString().split('T')[0] + 'T00:00:00Z');
          } else if (this.filters.dateRange === '7d') {
            const d = new Date();
            d.setDate(d.getDate() - 7);
            params.set('since', d.toISOString());
          } else if (this.filters.dateRange === '30d') {
            const d = new Date();
            d.setDate(d.getDate() - 30);
            params.set('since', d.toISOString());
          } else if (this.filters.dateRange === 'custom') {
            if (this.filters.since) params.set('since', this.filters.since + 'T00:00:00Z');
            if (this.filters.until) params.set('until', this.filters.until + 'T23:59:59Z');
          }

          if (this.filters.requestId) {
            params.set('request_id', this.filters.requestId);
          }

          if (this.filters.search) {
            params.set('search', this.filters.search);
          }

          // Context filters
          const validContextFilters = this.filters.contextFilters.filter(cf => cf.key && cf.value);
          for (const cf of validContextFilters) {
            params.set('context.' + cf.key, cf.value);
          }

          return params.toString();
        },

        async loadLogs() {
          this.loading = true;
          try {
            const query = this.buildQueryString();
            const res = await fetch('/dashboard/api/logs/' + APP_ID + '?' + query);
            const data = await res.json();
            if (data.ok && data.data) {
              this.logs = data.data;
            }
          } catch (err) {
            console.error('Failed to load logs:', err);
          } finally {
            this.loading = false;
          }
        },

        toggleAutoRefresh() {
          if (this.autoRefresh) {
            this.autoRefreshInterval = setInterval(() => this.loadLogs(), 5000);
          } else {
            clearInterval(this.autoRefreshInterval);
            this.autoRefreshInterval = null;
          }
        },

        prevPage() {
          if (this.offset > 0) {
            this.offset -= this.limit;
            this.loadLogs();
          }
        },

        nextPage() {
          this.offset += this.limit;
          this.loadLogs();
        },

        showLog(log) {
          this.selectedLog = log;
        },

        formatTimestamp(ts) {
          return new Date(ts).toLocaleString();
        }
      }
    }

    // Initialize charts and store instances for later updates via loadStats()
    document.addEventListener('DOMContentLoaded', () => {
      const ewCtx = document.getElementById('errorsWarningsChart');
      if (ewCtx) {
        ewChart = new Chart(ewCtx, ${errorsWarningsConfig});
      }
      const trafficCtx = document.getElementById('trafficChart');
      if (trafficCtx) {
        trafficChart = new Chart(trafficCtx, ${trafficConfig});
      }
    });
  </script>`

  return htmlDocument(content, { title: `Worker Logs - ${appName}`, brand })
}
