"""Daily LLM traffic for the Agent Manager demo.

Replays a random set of predefined conversations against the OpenAI, Anthropic
and Gemini providers registered in WSO2 Agent Manager, through each provider's
gateway proxy URL, so the analytics (cost per call, spend by model, model
affinity, daily tokens) have fresh data every day.

Configuration is all environment variables; see README.md. A provider takes
part when both its URL and API key are set. Exits non-zero only if every call
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

from conversations import CONVERSATIONS

DEFAULT_KEY_HEADER = "X-API-Key"
DEFAULT_MODELS = {
    "openai": "gpt-4o-mini",
    "anthropic": "claude-haiku-4-5",
    "gemini": "gemini-2.5-flash",
}


@dataclass(frozen=True)
class Provider:
    name: str  # openai | anthropic | gemini: also selects the request format
    base_url: str  # the provider's proxy URL in Agent Manager, without the API path
    api_key: str
    key_header: str
    models: list[str]


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


def load_providers() -> list[Provider]:
    providers = []
    for name in ("openai", "anthropic", "gemini"):
        prefix = name.upper()
        url = os.environ.get(f"{prefix}_URL", "").strip().rstrip("/")
        key = os.environ.get(f"{prefix}_API_KEY", "").strip()
        if not url or not key:
            log("provider_skipped", provider=name, reason=f"{prefix}_URL or {prefix}_API_KEY not set")
            continue
        models = [m.strip() for m in os.environ.get(f"{prefix}_MODELS", DEFAULT_MODELS[name]).split(",") if m.strip()]
        header = os.environ.get(f"{prefix}_KEY_HEADER", "").strip() or DEFAULT_KEY_HEADER
        providers.append(Provider(name, url, key, header, models))
    return providers


# --- Request formats: each provider keeps its native API behind the gateway ---


def build_request(provider: Provider, model: str, system: str, history: list[dict], max_tokens: int):
    """Returns (url, body) for one turn. history holds {"role": "user"|"assistant", "text": ...}."""
    if provider.name == "openai":
        messages = [{"role": "system", "content": system}]
        messages += [{"role": m["role"], "content": m["text"]} for m in history]
        return f"{provider.base_url}/chat/completions", {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
        }
    if provider.name == "anthropic":
        return f"{provider.base_url}/v1/messages", {
            "model": model,
            "system": system,
            "max_tokens": max_tokens,
            "messages": [{"role": m["role"], "content": m["text"]} for m in history],
        }
    # gemini: "assistant" is "model", and the system prompt has its own field.
    return f"{provider.base_url}/v1beta/models/{model}:generateContent", {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": [
            {"role": "model" if m["role"] == "assistant" else "user", "parts": [{"text": m["text"]}]} for m in history
        ],
        "generationConfig": {"maxOutputTokens": max_tokens},
    }


def parse_reply(provider: Provider, data: dict) -> tuple[str, dict]:
    """Returns (reply text, token usage) from a provider response."""
    if provider.name == "openai":
        usage = data.get("usage") or {}
        text = data["choices"][0]["message"].get("content") or ""
        return text, {"input": usage.get("prompt_tokens"), "output": usage.get("completion_tokens")}
    if provider.name == "anthropic":
        usage = data.get("usage") or {}
        text = "".join(block.get("text", "") for block in data.get("content", []) if block.get("type") == "text")
        return text, {"input": usage.get("input_tokens"), "output": usage.get("output_tokens")}
    usage = data.get("usageMetadata") or {}
    parts = data["candidates"][0].get("content", {}).get("parts", [])
    text = "".join(p.get("text", "") for p in parts)
    return text, {"input": usage.get("promptTokenCount"), "output": usage.get("candidatesTokenCount")}


def call(provider: Provider, url: str, body: dict, timeout: int) -> dict:
    headers = {"Content-Type": "application/json", provider.key_header: provider.api_key}
    if provider.name == "anthropic":
        headers["anthropic-version"] = "2023-06-01"
    request = urllib.request.Request(url, data=json.dumps(body).encode(), headers=headers, method="POST")
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read())


def run_conversation(provider: Provider, conversation: dict, rng: random.Random, settings: dict) -> dict:
    model = rng.choice(provider.models)
    history: list[dict] = []
    totals = {"input": 0, "output": 0}
    for turn_number, user_text in enumerate(conversation["turns"], start=1):
        history.append({"role": "user", "text": user_text})
        url, body = build_request(provider, model, conversation["system"], history, settings["max_tokens"])
        started = time.monotonic()
        try:
            data = call(provider, url, body, settings["timeout"])
            reply, usage = parse_reply(provider, data)
        except urllib.error.HTTPError as exc:
            detail = exc.read()[:300].decode(errors="replace")
            log("call_failed", provider=provider.name, model=model, conversation=conversation["id"],
                turn=turn_number, status=exc.code, detail=detail)
            return {"ok": False}
        except Exception as exc:  # noqa: BLE001 - network errors, timeouts, unexpected bodies
            log("call_failed", provider=provider.name, model=model, conversation=conversation["id"],
                turn=turn_number, error=f"{type(exc).__name__}: {exc}")
            return {"ok": False}
        history.append({"role": "assistant", "text": reply})
        for k in totals:
            totals[k] += usage.get(k) or 0
        log("call_ok", provider=provider.name, model=model, conversation=conversation["id"], turn=turn_number,
            latency_ms=int((time.monotonic() - started) * 1000), input_tokens=usage.get("input"),
            output_tokens=usage.get("output"))
    return {"ok": True, **totals}


def main() -> int:
    seed = os.environ.get("TRAFFIC_SEED", "").strip()
    rng = random.Random(seed or None)
    settings = {
        "min": env_int("TRAFFIC_MIN_PER_PROVIDER", 3),
        "max": env_int("TRAFFIC_MAX_PER_PROVIDER", 8),
        "pause_min": env_int("TRAFFIC_MIN_PAUSE_SECONDS", 5),
        "pause_max": env_int("TRAFFIC_MAX_PAUSE_SECONDS", 60),
        "max_tokens": env_int("TRAFFIC_MAX_TOKENS", 300),
        "timeout": env_int("TRAFFIC_TIMEOUT_SECONDS", 90),
        "start_jitter": env_int("TRAFFIC_START_JITTER_SECONDS", 0),
    }
    if not 0 <= settings["min"] <= settings["max"]:
        raise SystemExit("Need 0 <= TRAFFIC_MIN_PER_PROVIDER <= TRAFFIC_MAX_PER_PROVIDER")
    dry_run = os.environ.get("TRAFFIC_DRY_RUN", "").strip().lower() == "true"

    providers = load_providers()
    if not providers:
        log("nothing_to_do", reason="no provider has both a URL and an API key")
        return 1

    # A random number of conversations per provider, all shuffled together so
    # the providers interleave instead of running back to back.
    plan = []
    for provider in providers:
        count = rng.randint(settings["min"], settings["max"])
        plan += [(provider, rng.choice(CONVERSATIONS)) for _ in range(count)]
    rng.shuffle(plan)
    log("run_started", seed=seed or None, dry_run=dry_run, planned=len(plan),
        per_provider={p.name: sum(1 for q, _ in plan if q is p) for p in providers})

    # Start at a random point after the cron time, so the traffic doesn't land
    # at exactly the same minute every day.
    if settings["start_jitter"] > 0 and not dry_run:
        delay = rng.uniform(0, settings["start_jitter"])
        log("start_delayed", seconds=int(delay))
        time.sleep(delay)

    succeeded = failed = 0
    tokens = {"input": 0, "output": 0}
    for index, (provider, conversation) in enumerate(plan):
        if dry_run:
            log("planned", provider=provider.name, conversation=conversation["id"], turns=len(conversation["turns"]))
            continue
        if index:
            time.sleep(rng.uniform(settings["pause_min"], settings["pause_max"]))
        result = run_conversation(provider, conversation, rng, settings)
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
