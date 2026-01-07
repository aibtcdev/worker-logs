# worker-logs

Centralized logging service for Cloudflare Workers.

## Features

- **Sharded storage** - Each app gets isolated SQLite via Durable Objects
- **Dual access** - RPC binding for internal workers, REST API with API key for external
- **Health monitoring** - Periodic URL checks via DO alarms
- **Result types** - Ok/Err response format for clarity

## Setup

### 1. Cloudflare API Token

Create a token at https://dash.cloudflare.com/profile/api-tokens using the "Edit Cloudflare Workers" template, then add:
- **Workers KV Storage: Edit**
- **Account Settings: Read**

### 2. Environment Variables

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
# Edit .env with your CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID
```

### 3. Install & Run

```bash
npm install
npm run dev      # Local development
npm run deploy   # Deploy to Cloudflare
```

### 4. Create KV Namespace (after first deploy)

```bash
npm run wrangler -- kv namespace create LOGS_KV
# Add the returned ID to wrangler.jsonc
```

## Usage

### REST API (External)

```bash
# Write logs
curl -X POST https://worker-logs.<your-domain>.workers.dev/logs \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"level": "INFO", "message": "Hello from external"}'

# Query logs
curl "https://worker-logs.<your-domain>.workers.dev/logs?level=ERROR&limit=10" \
  -H "X-API-Key: your-api-key"
```

### RPC Binding (Internal Workers)

```typescript
// In your worker's wrangler.jsonc:
// "services": [{ "binding": "LOGGER", "service": "worker-logs", "entrypoint": "LoggerService" }]

// Usage:
await env.LOGGER.log('my-app', 'INFO', 'User action', { userId: '123' })
```

## Documentation

See [docs/PLAN.md](docs/PLAN.md) for full implementation details.

## License

MIT
