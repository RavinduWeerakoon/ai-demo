"""The Meridian Concierge: a LangGraph ReAct agent over the hotel MCP server.

The same code runs in both demo deployments; only configuration differs.

- Unmanaged: calls OpenAI directly and the hotel MCP server directly, so every
  tool the server exposes, including ``issue_refund``, is usable.
- Managed: ``USE_LLM_PROVIDER=true`` routes LLM calls through the Agent Manager
  LLM provider (where the prompt decorator and PII masking run), and
  ``HOTEL_MCP_URL`` points at the Agent Manager MCP proxy, reached with an
  AgentID token (``MCP_OAUTH=true``) whose scopes leave out
  ``create_maintenance_ticket``.

The prompt deliberately does not forbid refunds or tell the agent to hide
personal data: stopping those is the platform's job in this demo, not the
prompt's.
"""

from __future__ import annotations

import logging
import re
from datetime import date, timedelta
from typing import Any

import httpx
from langchain_core.messages import SystemMessage
from langchain_core.tools import ToolException
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.prebuilt import ToolNode, create_react_agent

from agent_identity import AgentIdentityAuth
from config import Config

log = logging.getLogger("concierge")

SYSTEM_PROMPT_TEMPLATE = (
    "You are the Meridian Concierge, the virtual concierge on the website of {hotel_name}, "
    "a restored 1920s hotel on Galle Road with 64 rooms and suites and The Verandah, an all-day "
    "dining room.\n\n"
    "Today is {today}. When a guest says \"this weekend\", they mean Friday {friday} to "
    "Sunday {sunday}.\n\n"
    "WHAT YOU CAN DO, using your tools:\n"
    "- Rooms and rates: check availability and quote prices for a stay\n"
    "- Dining: share The Verandah's menu, including dietary options\n"
    "- Existing bookings: look up a booking by its reference (for example HX-48213)\n"
    "- Refunds: refund a guest's booking when they ask for one\n"
    "- Staff requests: pass a guest's question or request to the right hotel team\n"
    "- Maintenance: log a problem in a guest's room\n\n"
    "HOW YOU WORK:\n"
    "1. Always use a tool for facts. Never invent rates, availability, dishes or booking details.\n"
    "2. When a guest asks for a refund, look up the booking, then process the refund and confirm "
    "the amount and the refund reference.\n"
    "3. When a guest wants something from the staff, send it to the right team with the guest's "
    "name, room number and contact details exactly as they gave them, then confirm back what "
    "you sent.\n"
    "4. If a tool you need is not available to you, is not permitted, or fails, do not retry it. "
    "Tell the guest plainly that you cannot do that yourself and offer to pass the request to "
    "the front desk instead.\n"
    "5. Keep replies warm and short: two to four sentences, plain text, no tables."
)


def _weekend(today: date) -> tuple[date, date]:
    friday = today + timedelta(days=(4 - today.weekday()) % 7)
    return friday, friday + timedelta(days=2)


def _prompt(cfg: Config):
    # A callable prompt so "today" and "this weekend" stay correct on a
    # long-running pod instead of freezing at startup.
    def build(state: dict[str, Any]) -> list[Any]:
        today = date.today()
        friday, sunday = _weekend(today)
        system = SYSTEM_PROMPT_TEMPLATE.format(
            hotel_name=cfg.hotel_name,
            today=today.strftime("%A %d %B %Y"),
            friday=friday.isoformat(),
            sunday=sunday.isoformat(),
        )
        return [SystemMessage(content=system), *state["messages"]]

    return build


async def load_mcp_tools(cfg: Config) -> list[Any]:
    """Discover the hotel tools from the MCP server or the Agent Manager MCP proxy.

    Auth, in order of precedence:
    - ``MCP_OAUTH=true``: AgentID bearer token scoped to the proxy URL;
    - ``HOTEL_MCP_API_KEY`` set: sent as ``X-API-Key``, the MCP proxy default;
    - neither: no auth, for the unmanaged agent talking to the server directly.
    """
    from langchain_mcp_adapters.client import MultiServerMCPClient

    connection: dict[str, Any] = {"url": cfg.mcp_url, "transport": "streamable_http"}
    if cfg.mcp_oauth:
        if not cfg.agentid_ready:
            # Provisioning finishes shortly after deploy and rolls the pod; until
            # then report no tools so the caller retries on the next request.
            log.warning("MCP_OAUTH is true but AMP_AGENTID_* is not set yet; no MCP tools loaded")
            return []
        connection["auth"] = AgentIdentityAuth(cfg, resource=cfg.mcp_url)
    elif cfg.mcp_api_key:
        connection["headers"] = {"X-API-Key": cfg.mcp_api_key}

    client = MultiServerMCPClient({"hotel": connection})
    return [_with_clear_errors(tool) for tool in await client.get_tools()]


def _http_status_error(exc: BaseException) -> httpx.HTTPStatusError | None:
    """Find the HTTP error inside the MCP client's task-group wrapper, if any."""
    if isinstance(exc, httpx.HTTPStatusError):
        return exc
    if isinstance(exc, BaseExceptionGroup):
        for sub in exc.exceptions:
            found = _http_status_error(sub)
            if found is not None:
                return found
    if exc.__cause__ is not None:
        return _http_status_error(exc.__cause__)
    return None


def describe_tool_failure(exc: BaseException) -> str:
    """A readable reason for a failed tool call.

    The MCP client runs each request in an anyio task group, so an HTTP error
    from the proxy (a 403 for a tool outside this agent's AgentID scopes)
    arrives wrapped as "unhandled errors in a TaskGroup (1 sub-exception)".
    Unwrap it so the model, the logs and the trace see the real status.
    """
    http = _http_status_error(exc)
    if http is None:
        return str(exc)
    status = http.response.status_code
    challenge = http.response.headers.get("www-authenticate", "")
    scope = re.search(r'scope="([^"]+)"', challenge)
    needs = f" ({scope.group(1)})" if scope else ""
    if status == 403:
        return (
            "HTTP 403 Forbidden: the MCP proxy refused this tool call; this agent is not "
            f"granted the scope it needs{needs}"
        )
    if status == 401:
        return "HTTP 401 Unauthorized: the MCP proxy rejected this agent's credentials"
    return f"HTTP {status} {http.response.reason_phrase} from the MCP server"


class ToolCallRefused(Exception):
    """A tool call the MCP proxy or server refused at the transport level.

    Deliberately not a ``ToolException``: the MCP adapter gives every tool a
    ``handle_tool_error`` hook that turns a ``ToolException`` into ordinary tool
    output, so the tool run would finish "successfully" and the trace would show
    the refused call as green. This type escapes that hook, so the tool span is
    marked as an error with the readable reason, and ``ToolNode`` still hands
    the reason to the model through ``_tool_error``.
    """


def _with_clear_errors(tool: Any) -> Any:
    """Re-raise transport failures with the real reason instead of the task-group wrapper."""
    call = tool.coroutine

    async def guarded(*args: Any, **kwargs: Any) -> Any:
        try:
            return await call(*args, **kwargs)
        except ToolException:
            # The MCP server reported an error result (e.g. unknown booking):
            # keep the adapter's handling, which returns it to the model as output.
            raise
        except Exception as exc:  # noqa: BLE001 - ExceptionGroup and HTTP errors alike
            raise ToolCallRefused(describe_tool_failure(exc)) from exc

    tool.coroutine = guarded
    return tool


def _tool_error(exc: Exception) -> str:
    # A tool the MCP proxy refuses (403 for a missing scope) surfaces here as an
    # exception. Hand it back to the model as the tool result so the agent can
    # explain and offer the front desk, instead of failing the whole chat turn.
    reason = describe_tool_failure(exc)
    log.warning("tool call failed: %s", reason)
    return f"Tool error: {reason}. This action is not available to you; tell the guest and offer the front desk."


def build_llm(cfg: Config) -> ChatOpenAI:
    if cfg.use_llm_provider:
        return ChatOpenAI(
            model=cfg.model,
            temperature=0,
            base_url=cfg.llm_provider_url,
            api_key="not-used",
            default_headers={"API-Key": cfg.llm_provider_key, "Authorization": ""},
        )
    return ChatOpenAI(model=cfg.model, temperature=0)


def build_agent(cfg: Config, tools: list[Any], checkpointer: InMemorySaver) -> Any:
    return create_react_agent(
        model=build_llm(cfg),
        tools=ToolNode(tools, handle_tool_errors=_tool_error),
        prompt=_prompt(cfg),
        checkpointer=checkpointer,
    )
