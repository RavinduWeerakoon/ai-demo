import { cookies } from "next/headers";

import { loadAgentFilterOptions } from "@/lib/agent-filter";
import { SESSION_COOKIE, isValidSessionToken } from "@/lib/demo-auth";

/**
 * The dashboard's "Agent" filter options: agent names (labels) for the LLM
 * proxy names Moesif filters on (values). Signed-in sessions only, never
 * cached. An empty list means "no mapping available": the page then shows
 * Moesif's unfiltered view instead of a broken filter.
 */
export async function GET() {
  const noStore = { "Cache-Control": "no-store" };

  const session = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!isValidSessionToken(session)) {
    return Response.json({ error: "Sign in first." }, { status: 401, headers: noStore });
  }

  const options = await loadAgentFilterOptions();
  return Response.json({ options: options ?? [] }, { headers: noStore });
}
