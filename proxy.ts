import { NextResponse } from "next/server";

import { auth } from "@/auth";

const PROTECTED_ROUTES = [
  "/dashboard",
  "/formulas",
  "/solver",
  "/plotter",
  "/matrix",
  "/derivative",
  "/cheatsheet",
  "/labcoach",
  "/practice",
] as const;

const AUTH_ROUTES = ["/login", "/register"] as const;

export default auth((request) => {
  const { pathname } = request.nextUrl;
  const isLoggedIn = Boolean(request.auth);

  const isProtected = PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  if (isProtected && !isLoggedIn) {
    const loginUrl = new URL("/login", request.nextUrl);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (
    isLoggedIn &&
    AUTH_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))
  ) {
    return NextResponse.redirect(new URL("/dashboard", request.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
