# Hackathon Defense and Q&A

## Q1. Why a server-backed app rather than a purely client-side one?

The prototype proved the interactions work with no backend, but it stored bookmarks and
custom formulas in `localStorage`, which means the data dies with the browser and cannot
be shared or recovered. The requirement was a cloud-synced account, so the data moved to
Postgres.

We kept the client-side split where it earns its place: KaTeX, mathjs, function-plot and
the canvas chart all run in the browser, so typing in the solver or dragging the plotter
never waits on a round trip. The server is used for exactly what has to be durable and
authorised: formulas, bookmarks and lab runs.

## Q2. How is authentication handled?

Authentication is Clerk, via `@clerk/nextjs`. Clerk owns identity: there is no user table
in our database and no password column anywhere, so the whole class of
"we hashed it wrong" bugs is somebody else's problem.

Three layers:

- `proxy.ts` wraps `clerkMiddleware` and calls `auth.protect({ unauthenticatedUrl: "/login" })`
  for the nine workspace routes. The explicit `unauthenticatedUrl` matters: `auth.protect()`
  otherwise calls `redirectToSignIn()` and sends the visitor to Clerk's hosted UI. We want
  our own page. Clerk preserves the original destination, and the login page only accepts a
  same-origin relative path for it.
- Sign-in and sign-up are our own components, not Clerk's. See Q7.
- Every server action calls `requireUserId()`, which reads Clerk's `auth()` and returns
  the `userId` (a string like `user_2abcDEF`), then scopes its query by that id. Protection
  does not rest on the proxy alone; an action invoked without a session returns an error
  string before touching the database.

## Q3. What was the most interesting bug to find?

Two numerical bugs, both inherited from the prototype, and both of the same species: the
code produced a plausible-looking wrong answer instead of failing.

The lab coach's regression reported a slope and an intercept but never computed the
coefficient of determination, even though `lab_runs.r_squared` is `NOT NULL`. Every save
would have written a placeholder, and the number would have looked fine on a results table.
`lib/regression.ts` now computes it, and handles the degenerate cases explicitly: a
vertical dataset has no defined slope, so the fit returns `null` rather than letting `NaN`
reach the column, and a flat series has zero total variance, so `R^2` is conventionally 1
when the fit is also exact.

The derivative parser read coefficients with `parseFloat` on a slice that still contained
the variable, so `parseFloat("-4x^2")` is `NaN`, the term silently disappeared, and
differentiating `3x^3 - 4x^2 + 7` returned a clean-looking result that was simply wrong.
`lib/polynomial.ts` now validates the whole input against a term grammar, requires that
every character in the input was consumed by a matched term, and throws
`PolynomialParseError` otherwise. A parser that cannot account for its input should say so
rather than answer.

## Q4. How do the maths modules avoid being trusted blindly?

They are pure functions with no React, DOM or database dependency: `lib/regression.ts`,
`lib/determinant.ts`, `lib/polynomial.ts` and `lib/evaluate.ts`. That separation is what
makes them checkable by inspection and against hand-computed values: a 3x3 determinant
expanded by hand, a perfect line fitting with `R^2` of exactly 1, the seeded Ohm's Law
readings, a vertical dataset, a flat series, and every `solve` expression the database
ships. The two defects above were found by working values through by hand, not by reading
the output for plausibility.

We should be clear about the limit: there is no committed test suite or test runner in the
repository, so "covered by tests" is not a claim we can make here. The correctness argument
rests on the modules being small and pure enough to verify directly.

## Q5. How is the database secured?

Row Level Security is enabled on all three tables with no policies, which is deny-all for
the `anon` and `authenticated` roles, and their grants are revoked outright.

Application traffic uses the service-role client, which bypasses RLS. So yes, the security
boundary is the application layer. That is a deliberate trade: it makes every query
explicit, which is why each action scopes by the Clerk `userId`, validates its input
before it reaches the database, and never interpolates client input into a filter. Database
errors are mapped to safe user-facing text and logged server-side, so PostgREST internals
and constraint names are not returned to the client.

## Q6. Why is RLS enabled with no policies while the app uses the service-role key?

That is not a contradiction; it is two different layers doing two jobs.

RLS with no policies is a revocation, not an authorisation scheme. It exists to make the
anon key useless. Supabase exposes the same database through PostgREST, and the anon key
ships to every browser. Any table the anon role can read is public to anyone who loads the
page, regardless of what our React code intends. Enabling RLS with no policies and revoking
the grants makes that exposure impossible rather than merely unlikely. The service-role key
is unaffected, because the service role bypasses RLS by design.

What RLS does *not* do for us is row-level authorisation, because we have not written any
policies. That is the gap, and we would rather name it than imply coverage we do not have:
if the service-role key ever leaked, RLS would not stop the leak, because the client using
it is exactly the one RLS cannot constrain. Today the exposure is bounded by the key
living only in server-side environment variables and the client module being marked
`server-only`.

Closing the gap properly means writing policies and switching reads to a user-scoped client,
which we did not do because it would mean giving the `authenticated` role table grants,
which is the very thing the current setup withholds. It is listed as next work rather than
claimed as done.

## Q7. Why is the auth UI custom rather than using Clerk's `<SignIn/>` and `<UserButton/>`?

Clerk's prebuilt components render Clerk's own UI and carry a Clerk watermark. Dropping a
watermarked third-party widget into the middle of a custom design system looks like a
screenshot of someone else's product, and the `/login` and `/register` routes are the first
two screens anyone sees.

The hooks give us the flow without the UI. `useSignIn()` in `components/login-form.tsx`
drives `signIn.password()` and `signIn.finalize()`; `useSignUp()` in
`components/register-form.tsx` drives `signUp.password()`, `verifications.sendEmailCode()`,
`verifications.verifyEmailCode()` and `signUp.finalize()`. `useClerk().signOut()` replaces
`<UserButton/>` in the shell. Every field is ours, so it uses the same `fx-input` and
`fx-btn` classes as the rest of the app, and inherits the same focus ring and validation
styling.

The trade is real, and we took it knowingly: we own the states Clerk's components would
have handled for us. Two of them are visible in the code. An unverified email surfaces as
`missing_requirements`, so the verification-code entry is shown only in that case and a
normal sign-up never asks for a code. A `needs_second_factor` status is detected and shown
to the user with an explanation, because this form does not implement second factors. We
also render a `#clerk-captcha` placeholder, without which Clerk's bot-protection widget
falls back to an invisible mode and logs a console error.

One note for a reader who goes looking: Clerk's older `SignInResource` type keeps its
future API behind a property literally named `__internal_future`. That is where the name
comes from, and it is why the installed version's own type declarations mark it
`@internal`. The current code does not go through that property. `useSignIn` and
`useSignUp` in Clerk 7.9.9 return the future resources directly, so `password()` and
`finalize()` are called on the object the hook hands back.

## Q8. What did you change from the specification, and why?

- **Self-managed auth to Clerk.** Identity moved to a hosted provider. The old auth packages
  and the local hashing dependency are gone, there is no `users` table, and `user_id` on
  all three tables is `TEXT` rather than `UUID` because Clerk ids are opaque strings.
- **The middleware file became `proxy.ts`.** Next 16 renamed both the filename and its
  default export.
- **No `src/` directory.** The app lives at the repository root; the import alias points at
  the root, not at `src/`.
- **`formula_id` to a real foreign key.** The original spec paired a UUID `formulas.id`
  with a TEXT `saved_bookmarks.formula_id`, which cannot form a foreign key and leaves
  bookmarks dangling on delete. `formulas.slug` is the client-referenceable key and
  `formula_id` references it with `ON DELETE CASCADE`.
- **Added `solver_meta JSONB`.** The spec had nowhere to put solver variable definitions.
- **Added RLS**, which the spec omitted entirely.
- **Synchronous request APIs are gone.** `params` and `searchParams` are Promises in
  Next 16.

## Q9. What would you do next?

Write RLS policies and move reads to a user-scoped client, so the database enforces
ownership instead of the application layer. Move practice progress out of `localStorage`
into a table so it survives a device change. Add a committed test suite for the pure maths
modules with mutation checks. Trap focus in the mobile navigation drawer, which is the one
accessibility gap we know about. Add second-factor support to the custom sign-in form, or
drop the custom form for Clerk's components if that requirement lands.