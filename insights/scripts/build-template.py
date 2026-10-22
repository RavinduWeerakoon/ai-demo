#!/usr/bin/env python3
"""Turn a Moesif "Export for Canvas" file into the dashboard template this app serves.

    python3 scripts/build-template.py ~/Downloads/canvas_ai_dashboard.json

The export carries each chart's query. Canvas-only settings are added here so a
fresh export never loses them: the grid layout, tooltips, KPI number formatting
($, decimals, trend arrows), the Agent filter, and metric labels. Cards are
matched by their Moesif id, which stays the same when a chart is edited. A chart
that is new to this script still appears, in its own row at the bottom, with
Moesif's own formatting; add it to the tables below to place and format it.
"""

import json
import sys
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "src/app/canvas-template.json"

TOTAL_COST = "6ad9b1b74d991b5f3e566144"
AVG_COST = "6ad9b81e1c70fd45e7280865"
REQUESTS = "6ad9b87be8a5be38822e2e60"
SPEND_PIE = "6ad9b9d61c70fd45e728086e"
MODEL_AFFINITY = "6ad8a13e1c70fd45e728026f"
DAILY_COST = "6ad89faa4d991b5f3e565c0a"
COST_BY_MODEL = "6ad8a03e4d991b5f3e565c0e"
AVG_DAILY = "6ad8a0d1e8a5be38822e2912"
TOKENS = "6ad8a1aee8a5be38822e2922"

# Rows of the grid, top to bottom. Within a row, "width" is each card's share.
ROWS = [
    [TOTAL_COST, AVG_COST, REQUESTS],
    [SPEND_PIE, MODEL_AFFINITY],
    [DAILY_COST, COST_BY_MODEL],
    [AVG_DAILY, TOKENS],
]
WIDTH = {DAILY_COST: 2, TOKENS: 2}

TOOLTIPS = {
    TOTAL_COST: "What every LLM call through the AI gateway cost in the selected period.",
    AVG_COST: "Average cost of a single LLM call.",
    REQUESTS: "LLM calls made through the AI gateway.",
    SPEND_PIE: "Share of the spend that went to each model.",
    MODEL_AFFINITY: "Share of LLM calls that went to each model.",
    DAILY_COST: "Total LLM spend per day.",
    COST_BY_MODEL: "Spend per model, highest first.",
    AVG_DAILY: "Average cost of one call per day, for the five most expensive models.",
    TOKENS: "Prompt and completion tokens sent through the gateway per day.",
}

# Single-number cards. Trend arrows compare with the previous period; for cost,
# going up is shown red.
KPI = {
    TOTAL_COST: {"unit": "$", "prefixedUnits": True, "decimals": 4, "trendIndicator": {"isIncreasementGreen": False}},
    AVG_COST: {"unit": "$", "prefixedUnits": True, "decimals": 4, "trendIndicator": {"isIncreasementGreen": False}},
    REQUESTS: {"abbreviate": True, "decimals": 0, "trendIndicator": {"isIncreasementGreen": True}},
}

# Metric labels to replace (Moesif's default names read badly in a legend).
RENAME = {SPEND_PIE: {"Metric a": "Cost (USD)"}}

AGENT_FILTER = {
    "id": "agent",
    "label": "Agent",
    "field": "metadata.apiName.raw",
    "op": "contains",
    "type": "autocomplete",
    "multi": True,
    "default": None,
}


def url_encode(text: str) -> str:
    return text.replace(" ", "%20").replace("(", "%28").replace(")", "%29")


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    template = json.loads(Path(sys.argv[1]).expanduser().read_text())
    if len(template.get("dashboards", [])) != 1:
        sys.exit("Expected an export of exactly one dashboard.")
    cards = {card["_id"]: card for card in template["workspaces"]}

    rows = [[cid for cid in row if cid in cards] for row in ROWS]
    placed = {cid for row in rows for cid in row}
    new_cards = [cid for cid in cards if cid not in placed]
    rows = [row for row in rows if row] + ([new_cards] if new_cards else [])
    for cid in sorted(set(sum(ROWS, [])) - set(cards)):
        print(f"note: {cid} is no longer in the export; left out")
    for cid in new_cards:
        print(f"note: new chart {cards[cid]['name']!r} ({cid}) added in a row of its own")

    dashboard = template["dashboards"][0]
    dashboard["name"] = "AI Cost & Usage"
    dashboard["workspace_ids"] = rows
    dashboard["filters"] = {"editable": [AGENT_FILTER]}

    for cid, card in cards.items():
        card["width"] = WIDTH.get(cid, 1)
        card["height"] = 1
        if cid in TOOLTIPS:
            card["tooltip"] = TOOLTIPS[cid]
        if cid in KPI:
            card["settings"]["groups"] = []
            card["settings"]["singleValueSettings"] = {"chartHeight": 80, "hideLabel": True, **KPI[cid]}
        for old, new in RENAME.get(cid, {}).items():
            for metric in card["settings"].get("metrics", []):
                if metric.get("customName") == old:
                    metric["customName"] = new
            card["urlQuery"] = card["urlQuery"].replace(f"customName]={url_encode(old)}", f"customName]={url_encode(new)}")

    OUT.write_text(json.dumps(template, indent=2) + "\n")
    print(f"wrote {OUT.relative_to(Path.cwd()) if OUT.is_relative_to(Path.cwd()) else OUT} ({len(cards)} charts)")


if __name__ == "__main__":
    main()
