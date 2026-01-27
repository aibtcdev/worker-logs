/**
 * Shared layout components for the dashboard
 */

import { logLevelCss, escapeHtml } from '../styles'
import { BrandConfig, DEFAULT_BRAND_CONFIG } from '../brand'

export interface LayoutOptions {
  title?: string
  currentView?: 'overview' | 'app'
  currentApp?: string
  apps?: string[]
  brand?: BrandConfig
}

/**
 * Generate brand CSS from BrandConfig
 */
export function buildBrandCss(config: BrandConfig): string {
  return `
  @font-face {
    font-family: '${config.fontName}';
    src: url('${config.fontRegularUrl}') format('woff2');
    font-weight: 400;
    font-display: swap;
  }
  @font-face {
    font-family: '${config.fontName}';
    src: url('${config.fontMediumUrl}') format('woff2');
    font-weight: 500;
    font-display: swap;
  }
  :root {
    --accent: ${config.accentColor};
    --accent-hover: ${config.accentHoverColor};
    --accent-dim: ${config.accentDimColor};
    --bg-primary: #000;
    --bg-card: #0a0a0a;
    --bg-table-header: #111111;
    --bg-hover: #18181b;
    --bg-input: #1a1a1a;
    --bg-input-hover: #222222;
    --bg-active-subtle: #252525;
    --bg-active: #2a2a2a;
    --border: rgba(255,255,255,0.06);
    --border-hover: rgba(255,255,255,0.1);
    --text-primary: #fafafa;
    --text-secondary: #a1a1aa;
    --text-muted: #71717a;
  }
  * { box-sizing: border-box; }
  body {
    font-family: '${config.fontName}', system-ui, -apple-system, sans-serif;
    background: linear-gradient(135deg, #000000, #0a0a0a, #050208);
    color: var(--text-primary);
    min-height: 100vh;
    -webkit-font-smoothing: antialiased;
  }
  body::before {
    content: '';
    position: fixed;
    inset: 0;
    background: url('${config.patternImageUrl}') center/cover;
    opacity: 0.12;
    filter: saturate(1.3);
    pointer-events: none;
    z-index: -1;
  }
  /* Override Tailwind gray-900/800/700 with brand dark palette */
  .bg-gray-900, .bg-gray-800 { background-color: var(--bg-card) !important; }
  .border-gray-700 { border-color: var(--border) !important; }
  .bg-gray-750 { background-color: var(--bg-table-header) !important; }
  .hover\\:bg-gray-750:hover { background-color: var(--bg-hover) !important; }
  .bg-gray-700 { background-color: var(--bg-input) !important; }
  .hover\\:bg-gray-700\\/50:hover { background-color: rgba(26,26,26,0.5) !important; }
  .hover\\:bg-gray-700:hover { background-color: var(--bg-input-hover) !important; }
  .hover\\:bg-gray-600:hover { background-color: var(--bg-active) !important; }
  .bg-gray-600 { background-color: var(--bg-active-subtle) !important; }
  /* Brand accent overrides: all .text-blue-400 except log-level indicators */
  .text-blue-400:not(.log-level) { color: var(--accent) !important; }
  .text-blue-400:not(.log-level):hover, .hover\\:text-blue-300:not(.log-level):hover { color: ${config.accentLightColor} !important; }
  .bg-blue-600 { background-color: var(--accent) !important; }
  .hover\\:bg-blue-700:hover { background-color: var(--accent-hover) !important; }
  .focus\\:border-blue-500:focus { border-color: var(--accent) !important; }
  /* Focus ring styling */
  input:focus-visible, select:focus-visible, button:focus-visible:not(.log-level):not(.icon-button) {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
  .log-level:focus-visible, .icon-button:focus-visible {
    outline: auto;
    outline-offset: 0;
  }
  /* Login button hover */
  .btn-accent { background: var(--accent); color: white; }
  .btn-accent:hover { background: var(--accent-hover); }
  /* Brand card effects */
  .brand-card {
    position: relative;
    overflow: hidden;
    background: var(--bg-card);
    border: 1px solid var(--border);
    transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
  }
  .brand-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 20px ${config.accentGlowColor};
    border-color: ${config.accentBorderColor};
  }
  .brand-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 2px;
    background: linear-gradient(90deg, var(--accent), transparent);
    opacity: 0;
    transition: opacity 0.3s ease;
  }
  .brand-card:hover::before { opacity: 1; }
  /* Card glow effect */
  .card-glow::after {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(
      circle at var(--mouse-x, 50%) var(--mouse-y, 50%),
      var(--accent-dim) 0%,
      transparent 60%
    );
    opacity: 0;
    transition: opacity 0.4s ease;
    pointer-events: none;
    z-index: 0;
  }
  .card-glow:hover::after { opacity: 1; }
  /* Ensure card content is above glow */
  .brand-card > * {
    position: relative;
    z-index: 1;
  }
  /* Header brand styling */
  .brand-header {
    background: rgba(10,10,10,0.8);
    -webkit-backdrop-filter: blur(12px);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--border);
  }
  .header-logo { height: 28px; width: auto; }
`
}

/**
 * Card glow mouse tracking script
 */
const cardGlowScript = `
  (function() {
    document.addEventListener('mousemove', function(e) {
      if (!e.target || !e.target.closest) return;
      var card = e.target.closest('.card-glow');
      if (!card) return;
      var rect = card.getBoundingClientRect();
      card.style.setProperty('--mouse-x', ((e.clientX - rect.left) / rect.width * 100) + '%');
      card.style.setProperty('--mouse-y', ((e.clientY - rect.top) / rect.height * 100) + '%');
    });
  })();
`

/**
 * Generate the HTML document wrapper with head and scripts
 */
export function htmlDocument(content: string, options: LayoutOptions = {}): string {
  const { title = 'Worker Logs' } = options
  const brand = options.brand || DEFAULT_BRAND_CONFIG

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="icon" type="image/png" sizes="32x32" href="${escapeHtml(brand.faviconUrl)}">
  <link rel="dns-prefetch" href="${escapeHtml(brand.cdnHost)}">
  <link rel="preload" href="${escapeHtml(brand.patternImageUrl)}" as="image" type="image/jpeg">
  <script src="https://cdn.tailwindcss.com"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    ${buildBrandCss(brand)}
    ${logLevelCss}
    [x-cloak] { display: none !important; }
  </style>
</head>
<body class="min-h-screen">
${content}
<script>${cardGlowScript}</script>
</body>
</html>`
}

/**
 * Dashboard header with navigation and brand logo
 */
export function header(options: LayoutOptions = {}): string {
  const { currentView = 'overview', currentApp, apps = [] } = options
  const brand = options.brand || DEFAULT_BRAND_CONFIG

  return `
  <header class="brand-header px-6 py-4">
    <div class="max-w-7xl mx-auto flex items-center justify-between">
      <div class="flex items-center gap-6">
        <a href="/dashboard" class="flex items-center gap-3" style="color: inherit; text-decoration: none;">
          <img src="${escapeHtml(brand.logoUrl)}" alt="${escapeHtml(brand.name)}" class="header-logo">
          <span class="text-lg font-medium" style="color: var(--text-secondary);">Worker Logs</span>
        </a>
        <nav class="flex gap-1">
          <a href="/dashboard"
             class="px-3 py-1.5 text-sm rounded ${currentView === 'overview' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'}">
            Overview
          </a>
          <div class="relative" x-data="{ open: false }">
            <button @click="open = !open"
                    class="px-3 py-1.5 text-sm rounded flex items-center gap-1 ${currentView === 'app' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'}">
              ${currentApp ? currentApp : 'Select App'}
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
              </svg>
            </button>
            <div x-show="open" @click.away="open = false" x-cloak
                 class="absolute top-full left-0 mt-1 rounded shadow-lg py-1 min-w-[160px] z-50" style="background: var(--bg-card); border: 1px solid var(--border);">
              ${apps.map(app => `
                <a href="/dashboard/app/${app}"
                   class="block px-3 py-1.5 text-sm hover:bg-gray-700 ${app === currentApp ? 'text-blue-400' : 'text-gray-300'}">
                  ${app}
                </a>
              `).join('')}
              ${apps.length === 0 ? '<div class="px-3 py-1.5 text-sm text-gray-500">No apps registered</div>' : ''}
            </div>
          </div>
        </nav>
      </div>
      <a href="/dashboard/logout" class="text-gray-400 hover:text-gray-200 text-sm">Logout</a>
    </div>
  </header>`
}

/**
 * Stats card component with brand hover effect
 */
export function statsCard(label: string, value: number | string, colorClass: string = 'text-gray-100'): string {
  return `
  <div class="brand-card card-glow rounded-lg p-4">
    <div class="text-sm mb-1" style="color: var(--text-muted);">${label}</div>
    <div class="text-2xl font-bold ${colorClass}">${value}</div>
  </div>`
}

/**
 * Empty state component
 */
export function emptyState(icon: string, message: string): string {
  return `
  <div class="text-center py-12" style="color: var(--text-muted);">
    ${icon}
    <p>${message}</p>
  </div>`
}
