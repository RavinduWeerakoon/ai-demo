import { cookies } from "next/headers";

import { loadFilterOptions } from "@/lib/agent-filter";
import { SESSION_COOKIE, isValidSessionToken } from "@/lib/demo-auth";

/**
 * The dashboard's filter options: "agents" (one entry per agent) and
 * "proxies" (one per LLM proxy or provider). Labels are agent names, values
 * are what Moesif matches the proxy name against. Signed-in sessions only,
 * never cached. Empty lists mean "no mapping available": the page then shows
 * Moesif's unfiltered view instead of a broken filter.
 */
export async function GET() {
  const noStore = { "Cache-Control": "no-store" };

  const session = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!isValidSessionToken(session)) {
    return Response.json({ error: "Sign in first." }, { status: 401, headers: noStore });
  }

  const options = await loadFilterOptions();
  return Response.json({ agents: options?.agents ?? [], proxies: options?.proxies ?? [] }, { headers: noStore });
}
