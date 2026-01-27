/**
 * Login page for the dashboard
 */

import { htmlDocument } from '../components/layout'
import { escapeHtml } from '../styles'
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
        <img src="${escapeHtml(brand.logoUrl)}" alt="${escapeHtml(brand.name)}" style="height: 36px; width: auto; margin-bottom: 16px;">
        <h1 class="text-2xl font-bold text-center">Worker Logs</h1>
      </div>
      ${errorHtml}
      <form method="POST" action="/dashboard/login">
        <label class="block mb-2 text-sm text-gray-400">Admin Key</label>
        <input
          type="password"
          name="admin_key"
          class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
          placeholder="Enter admin key"
          required
          autofocus
        />
        <button
          type="submit"
          class="w-full mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-medium transition-colors"
        >
          Login
        </button>
      </form>
    </div>
  </div>`

  return htmlDocument(content, { title: 'Worker Logs - Login', brand })
}
