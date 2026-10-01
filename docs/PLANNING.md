# Project Planning & Architectural Design

## 1. Problem Statement & Scope

Engineering students lose time hunting through bulky textbooks and switching between
fragmented tools while solving problems or analysing lab data. FormulaX consolidates the
reference material, the calculators and the lab notebook into one account-backed
workspace, so a formula starred on a laptop is still there on a phone.

## 2. Technical Architecture

| Layer                | Choice                             | Rationale                                                                                 |
| -------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------- |
| Framework            | Next.js 16 (App Router, RSC)       | Server components keep the service-role client and the Clerk secret out of the browser bundle. |
| Auth                 | Clerk, `@clerk/nextjs`             | Identity, sessions and password hashing are Clerk's problem, not ours; there is no credential table to secure or migrate. |
| DB client            | `@supabase/supabase-js`, service role | Single privileged path to the database. RLS is deny-all, so every query is explicit.   |
| Package manager      | npm                                | One lockfile, `package-lock.json`; no workspace layer to reason about for a single-package repo. |
| Math typesetting     | KaTeX, client component            | Fast synchronous rendering; loaded only where equations are actually displayed.           |
| Evaluation           | mathjs (`mathjs/number`)           | Evaluates the seeded solver expressions and compiles the plotter's input.                |
| Plotting             | function-plot                      | Pan/zoom Cartesian graph. Loaded client-side only, since it touches the DOM at import.   |
| PDF export           | jsPDF, dynamic import               | Loaded on demand so it stays out of the initial bundle.                                  |
| OCR                  | Tesseract.js, dynamic import       | Browser Web Worker; the bundle loads only when a scan is requested.                      |

### Server/client boundary

The service-role Supabase client is marked `server-only`, so a mistaken client import
fails the build rather than shipping the key. `lib/supabase.ts` defers client construction
to first use rather than throwing at module scope, so a missing credential surfaces on the
first real request with an actionable message instead of failing `next build` when the
build happens to collect page data. Navigation metadata lives in `lib/nav-sections.ts`,
which is deliberately free of any server-only import, and session reads live in
`lib/session.ts`; both keep Clerk and Supabase out of the sidebar's client bundle.

### Auth model

`proxy.ts` (the file Next 16 uses in place of the old middleware file) wraps
`clerkMiddleware` and gates the nine workspace routes with `createRouteMatcher`. For a
matched route it calls `auth.protect({ unauthenticatedUrl: "/login" })`. The explicit
`unauthenticatedUrl` is
load-bearing: `auth.protect()` otherwise falls through to `redirectToSignIn()`, which sends
the visitor to Clerk's hosted UI rather than the app's own page. `unauthorizedUrl` covers a
different case, a signed-in user failing an authorisation check, and is not used here.

Server actions do not trust the proxy. Each one calls `requireUserId()`, which reads
`auth()` and returns Clerk's `userId`, and returns an error string when it is null, then
scopes its query by that id.

### Custom sign-in UI on Clerk's headless hooks

Clerk ships prebuilt components (`<SignIn/>`, `<SignUp/>`, `<UserButton/>`). They render
Clerk's own UI and carry a Clerk watermark, which would sit inside an app with its own
design system. Instead the app uses the headless hooks:

- `useSignIn()` in `components/login-form.tsx` drives `signIn.password()` and
  `signIn.finalize()`, and handles the `needs_second_factor` status explicitly rather than
  silently treating it as a failure.
- `useSignUp()` in `components/register-form.tsx` drives `signUp.password()`,
  `signUp.verifications.sendEmailCode()`, `verifications.verifyEmailCode()` and
  `signUp.finalize()`. An unverified email surfaces as `missing_requirements`, and the
  code entry is shown only in that case. A `#clerk-captcha` placeholder div is rendered so
  Clerk's bot-protection widget has somewhere to mount.
- `useClerk().signOut()` in `components/app-shell.tsx` replaces `<UserButton/>`, so the
  sign-out button is the app's own.

**On the `__internal_` prefix.** In the installed Clerk version (7.9.9), `useSignIn` and
`useSignUp` return the Signal-based *future* resources (`SignInFutureResource` /
`SignUpFutureResource`) directly, not the legacy resources. The legacy `SignInResource`
still carries the future API behind a property literally named `__internal_future`
(`@internal` in Clerk's own type declarations), which is where the double-underscore name
originates. The current code does not go through that property; it calls `password()` and
`finalize()` on the object the hook returns, because the hook already returns the future
resource. If a future Clerk release ever hands the legacy resource back, the call sites in
`components/login-form.tsx` and `components/register-form.tsx` are the only two places
that would need to change.

`ClerkProvider` in `app/layout.tsx` sets `signInUrl`, `signUpUrl` and `afterSignOutUrl` to
the app's own routes, and hides Clerk's root box via `appearance`.

## 3. Data model decisions

- **No `users` table; Clerk owns identity.** The previous self-managed identity table was
  dropped, not renamed. A local mirror would be a second source of truth that can drift from
  Clerk, and the table held password hashes on a database that PostgREST exposes publicly.
- **`user_id` is `TEXT`, not `UUID`.** Clerk user ids are opaque strings such as
  `user_2abcDEF`. The id is stored verbatim and is never parsed, cast or ordered on
  meaning; it is only ever an equality key, which is what `TEXT` gives without a lossy
  conversion layer. Every reference to a UUID `users(id)` foreign key is gone.
- **`formulas.slug` + a real foreign key.** The original spec paired `formulas.id UUID`
  with `saved_bookmarks.formula_id TEXT`, which cannot form a foreign key and leaves
  bookmarks dangling. `slug` is the client-referenceable key and `formula_id` references
  it with `ON DELETE CASCADE`. `formulas.id` stays a UUID surrogate for internal joins, and
  the `formulas_set_slug` trigger derives a slug for custom formulas so a client can always
  read back the slug it must bookmark with.
- **`solver_meta JSONB`.** The spec had nowhere to put solver variable definitions. JSON
  cannot carry the JS closures the prototype used, so each `solve` entry is a mathjs
  expression string over the remaining variables.
- **RLS enabled with no policies**, and grants revoked from `anon`/`authenticated`.
  Without this, PostgREST would serve any table reachable by the anon key to anyone
  holding it. Only the service-role client, which bypasses RLS, reaches the database.

`db/schema.sql` also carries the migration order, which is load-bearing: Postgres cannot
retype a column while a foreign key depends on it, so the legacy FKs to `public.users(id)`
must be dropped before the `uuid` -> `text` change, and the table is dropped after. Each
step is written to be a no-op when its target is already gone, so the file is safe on a
fresh database and on one still carrying the old schema.

## 4. Development timeline

| Phase                  | Deliverables                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------- |
| Setup and schema       | Project scaffold, Postgres schema, RLS, 15 seeded formulas, 5 with solver metadata.                       |
| Auth and data layer    | Clerk integration, service-role client, route protection, validated server actions.                      |
| Workspace UI           | Design tokens, app shell with responsive drawer, nine protected routes plus `/login` and `/register`, every prototype feature ported. |
| Correctness            | Two prototype defects found and fixed; regression, determinant, polynomial and evaluation modules rewritten. |
| Documentation and ship  | Schema reference, deployment notes, production build, history rewrite to a single contributor.            |