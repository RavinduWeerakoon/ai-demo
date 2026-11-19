# LLM traffic generator

Generates daily traffic through the demo's **external agents in WSO2 Agent Manager**. Each agent fronts one LLM provider, so the analytics get fresh, per-agent data every day: cost per call, total spend, spend by model, model affinity and daily token usage.

| Agent (id) | Provider | Called as |
| --- | --- | --- |
| Hotel Booking (`hotel-booking`) | OpenAI | `POST <url>/chat/completions` |
| Leave Assistant (`leave-assistant`) | Anthropic | `POST <url>/v1/messages` |
| RoomService (`room-service`) | Gemini | `POST <url>/v1beta/models/<model>:generateContent` |

Each agent is called in its provider's **native** API format, with the agent's Agent Manager key in the `api-key` header. Every request names a model: the agents reject an empty `model`.

Each run:

1. Picks a random number of conversations for every configured agent (3–8 by default), each drawn from that agent's own set: bookings, leave requests or room-service orders.
2. Shuffles them so the agents interleave.
3. Replays each conversation turn by turn, feeding the model's real replies back in.
4. Pauses a random 5–60 s between conversations, after starting up to an hour past the cron time.

The conversations live in `conversations.py` (`AGENT_CONVERSATIONS`, five per agent; an agent id without its own set uses `GENERAL_CONVERSATIONS`). Every call is logged as one JSON line (`call_ok` / `call_failed` with agent, provider, model, tokens and latency), and the run ends with a `run_finished` summary. A run exits non-zero only when every conversation failed.

```
llm-traffic/
  traffic.py         the generator (Python standard library only)
  conversations.py   the predefined conversations
  Dockerfile
  k8s/               CronJob, settings ConfigMap, Secret template, kustomization
```

## Configuration

`TRAFFIC_AGENTS` lists the agent ids (default `hotel-booking,leave-assistant,room-service`). For each id, settings use its upper-case prefix (`hotel-booking` → `HOTEL_BOOKING_`). An agent missing its URL, key or a valid provider is skipped.

| Setting | Where | Value |
| --- | --- | --- |
| `<ID>_PROVIDER` | ConfigMap | `openai`, `anthropic` or `gemini`: picks the request format |
| `<ID>_URL` | ConfigMap | The agent's LLM proxy URL, **without** the API path (the part before `/chat/completions` in the console's sample `curl`) |
| `<ID>_MODELS` | ConfigMap | Comma-separated models to pick from at random. Defaults: `gpt-4o-mini`, `claude-haiku-4-5`, `gemini-2.5-flash` |
| `<ID>_API_KEY` | Secret `llm-traffic-agent-keys` | The agent's API key from Agent Manager |
| `<ID>_KEY_HEADER` | optional | Header for the key; default `api-key` |

Run settings (ConfigMap `llm-traffic-settings`, `k8s/settings.yaml`):

| Key | Default | Meaning |
| --- | --- | --- |
| `TRAFFIC_MIN_PER_AGENT` / `TRAFFIC_MAX_PER_AGENT` | 3 / 8 | Conversations per agent per run |
| `TRAFFIC_MIN_PAUSE_SECONDS` / `TRAFFIC_MAX_PAUSE_SECONDS` | 5 / 60 | Pause between conversations |
| `TRAFFIC_START_JITTER_SECONDS` | 3600 | Random delay before the run starts |
| `TRAFFIC_MAX_TOKENS` | 300 | Cap per reply, keeps the daily cost small |
| `TRAFFIC_TIMEOUT_SECONDS` | 90 | Per-call timeout |

Also available: `TRAFFIC_SEED` (repeatable runs) and `TRAFFIC_DRY_RUN=true` (print the plan, call nothing).

## Run it locally

```bash
HOTEL_BOOKING_PROVIDER=openai HOTEL_BOOKING_URL=https://... HOTEL_BOOKING_API_KEY=... TRAFFIC_DRY_RUN=true python3 traffic.py
```

Drop `TRAFFIC_DRY_RUN` to make the calls. With the python.org Python on macOS, add `SSL_CERT_FILE=/etc/ssl/cert.pem` if calls fail with `CERTIFICATE_VERIFY_FAILED` (the container image has CA certificates).

## Deploy on agent-manager-demo

**1. Build and push the image** (linux/amd64, to the in-cluster registry, the same way as the other images in this repo; see the main README):

```bash
docker --context colima build --platform linux/amd64 -t localhost:5000/meridian/llm-traffic:0.2.0 llm-traffic
docker --context colima push localhost:5000/meridian/llm-traffic:0.2.0
```

**2. Create the keys Secret** with each agent's API key from Agent Manager. Run it in your own terminal; it prompts for each key without echoing it:

```bash
read -s "HB?Hotel Booking key: " && echo && read -s "LA?Leave Assistant key: " && echo && read -s "RS?RoomService key: " && echo && kubectl --context agent-manager-demo -n meridian-demo create secret generic llm-traffic-agent-keys --from-literal=HOTEL_BOOKING_API_KEY="$HB" --from-literal=LEAVE_ASSISTANT_API_KEY="$LA" --from-literal=ROOM_SERVICE_API_KEY="$RS" && unset HB LA RS
```

Agent URLs, providers and models are already in `k8s/settings.yaml`; edit them there.

**3. Apply the CronJob** (runs daily at 09:00 Asia/Colombo, then waits up to an hour):

```bash
kubectl --context agent-manager-demo apply -k llm-traffic/k8s
```

**4. Try it now** instead of waiting for the schedule, and follow the logs:

```bash
kubectl --context agent-manager-demo -n meridian-demo create job --from=cronjob/llm-traffic llm-traffic-manual-1
kubectl --context agent-manager-demo -n meridian-demo logs -f job/llm-traffic-manual-1
```

The manual job also waits for the start jitter. Set `TRAFFIC_START_JITTER_SECONDS` to `"0"` in `k8s/settings.yaml` and re-apply while testing.

To change a key, recreate the Secret (`kubectl delete secret llm-traffic-agent-keys`, then step 2). To change agents or models, edit `k8s/settings.yaml` and re-apply. The next run picks either up; no restart needed.

The earlier provider-direct version used the Secret `llm-traffic-providers`; after switching, delete it with `kubectl --context agent-manager-demo -n meridian-demo delete secret llm-traffic-providers`.
