# AI Insights

A small Next.js app that shows the Moesif dashboard for the demo's LLM traffic:
cost, model mix and token use through the WSO2 AI gateway. It embeds
[Moesif Canvas](https://www.moesif.com) behind the same single demo login as the
hotel website (`web/`), and is served separately at
`https://insights.agents.agent-manager.wso2demos.com`.

## Run locally

```bash
cp .env.example .env.local   # fill in the demo login and the Moesif key
npm install
npm run dev                  # http://localhost:3001
```

`MOESIF_CANVAS_KEY` is a Moesif management API key (Settings, then API Keys)
with read access to events only. Paste the key without the `Bearer ` prefix.
Every signed-in visitor can read it in the browser, so give it nothing more.

## How the embed works

- `src/app/api/canvas-token/route.ts` hands the key to a signed-in session only.
- `src/app/canvas-embed.tsx` loads `https://www.moesif.com/embed/canvas` and runs
  the handshake. On this key route Canvas first waits silently for `SET_TOKEN`,
  then moves to the app's page and sends `CANVAS_READY`; only then does it take
  the key again plus the template. It never sends `CANVAS_RENDERED`, so the frame
  is shown once the template is sent.
- `src/app/canvas-template.json` is the dashboard. It is generated from a
  Moesif "Export for Canvas" file, so editing a chart in Moesif does not change
  this page until you export again and regenerate it:

  ```bash
  python3 scripts/build-template.py ~/Downloads/canvas_<dashboard>.json
  ```

  It works with any Moesif dashboard. Single-number charts become KPI cards on
  top (cost ones get a `$` and 4 decimals); the rest follow two to a row. Chart
  order, wide charts, tooltips and metric labels are set by chart name in
  `dashboard-layout.json`. Then build and deploy a new image version.

## Deploy

See the repo README: build `meridian/insights` for linux/amd64, push it to the
cluster registry, create the `insights-moesif` Secret, and apply the overlay.

## The Agent and LLM proxy filters

Moesif only knows which LLM proxy each call went through (`metadata.apiName`),
and Agent Manager names an agent's proxy after a shortened config name, a hash
of project/agent/config/environment, and an agent-specific id
(`open-ai-b74b243322435f0c-1bac1b12-proxy`). An agent configured in two
environments therefore has two proxies. The dashboard has two filters, both
matching the proxy name with `contains`:

- **Agent**: one entry per agent. An agent with several proxies is matched on
  the tail its proxy names share (`-1bac1b12-proxy`), so one entry covers every
  environment. The tail is used only if it is at least 12 characters and
  matches none of the other proxies or providers; otherwise that agent keeps
  one entry per proxy.
- **LLM proxy**: one entry per proxy, labelled with its agent (plus the proxy
  name when the agent has several), to look at a single environment.

How it is built:

- `src/lib/agent-filter.ts` reads the mapping from Agent Manager's database,
  read-only (`artifacts` → `env_agent_model_mapping` → `agent_configurations`),
  and builds both lists. Proxies and providers no agent uses are listed in both,
  labelled `· proxy` / `· direct provider calls`, so nothing drops out of the
  dashboard. Environment names live in OpenChoreo, not in Agent Manager's
  database, so they can't be shown.
- `src/app/api/agent-filter/route.ts` serves them (`agents`, `proxies`) to
  signed-in sessions only.
- `canvas-embed.tsx` sends them in `CANVAS_INIT` as the `agent` and `proxy`
  context filters (declared in the template under `filters.context`, type
  `parentOptions`), with every option pre-selected. A filter with no options is
  left out of the template.

Because the match is `contains`, a provider entry also matches proxies whose
names contain the provider's name: `gemini` matches `gemini-…-proxy`. With
everything selected this changes nothing, but selecting only a provider entry
also shows that provider's agent proxies.

Without database settings, or if the database can't be read, both filters are
left out and the dashboard shows all traffic unfiltered.

**A read-only role.** Run once in Agent Manager's database (for example
`kubectl -n wso2-amp exec -it amp-postgresql-0 -- psql -U agentmanager agentmanager`),
with a password of your own:

```sql
CREATE ROLE insights_ro LOGIN PASSWORD '<password>';
GRANT CONNECT ON DATABASE agentmanager TO insights_ro;
GRANT USAGE ON SCHEMA public TO insights_ro;
GRANT SELECT ON artifacts, agent_configurations, env_agent_model_mapping TO insights_ro;
```

Then give it to the site and restart it:

```bash
kubectl --context agent-manager-demo -n meridian-demo create secret generic insights-amp-db --from-literal=AMP_DB_USER=insights_ro --from-literal=AMP_DB_PASSWORD='<password>'
kubectl --context agent-manager-demo -n meridian-demo rollout restart deploy/insights-web
```

The app also opens every session with `default_transaction_read_only=on`, so it
cannot write even if given a broader role.

If the filter shows agents but the charts go empty, Moesif's `apiName` carries
the proxy **handle** rather than its name: set `INSIGHTS_PROXY_MATCH=handle`.
