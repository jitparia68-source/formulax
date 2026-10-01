import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/**
 * The nine workspace routes. `auth.protect()` sends an unauthenticated visitor to
 * Clerk's sign-in URL, which `ClerkProvider` is configured to point at `/login`, and it
 * preserves a `redirectUrl` so the user lands where they were going.
 */
const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/formulas(.*)",
  "/solver(.*)",
  "/plotter(.*)",
  "/matrix(.*)",
  "/derivative(.*)",
  "/cheatsheet(.*)",
  "/labcoach(.*)",
  "/practice(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  if (isProtectedRoute(request)) {
    // `unauthenticatedUrl` is the option that applies to a signed-out visitor;
    // `unauthorizedUrl` only covers a signed-in user who fails an authorization check.
    // Without this, protect() calls redirectToSignIn() and sends the visitor to Clerk's
    // hosted UI instead of our own page.
    await auth.protect({ unauthenticatedUrl: "/login" });
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files, unless found in search params.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for Clerk's frontend API routes.
    "/__clerk/(.*)",
    // Always run for API routes.
    "/(api|trpc)(.*)",
  ],
};
