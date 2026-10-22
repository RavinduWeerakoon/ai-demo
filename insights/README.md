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
- `src/app/canvas-template.json` is the dashboard: an "Export for Canvas" from
  the Moesif "AI dashboard", with the layout, `$` units, trend arrows, tooltips
  and an Agent filter added. It is a copy, so editing a chart in Moesif does not
  change this page until you export again and regenerate it:

  ```bash
  python3 scripts/build-template.py ~/Downloads/canvas_ai_dashboard.json
  ```

  The script re-applies the additions to the fresh export. A brand-new chart
  lands in its own row at the bottom; add it to the tables in the script to
  place and format it. Then build and deploy a new image version.

## Deploy

See the repo README: build `meridian/insights` for linux/amd64, push it to the
cluster registry, create the `insights-moesif` Secret, and apply the overlay.
