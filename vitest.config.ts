import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config'

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.jsonc' },
        // ADMIN_API_KEY is a secret (.dev.vars, gitignored), so a fresh clone has none and
        // the admin-gated integration tests get 503. Give the test pool its own value.
        miniflare: { bindings: { ADMIN_API_KEY: 'test-admin-key' } },
        // Disable isolated storage for SQLite-backed DOs (known issue)
        // https://developers.cloudflare.com/workers/testing/vitest-integration/known-issues/#isolated-storage
        isolatedStorage: false,
      },
    },
  },
})
