"use client";

import { useEffect, useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";

import { MultiSelect, type Option } from "@/components/multi-select";
import { CanvasEmbed, type AppliedFilters } from "./canvas-embed";

type FilterData = { agents: Option[]; proxies: Option[] };

// Moesif's own copy of the filters is hidden by default, since the page draws
// its own. Canvas's accepted values aren't documented, so ?filterVisibility=
// overrides it (e.g. "always" to bring Moesif's Filters panel back).
function filterVisibility(): string {
  const value = new URLSearchParams(window.location.search).get("filterVisibility")?.trim();
  return value && /^[a-z]{1,20}$/i.test(value) ? value : "hidden";
}

// A proxy belongs to an agent option when it contains that option's value
// (the agent's shared proxy-name tail, or the proxy name itself).
const belongsTo = (proxy: string, agentValues: string[]) => agentValues.some((a) => proxy.includes(a));

/**
 * The Agent and LLM proxy filters, drawn here above the Moesif dashboard.
 * Choices take effect on Apply, which reloads the dashboard with them: Canvas
 * has no documented way to change a filter once it has loaded.
 */
export function InsightsDashboard() {
  const [data, setData] = useState<FilterData | null>(null);
  const [agents, setAgents] = useState<string[]>([]);
  const [proxies, setProxies] = useState<string[]>([]);
  const [applied, setApplied] = useState<AppliedFilters | null>(null);
  const [revision, setRevision] = useState(0);

  // Load the options once. Any failure leaves the filters out and the
  // dashboard loads unfiltered.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/agent-filter", { cache: "no-store" })
      .then(async (res) => (res.ok ? ((await res.json()) as Partial<FilterData>) : {}))
      .catch(() => ({}) as Partial<FilterData>)
      .then((body) => {
        if (cancelled) return;
        const loaded = { agents: body.agents ?? [], proxies: body.proxies ?? [] };
        const allAgents = loaded.agents.map((o) => o.value);
        const allProxies = loaded.proxies.map((o) => o.value);
        setData(loaded);
        setAgents(allAgents);
        setProxies(allProxies);
        setApplied(toApplied(loaded, allAgents, allProxies));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // The LLM proxy list only offers proxies of the chosen agents.
  const proxyOptions = useMemo(
    () => (data ? data.proxies.filter((p) => belongsTo(p.value, agents)) : []),
    [data, agents],
  );

  function chooseAgents(values: string[]) {
    setAgents(values);
    // A new agent choice starts with all of those agents' proxies selected.
    setProxies((data?.proxies ?? []).filter((p) => belongsTo(p.value, values)).map((p) => p.value));
  }

  function toApplied(source: FilterData, agentValues: string[], proxyValues: string[]): AppliedFilters {
    return {
      agent: { options: source.agents, selected: agentValues },
      proxy: { options: source.proxies, selected: proxyValues },
      visibility: filterVisibility(),
    };
  }

  function apply() {
    if (!data) return;
    setApplied(toApplied(data, agents, proxies));
    setRevision((r) => r + 1); // new key: a fresh dashboard with these filters
  }

  function reset() {
    if (!data) return;
    const allAgents = data.agents.map((o) => o.value);
    const allProxies = data.proxies.map((o) => o.value);
    setAgents(allAgents);
    setProxies(allProxies);
    setApplied(toApplied(data, allAgents, allProxies));
    setRevision((r) => r + 1);
  }

  const hasFilters = !!data && data.agents.length > 0;
  const changed =
    !!applied && (applied.agent.selected.join("\n") !== agents.join("\n") || applied.proxy.selected.join("\n") !== proxies.join("\n"));
  const empty = agents.length === 0 || proxies.length === 0;

  return (
    <div className="flex flex-col gap-4">
      {hasFilters && (
        <div className="flex flex-wrap items-end gap-4 rounded-xl border border-line bg-white px-4 py-4 shadow-sm sm:px-5">
          <MultiSelect label="Agent" options={data.agents} selected={agents} onChange={chooseAgents} />
          <MultiSelect label="LLM proxy" options={proxyOptions} selected={proxies} onChange={setProxies} />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={apply}
              disabled={!changed || empty}
              className="h-10 rounded-lg bg-brand px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={reset}
              className="flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm text-ink-muted hover:text-ink"
              title="Select every agent and proxy again"
            >
              <RotateCcw className="size-4" aria-hidden />
              Reset
            </button>
          </div>
          {empty && <p className="w-full text-sm text-error-ink">Choose at least one agent and one LLM proxy.</p>}
        </div>
      )}

      {/* Waits for the options, so the dashboard starts with the right filters. */}
      {data && <CanvasEmbed key={revision} filters={hasFilters ? applied : null} />}
    </div>
  );
}
