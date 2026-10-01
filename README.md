# FormulaX

Engineering mathematical reference and interactive solver, backed by a Supabase Postgres
database with Clerk owning identity. Formula vault, multi-variable solver, 2D plotter,
matrix calculator, polynomial differentiation, a lab regression coach, an exportable cheat
sheet and a formula recall quiz.

## Stack

Next.js 16 (App Router, React Server Components) - `@clerk/nextjs` for authentication -
Supabase Postgres via the service-role SDK - KaTeX - mathjs - function-plot - jsPDF -
Tesseract.js - lucide-react. Tailwind CSS v4, TypeScript strict, npm.

## Getting started

```bash
npm install
cp .env.example .env    # then fill it in, see docs/DEPLOYMENT.md
npm run dev
```

## Database

`db/schema.sql` is idempotent and creates everything the app needs:

```bash
psql -v ON_ERROR_STOP=1 -f db/schema.sql
```

It creates three tables, `formulas`, `saved_bookmarks` and `lab_runs`, enables RLS with no
policies (deny-all for `anon` and `authenticated`, with their grants revoked), and seeds 15
baseline formulas, 5 of which carry the `solver_meta` the interactive solver reads.

There is no `users` table. Clerk owns identity, so a local mirror would be a second source
of truth that can drift, and the table it replaced held password hashes on a database
PostgREST exposes publicly. `user_id` is `TEXT` on all three tables, because a Clerk user id
is an opaque string such as `user_2abcDEF` rather than a UUID.

## Environment variables

| Variable                                      | Required | Notes                                                     |
| --------------------------------------------- | -------- | --------------------------------------------------------- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`           | yes      | Clerk publishable key, `pk_...`.                           |
| `CLERK_SECRET_KEY`                            | yes      | Clerk secret key, `sk_...`. Server-only.                   |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL`               | yes      | `/login`, the app's own sign-in route.                     |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL`               | yes      | `/register`, the app's own sign-up route.                  |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | yes   | Where Clerk lands after a successful sign-in.              |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | yes   | Where Clerk lands after a successful sign-up.              |
| `SUPABASE_URL`                                | yes      | Provisioned via the Vercel Supabase marketplace.          |
| `SUPABASE_SERVICE_ROLE_KEY`                   | yes      | `SUPABASE_SECRET_KEY` is used if this is unset.           |

`.env` is gitignored (`.env*` in `.gitignore`). See `docs/DEPLOYMENT.md` for the full
deployment runbook.

## Scripts

```bash
npm run dev        # development server
npm run build      # production build
npm run start      # serve the production build
npm run lint       # eslint
npm run typecheck  # generate route types, then tsc --noEmit
```

`npm run typecheck` runs `next typegen` first because the `PageProps` and `LayoutProps`
globals are generated from the route table into `.next/types`, which does not exist in a
fresh clone.

## Layout

```
app/          routes and server actions
  actions.ts  server actions and the getUserData read, each scoped by Clerk userId
  globals.css design tokens and the fx-* component classes
  layout.tsx  root layout, ClerkProvider, toast provider
components/   client components, one per feature area
db/schema.sql idempotent Postgres migration and seed data
docs/         planning, deployment runbook, Q&A, status
lib/          pure maths modules, Supabase client, session and nav helpers
proxy.ts      route protection (Next 16 renamed the middleware file to proxy)
types/        row types and the formula-category type guard
```

`proxy.ts` wraps `clerkMiddleware` and calls `auth.protect({ unauthenticatedUrl: "/login" })`
for the nine workspace routes. The explicit `unauthenticatedUrl` is what keeps the redirect
on the app's own `/login` page instead of Clerk's hosted UI.

The maths modules in `lib/regression.ts`, `lib/determinant.ts`, `lib/polynomial.ts` and
`lib/evaluate.ts` are pure and dependency-free by design, which is what makes them
straightforward to verify against hand-computed values.

## Design system

Colours are declared once in `app/globals.css` under Tailwind v4's `@theme`, which is why
there is no tailwind.config file: the tokens become utilities (`bg-surface-2`, `text-ink`)
and CSS variables at the same time. The reusable component classes are `fx-*`
(`fx-card`, `fx-input`, `fx-btn-primary`, `fx-result`, `fx-math`, `fx-plot`, `fx-nav`).

| Group     | Tokens                                                                                        |
| --------- | --------------------------------------------------------------------------------------------- |
| Elevation | `chrome` app frame, `surface-0` page canvas, `surface-1` recessed, `surface-2` card, `surface-3` raised, `surface-4` top of stack |
| Lines     | `line`, `line-soft`, `line-strong`, `hairline`                                                 |
| Ink       | `ink`, `ink-muted`, `ink-faint`                                                                |
| Accent    | `accent` fill and focus ring, `accent-bright` readable accent text, `accent-deep` label on an accent fill, plus `accent-hover`, `accent-soft`, `accent-ring` |
| Secondary | `secondary`, `tertiary`                                                                        |
| Status    | `success`, `warning`, `danger`, `danger-bright`                                                |
| Plot      | `plot`, `plot-ink`, `plot-line`, `plot-grid`, `plot-point`                                    |

The accent family has three deliberately non-overlapping roles, so a primary button and an
important number never share a colour: `accent` paints fills, focus rings and borders;
`accent-bright` is the readable text weight of the same hue; `accent-deep` is the label
colour used on top of an accent fill.

Depth comes from a 4-7% inset top highlight plus a wide, very low-opacity drop shadow
(`shadow-panel`, `shadow-raised`, `shadow-float`). The 1px border is demoted to edge
definition rather than acting as the primary separator.

Measured contrast ratios: every ink token clears 4.5:1 on every surface, the tightest being
`ink-faint` on `surface-4` at 4.59:1; `accent-deep` on `accent` is 6.33:1; the focus ring
(`accent` against `chrome`) is 6.54:1.

The `plot-*` tokens are light on purpose. function-plot paints its axes, ticks and labels
with `currentColor` and its origin rules in black, so a dark canvas would hide them;
tinting a light surface ties the chart to the app instead of reading as a foreign white box.

## Security notes

- The service-role Supabase client is marked `server-only`, so importing it from a client
  component fails the build rather than leaking the key.
- Every server action re-reads the Clerk session through `auth()` and scopes its query by
  that `userId`; protection does not rely on `proxy.ts` alone.
- Database error messages are mapped to safe user-facing text and logged server-side, so
  PostgREST internals are not exposed to clients.
- Custom formula deletes are scoped by `user_id` and `is_custom`, so a seeded formula
  cannot be deleted through the custom-formula path.
- The post-authentication redirect is accepted only as a same-origin relative path: it must
  start with a single `/` and not `//`.
- Sign-in and sign-up are custom UI built on Clerk's headless `useSignIn` / `useSignUp`
  hooks, so Clerk's prebuilt watermarked components are never rendered. `ClerkProvider`
  also sets `appearance.elements.rootBox` to `hidden` as a second line of defence.