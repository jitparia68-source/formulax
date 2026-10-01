# Implementation Status

## Features

- [x] **Account registration and sign-in.** Auth.js v5 credentials provider, bcrypt at 10
      rounds, JWT session cookie. Registration auto-signs the user in.
- [x] **Route protection.** `proxy.ts` gates the nine workspace routes and preserves a
      validated same-origin `callbackUrl`.
- [x] **Categorised formula vault.** Search across title, description, category and
      LaTeX, with category filters, backed by Postgres.
- [x] **Crisp LaTeX rendering.** KaTeX in a client component, with `throwOnError: false`
      so a malformed formula in user content cannot take down the page.
- [x] **Personal formula library.** Users add and delete their own formulas; deletes are
      scoped by user id and the custom flag, so a seeded formula cannot be removed.
- [x] **Interactive multi-variable solver.** Driven by `solver_meta`, solving for any
      variable via mathjs, with division-by-zero and domain errors reported in the UI.
- [x] **Random formula challenge.** Generates physically sensible inputs per variable,
      scores with a relative tolerance, and can show its working.
- [x] **2D function plotter.** function-plot, loaded client-side only, with six presets
      and a re-draw on container resize.
- [x] **3x3 matrix calculator.** Determinant expanded step by step along the first row,
      plus inverse and 3x3 linear solve.
- [x] **Polynomial derivative solver.** Power rule applied per term, with the working
      shown and a parser that rejects malformed input rather than returning a wrong
      answer.
- [x] **Bookmarked cheat sheet.** Starred formulas, with client-side PDF export.
- [x] **Lab coach and regression tool.** Editable readings, least-squares fit reporting
      slope, intercept and R-squared, canvas scatter plot with the best-fit line, save to
      the notebook, and a printable report.
- [x] **Browser OCR scanner.** Tesseract.js in a Web Worker, imported on demand, with
      image preview and follow-up search or plot actions.
- [x] **Formula practice quiz.** Multiple choice with generated distractors, streak and
      accuracy tracking, and weak-topic detection that links back to the vault.

## Data layer

- [x] Four tables: `users`, `formulas`, `saved_bookmarks`, `lab_runs`.
- [x] RLS enabled with no policies and grants revoked from `anon`/`authenticated`.
- [x] 15 baseline formulas seeded, 5 carrying `solver_meta`.
- [x] Idempotent migration in `db/schema.sql`.

## Correctness work

Two defects inherited from the prototype were found and fixed:

1. **R-squared was never computed.** `lab_runs.r_squared` is `NOT NULL` but the
   regression only produced a slope and an intercept. Now computed, with the degenerate
   cases handled.
2. **The derivative parser dropped decimal coefficients.** `parseFloat("-4x^2")` is `NaN`,
   so the term vanished and the result looked plausible but was wrong. The parser now
   validates the entire input and throws on anything it cannot account for.

The pure maths modules are covered by 127 assertions, mutation-checked by deliberately
introducing each of those defects and confirming the suite fails.

## Known limitations

- Practice progress lives in `localStorage`; there is no practice table in the schema, so
  it does not follow the user across devices.
- Application queries use the service-role client, so the database security boundary is
  the application layer rather than RLS policies.
- The plotting, canvas and OCR components are covered by types and the maths modules
  underneath them, but not by browser-level tests.
- pnpm reports ignored build scripts for `core-js` and `tesseract.js`. This does not block
  the browser OCR path, since the worker and wasm core are fetched from a CDN.
