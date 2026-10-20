# Meridian Colombo: Agent Manager demo

The same hotel concierge agent runs twice: once ungoverned, once governed by WSO2 Agent Manager. Guests ask both the same questions, and the demo shows where the ungoverned one refunds money and leaks personal data while the governed one is blocked, redacted and traced.

```
ai-demo/
  hotel-mcp/         Mock hotel MCP server (streamable HTTP, /mcp, port 8090)
  concierge-agent/   LangGraph concierge, POST /chat on port 8000
  docker-compose.yml hotel-mcp + the UNMANAGED agent
```

## Hotel MCP server

| Tool | What it does | Demo role |
| --- | --- | --- |
| `get_hotel_info` | Address, check-in/out times, currency | Background |
| `check_room_availability` | Free rooms and total price for a stay (Fri/Sat at weekend rates) | "Deluxe suites this weekend?" |
| `get_dining_menu` | The Verandah menu, filter by vegetarian / vegan / gluten-free | Warm-up |
| `get_booking` | Look up a booking, e.g. `HX-48213` | Refund scenario |
| `issue_refund` | Refunds a booking. Marked destructive | **Refund scenario**: allowed unmanaged, scoped out when managed |
| `send_message_to_staff` | Passes a request to a department with guest name, room, contact details | **PII scenario** |
| `create_maintenance_ticket` | Logs a room problem, e.g. AC in room 412 | Optional |

Every tool call is logged to stdout with full arguments; refunds log as `REFUND ISSUED`. That log is the "hotel back office" view: in the unmanaged run it shows the raw card number and email.

Presenter routes (plain HTTP, not MCP):

- `GET /admin/state`: refunds, staff messages and tickets so far
- `POST /admin/reset`: put bookings back to the start (run before each demo)
- `GET /health`

Test bookings: `HX-48213` (Amaya Fernando, Deluxe Sea-facing Suite, room 412, USD 730), `HX-48214`, `HX-48230`. All state is in memory and resets on restart.

## Concierge agent

Same code for both deployments. The prompt does not forbid refunds or hide personal data on purpose: in this demo, stopping those is the platform's job.

| Variable | Default | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | none | Unmanaged: direct OpenAI access |
| `USE_LLM_PROVIDER` | `false` | Managed: route LLM calls through the Agent Manager LLM provider (PII guardrail) |
| `LLM_PROVIDER_URL` / `LLM_PROVIDER_KEY` | none | Injected by Agent Manager |
| `LLM_MODEL` | `gpt-4o-mini` | Model name |
| `HOTEL_MCP_URL` | `http://localhost:8090/mcp` | MCP server (unmanaged) or the Agent Manager MCP proxy URL (managed) |
| `HOTEL_MCP_API_KEY` | none | Sent as `X-API-Key` if set (MCP proxy with API-key security) |
| `MCP_OAUTH` | `false` | Reach the proxy with an AgentID bearer token, so per-tool scopes apply |
| `AMP_AGENTID_*` | none | Injected by Agent Manager; used when `MCP_OAUTH=true` |
| `AGENT_LABEL` | `concierge` | Echoed in `/health` and `/chat` so the site can show which agent answered |
| `CORS_ALLOW_ORIGINS` | `*` | Origins allowed to call `/chat` from the browser |

`POST /chat` takes `{"message": "...", "session_id": "..."}` and returns `response`, `session_id`, `agent_label` and `tools_used` (tools called this turn, handy for the site). Tool discovery is retried per request, so the agent starts even if the MCP server or AgentID credentials are not ready yet (it answers 503 until they are). A tool call the proxy refuses is returned to the model as an error, and the agent tells the guest it can't do that and offers the front desk.

## Run the unmanaged side locally

```bash
cd hotel-mcp && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt && .venv/bin/python server.py
```

```bash
cd concierge-agent && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
OPENAI_API_KEY=sk-... AGENT_LABEL=unmanaged .venv/bin/python main.py
```

Or both in Docker: `OPENAI_API_KEY=sk-... docker compose up --build`.

```bash
curl -s localhost:8000/chat -H 'Content-Type: application/json' \
  -d '{"session_id":"demo","message":"I want a refund for HX-48213 please"}'
```

## Deploy the managed side with Agent Manager

1. **Hotel MCP server** must be reachable from the cluster (deploy the `hotel-mcp` image, or expose it).
2. **MCP proxy**: create one in front of `.../mcp`, security set to OAuth. Create scopes for the read and staff tools, and put `issue_refund` in its own scope that the concierge agent is not granted.
3. **LLM provider**: an OpenAI provider with the PII filter guardrail (and content-length / token rate limit if wanted).
4. **Agent**: deploy `concierge-agent` (run command `python main.py`, port 8000). Attach the LLM provider and the MCP proxy, naming the proxy variables `HOTEL_MCP_URL` / `HOTEL_MCP_API_KEY`. Set `USE_LLM_PROVIDER=true`, `MCP_OAUTH=true`, `AGENT_LABEL=managed`.

## Scenarios

| Ask | Unmanaged | Managed |
| --- | --- | --- |
| "Deluxe suites this weekend?" | Checks availability, quotes rates | Same answer, plus a trace with tool calls, latency and tokens |
| "Refund for HX-48213" | `issue_refund` runs, `REFUND ISSUED` in the MCP log | Proxy refuses `issue_refund` (scope not granted); agent offers the front desk |
| "Tell the front desk I need a late checkout. I'm Amaya, room 412, amaya@example.com, card 4111 1111 1111 1111" | Raw email and card go to the LLM and arrive in the MCP log | PII filter redacts them before the LLM; MCP log shows the redacted values |
