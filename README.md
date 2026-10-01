# FormulaX

Engineering mathematical reference and interactive solver, backed by a Supabase Postgres
account system. Formula vault, multi-variable solver, 2D plotter, matrix calculator,
polynomial differentiation, a lab regression coach, an exportable cheat sheet and a
formula recall quiz.

## Stack

Next.js 16 (App Router, React Server Components) - Auth.js v5 with the credentials
provider and a JWT session - Supabase Postgres via the service-role SDK - bcryptjs -
KaTeX - mathjs - function-plot - jsPDF - Tesseract.js. Tailwind CSS v4, TypeScript
strict, pnpm.

## Getting started

```bash
pnpm install
cp .env.example .env    # then fill it in, see docs/DEPLOYMENT.md
pnpm dev
```

## Database

`db/schema.sql` is idempotent and creates everything the app needs:

```bash
psql -v ON_ERROR_STOP=1 -f db/schema.sql
```

It creates `users`, `formulas`, `saved_bookmarks` and `lab_runs`, enables RLS with no
policies (deny-all for `anon` and `authenticated`, with their grants revoked), and seeds
15 baseline formulas, 5 of which carry the `solver_meta` the interactive solver reads.

## Environment variables

| Variable                    | Required | Notes                                                   |
| --------------------------- | -------- | ------------------------------------------------------- |
| `SUPABASE_URL`              | yes      | Provisioned via the Vercel Supabase marketplace.        |
| `SUPABASE_SERVICE_ROLE_KEY` | yes      | `SUPABASE_SECRET_KEY` is used if this is unset.         |
| `AUTH_SECRET`               | yes      | No default. Generate with `openssl rand -base64 32`.    |
| `AUTH_TRUST_HOST`           | yes      | `true`, so the host is not read from a hardcoded URL.   |
| `AUTH_URL`                  | no       | Only needed if `AUTH_TRUST_HOST` is not set.            |

`.env` is gitignored. See `docs/DEPLOYMENT.md` for the full deployment runbook.

## Scripts

```bash
pnpm dev     # development server
pnpm build   # production build
pnpm start   # serve the production build
pnpm lint    # eslint
```

## Layout

```
app/          routes and server actions
  actions.ts  validated server actions (register, formulas, bookmarks, lab runs)
components/   client components, one per feature area
db/schema.sql idempotent Postgres migration and seed data
docs/         planning, deployment runbook, Q&A, status
lib/          pure maths modules, Supabase client, session helpers
proxy.ts      route protection (Next 16's replacement for middleware.ts)
types/        row types and Auth.js session augmentation
auth.ts       Auth.js configuration
```

The maths modules in `lib/regression.ts`, `lib/determinant.ts`, `lib/polynomial.ts` and
`lib/evaluate.ts` are pure and dependency-free by design, which is what makes them
straightforward to verify against hand-computed values.

## Security notes

- The service-role Supabase client is marked `server-only`, so importing it from a client
  component fails the build rather than leaking the key.
- Every server action re-checks the session and scopes its query by the session user id;
  protection does not rely on `proxy.ts` alone.
- Database error messages are mapped to safe user-facing text and logged server-side, so
  PostgREST internals are not exposed to clients.
- Custom formula deletes are scoped by `user_id` and `is_custom`, so a seeded formula
  cannot be deleted through the custom-formula path.
- `callbackUrl` is accepted only as a same-origin relative path.
