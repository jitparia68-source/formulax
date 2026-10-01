# Deployment

## Platform

- **Hosting:** Vercel
- **Database:** Supabase Postgres, provisioned through the Vercel marketplace
- **Framework preset:** Next.js (auto-detected)

## 1. Environment variables

Set these in the Vercel project settings. The marketplace integration injects the
Supabase values automatically; the rest are manual.

| Variable                      | Source                       | Required |
| ----------------------------- | ---------------------------- | -------- |
| `SUPABASE_URL`                | Supabase project settings    | yes      |
| `SUPABASE_SERVICE_ROLE_KEY`   | Supabase project settings    | yes      |
| `SUPABASE_SECRET_KEY`         | fallback if service key unset | no       |
| `AUTH_SECRET`                 | `openssl rand -base64 32`    | yes      |
| `AUTH_TRUST_HOST`             | `true`                       | yes      |
| `AUTH_URL`                    | deployment URL               | no       |

`AUTH_SECRET` has no default. Without it NextAuth throws `MissingSecretError` in
production, and every sign-in fails. `AUTH_TRUST_HOST=true` is required so the host is
derived from the request rather than a hardcoded `NEXTAUTH_URL`.

Never commit `.env`. It is covered by `.env*` in `.gitignore`.

## 2. Database

Run `db/schema.sql` once against the target database. It is idempotent, so a re-run is
safe:

```bash
# local helper: source the credentials from .env first
psql -v ON_ERROR_STOP=1 -f db/schema.sql
```

The script creates the four tables, enables RLS with no policies (deny-all), revokes
`anon`/`authenticated` grants, and seeds the 15 baseline formulas, 5 of which carry
`solver_meta` used by the interactive solver and the quiz.

## 3. Deploy

Push to the default branch and let Vercel's Git integration build, or:

```bash
pnpm install --frozen-lockfile
pnpm build
```

Vercel runs `pnpm build`, which is `next build`. Turbopack is the default bundler in
Next 16 and `next.config.ts` pins `turbopack.root` to the project so a stray
`pnpm-workspace.yaml` in a parent directory cannot widen the module root.

## 4. Post-deploy checks

1. `/login` renders and `/dashboard` redirects to it when signed out.
2. Register a throwaway account, confirm it can sign in.
3. Star a formula in `/formulas`; confirm it survives a reload and appears in
   `/cheatsheet`.
4. Run a least-squares fit in `/labcoach` and save it; confirm the R-squared value
   round-trips and the run appears in the notebook history.
5. Export the cheat sheet as a PDF.
6. Confirm `proxy.ts` is active: visiting `/labcoach` while signed out redirects to
   `/login` with a `callbackUrl`.

## 5. Rollback

Every push to the default branch produces a Vercel deployment. Promote a previous one
from the Vercel dashboard's Deployments tab. Database migrations are additive and
idempotent, so rolling the app back does not require a schema change.
