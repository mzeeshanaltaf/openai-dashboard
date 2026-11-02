# OpenAI Usage Dashboard

One page for everything the OpenAI platform spreads across several screens: remaining balance, month-to-date spend with a forecast, daily spend by project or model, per-project and per-API-key breakdowns, monthly budgets with alerts, and CSV export.

Data comes live from OpenAI's Admin API (`/v1/organization/costs`, `/usage/*`, `/projects`, `/projects/{id}/api_keys`). Responses are cached in memory for 5 minutes; the refresh button bypasses the cache.

## Remaining balance

OpenAI does not return credit balance or grants to API keys (those endpoints require a browser session). Instead, record each credit top-up in **Credits & budgets** (gear icon). The dashboard shows:

```
remaining = sum(active top-ups) − actual spend (Costs API) since the earliest active top-up
```

Top-ups with a past expiry date are excluded. Top-ups and budgets are stored in SQLite at `$DATA_DIR/dashboard.db`.

## Environment

| Variable | Purpose |
|---|---|
| `OPENAI_ADMIN_KEY` | Organization Admin API key (server-side only) |
| `DASHBOARD_PASSWORD` | Password for the login page |
| `SESSION_SECRET` | Random string (32+ bytes) used to sign the session cookie |
| `DATA_DIR` | Directory for the SQLite file (`./data` locally, `/data` in Docker) |

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:3000 and sign in with `DASHBOARD_PASSWORD`.

## Deployment (Docker / Coolify)

The `Dockerfile` builds a standalone Next.js server on port 3000. Mount a persistent volume at `/data` so credit top-ups and budgets survive redeploys, and set the four variables above as runtime environment variables.

## Notes

- All dates are UTC days, matching OpenAI's billing buckets.
- Every page and API route except `/login` sits behind the password (`proxy.ts`); login attempts are rate-limited per IP.
- Series colors follow the entity: the top 7 projects or models by spend in the selected range get fixed colors, and the rest fold into "Other".
