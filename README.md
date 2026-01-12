# worker-logs

Centralized logging service for Cloudflare Workers.

## Features

- **Sharded storage** - Each app gets isolated SQLite via Durable Objects
- **Dual access** - RPC binding for internal workers, REST API with API key for external
- **Web dashboard** - Browse and search logs at `/dashboard`
- **Health monitoring** - Periodic URL checks via DO alarms
- **Daily stats** - Aggregated log counts by level
- **Result types** - Ok/Err response format for consistency

## Setup

### 1. Cloudflare API Token

Create a token at https://dash.cloudflare.com/profile/api-tokens using the "Edit Cloudflare Workers" template, then add:
- **Workers KV Storage: Edit**
- **Account Settings: Read**

### 2. Environment Variables

Create a `.env` file with your credentials:

```bash
CLOUDFLARE_API_TOKEN=your-api-token
CLOUDFLARE_ACCOUNT_ID=your-account-id
```

### 3. Install & Run

```bash
npm install
npm run dev      # Local development
npm run deploy   # Deploy to Cloudflare (or use CI/CD)
```

### 4. Create KV Namespace (first time only)

```bash
npm run wrangler -- kv namespace create LOGS_KV
# Add the returned ID to wrangler.jsonc
```

### 5. Set Admin API Key

```bash
npm run wrangler -- secret put ADMIN_API_KEY
# Enter a secure random key (e.g., openssl rand -hex 24)
```

## Usage

### Web Dashboard

Access the dashboard at `/dashboard` to browse and search logs. Requires admin key login.

### REST API (External)

```bash
# Write logs
curl -X POST https://worker-logs.<your-domain>.workers.dev/logs \
  -H "X-App-ID: my-app" \
  -H "X-Api-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"level": "INFO", "message": "Hello from external"}'

# Query logs
curl "https://worker-logs.<your-domain>.workers.dev/logs?level=ERROR&limit=10" \
  -H "X-App-ID: my-app" \
  -H "X-Api-Key: your-api-key"

# Get daily stats
curl "https://worker-logs.<your-domain>.workers.dev/stats/my-app?days=7" \
  -H "X-App-ID: my-app" \
  -H "X-Api-Key: your-api-key"
```

### RPC Binding (Internal Workers)

```typescript
// In your worker's wrangler.jsonc:
// "services": [{ "binding": "LOGS", "service": "worker-logs", "entrypoint": "LogsRPC" }]

// Usage:
await env.LOGS.info('my-app', 'User action', { userId: '123' })
await env.LOGS.error('my-app', 'Something failed', { error: err.message })
```

## Testing

```bash
npm test           # Run all tests
npm run test:watch # Watch mode
```

## Documentation

- [Integration Guide](docs/integration.md) - How to integrate worker-logs into your workers
- [Implementation Plan](docs/PLAN.md) - Architecture and design details

## License

MIT
