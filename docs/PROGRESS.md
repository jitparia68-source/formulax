# Implementation Status

## Features

- [x] **Account registration and sign-in.** Clerk, with custom sign-in and sign-up UI on the
      headless `useSignIn` / `useSignUp` hooks, so Clerk's prebuilt watermarked components
      are never rendered. Sign-up shows an email-code step only when Clerk reports
      `missing_requirements`.
- [x] **Sign out.** `useClerk().signOut({ redirectUrl: "/login" })` from the app shell,
      replacing `<UserButton/>`.
- [x] **Route protection.** `proxy.ts` wraps `clerkMiddleware` and gates the nine workspace
      routes with `auth.protect({ unauthenticatedUrl: "/login" })`, which keeps the redirect
      on the app's own login page.
- [x] **Categorised formula vault.** Search across title, description, category and
      LaTeX, with category filters, backed by Postgres.
- [x] **Crisp LaTeX rendering.** KaTeX in a client component, with `throwOnError: false`
      so a malformed formula in user content cannot take down the page.
- [x] **Personal formula library.** Users add and delete their own formulas; deletes are
      scoped by Clerk `userId` and the custom flag, so a seeded formula cannot be removed.
- [x] **Interactive multi-variable solver.** Driven by `solver_meta`, solving for any
      variable via mathjs, with division-by-zero and domain errors reported in the UI.
- [x] **Random formula challenge.** Generates physically sensible inputs per variable
      (ranges chosen from the variable name and unit), scores with a relative tolerance so
      a rounded display value is not scored wrong, and can show its working.
- [x] **2D function plotter.** function-plot, loaded client-side only, with six presets and
      a `ResizeObserver` re-draw, since function-plot exposes no `resize()`.
- [x] **3x3 matrix calculator.** Determinant expanded step by step along the first row,
      plus the adjugate-based inverse and a 3x3 linear solve.
- [x] **Polynomial derivative solver.** Power rule applied per term, with the working shown
      and a parser that rejects malformed input rather than returning a wrong answer.
- [x] **Bookmarked cheat sheet.** Starred formulas, with client-side PDF export via a
      dynamically imported jsPDF.
- [x] **Lab coach and regression tool.** Editable readings, least-squares fit reporting
      slope, intercept and `R^2`, canvas scatter plot with the best-fit line, save to the
      notebook, and a PDF report.
- [x] **Browser OCR scanner.** Tesseract.js in a Web Worker, imported on demand, with image
      preview and follow-up search or plot actions.
- [x] **Formula practice quiz.** Multiple choice with distractors drawn from other
      formulas, streak and accuracy tracking, and weak-topic detection that links back to the
      vault.

## Auth migration

The auth provider moved from the previous self-managed solution to Clerk and Supabase
became the database only. The old auth packages and their local hashing dependency were
removed from `package.json`.

| Change                                                                 | Detail                                                                     |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Added                                                                  | `components/login-form.tsx`, `components/register-form.tsx`                |
| Rewritten                                                             | `proxy.ts`, now `clerkMiddleware` rather than the previous middleware body |
| Removed                                                                | the old auth config module, its session type declaration, the two server auth-helper modules, and the old session route handler |
| Removed from `app/actions.ts`                                          | `registerUserAction`                                                        |
| Removed from the schema                                                | the `users` table; `user_id` retyped to `TEXT` on `formulas`, `saved_bookmarks`, `lab_runs` |
| Kept                                                                   | `getUserData`, `addCustomFormulaAction`, `deleteCustomFormulaAction`, `toggleBookmarkAction`, `saveLabRunAction`, `deleteLabRunAction`; they now read the caller via Clerk's `auth()` -> `userId` |

## Data layer

- [x] Three tables: `formulas`, `saved_bookmarks`, `lab_runs`. No `users` table.
- [x] `user_id` is `TEXT` on all three tables, holding a Clerk id such as `user_2abcDEF`.
- [x] `saved_bookmarks.formula_id` is a real foreign key to `formulas(slug)` with
      `ON DELETE CASCADE`, plus a `UNIQUE (user_id, formula_id)` constraint.
- [x] RLS enabled with no policies and grants revoked from `anon`/`authenticated`.
- [x] 15 baseline formulas seeded, 5 carrying `solver_meta`.
- [x] Idempotent migration in `db/schema.sql`, which also carries the ordered legacy
      identity -> Clerk steps.

## Correctness work

Two defects inherited from the prototype were found and fixed:

1. **R-squared was never computed.** `lab_runs.r_squared` is `NOT NULL` but the prototype's
   least-squares fit returned only a slope and an intercept, so every save would have
   written a placeholder. `lib/regression.ts` now computes it, with the degenerate cases
   handled: a vertical dataset has no defined slope (the whole fit returns `null` rather
   than `NaN` reaching the column), and a flat series has zero total variance, so `R^2` is
   1 when the fit is also exact.
2. **The derivative parser dropped decimal coefficients.** The prototype read coefficients
   with `parseFloat` on a slice that still included the variable, so `parseFloat("-4x^2")`
   is `NaN` and the term vanished. The derivative looked plausible and was wrong.
   `lib/polynomial.ts` now validates the entire input against a term grammar, requires
   every character to be accounted for, and throws `PolynomialParseError` rather than
   returning a partial answer.

## Design system

The colour tokens in `app/globals.css` were replaced with an elevation-based set:
`chrome` -> `surface-0` -> `surface-1` -> `surface-2` -> `surface-3` -> `surface-4`, plus
line, ink, accent, secondary/tertiary, status and plot families. The accent family was
split into `accent` (fill, focus ring, borders), `accent-bright` (readable accent text) and
`accent-deep` (label colour on an accent fill) so a primary button and an important number
never share a colour. Depth now comes from an inset top highlight plus a wide
low-opacity shadow, with the 1px border demoted to edge definition. Every ink token clears
4.5:1 on every surface.

## Known limitations

- Practice progress lives in `localStorage` under the key `formulax.practice.v1`; there is
  no practice table in the schema, so it does not follow the user across devices, and a
  cleared browser profile loses it.
- Application queries use the service-role client, which bypasses RLS, so the database
  security boundary is the application layer rather than RLS policies. Each action scopes
  by the Clerk `userId` to compensate.
- The plotting, canvas and OCR components have no browser-level tests. They are covered by
  TypeScript types and, for the maths underneath them, by hand-verified values.
- The mobile navigation drawer is not focus-trapped. It closes on Escape and on selecting a
  link, but focus is not moved into the drawer or held there.
- The custom sign-in form does not support second factors. A `needs_second_factor` status
  is detected and reported to the user rather than silently failing.
- Tesseract.js's browser worker defaults to a `cdn.jsdelivr.net` URL, so the OCR path needs
  network access to that CDN. It is not bundled.
- `.env.example` still lists the obsolete session-library variables. It is stale relative to
  the current `.env` and `docs/DEPLOYMENT.md`.