"""Daily LLM traffic for the Agent Manager demo.

Replays a random set of predefined conversations through the demo's external
agents in WSO2 Agent Manager. Each agent fronts one LLM provider (OpenAI,
Anthropic or Gemini) through its own LLM proxy, and is called in that
provider's native API format, so the traffic shows up per agent in the
analytics (cost per call, spend by model, model affinity, daily tokens).

Configuration is all environment variables; see README.md. An agent takes part
when its URL and API key are set. Exits non-zero only if every conversation
failed, so a partial outage still shows as a successful run with errors logged.
"""

from __future__ import annotations

import json
import os
import random
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone

from conversations import AGENT_CONVERSATIONS, GENERAL_CONVERSATIONS

# Agent Manager's agent LLM proxies take the agent's key in this header.
DEFAULT_KEY_HEADER = "api-key"
PROVIDERS = ("openai", "anthropic", "gemini")
DEFAULT_AGENTS = "hotel-booking,leave-assistant,room-service"
DEFAULT_MODELS = {
    "openai": "gpt-4o-mini",
    "anthropic": "claude-haiku-4-5",
    "gemini": "gemini-2.5-flash",
}


@dataclass(frozen=True)
class Agent:
    id: str  # e.g. hotel-booking; also picks its conversation pool
    provider: str  # openai | anthropic | gemini: selects the request format
    base_url: str  # the agent's LLM proxy URL in Agent Manager, without the API path
    api_key: str
    key_header: str
    models: list[str]
    conversations: list[dict]


def log(event: str, **fields: object) -> None:
    """One JSON line per event, so `kubectl logs` reads cleanly and greps well."""
    record = {"ts": datetime.now(timezone.utc).isoformat(timespec="seconds"), "event": event, **fields}
    print(json.dumps(record), flush=True)


def env_int(name: str, default: int) -> int:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError:
        raise SystemExit(f"{name} must be an integer, got {raw!r}") from None


def env_prefix(agent_id: str) -> str:
    """hotel-booking -> HOTEL_BOOKING"""
    return "".join(c if c.isalnum() else "_" for c in agent_id).upper()


def load_agents() -> list[Agent]:
    """Reads TRAFFIC_AGENTS (comma-separated ids) and each agent's <PREFIX>_* settings."""
    agents = []
    for agent_id in [a.strip() for a in os.environ.get("TRAFFIC_AGENTS", DEFAULT_AGENTS).split(",") if a.strip()]:
        prefix = env_prefix(agent_id)
        url = os.environ.get(f"{prefix}_URL", "").strip().rstrip("/")
        key = os.environ.get(f"{prefix}_API_KEY", "").strip()
        provider = os.environ.get(f"{prefix}_PROVIDER", "").strip().lower()
        if not url or not key:
            log("agent_skipped", agent=agent_id, reason=f"{prefix}_URL or {prefix}_API_KEY not set")
            continue
        if provider not in PROVIDERS:
            log("agent_skipped", agent=agent_id, reason=f"{prefix}_PROVIDER must be one of {', '.join(PROVIDERS)}")
            continue
        models = [m.strip() for m in os.environ.get(f"{prefix}_MODELS", DEFAULT_MODELS[provider]).split(",") if m.strip()]
        header = os.environ.get(f"{prefix}_KEY_HEADER", "").strip() or DEFAULT_KEY_HEADER
        pool = AGENT_CONVERSATIONS.get(agent_id, GENERAL_CONVERSATIONS)
        agents.append(Agent(agent_id, provider, url, key, header, models, pool))
    return agents


# --- Request formats: each agent is called in its provider's native API ---


def build_request(agent: Agent, model: str, system: str, history: list[dict], max_tokens: int):
    """Returns (url, body) for one turn. history holds {"role": "user"|"assistant", "text": ...}."""
    if agent.provider == "openai":
        messages = [{"role": "system", "content": system}]
        messages += [{"role": m["role"], "content": m["text"]} for m in history]
        return f"{agent.base_url}/chat/completions", {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
        }
    if agent.provider == "anthropic":
        return f"{agent.base_url}/v1/messages", {
            "model": model,
            "system": system,
            "max_tokens": max_tokens,
            "messages": [{"role": m["role"], "content": m["text"]} for m in history],
        }
    # gemini: "assistant" is "model", and the system prompt has its own field.
    return f"{agent.base_url}/v1beta/models/{model}:generateContent", {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": [
            {"role": "model" if m["role"] == "assistant" else "user", "parts": [{"text": m["text"]}]} for m in history
        ],
        "generationConfig": {"maxOutputTokens": max_tokens},
    }


def parse_reply(agent: Agent, data: dict) -> tuple[str, dict]:
    """Returns (reply text, token usage) from a response in the agent's provider format."""
    if agent.provider == "openai":
        usage = data.get("usage") or {}
        text = data["choices"][0]["message"].get("content") or ""
        return text, {"input": usage.get("prompt_tokens"), "output": usage.get("completion_tokens")}
    if agent.provider == "anthropic":
        usage = data.get("usage") or {}
        text = "".join(block.get("text", "") for block in data.get("content", []) if block.get("type") == "text")
        return text, {"input": usage.get("input_tokens"), "output": usage.get("output_tokens")}
    usage = data.get("usageMetadata") or {}
    parts = data["candidates"][0].get("content", {}).get("parts", [])
    text = "".join(p.get("text", "") for p in parts)
    return text, {"input": usage.get("promptTokenCount"), "output": usage.get("candidatesTokenCount")}


def call(agent: Agent, url: str, body: dict, timeout: int) -> dict:
    headers = {"Content-Type": "application/json", agent.key_header: agent.api_key}
    if agent.provider == "anthropic":
        headers["anthropic-version"] = "2023-06-01"
    request = urllib.request.Request(url, data=json.dumps(body).encode(), headers=headers, method="POST")
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read())


def run_conversation(agent: Agent, conversation: dict, rng: random.Random, settings: dict) -> dict:
    model = rng.choice(agent.models)
    history: list[dict] = []
    totals = {"input": 0, "output": 0}
    for turn_number, user_text in enumerate(conversation["turns"], start=1):
        history.append({"role": "user", "text": user_text})
        url, body = build_request(agent, model, conversation["system"], history, settings["max_tokens"])
        started = time.monotonic()
        try:
            data = call(agent, url, body, settings["timeout"])
            reply, usage = parse_reply(agent, data)
        except urllib.error.HTTPError as exc:
            detail = exc.read()[:300].decode(errors="replace")
            log("call_failed", agent=agent.id, provider=agent.provider, model=model, conversation=conversation["id"],
                turn=turn_number, status=exc.code, detail=detail)
            return {"ok": False}
        except Exception as exc:  # noqa: BLE001 - network errors, timeouts, unexpected bodies
            log("call_failed", agent=agent.id, provider=agent.provider, model=model, conversation=conversation["id"],
                turn=turn_number, error=f"{type(exc).__name__}: {exc}")
            return {"ok": False}
        history.append({"role": "assistant", "text": reply})
        for k in totals:
            totals[k] += usage.get(k) or 0
        log("call_ok", agent=agent.id, provider=agent.provider, model=model, conversation=conversation["id"], turn=turn_number,
            latency_ms=int((time.monotonic() - started) * 1000), input_tokens=usage.get("input"),
            output_tokens=usage.get("output"))
    return {"ok": True, **totals}


def main() -> int:
    seed = os.environ.get("TRAFFIC_SEED", "").strip()
    rng = random.Random(seed or None)
    settings = {
        "min": env_int("TRAFFIC_MIN_PER_AGENT", 3),
        "max": env_int("TRAFFIC_MAX_PER_AGENT", 8),
        "pause_min": env_int("TRAFFIC_MIN_PAUSE_SECONDS", 5),
        "pause_max": env_int("TRAFFIC_MAX_PAUSE_SECONDS", 60),
        "max_tokens": env_int("TRAFFIC_MAX_TOKENS", 300),
        "timeout": env_int("TRAFFIC_TIMEOUT_SECONDS", 90),
        "start_jitter": env_int("TRAFFIC_START_JITTER_SECONDS", 0),
    }
    if not 0 <= settings["min"] <= settings["max"]:
        raise SystemExit("Need 0 <= TRAFFIC_MIN_PER_AGENT <= TRAFFIC_MAX_PER_AGENT")
    dry_run = os.environ.get("TRAFFIC_DRY_RUN", "").strip().lower() == "true"

    agents = load_agents()
    if not agents:
        log("nothing_to_do", reason="no agent has a URL, an API key and a provider")
        return 1

    # A random number of conversations per agent, each drawn from that agent's
    # own pool, all shuffled together so the agents interleave.
    plan = []
    for agent in agents:
        count = rng.randint(settings["min"], settings["max"])
        plan += [(agent, rng.choice(agent.conversations)) for _ in range(count)]
    rng.shuffle(plan)
    log("run_started", seed=seed or None, dry_run=dry_run, planned=len(plan),
        per_agent={a.id: sum(1 for b, _ in plan if b is a) for a in agents})

    # Start at a random point after the cron time, so the traffic doesn't land
    # at exactly the same minute every day.
    if settings["start_jitter"] > 0 and not dry_run:
        delay = rng.uniform(0, settings["start_jitter"])
        log("start_delayed", seconds=int(delay))
        time.sleep(delay)

    succeeded = failed = 0
    tokens = {"input": 0, "output": 0}
    for index, (agent, conversation) in enumerate(plan):
        if dry_run:
            log("planned", agent=agent.id, provider=agent.provider, conversation=conversation["id"],
                turns=len(conversation["turns"]))
            continue
        if index:
            time.sleep(rng.uniform(settings["pause_min"], settings["pause_max"]))
        result = run_conversation(agent, conversation, rng, settings)
        if result["ok"]:
            succeeded += 1
            tokens["input"] += result["input"]
            tokens["output"] += result["output"]
        else:
            failed += 1

    log("run_finished", conversations_ok=succeeded, conversations_failed=failed,
        input_tokens=tokens["input"], output_tokens=tokens["output"])
    return 1 if failed and not succeeded else 0


if __name__ == "__main__":
    sys.exit(main())
