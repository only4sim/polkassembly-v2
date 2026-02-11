# Running in No-Keys Dev Mode

This guide explains how to run the Polkassembly development server without blockchain, indexer, Redis, Algolia, or AI service keys.

## Quick Start

1. Copy the example environment file:

   ```bash
   cp .env.example .env
   ```

2. Set minimal required values in `.env`:

   ```env
   NEXT_PUBLIC_APP_ENV='development'
   ```

   > `NEXT_PUBLIC_DEFAULT_NETWORK` is optional — it falls back to `'polkadot'` when not set.

3. Ensure all feature flags are set to `false` (this is the default in `.env.example`):

   ```env
   ENABLE_BLOCKCHAIN=false
   ENABLE_INDEXERS=false
   ENABLE_REDIS=false
   ENABLE_ALGOLIA=false
   ENABLE_AI=false
   IS_CACHE_ENABLED=false
   IS_AI_ENABLED=false
   IS_NOTIFICATION_SERVICE_ENABLED=false
   ```

4. Start the dev server:

   ```bash
   yarn dev
   ```

## Feature Flags

| Flag                | Default | Description                                        |
| ------------------- | ------- | -------------------------------------------------- |
| `ENABLE_BLOCKCHAIN` | `false` | Enables Polkadot API / on-chain wallet connections |
| `ENABLE_INDEXERS`   | `false` | Enables Subscan and Subsquid indexer services      |
| `ENABLE_REDIS`      | `false` | Enables Redis caching (requires `REDIS_URL`)       |
| `ENABLE_ALGOLIA`    | `false` | Enables Algolia search indexing                    |
| `ENABLE_AI`         | `false` | Enables AI service (summaries, sentiment, spam)    |

When a feature flag is `false`:

- The corresponding service will **not** initialize or connect.
- API calls that depend on the service will return empty/stub data.
- A `[disabled]` log message is printed at startup for each disabled service.
- The app will not throw errors due to missing keys for that service.

## What Works Without Keys

- The dev server starts and compiles successfully.
- The home page loads (may show empty listings if no Firestore data is available).
- The Next.js error boundary displays a friendly error page if data fetching fails.
- All UI components render (with placeholder/empty states where data is unavailable).

## What Requires Keys

To enable full functionality, set the corresponding feature flag to `true` and provide the required environment variables:

| Feature Flag        | Required Env Vars                                                       |
| ------------------- | ----------------------------------------------------------------------- |
| `ENABLE_REDIS`      | `REDIS_URL`                                                             |
| `ENABLE_INDEXERS`   | `SUBSCAN_API_KEY`                                                       |
| `ENABLE_ALGOLIA`    | `NEXT_PUBLIC_ALGOLIA_APP_ID`, `ALGOLIA_WRITE_API_KEY`                   |
| `ENABLE_AI`         | `AI_SERVICE_URL`, plus set `IS_AI_ENABLED=true`                         |
| `ENABLE_BLOCKCHAIN` | RPC endpoints are hardcoded in network config; no extra env vars needed |

## Firebase / Firestore

`FIREBASE_SERVICE_ACC_CONFIG` is handled separately. If not set, a warning is logged but the server still starts. Firestore-dependent operations will fail at call time rather than at startup.

## Troubleshooting

**Server won't start?**

- Check that all `ENABLE_*` flags are set to `false`.
- Check that `IS_CACHE_ENABLED`, `IS_AI_ENABLED`, and `IS_NOTIFICATION_SERVICE_ENABLED` are set to `false`.

**Pages show errors?**

- This is expected when data services are disabled. The error boundary will show a friendly message.
- If you need working data, provide `FIREBASE_SERVICE_ACC_CONFIG` for Firestore access.
