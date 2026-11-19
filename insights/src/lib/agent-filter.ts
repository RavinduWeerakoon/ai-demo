import "server-only";

import { Pool } from "pg";

/**
 * The options for the dashboard's two filter controls: "Agent" (one entry per
 * agent, with the exact names of its proxies) and "LLM proxy" (one entry per
 * proxy or provider). Moesif matches proxy names exactly, so the page turns an
 * agent choice into the exact names of that agent's proxies before filtering.
 *
 * Moesif only knows which LLM proxy or provider each call went through (its
 * `apiName`), and Agent Manager names an agent's proxy after a shortened agent
 * name plus a hash. The agent behind each proxy lives in Agent Manager's
 * database, so this reads it there, read-only, and turns every proxy and
 * provider into a { label, value } option: the label is what people see (the
 * agent name), the value is what Moesif filters on (the proxy name).
 * Environment names aren't in Agent Manager's database (they live in
 * OpenChoreo), so an agent with several proxies is told apart by proxy name.
 *
 * Providers and unattached proxies are listed too, so that with everything
 * pre-selected the dashboard still covers all gateway traffic, including
 * calls made straight to a provider.
 */

export type FilterOption = { label: string; value: string };
/** An agent and the exact names (the values Moesif matches) of its LLM proxies. */
export type AgentOption = FilterOption & { proxies: string[] };
export type FilterOptions = { agents: AgentOption[]; proxies: FilterOption[] };

// An evaluation monitor's LLM-judge proxy, as Agent Manager names it
// (monitorProxyName): up to 4 characters of the monitor name, an 8-hex provider
// fingerprint, the monitor's dashless UUID, then "-proxy".
const MONITOR_PROXY = /^[a-z0-9-]{1,4}-[0-9a-f]{8}-[0-9a-f]{32}-proxy$/;

type Row = {
  kind: string;
  proxy_name: string;
  proxy_handle: string;
  agent: string | null;
  project: string | null;
};

// One row per proxy/provider, plus one per agent configuration that uses it.
const QUERY = `
  SELECT a.kind,
         a.name   AS proxy_name,
         a.handle AS proxy_handle,
         ac.agent_id     AS agent,
         ac.project_name AS project
  FROM artifacts a
  LEFT JOIN env_agent_model_mapping m ON m.llm_proxy_uuid = a.uuid
  LEFT JOIN agent_configurations ac ON ac.uuid = m.config_uuid
  WHERE a.kind IN ('LlmProxy', 'LlmProvider')
  ORDER BY ac.agent_id NULLS LAST, a.name`;

let pool: Pool | null = null;

function getPool(): Pool | null {
  const { AMP_DB_HOST, AMP_DB_PORT, AMP_DB_NAME, AMP_DB_USER, AMP_DB_PASSWORD } = process.env;
  if (!AMP_DB_HOST || !AMP_DB_NAME || !AMP_DB_USER || !AMP_DB_PASSWORD) return null;
  pool ??= new Pool({
    host: AMP_DB_HOST,
    port: Number(AMP_DB_PORT || 5432),
    database: AMP_DB_NAME,
    user: AMP_DB_USER,
    password: AMP_DB_PASSWORD,
    ssl: process.env.AMP_DB_SSL === "true" ? { rejectUnauthorized: false } : undefined,
    max: 2,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    // Even with a read-only role, every session refuses writes.
    options: "-c default_transaction_read_only=on -c statement_timeout=5000",
  });
  return pool;
}

/** Moesif's apiName is the proxy's name by default; set INSIGHTS_PROXY_MATCH=handle if it carries the handle. */
const matchOn = (): "proxy_name" | "proxy_handle" =>
  process.env.INSIGHTS_PROXY_MATCH === "handle" ? "proxy_handle" : "proxy_name";

/** One option per LLM proxy or provider, labelled with its agent. */
export function buildProxyOptions(rows: Row[]): FilterOption[] {
  const key = matchOn();
  // Group the agent rows per proxy (one proxy can serve an agent in several environments).
  const byValue = new Map<string, Row[]>();
  for (const row of rows) {
    const value = row[key];
    if (!value) continue;
    byValue.set(value, [...(byValue.get(value) ?? []), row]);
  }

  // An agent with several proxies (one per environment) gets the proxy name in its label.
  const proxiesPerAgent = new Map<string, number>();
  for (const group of byValue.values()) {
    const agent = group.find((r) => r.agent)?.agent;
    if (agent) proxiesPerAgent.set(agent, (proxiesPerAgent.get(agent) ?? 0) + 1);
  }

  const options: FilterOption[] = [];
  for (const [value, group] of byValue) {
    const agentRow = group.find((r) => r.agent);
    let label: string;
    if (agentRow?.agent) {
      label = agentRow.agent;
      if ((proxiesPerAgent.get(agentRow.agent) ?? 0) > 1) {
        label += ` (${value})`;
      }
    } else if (group[0].kind === "LlmProvider") {
      label = `${group[0].proxy_name} · direct provider calls`;
    } else if (MONITOR_PROXY.test(group[0].proxy_name)) {
      label = `${group[0].proxy_name} · evaluation monitor`;
    } else {
      label = `${group[0].proxy_name} · proxy`;
    }
    options.push({ label, value });
  }
  // Agents first, alphabetically; providers and other proxies after.
  return options.sort((a, b) => {
    const rank = (o: FilterOption) => (o.label.includes(" · ") ? 1 : 0);
    return rank(a) - rank(b) || a.label.localeCompare(b.label);
  });
}

/**
 * One option per agent, so an agent with a proxy in several environments is a
 * single entry. Each carries the exact names of its proxies, read from the
 * same mapping, which the page sends to Moesif as the proxy filter. Only
 * agents are listed: proxies with no agent (such as evaluation monitors' judge
 * proxies) and direct provider calls are only in the LLM proxy filter.
 * (Nothing is sent to Moesif while everything is selected, so that view
 * includes them.)
 */
export function buildAgentOptions(rows: Row[]): AgentOption[] {
  const key = matchOn();
  const byAgent = new Map<string, Set<string>>();
  for (const row of rows) {
    const value = row[key];
    if (value && row.agent && row.kind !== "LlmProvider") {
      byAgent.set(row.agent, (byAgent.get(row.agent) ?? new Set()).add(value));
    }
  }
  return [...byAgent]
    .map(([agent, values]) => ({ label: agent, value: agent, proxies: [...values].sort() }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** Returns both filters' options, or null when the database isn't configured or can't be read. */
export async function loadFilterOptions(): Promise<FilterOptions | null> {
  const db = getPool();
  if (!db) {
    console.warn("[insights] AMP_DB_* not set: the Agent filter falls back to Moesif's unfiltered view");
    return null;
  }
  try {
    const { rows } = await db.query<Row>(QUERY);
    return { agents: buildAgentOptions(rows), proxies: buildProxyOptions(rows) };
  } catch (error) {
    console.error("[insights] could not read the proxy-to-agent mapping:", error);
    return null;
  }
}
