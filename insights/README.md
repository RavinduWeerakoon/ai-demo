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

The filter bar above the dashboard is drawn by this app, not by Moesif:

- **Agent**: one entry per agent. An agent configured in several environments
  has one LLM proxy per environment, and its entry covers all of them. Only
  agents are listed: proxies with no agent (an evaluation monitor's LLM-judge
  proxy, labelled `· evaluation monitor`) and direct provider calls appear only
  under LLM proxy.
- **LLM proxy**: the proxies of the chosen agents, labelled with their agent.
  With every agent chosen it lists everything, direct provider calls included.

Choices take effect on **Apply**, which reloads the Moesif dashboard with them
(Canvas has no documented way to change a filter after it loads). **Reset**
selects everything again.

Moesif only knows which proxy each call went through (`metadata.apiName`), and
it matches the filter's values **exactly**, whatever the template's `op` says.
So only one filter is sent to Moesif: `proxy`, with the exact names of the
chosen proxies; the agent choice is turned into those names here. With every
proxy selected nothing is sent, so the default view shows all traffic.

How it is built:

- `src/lib/agent-filter.ts` reads the mapping from Agent Manager's database,
  read-only (`artifacts` → `env_agent_model_mapping` → `agent_configurations`):
  the agents with the exact names of their proxies, and every proxy and
  provider. Environment names live in OpenChoreo, not in Agent Manager's
  database, so they can't be shown.
- `src/app/api/agent-filter/route.ts` serves them (`agents`, `proxies`) to
  signed-in sessions only.
- `src/app/insights-dashboard.tsx` draws the two controls
  (`src/components/multi-select.tsx`) and remounts the embed on Apply.
- `canvas-embed.tsx` sends the chosen proxy names in `CANVAS_INIT` as the
  `proxy` context filter (declared in the template under `filters.context`,
  type `parentOptions`), with `visibility` set to `hidden`. Override it with
  `?filterVisibility=<value>` in the page URL.

Moesif may still show its own Filters button once a filter is sent: it runs on
moesif.com in an iframe, so this page's CSS can't reach it, and Canvas has no
documented setting to hide it.

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
