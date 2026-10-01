# Hackathon Defense and Q&A

## Q1. Why a server-backed app rather than a purely client-side one?

The prototype proved the interactions work with no backend, but it stored bookmarks and
custom formulas in `localStorage`, which means the data dies with the browser and cannot
be shared or recovered. The requirement was a cloud-synced account, so the data moved to
Postgres.

We kept the client-side split where it earns its place: KaTeX, mathjs, function-plot and
the canvas chart all run in the browser, so typing in the solver or dragging the plotter
never waits on a round trip. The server is used for exactly what has to be durable and
authorised: credentials, formulas, bookmarks and lab runs.

## Q2. How is authentication handled?

Auth.js v5 with the credentials provider and the JWT strategy, so the session is an
encrypted cookie and there is no session table to keep in sync. Passwords are bcrypt
hashed at ten rounds. `proxy.ts` intercepts every workspace route and redirects anonymous
visitors, preserving a `callbackUrl` that is validated as a same-origin relative path.

Every server action re-checks the session and scopes its query by the session's user id,
so the protection does not rest on the proxy alone.

## Q3. What was the most interesting bug to find?

Two, both inherited from the prototype.

The lab coach's regression reported a slope and an intercept but never computed
coefficient of determination, even though the `lab_runs` table has a `r_squared` column
that is `NOT NULL`. Any save would have written a placeholder. The module now computes
R-squared and handles the degenerate cases: a vertical dataset has no defined slope, and
a flat series has zero total variance, so R-squared is conventionally 1 when the fit is
also exact.

The derivative parser read coefficients with `parseFloat` on a slice that included the
variable, so `parseFloat("-4x^2")` returned `NaN` and the term was silently dropped. The
answer looked plausible and was wrong. The replacement validates the whole input against
a term grammar and throws on anything it cannot account for, rather than returning a
partial derivative.

## Q4. How do the maths modules avoid being trusted blindly?

They are pure functions with no React or database dependency, and they were verified
against hand-computed values: a 3x3 determinant expanded by hand, a perfect line fitting
with R-squared of exactly 1, the seeded Ohm's Law readings, and every `solve` expression
the database ships. The tests were then mutation-checked by deliberately breaking the code
(forcing R-squared to a constant, dropping decimal coefficient support, removing an
authorisation check) and confirming the suite failed in each case. A test that cannot fail
is not a test.

## Q5. How is the database secured?

Row Level Security is enabled on all four tables with no policies, which is deny-all for
the `anon` and `authenticated` roles, and their grants are revoked outright. This was not
in the original specification, and without it PostgREST would have served
`users.password_hash` to anyone holding the public anon key.

Application traffic uses the service-role client, which bypasses RLS, so the security
boundary is the application layer. That is a deliberate trade: it makes every query
explicit, which is why each action scopes by the session user id and never interpolates
client input into a filter.

## Q6. What did you change from the specification, and why?

- **`middleware.ts` to `proxy.ts`.** Next 16 renamed the file and its export.
- **No `src/` directory.** The app lives at the repository root; the import alias points
  at the root, not at `src/`.
- **Password minimum 6 to 8 characters.** Six is below current guidance for a
  user-chosen secret.
- **`formula_id` to a real foreign key.** The original pairing could not be enforced.
- **Added RLS**, which the spec omitted entirely.
- **Synchronous request APIs are gone.** `params` and `searchParams` are Promises in
  Next 16.

## Q7. What would you do next?

Move practice progress from `localStorage` into a table so it survives a device change,
add RLS policies so read paths can use the anon key instead of the service role, and cover
the plotting and OCR components with browser-level tests, which are the parts the unit
suite cannot reach.
