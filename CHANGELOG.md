# Changelog

## 1.0.0 (2026-01-27)


### Features

* add API key authentication middleware ([08693ea](https://github.com/aibtcdev/worker-logs/commit/08693ea65c5a1d444938ceb7f91b01f100230acf))
* add auth to public endpoints and document Cloudflare Access ([3ee8154](https://github.com/aibtcdev/worker-logs/commit/3ee8154c8e9f74fdfef7e96b8c0070c4254e65bb))
* add RPC entrypoint for service bindings ([51d702d](https://github.com/aibtcdev/worker-logs/commit/51d702d661b639a0992aa976cfcf171970686947))
* add web dashboard for browsing logs ([8efb678](https://github.com/aibtcdev/worker-logs/commit/8efb67872a7043e3a112f0385285d42e18da6be7))
* add wrangler env wrapper for API token auth ([7d024b2](https://github.com/aibtcdev/worker-logs/commit/7d024b26ee654edf8cc483ef5d560a9a4bd0e6ec))
* allow admin key to delete apps ([#2](https://github.com/aibtcdev/worker-logs/issues/2)) ([cc4e059](https://github.com/aibtcdev/worker-logs/commit/cc4e059083bcc848ff15ee1e1738539c0d23fd56))
* **dashboard:** apply AIBTC brand guidelines ([#9](https://github.com/aibtcdev/worker-logs/issues/9)) ([66d6f28](https://github.com/aibtcdev/worker-logs/commit/66d6f280a781ba25347c2b10925b3835c0f21ac6))
* **dashboard:** make branding configurable via env vars ([#10](https://github.com/aibtcdev/worker-logs/issues/10)) ([358afa8](https://github.com/aibtcdev/worker-logs/commit/358afa8b7189489e2b9a9bbdbb413a6819b02517))
* initial project scaffold ([006d303](https://github.com/aibtcdev/worker-logs/commit/006d303f9b0c347f5773fbed6caf7a47d7d47765))
* **phase2:** add core types and result utilities ([50ad925](https://github.com/aibtcdev/worker-logs/commit/50ad925c95cbc63ae7af0edb1d32c91383ea7bd3))
* **phase3:** implement Durable Object with full functionality ([70b65b2](https://github.com/aibtcdev/worker-logs/commit/70b65b2f922db2d3fd44904f123584d504eec00d))
* **phase4:** implement full API layer with registry and stats services ([056eea4](https://github.com/aibtcdev/worker-logs/commit/056eea480e091a7cc82d98b94a5e1d5585121cf9))
* production readiness fixes ([9917396](https://github.com/aibtcdev/worker-logs/commit/9917396b6abfa88ec00850383c3a135cbbcd5e93))


### Bug Fixes

* cleanup wrangler.jsonc, add dev and preview ([3d2c181](https://github.com/aibtcdev/worker-logs/commit/3d2c1817070023f46307e2ef9d649c8d3cec02d7))
* require API key auth for management endpoints ([ba796c2](https://github.com/aibtcdev/worker-logs/commit/ba796c2cc1baf74cca930c8a1c05cc145323ee2e))
* use correct KV namespace IDs for aibtcdev account ([#3](https://github.com/aibtcdev/worker-logs/issues/3)) ([9782556](https://github.com/aibtcdev/worker-logs/commit/978255672b8f18bc76e41519f44b841cd2312e9b))
