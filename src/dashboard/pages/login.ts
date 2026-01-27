/**
 * Login page for the dashboard
 */

import { htmlDocument } from '../components/layout'
import type { BrandConfig } from '../brand'
import { DEFAULT_BRAND_CONFIG } from '../brand'

export function loginPage(error?: string, brand: BrandConfig = DEFAULT_BRAND_CONFIG): string {
  const errorHtml = error
    ? `<div class="bg-red-900/50 border border-red-500 text-red-300 px-4 py-2 rounded mb-4">${error}</div>`
    : ''

  const content = `
  <div class="min-h-screen flex items-center justify-center">
    <div class="brand-card rounded-lg p-8 shadow-xl w-full max-w-md">
      <div class="flex flex-col items-center mb-6">
        <img src="${brand.logoUrl}" alt="${brand.name}" style="height: 36px; width: auto; margin-bottom: 16px;">
        <h1 class="text-2xl font-bold text-center">Worker Logs</h1>
      </div>
      ${errorHtml}
      <form method="POST" action="/dashboard/login">
        <label class="block mb-2 text-sm" style="color: var(--text-muted);">Admin Key</label>
        <input
          type="password"
          name="admin_key"
          class="w-full px-4 py-2 rounded"
          style="background: var(--bg-hover); border: 1px solid var(--border); color: var(--text-primary);"
          placeholder="Enter admin key"
          required
          autofocus
        />
        <button
          type="submit"
          class="w-full mt-4 px-4 py-2 rounded font-medium transition-colors btn-accent"
        >
          Login
        </button>
      </form>
    </div>
  </div>`

  return htmlDocument(content, { title: 'Worker Logs - Login', brand })
}
