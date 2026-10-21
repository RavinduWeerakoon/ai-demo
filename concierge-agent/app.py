from __future__ import annotations

import asyncio
import logging
import uuid
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from langgraph.checkpoint.memory import InMemorySaver
from pydantic import BaseModel

from agent import build_agent, guardrail_intervention, load_mcp_tools
from config import Config

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("concierge")

CONFIG = Config.from_env()


class Runtime:
    """Builds the agent on first use and keeps retrying until MCP tools load.

    The MCP server may start after the agent, and with MCP_OAUTH the AgentID
    credential lands a little after deploy, so tool discovery is retried on
    each request instead of crashing at startup.
    """

    def __init__(self, cfg: Config) -> None:
        self.cfg = cfg
        self.tools: list[Any] = []
        self.agent: Any = None
        # Shared across rebuilds so conversations survive a tool reload.
        self.checkpointer = InMemorySaver()
        self._lock = asyncio.Lock()

    async def get(self) -> Any:
        if self.agent is not None:
            return self.agent
        async with self._lock:
            if self.agent is None:
                try:
                    self.tools = await load_mcp_tools(self.cfg)
                except Exception as exc:  # noqa: BLE001
                    log.warning("could not load MCP tools from %s: %s", self.cfg.mcp_url, exc)
                    self.tools = []
                if not self.tools:
                    raise HTTPException(status_code=503, detail="Hotel tools are not reachable yet; try again shortly")
                self.agent = build_agent(self.cfg, self.tools, self.checkpointer)
                log.info(
                    "concierge ready (label=%s, llm=%s, mcp=%s, tools=%s)",
                    self.cfg.agent_label,
                    "agent-manager" if self.cfg.use_llm_provider else "openai-direct",
                    self.cfg.mcp_url,
                    [t.name for t in self.tools],
                )
        return self.agent


RUNTIME = Runtime(CONFIG)


class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None
    context: dict[str, Any] | None = None


class ChatResponse(BaseModel):
    response: str
    session_id: str | None = None
    agent_version: str | None = None
    agent_label: str | None = None
    tools_used: list[str] = []
    # Set when an Agent Manager guardrail blocked this turn, e.g. "REGEX_GUARDRAIL".
    guardrail: str | None = None


app = FastAPI(title="Meridian Concierge Agent", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CONFIG.cors_allow_origins,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "agent_label": CONFIG.agent_label,
        "agent_version": CONFIG.agent_version,
        "llm_route": "agent-manager" if CONFIG.use_llm_provider else "openai-direct",
        "mcp_url": CONFIG.mcp_url,
        "mcp_auth": "oauth" if CONFIG.mcp_oauth else ("api-key" if CONFIG.mcp_api_key else "none"),
        "mcp_tools": [t.name for t in RUNTIME.tools],
    }


@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest) -> ChatResponse:
    session_id = req.session_id or str(uuid.uuid4())
    agent = await RUNTIME.get()

    run_config = {"configurable": {"thread_id": session_id}}
    try:
        result = await agent.ainvoke({"messages": [HumanMessage(content=req.message)]}, config=run_config)
    except Exception as exc:  # noqa: BLE001
        guardrail = guardrail_intervention(exc)
        if guardrail is None:
            log.exception("agent invocation failed")
            raise HTTPException(status_code=500, detail=str(exc)) from exc
        return await _hand_off(agent, run_config, session_id, req.message, guardrail)

    messages = result.get("messages", [])
    # Tool calls made in this turn only: everything after the latest human message.
    last_human = max((i for i, m in enumerate(messages) if isinstance(m, HumanMessage)), default=-1)
    tools_used = [m.name for m in messages[last_human + 1 :] if isinstance(m, ToolMessage) and m.name]

    final: Any = next((m.content for m in reversed(messages) if isinstance(m, AIMessage)), "(no response)")
    if isinstance(final, list):
        final = "\n".join(p.get("text", "") if isinstance(p, dict) else str(p) for p in final)

    return ChatResponse(
        response=str(final),
        session_id=session_id,
        agent_version=CONFIG.agent_version,
        agent_label=CONFIG.agent_label,
        tools_used=tools_used,
    )


HAND_OFF_REPLY = (
    "I'm not able to complete that request myself, so I've passed it to our front desk team. "
    "They will review it and get back to you shortly."
)


async def _hand_off(agent: Any, run_config: dict, session_id: str, message: str, guardrail: str) -> ChatResponse:
    """A guardrail blocked the model: tell the guest and route the request to staff.

    The tool call the model was about to make never runs, because the gateway
    refused the LLM response that contained it. Staff get the guest's request
    through the same MCP tool the agent would use.
    """
    log.warning("guardrail %s intervened (session=%s); handing off to front desk", guardrail, session_id)
    tools_used: list[str] = []
    staff_tool = next((t for t in RUNTIME.tools if t.name == "send_message_to_staff"), None)
    if staff_tool is not None:
        try:
            await staff_tool.ainvoke(
                {
                    "department": "front_desk",
                    "message": f"Concierge request stopped by policy ({guardrail}); needs staff review. Guest said: {message}",
                }
            )
            tools_used.append(staff_tool.name)
        except Exception as exc:  # noqa: BLE001
            log.warning("hand-off to staff failed: %s", exc)

    # Record the reply in the conversation so the next turn has context.
    try:
        await agent.aupdate_state(run_config, {"messages": [AIMessage(content=HAND_OFF_REPLY)]}, as_node="agent")
    except Exception as exc:  # noqa: BLE001
        log.warning("could not record hand-off in session state: %s", exc)

    return ChatResponse(
        response=HAND_OFF_REPLY,
        session_id=session_id,
        agent_version=CONFIG.agent_version,
        agent_label=CONFIG.agent_label,
        tools_used=tools_used,
        guardrail=guardrail,
    )
