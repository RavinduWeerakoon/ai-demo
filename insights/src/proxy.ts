import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE, isValidSessionToken } from "@/lib/demo-auth";

/**
 * Sends anyone without a demo session to /login, and a signed-in visitor who
 * opens /login back to the site. Static assets are excluded by the matcher.
 */
export function proxy(request: NextRequest) {
  const signedIn = isValidSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  const onLoginPage = request.nextUrl.pathname === "/login";

  if (!signedIn && !onLoginPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (signedIn && onLoginPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
