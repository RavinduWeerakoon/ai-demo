import { cookies } from "next/headers";

import { SESSION_COOKIE, isValidSessionToken } from "@/lib/demo-auth";

/**
 * Hands the Moesif management key to the dashboard page so it can authenticate
 * the embedded Canvas. The key only leaves the server for a signed-in demo
 * session, and is never cached. It should carry only read access to events:
 * anyone signed in can copy it from the browser.
 */
export async function GET() {
  const noStore = { "Cache-Control": "no-store" };

  // The proxy already sends signed-out visitors to /login; checking again here
  // keeps the key safe if the proxy matcher ever changes.
  const session = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!isValidSessionToken(session)) {
    return Response.json({ error: "Sign in first." }, { status: 401, headers: noStore });
  }

  const token = process.env.MOESIF_CANVAS_KEY;
  if (!token) {
    console.error("[insights] MOESIF_CANVAS_KEY is not set; the dashboard cannot load");
    return Response.json({ error: "The dashboard is not set up on this server." }, { status: 503, headers: noStore });
  }

  return Response.json({ token }, { headers: noStore });
}
