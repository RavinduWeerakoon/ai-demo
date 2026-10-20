from __future__ import annotations

import os
from dataclasses import dataclass


def _env(name: str, default: str | None = None) -> str:
    val = os.environ.get(name, default)
    if val is None:
        raise RuntimeError(f"Missing required env var: {name}")
    return val


def _flag(name: str) -> bool:
    return _env(name, "false").strip().lower() == "true"


@dataclass(frozen=True)
class Config:
    hotel_name: str
    agent_label: str
    agent_version: str
    model: str
    use_llm_provider: bool
    llm_provider_url: str
    llm_provider_key: str
    mcp_url: str
    mcp_api_key: str
    mcp_oauth: bool
    agentid_client_id: str
    agentid_client_secret: str
    agentid_token_endpoint: str
    agentid_scopes: str
    cors_allow_origins: list[str]

    @property
    def agentid_ready(self) -> bool:
        return bool(self.agentid_client_id and self.agentid_client_secret and self.agentid_token_endpoint)

    @classmethod
    def from_env(cls) -> "Config":
        use_llm_provider = _flag("USE_LLM_PROVIDER")
        llm_provider_url = _env("LLM_PROVIDER_URL", "")
        llm_provider_key = _env("LLM_PROVIDER_KEY", "")
        if use_llm_provider:
            if not llm_provider_url:
                raise RuntimeError("USE_LLM_PROVIDER is true but LLM_PROVIDER_URL is not set")
            if not llm_provider_key:
                raise RuntimeError("USE_LLM_PROVIDER is true but LLM_PROVIDER_KEY is not set")
        elif not os.environ.get("OPENAI_API_KEY"):
            raise RuntimeError("Set OPENAI_API_KEY, or USE_LLM_PROVIDER=true with LLM_PROVIDER_URL/KEY")

        # The hotel MCP server. Unmanaged: the server itself
        # (http://localhost:8090/mcp). Managed: the Agent Manager MCP proxy URL,
        # injected under these names when the proxy is attached to the agent.
        mcp_url = _env("HOTEL_MCP_URL", "http://localhost:8090/mcp")
        mcp_api_key = _env("HOTEL_MCP_API_KEY", "")

        # MCP_OAUTH=true reaches the proxy with an AgentID bearer token instead of
        # an API key. This is what makes per-tool scopes apply: the token only
        # carries the scopes granted to this agent, so issue_refund is refused.
        mcp_oauth = _flag("MCP_OAUTH")

        origins = [o.strip() for o in _env("CORS_ALLOW_ORIGINS", "*").split(",") if o.strip()]

        return cls(
            hotel_name=_env("HOTEL_NAME", "The Meridian Colombo"),
            # Free-form name echoed in /health and every chat response, so the demo
            # site can show which deployment answered ("managed" / "unmanaged").
            agent_label=_env("AGENT_LABEL", "concierge"),
            agent_version=_env("AGENT_VERSION", "dev"),
            model=_env("LLM_MODEL", "gpt-4o-mini"),
            use_llm_provider=use_llm_provider,
            llm_provider_url=llm_provider_url,
            llm_provider_key=llm_provider_key,
            mcp_url=mcp_url,
            mcp_api_key=mcp_api_key,
            mcp_oauth=mcp_oauth,
            agentid_client_id=_env("AMP_AGENTID_CLIENT_ID", ""),
            agentid_client_secret=_env("AMP_AGENTID_CLIENT_SECRET", ""),
            agentid_token_endpoint=_env("AMP_AGENTID_TOKEN_ENDPOINT", ""),
            agentid_scopes=_env("AMP_AGENTID_SCOPES", ""),
            cors_allow_origins=origins,
        )
