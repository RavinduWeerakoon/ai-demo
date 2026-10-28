# LLM traffic generator

Generates daily traffic through the **OpenAI, Anthropic and Gemini providers registered in WSO2 Agent Manager**, so the analytics have fresh data every day: cost per call, total spend, spend by model, model affinity and daily token usage.

Each run:

1. Picks a random number of conversations for every configured provider (3–8 by default).
2. Shuffles them so providers interleave.
3. Replays each one turn by turn against a randomly chosen model from that provider's list, feeding the model's real replies back in.
4. Pauses a random 5–60 s between conversations, after starting up to an hour past the cron time.

The 12 predefined conversations live in `conversations.py`: hotel concierge, emails, itineraries, code review, SQL, summaries, translation and extraction, of varying length. Every call is logged as one JSON line (`call_ok` / `call_failed` with model, tokens and latency) and the run ends with a `run_finished` summary. A run exits non-zero only when every conversation failed.

```
llm-traffic/
  traffic.py         the generator (Python standard library only)
  conversations.py   the predefined conversations
  Dockerfile
  k8s/               CronJob, settings ConfigMap, Secret template, kustomization
```

## Configuration

**Secret `llm-traffic-providers`** (one set per provider; a provider missing its URL or key is skipped):

| Key | Value |
| --- | --- |
| `OPENAI_URL`, `ANTHROPIC_URL`, `GEMINI_URL` | The provider's proxy URL in Agent Manager, **without** the API path. The script appends `/chat/completions` (OpenAI), `/v1/messages` (Anthropic) or `/v1beta/models/<model>:generateContent` (Gemini), each provider's native API. |
| `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` | An API key issued for that provider in Agent Manager (not the vendor's own key) |
| `OPENAI_MODELS`, `ANTHROPIC_MODELS`, `GEMINI_MODELS` | Comma-separated models to pick from at random, e.g. `gpt-4o-mini,gpt-4o`. Defaults: `gpt-4o-mini`, `claude-haiku-4-5`, `gemini-2.5-flash` |
| `OPENAI_KEY_HEADER` etc. | Optional header for the key; default `X-API-Key` |

From inside the cluster, a provider's proxy URL is the gateway runtime plus the provider's context path, e.g. `http://api-platform-default-default-gw-gateway-gateway-runtime.openchoreo-data-plane:22893/<provider-context>`. Use the URL the Agent Manager console shows for the provider.

**ConfigMap `llm-traffic-settings`** (`k8s/settings.yaml`):

| Key | Default | Meaning |
| --- | --- | --- |
| `TRAFFIC_MIN_PER_PROVIDER` / `TRAFFIC_MAX_PER_PROVIDER` | 3 / 8 | Conversations per provider per run |
| `TRAFFIC_MIN_PAUSE_SECONDS` / `TRAFFIC_MAX_PAUSE_SECONDS` | 5 / 60 | Pause between conversations |
| `TRAFFIC_START_JITTER_SECONDS` | 3600 | Random delay before the run starts |
| `TRAFFIC_MAX_TOKENS` | 300 | Cap per reply, keeps the daily cost small |
| `TRAFFIC_TIMEOUT_SECONDS` | 90 | Per-call timeout |

Also available: `TRAFFIC_SEED` (repeatable runs) and `TRAFFIC_DRY_RUN=true` (print the plan, call nothing).

## Run it locally

```bash
OPENAI_URL=... OPENAI_API_KEY=... TRAFFIC_DRY_RUN=true python3 traffic.py
```

Drop `TRAFFIC_DRY_RUN` to make the calls.

## Deploy on agent-manager-demo

**1. Build and push the image** (linux/amd64, to the in-cluster registry, the same way as the other images in this repo; see the main README):

```bash
docker --context colima build --platform linux/amd64 -t localhost:5000/meridian/llm-traffic:0.1.0 llm-traffic
docker --context colima push localhost:5000/meridian/llm-traffic:0.1.0
```

**2. Create the Secret.** Put the values in a local file (never commit it), create the Secret from it, then delete the file:

```bash
cat > /tmp/llm-providers.env <<'EOF'
OPENAI_URL=https://...
OPENAI_API_KEY=...
OPENAI_MODELS=gpt-4o-mini,gpt-4o
ANTHROPIC_URL=https://...
ANTHROPIC_API_KEY=...
ANTHROPIC_MODELS=claude-haiku-4-5,claude-sonnet-4-5
GEMINI_URL=https://...
GEMINI_API_KEY=...
GEMINI_MODELS=gemini-2.5-flash,gemini-2.5-pro
EOF
kubectl --context agent-manager-demo -n meridian-demo create secret generic llm-traffic-providers --from-env-file=/tmp/llm-providers.env
rm /tmp/llm-providers.env
```

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

To change keys or models later, recreate the Secret (`kubectl delete secret llm-traffic-providers` then step 2); the next run picks it up, no restart needed.
