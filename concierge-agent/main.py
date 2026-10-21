"""Entrypoint for the Meridian Concierge agent: ``python main.py`` (also the AM build's run command)."""

from __future__ import annotations

import os

import uvicorn

from app import app


def main() -> None:
    # AGENT_PORT, not PORT: the Agent Manager buildpack image sets PORT=8080,
    # while its Chat Agent interface serves and probes port 8000.
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("AGENT_PORT", "8000")))


if __name__ == "__main__":
    main()
