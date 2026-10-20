"""Entrypoint for the Meridian Concierge agent: ``python main.py`` (also the AM build's run command)."""

from __future__ import annotations

import os

import uvicorn

from app import app


def main() -> None:
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "8000")))


if __name__ == "__main__":
    main()
