"use server";

import { agentConfig, isAgentMode, type AgentMode } from "@/lib/agents";

export type ChatResult =
  | { ok: true; reply: string; sessionId: string; guardrail: string | null; toolsUsed: string[] }
  | { ok: false; error: string };

const MAX_MESSAGE_LENGTH = 2000;
const REQUEST_TIMEOUT_MS = 90_000;
const SESSION_ID = /^[A-Za-z0-9-]{1,64}$/;

/**
 * Sends one guest message to the chosen concierge and returns its reply.
 *
 * Runs on the server: the browser only ever sees the reply text, never the
 * agent URLs or API keys. Server functions can be called by anyone who can
 * reach the site, so every input is checked here rather than trusted.
 */
export async function sendChatMessage(input: {
  mode: AgentMode;
  sessionId: string;
  message: string;
}): Promise<ChatResult> {
  const { mode, sessionId } = input;
  const message = typeof input.message === "string" ? input.message.trim() : "";

  if (!isAgentMode(mode)) return { ok: false, error: "Unknown agent." };
  if (typeof sessionId !== "string" || !SESSION_ID.test(sessionId)) {
    return { ok: false, error: "Invalid conversation id." };
  }
  if (!message) return { ok: false, error: "Type a message first." };
  if (message.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, error: `Messages are limited to ${MAX_MESSAGE_LENGTH} characters.` };
  }

  const config = agentConfig(mode);
  if ("missing" in config) {
    console.error(`[chat] ${mode} agent is not configured: ${config.missing} is not set`);
    return { ok: false, error: `The ${mode} concierge is not configured on the server.` };
  }

  let response: Response;
  try {
    response = await fetch(config.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": config.apiKey },
      body: JSON.stringify({ message, session_id: sessionId }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    console.error(`[chat] ${mode} agent unreachable:`, error);
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return {
      ok: false,
      error: timedOut ? "The concierge took too long to answer." : "The concierge is unreachable right now.",
    };
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error(`[chat] ${mode} agent answered ${response.status}: ${detail.slice(0, 500)}`);
    if (response.status === 401 || response.status === 403) {
      return { ok: false, error: "The concierge rejected this site's API key." };
    }
    if (response.status === 503) {
      return { ok: false, error: "The concierge is starting up. Try again in a moment." };
    }
    return { ok: false, error: "The concierge could not answer that. Please try again." };
  }

  const data = (await response.json().catch(() => null)) as {
    response?: unknown;
    session_id?: unknown;
    guardrail?: unknown;
    tools_used?: unknown;
  } | null;
  if (!data || typeof data.response !== "string") {
    console.error(`[chat] ${mode} agent returned an unexpected body`);
    return { ok: false, error: "The concierge sent an unexpected reply." };
  }

  return {
    ok: true,
    reply: data.response,
    sessionId: typeof data.session_id === "string" ? data.session_id : sessionId,
    guardrail: typeof data.guardrail === "string" ? data.guardrail : null,
    toolsUsed: Array.isArray(data.tools_used) ? data.tools_used.filter((t): t is string => typeof t === "string") : [],
  };
}
