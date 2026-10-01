# Deployment

## Platform

- **Hosting:** Vercel
- **Database:** Supabase Postgres, provisioned through the Vercel marketplace
- **Framework preset:** Next.js (auto-detected)

## 1. Clerk prerequisites

Clerk is the identity provider, so an application must exist before the app can run.
`ClerkProvider` and `clerkMiddleware` read the keys from the environment with no local
fallback, so a missing `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` or `CLERK_SECRET_KEY` fails at
the point those modules are loaded rather than degrading to a working anonymous mode.

1. Create a Clerk application in the Clerk dashboard.
2. Copy its publishable key (`pk_...`) and secret key (`sk_...`).
3. Set the six `CLERK_*` / `NEXT_PUBLIC_CLERK_*` variables from the table below.
4. Add the deployment domain to the Clerk instance's **Allowed Origins**, otherwise Clerk
   refuses the requests from that host.
5. In **User & Authentication**, confirm the **Email address** strategy and the **Password**
   strategy are enabled. The custom sign-in and sign-up forms submit
   `signIn.password()` and `signUp.password()`, so both must be on for those pages to work.

**Development instance warning.** The keys currently in `.env` are `pk_test_` and
`sk_test_`, which belong to a Clerk *development* instance. Development instances are
rate-limited and not intended for production traffic. Before launch, create a production
Clerk instance, swap in its `pk_live_` / `sk_live_` keys, and set the production domain in
its Allowed Origins. Verify which instance the keys belong to by prefix before deploying.

## 2. Environment variables

Set these in the Vercel project settings. The marketplace integration injects the
Supabase values automatically; the Clerk values are manual.

| Variable                                        | Source                    | Required |
| ----------------------------------------------- | ------------------------- | -------- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`             | Clerk dashboard, API keys | yes      |
| `CLERK_SECRET_KEY`                              | Clerk dashboard, API keys | yes      |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL`                 | `/login`                  | yes      |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL`                 | `/register`               | yes      |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | `/dashboard`            | yes      |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | `/dashboard`            | yes      |
| `SUPABASE_URL`                                  | Supabase project settings | yes      |
| `SUPABASE_SERVICE_ROLE_KEY`                     | Supabase project settings | yes      |
| `SUPABASE_SECRET_KEY`                           | fallback if service key unset | no    |

`CLERK_SECRET_KEY` is read server-side only and must stay out of any `NEXT_PUBLIC_`
variable. `lib/supabase.ts` falls back to `SUPABASE_SECRET_KEY` when
`SUPABASE_SERVICE_ROLE_KEY` is absent, and throws with an actionable message if neither is
set; that throw is deferred to the first real request rather than module scope, so a missing
variable does not fail the build outright.

Never commit `.env`. It is covered by `.env*` in `.gitignore`.

## 3. Database

Run `db/schema.sql` once against the target database. It is idempotent, so a re-run is
safe:

```bash
# source the credentials from .env first
psql -v ON_ERROR_STOP=1 -f db/schema.sql
```

The script creates three tables (`formulas`, `saved_bookmarks`, `lab_runs`), enables RLS
with no policies (deny-all), revokes `anon`/`authenticated` grants, and seeds the 15
baseline formulas, 5 of which carry `solver_meta` used by the interactive solver and the
quiz. It is also the Clerk migration path: it drops any legacy foreign keys to
`public.users`, retypes the three `user_id` columns from `uuid` to `text`, and drops the
`users` table. The ordering is required, since Postgres cannot retype a column while a
foreign key depends on it.

If the database already carries the previous session-library schema, running the file once in
the order it is written migrates it in place. Apply with `ON_ERROR_STOP=1` so a mid-file
failure stops rather than leaving a partially migrated database.

## 4. Build and deploy

Push to the default branch and let Vercel's Git integration build, or reproduce the build
locally:

```bash
npm ci          # or: npm install
npm run build
```

Vercel detects npm from `package-lock.json` and runs `npm run build`, which is `next build`.
`next.config.ts` currently sets no options. To check a production build before pushing:

```bash
npm run typecheck   # next typegen && tsc --noEmit
npm run lint
```

`next typegen` is required before `tsc --noEmit` in a fresh clone, because `PageProps` and
`LayoutProps` are generated from the route table into `.next/types`.

## 5. Post-deploy checks

1. `/login` renders and `/dashboard` redirects to it while signed out.
2. Register a throwaway account on the app's own `/register` form, then sign in on `/login`.
   Both pages must be the app's own UI, not Clerk's hosted pages.
3. Star a formula in `/formulas`; confirm it survives a reload and appears in
   `/cheatsheet`.
4. Run a least-squares fit in `/labcoach` and save it; confirm the `R^2` value round-trips
   and the run appears in the notebook history. A vertical dataset should report the fit as
   unusable rather than saving a placeholder `r_squared`.
5. Export the cheat sheet as a PDF.
6. Confirm `proxy.ts` is active: visiting `/labcoach` while signed out lands on `/login`,
   not on a Clerk-hosted page, and the original destination is preserved so the user returns
   to `/labcoach` after signing in.
7. Confirm the Clerk instance in use is a production instance by checking that the keys
   configured in Vercel carry `pk_live_` / `sk_live_` prefixes.

## 6. Rollback

Every push to the default branch produces a Vercel deployment. Promote a previous one from
the Vercel dashboard's Deployments tab.

Database migrations are additive and idempotent, so rolling the app back does not require a
schema change. The one non-additive step is the Clerk identity migration (retyping
`user_id` to `text` and dropping `users`), which removes the previous identity columns and
table; it is not reversible by re-running this file. The rollback target for a bad build is
the previous Vercel deployment, not the previous schema.