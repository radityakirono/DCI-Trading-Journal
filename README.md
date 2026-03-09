# DCI (Dhoho Capital Investment)

Personal stock trading journal for IDX equities, built with Next.js, Tailwind, shadcn/ui, and Supabase.

## Run Locally

1. Copy environment variables:

```bash
cp .env.example .env.local
```

2. Fill in:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

3. Install and run:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Security Baseline (Implemented)

- Authenticated API routes for:
  - `POST/GET /api/transactions`
  - `POST/GET /api/cash-journal`
  - `GET /api/signal-notifications`
- Server-side payload validation with `zod`.
- Server-side broker fee calculation (buy 0.15%, sell 0.25%).
- HTTP security headers + CSP in `next.config.ts`.
- CI security workflows:
  - GitHub CodeQL
  - Dependency Review
  - `npm audit` (high+)
  - Optional Snyk scan if `SNYK_TOKEN` is configured.

## Supabase RLS Setup

Run this SQL script in Supabase SQL Editor:

- [`supabase/sql/001_security_baseline.sql`](supabase/sql/001_security_baseline.sql)

What it configures:

- `user_id` ownership columns on `transactions`, `cash_journal`, `signal_notifications`
- strict row-level security policies (users only access their own rows)
- indexes for user/date access patterns
- `audit_logs` table
- triggers to auto-log `INSERT/UPDATE/DELETE` on `transactions` and `cash_journal`

## Important Notes

- Do not expose service-role keys in browser code.
- Keep `SUPABASE_SERVICE_ROLE_KEY` server-only (if used for backend jobs).
- The frontend supports local fallback mode when unauthenticated, but secure persistence and sync require authenticated Supabase sessions.

## Build

```bash
npm run lint
npm run build
```
