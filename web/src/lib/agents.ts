import "server-only";

// The two concierge deployments the demo switches between. Both speak the same
// contract: POST {message, session_id} to the chat URL with an X-API-Key header.
//   unmanaged: the plain Kubernetes Deployment (its own AGENT_API_KEY)
//   managed:   the Agent Manager platform-hosted agent (an Agent Manager API key)
// URLs and keys are read on the server only and never sent to the browser.

export const AGENT_MODES = ["unmanaged", "managed"] as const;
export type AgentMode = (typeof AGENT_MODES)[number];

type AgentConfig = { url: string; apiKey: string };

const ENV_NAMES: Record<AgentMode, { url: string; apiKey: string }> = {
  unmanaged: { url: "UNMANAGED_AGENT_URL", apiKey: "UNMANAGED_AGENT_API_KEY" },
  managed: { url: "MANAGED_AGENT_URL", apiKey: "MANAGED_AGENT_API_KEY" },
};

export function isAgentMode(value: unknown): value is AgentMode {
  return typeof value === "string" && (AGENT_MODES as readonly string[]).includes(value);
}

/** Returns the agent's config, or the name of the first missing env var. */
export function agentConfig(mode: AgentMode): AgentConfig | { missing: string } {
  const names = ENV_NAMES[mode];
  const url = process.env[names.url]?.trim();
  const apiKey = process.env[names.apiKey]?.trim();
  if (!url) return { missing: names.url };
  if (!apiKey) return { missing: names.apiKey };
  return { url, apiKey };
}
