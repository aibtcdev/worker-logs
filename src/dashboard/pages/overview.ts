/**
 * Overview page - unified view of all apps
 */

import { htmlDocument, header, statsCard, emptyState } from '../components/layout'
import { formatTrend, formatHealthStatus, overviewBarChartConfig, sparkline } from '../components/charts'
import { escapeHtml } from '../styles'
import type { OverviewResponse } from '../types'
import type { BrandConfig } from '../brand'
import { DEFAULT_BRAND_CONFIG } from '../brand'

export function overviewPage(data: OverviewResponse, apps: string[], brand: BrandConfig = DEFAULT_BRAND_CONFIG): string {
  const { totals, apps: appSummaries, recent_errors } = data

  const totalErrors = totals.today.error
  const appsWithErrors = appSummaries.filter(a => a.today_stats.error > 0).length
  const totalApps = appSummaries.length

  // Compute total log volume for error rate calculation
  const todayTotal = totals.today.debug + totals.today.info + totals.today.warn + totals.today.error
  const errorRate = todayTotal > 0 ? Math.round((totals.today.error / todayTotal) * 100) : 0
  const warnRate = todayTotal > 0 ? Math.round((totals.today.warn / todayTotal) * 100) : 0

  // 2-point sparklines: [yesterday, today]
  const errorSparkline = sparkline(
    [totals.yesterday.error, totals.today.error],
    { color: '#F87171', showArea: true, width: 100, height: 20 }
  )
  const warnSparkline = sparkline(
    [totals.yesterday.warn, totals.today.warn],
    { color: '#FBBF24', showArea: true, width: 100, height: 20 }
  )
  const infoSparkline = sparkline(
    [totals.yesterday.info, totals.today.info],
    { color: '#60A5FA', showArea: true, width: 100, height: 20 }
  )

  // Initial empty chart config — populated via loadChartData() on DOMContentLoaded
  const initialChartConfig = overviewBarChartConfig([], [])

  const content = `
  ${header({ currentView: 'overview', apps, brand })}

  <main class="max-w-7xl mx-auto px-6 py-6" x-data="overviewState()">
    <!-- Error Summary Cards -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      ${statsCard('Total Errors (24h)', totalErrors, 'text-red-400', errorSparkline, errorRate > 0 ? `${errorRate}% of all logs` : undefined)}
      ${statsCard('Apps with Issues', `${appsWithErrors}/${totalApps}`, appsWithErrors > 0 ? 'text-yellow-400' : 'text-green-400')}
      ${statsCard('Total Warnings', totals.today.warn, 'text-yellow-400', warnSparkline, warnRate > 0 ? `${warnRate}% of all logs` : undefined)}
      ${statsCard('Total Info', totals.today.info, 'text-blue-400', infoSparkline)}
    </div>

    <!-- Overview Chart -->
    <div class="brand-card rounded-lg p-4 mb-6">
      <div class="flex items-center justify-between mb-3">
        <h2 class="font-medium">Errors &amp; Warnings by App (<span x-text="chartRange + 'd'">7d</span>)</h2>
        <div class="flex items-center gap-1">
          <button @click="setChartRange(7)"
                  :class="chartRange === 7 ? 'bg-gray-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-400'"
                  class="px-3 py-1 text-xs rounded transition-colors">7d</button>
          <button @click="setChartRange(14)"
                  :class="chartRange === 14 ? 'bg-gray-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-400'"
                  class="px-3 py-1 text-xs rounded transition-colors">14d</button>
          <button @click="setChartRange(30)"
                  :class="chartRange === 30 ? 'bg-gray-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-400'"
                  class="px-3 py-1 text-xs rounded transition-colors">30d</button>
        </div>
      </div>
      <div x-show="chartLoading" class="flex justify-center py-4">
        <svg class="animate-spin h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
      <div x-show="!chartLoading" class="h-64">
        <canvas id="overviewChart"></canvas>
      </div>
    </div>

    <!-- App Health Table -->
    <div class="brand-card rounded-lg mb-6 overflow-hidden">
      <div class="px-4 py-3 flex items-center justify-between" style="border-bottom: 1px solid var(--border);">
        <h2 class="font-medium">App Health Summary</h2>
        <button @click="refreshData()" class="text-sm text-gray-400 hover:text-gray-200 flex items-center gap-1">
          <svg class="w-4 h-4" :class="{ 'animate-spin': loading }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
          Refresh
        </button>
      </div>
      ${appSummaries.length > 0 ? `
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-750">
            <tr class="text-left text-gray-400 border-b border-gray-700">
              <th class="px-4 py-3">App</th>
              <th class="px-4 py-3 text-right">Errors (24h)</th>
              <th class="px-4 py-3 text-center">Trend</th>
              <th class="px-4 py-3">Status</th>
              <th class="px-4 py-3">Last Error</th>
              <th class="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-700">
            ${appSummaries.map(app => `
            <tr class="log-row hover:bg-gray-750">
              <td class="px-4 py-3">
                <a href="/dashboard/app/${app.id}" class="text-blue-400 hover:text-blue-300 font-medium">${escapeHtml(app.name)}</a>
                ${app.name !== app.id ? `<div class="text-xs text-gray-500">${escapeHtml(app.id)}</div>` : ''}
              </td>
              <td class="px-4 py-3 text-right font-mono ${app.today_stats.error > 0 ? 'text-red-400' : 'text-gray-400'}">
                ${app.today_stats.error}
              </td>
              <td class="px-4 py-3 text-center">
                ${formatTrend(app.today_stats.error, app.yesterday_stats.error)}
              </td>
              <td class="px-4 py-3">
                ${formatHealthStatus(app.health_status)}
              </td>
              <td class="px-4 py-3 text-gray-400 text-xs max-w-xs truncate">
                ${app.last_error ? `
                  <span title="${escapeHtml(app.last_error.message)}">${escapeHtml(app.last_error.message.substring(0, 50))}${app.last_error.message.length > 50 ? '...' : ''}</span>
                ` : '-'}
              </td>
              <td class="px-4 py-3">
                <a href="/dashboard/app/${app.id}" class="text-gray-400 hover:text-gray-200">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                  </svg>
                </a>
              </td>
            </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ` : emptyState(
        '<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2"/></svg>',
        'No apps registered yet.',
        'Use POST /apps with an admin key to register your first app.'
      )}
    </div>

    <!-- Recent Errors -->
    <div class="brand-card rounded-lg overflow-hidden">
      <div class="px-4 py-3" style="border-bottom: 1px solid var(--border);">
        <h2 class="font-medium">Recent Errors (All Apps)</h2>
      </div>
      ${recent_errors.length > 0 ? `
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-750">
            <tr class="text-left text-gray-400 border-b border-gray-700">
              <th class="px-4 py-3 w-40">Timestamp</th>
              <th class="px-4 py-3 w-32">App</th>
              <th class="px-4 py-3">Message</th>
              <th class="px-4 py-3 w-32">Path</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-700">
            ${recent_errors.map(error => `
            <tr class="log-row hover:bg-gray-750 cursor-pointer" @click="showError(${JSON.stringify(error).replace(/"/g, '&quot;')})">
              <td class="px-4 py-2 text-gray-400 font-mono text-xs">
                ${new Date(error.timestamp).toLocaleString()}
              </td>
              <td class="px-4 py-2">
                <a href="/dashboard/app/${error.app_id}" class="text-blue-400 hover:text-blue-300 text-xs" @click.stop>
                  ${escapeHtml(error.app_id)}
                </a>
              </td>
              <td class="px-4 py-2 text-red-400 truncate max-w-md">
                ${escapeHtml(error.message)}
              </td>
              <td class="px-4 py-2 text-gray-500 text-xs truncate">
                ${error.context?.path ? escapeHtml(String(error.context.path)) : '-'}
              </td>
            </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ` : emptyState(
        '<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>',
        'No recent errors across all apps.',
        'Your apps are running smoothly.'
      )}
    </div>

    <!-- Error Detail Modal -->
    <div x-show="selectedError" x-cloak
         class="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"
         @click.self="selectedError = null">
      <div class="rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden" style="background: var(--bg-card); border: 1px solid var(--border);" @click.stop>
        <div class="flex items-center justify-between px-4 py-3" style="border-bottom: 1px solid var(--border);">
          <h3 class="font-medium">Error Details</h3>
          <button @click="selectedError = null" class="icon-button text-gray-400 hover:text-gray-200">&times;</button>
        </div>
        <div class="p-4 overflow-auto max-h-[calc(80vh-60px)]">
          <pre class="text-sm whitespace-pre-wrap text-gray-300" x-text="JSON.stringify(selectedError, null, 2)"></pre>
        </div>
      </div>
    </div>
  </main>

  <script>
    // Chart instance — set in DOMContentLoaded, updated by loadChartData()
    var overviewChart = null;

    function overviewState() {
      return {
        loading: false,
        selectedError: null,
        chartRange: 7,
        chartLoading: false,

        init() {
          this.loadChartData();
        },

        setChartRange(days) {
          this.chartRange = days;
          this.loadChartData();
        },

        async loadChartData() {
          this.chartLoading = true;
          try {
            const res = await fetch('/dashboard/api/overview/chart?days=' + this.chartRange);
            const data = await res.json();
            if (data.ok && data.data && overviewChart) {
              const { dates, apps } = data.data;
              const datasets = [];
              for (const app of apps) {
                datasets.push({
                  label: app.name + ' Errors',
                  data: app.errors,
                  backgroundColor: '#F8717199',
                  borderColor: '#F87171',
                  borderWidth: 1,
                  borderRadius: 2,
                });
                datasets.push({
                  label: app.name + ' Warns',
                  data: app.warnings,
                  backgroundColor: '#FBBF2499',
                  borderColor: '#FBBF24',
                  borderWidth: 1,
                  borderRadius: 2,
                });
              }
              overviewChart.data.labels = dates;
              overviewChart.data.datasets = datasets;
              overviewChart.update();
            }
          } catch (err) {
            console.error('Failed to load chart data:', err);
          } finally {
            this.chartLoading = false;
          }
        },

        refreshData() {
          this.loading = true;
          window.location.reload();
        },

        showError(error) {
          this.selectedError = error;
        }
      }
    }

    // Initialize chart with empty config; loadChartData() populates it via Alpine init()
    document.addEventListener('DOMContentLoaded', () => {
      const ctx = document.getElementById('overviewChart');
      if (ctx) {
        overviewChart = new Chart(ctx, ${initialChartConfig});
      }
    });
  </script>`

  return htmlDocument(content, { title: 'Worker Logs - Overview', brand })
}
