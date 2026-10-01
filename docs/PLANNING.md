# Project Planning & Architectural Design

## 1. Problem Statement & Scope

Engineering students lose time hunting through bulky textbooks and switching between
fragmented tools while solving problems or analysing lab data. FormulaX consolidates the
reference material, the calculators and the lab notebook into one account-backed
workspace, so a formula starred on a laptop is still there on a phone.

## 2. Technical Architecture

| Layer                | Choice                             | Rationale                                                                                 |
| -------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------- |
| Framework            | Next.js 16 (App Router, RSC)       | Server components keep credentials and the service-role client out of the browser bundle. |
| Auth                 | Auth.js v5, JWT strategy           | Stateless encrypted session cookie; no server-side session table to operate.              |
| Database             | Supabase Postgres                  | Relational data with JSONB and RLS; provisioned through the Vercel marketplace.            |
| DB client            | `@supabase/supabase-js`, service role | Single privileged path to the database. RLS is deny-all, so every query is explicit.    |
| Passwords            | bcryptjs, 10 rounds                | Cost is tuned per login; hashes are never recoverable.                                    |
| Math typesetting     | KaTeX, client component            | Fast synchronous rendering; loaded only where equations are actually displayed.           |
| Evaluation           | mathjs (`mathjs/number`)           | Evaluates the seeded solver expressions and compiles the plotter's input.                |
| Plotting             | function-plot                      | Pan/zoom Cartesian graph. Loaded client-side only, since it touches the DOM at import.   |
| PDF export           | jsPDF, dynamic import               | Loaded on demand so it stays out of the initial bundle.                                  |
| OCR                  | Tesseract.js, dynamic import       | Browser Web Worker; the bundle loads only when a scan is requested.                      |

### Server/client boundary

The service-role Supabase client is marked `server-only`, so a mistaken client import
fails the build rather than shipping the key. Navigation metadata lives in
`lib/nav-sections.ts` and session reads in `lib/session.ts`, which keeps the auth
dependency out of the sidebar's client bundle.

### Auth model

`proxy.ts` (Next 16's replacement for `middleware.ts`) gates the nine workspace routes
and redirects anonymous visitors to `/login?callbackUrl=...`. The callback is validated
to be a same-origin relative path, so a crafted link cannot bounce a freshly
authenticated user off-site.

## 3. Data model decisions

- **`formulas.slug` + a real foreign key.** The original spec paired `formulas.id UUID`
  with `saved_bookmarks.formula_id TEXT`, which cannot form a foreign key and leaves
  bookmarks dangling. `slug` is the client-referenceable key and `formula_id` references
  it with `ON DELETE CASCADE`.
- **`solver_meta JSONB`.** The spec had nowhere to put solver variable definitions. JSON
  cannot carry the JS closures the prototype used, so each `solve` entry is a mathjs
  expression string over the remaining variables.
- **RLS enabled with no policies**, and grants revoked from `anon`/`authenticated`.
  Without this, PostgREST would expose `users.password_hash` to the public anon key.
  Only the service-role client, which bypasses RLS, reaches the database.

## 4. Development timeline

| Phase                  | Deliverables                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------- |
| Setup and schema       | Project scaffold, Postgres schema, RLS, 15 seeded formulas, 5 with solver metadata.                       |
| Auth and data layer    | Service-role client, Auth.js credentials flow, route protection, validated server actions.               |
| Workspace UI           | Design tokens, app shell with responsive drawer, 11 routes, every prototype feature ported.             |
| Correctness            | Regression, determinant, polynomial and evaluation modules verified against hand-computed values.         |
| Documentation and ship  | Schema reference, deployment notes, production build, history rewrite to a single contributor.            |
