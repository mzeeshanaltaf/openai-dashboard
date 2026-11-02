# OpenAI Usage Dashboard

A single-page, password-protected dashboard over the OpenAI **Admin API**. It shows remaining balance, month-to-date
spend with a forecast, daily spend by project or model, per-project, per-model and per-API-key breakdowns, monthly
budgets with alerts, and CSV export. It runs live at https://openai-dashboard.zeeshanai.cloud (Coolify on the Hostinger VPS).

@AGENTS.md

## Commands

```bash
npm run dev      # dev server (http://localhost:3000)
npm run build    # production build (standalone output)
npm run lint     # eslint
npx tsc --noEmit # type check
```

No test suite exists. Verify changes by running `tsc` and `lint`, then exercise the app in a browser.

## Stack

- **Next.js 16.4** (App Router, Turbopack), React 19, TypeScript, Tailwind v4.
- **shadcn/ui on Base UI** (`style: base-nova`). Custom triggers use the `render` prop, **not** `asChild`.
  `cn` is imported from the `cn` package (re-exported by `lib/utils.ts`).
- **Recharts 3** through shadcn's `ChartContainer`.
- **better-sqlite3** for local persistence and **next-themes** for dark mode.

## Next.js 16 specifics (read before changing routing or auth)

- Middleware is now **`proxy.ts`** at the root. It runs on the Node runtime.
- `cacheComponents` / `partialPrefetching` are **deliberately disabled** in `next.config.ts`. All data is fetched
  client-side from `/api/*`, so caching via Cache Components isn't needed. Don't re-enable them without reading
  `node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md`.
- `searchParams` / `params` in pages are async (`await searchParams`).
- Bundled docs live in `node_modules/next/dist/docs/`. Check them before using unfamiliar APIs.

## Architecture

```
browser ──► proxy.ts (session check) ──► app/api/dashboard ──► lib/openai-admin.ts ──► api.openai.com
                                          app/api/credits|budgets ──► lib/db.ts (SQLite)
```

- **`app/page.tsx`** loads `components/dashboard.tsx` with `next/dynamic` and `{ ssr: false }`, because the
  dashboard reads `localStorage` and dates during initial state. Keep it client-only to avoid dead-UI hydration
  mismatches.
- **`app/api/dashboard/route.ts`** is the single data endpoint (`?start=YYYY-MM-DD&end=YYYY-MM-DD[&refresh=1]`).
  It returns projects, API keys, cost rows, usage rows, month-to-date figures, balance, grants and budgets in one
  payload (`DashboardData` in `lib/types.ts`).
- **`lib/derive.ts`** does all aggregation **in the browser** as pure functions: totals, stacked daily series,
  project, model and key rows, budget state. Filtering by project never refetches.
- **`lib/openai-admin.ts`** (`server-only`) is the only module that touches `OPENAI_ADMIN_KEY`. It follows
  pagination, keeps an in-memory **5-minute cache** per URL (`refresh=1` bypasses it), and retries on 429.
- **`lib/line-item.ts`** parses cost line items such as `"flex | gpt-6-luna, cache writes - 12hr"` into
  `{ model, kind, tier }`.
- **`lib/db.ts`** stores SQLite at `$DATA_DIR/dashboard.db`: `credit_grants`, `budgets` (scope = `"total"` or a
  project id), and the per-day API caches `cost_days` / `usage_days`.
- **`lib/history.ts`** serves cost and usage rows from `cost_days` / `usage_days`, fetching only missing days.
  Days older than 2 UTC days are stored as `final` and never refetched; today and yesterday are refetched each
  time (through the 5-minute memory cache). Balance and month-to-date are summed from these same cost rows.
  Costs before OpenAI's `api_key_id` grouping cutoff (~2025-12-06) come back with `apiKeyId = null`.
- **`lib/auth.ts`** signs the session cookie with HMAC-SHA256 via Web Crypto (cookie `oad_session`, 30 days).
  `app/api/login` accepts a **plain HTML form post** (it works without JS) and is rate-limited per IP.

## OpenAI Admin API facts (verified against the live API)

- **Balance can't be fetched.** `/v1/dashboard/billing/credit_grants` and `/subscription` return 403 for API
  keys because they need a browser session. Remaining balance is therefore
  `sum(active top-ups) − Costs API spend since the earliest active top-up`, with top-ups entered by the user.
- `/organization/costs`: `bucket_width=1d` only, `limit` ≤ 180. It supports repeated
  `group_by=project_id|api_key_id|line_item`. Amounts are USD and can be strings, so always wrap them in `Number()`.
- `/organization/usage/{completions,embeddings,moderations,images,audio_speeches,audio_transcriptions}`:
  `limit` ≤ 31 for `1d`, paginated via `next_page`, and group by `project_id`, `model` and `api_key_id`.
- `/usage/vector_stores` and `/usage/code_interpreter_sessions` accept **only** `group_by=project_id`.
  `model` returns a 400.
- Vector-store usage is a daily storage snapshot. Report the latest day's value, never a sum.
- Paginated list endpoints (`/projects`, `/projects/{id}/api_keys`) use the `after` cursor (`last_id`); time-bucketed
  endpoints use `page` (`next_page`).
- All buckets are **UTC days**. Date ranges (`lib/ranges.ts`) are computed in UTC to match.

## Conventions

- **Never** import `lib/openai-admin.ts` or `lib/db.ts` from client components. Both are `server-only`.
- **Redirects in route handlers must use relative `Location` headers**
  (`new NextResponse(null, { status: 303, headers: { Location: "/" } })`). Behind Coolify's Traefik proxy,
  `request.url` is `0.0.0.0:3000`, so `NextResponse.redirect(new URL(path, request.url))` breaks in production.
- Public paths (no session needed) are `/login`, `/api/login` and `/api/logout`, set in `PUBLIC_PATHS` in `proxy.ts`.
  Unauthenticated `/api/*` gets a JSON 401; pages redirect to `/login`.
- Money is formatted with `formatUsd` (`lib/format.ts`), which shows 4 decimals under $1. Columns use
  `tabular-nums`, not a mono font.
- Chart and status colors are CSS tokens in `app/globals.css` (`--series-1..7`, `--series-other`,
  `--status-good|warning|critical`), with separate validated light and dark values. Use the Tailwind classes
  (`bg-series-1`, `bg-status-critical`), never raw hex.
- Colors follow the entity, not its rank. `buildColorMap` assigns the top 7 projects or models by cost in the
  **unfiltered** range; the rest fold into "Other". Filtering must not repaint series.
- Status (budget) indicators always pair color with an **icon and a label** (`components/budget-meter.tsx`).
- shadcn rules: `gap-*` not `space-y-*`, `size-*` for square sizes, `data-icon` on icons inside buttons, and
  `FieldGroup`/`Field` for forms.
- React lint forbids synchronous `setState` in effects. `dashboard.tsx` derives `loading` from a request key
  instead, and `SettingsSheet` remounts `BudgetsSection` via `key` to reset its draft.

## Environment

| Variable | Notes |
|---|---|
| `OPENAI_ADMIN_KEY` | Organization Admin key. Server-only. |
| `DASHBOARD_PASSWORD` | Login password. |
| `SESSION_SECRET` | 32+ random bytes for cookie signing. |
| `DATA_DIR` | `./data` locally (git-ignored), `/data` in Docker (persistent volume). |
| `COOLIFY_API_TOKEN_ROOT` / `_DEPLOY` | Local only, for Coolify API calls. Never deploy these. |

`.env*` and `/data` are git-ignored. The GitHub repo is **public**, so never commit secrets.

## Deployment

- **Coolify** on the Hostinger VPS `76.13.7.106`: project `just2yfywsqi5vkazq8jcd3v`, app `jknwiqullcagyqyneigzwwgt`,
  build pack `dockerfile`, port 3000, persistent volume mounted at `/data`.
- **Auto-deploy:** `.github/workflows/deploy.yml` calls `POST /api/v1/deploy` with retries on every push to `main`.
  It needs repo secrets `COOLIFY_API_TOKEN` (deploy token) and `COOLIFY_APP_UUID`. Coolify's own auto-deploy
  webhook is off on purpose.
- **Manual deploy:** call the Coolify API over SSH against `http://localhost:8000/api/v1`, with the token passed
  on stdin:
  `ssh -i ~/.ssh/hostinger_vps_ed25519 -o IdentitiesOnly=yes root@76.13.7.106`.
- Coolify 4.5.3 env flags are `is_buildtime` / `is_runtime`. `is_build_time` is silently ignored. Keep all four
  app vars **runtime-only**.
- The `Dockerfile` copies `.next/standalone`, `.next/static` and `public`, then runs as the `node` user.
  `next.config.ts` excludes `./data/**` from output tracing so a local DB never ships in the image.

## Gotchas

- Recharts animates bars. Full-page screenshots taken right after load can show an empty chart, so bar animation is
  disabled (`isAnimationActive={false}`).
- Only the top segment of each day's stack gets rounded corners (`isTopSegment` in `spend-chart.tsx`).
- `npm run dev` re-adds the Next agent block to `AGENTS.md`. Commit it rather than fighting it.
