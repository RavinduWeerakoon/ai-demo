#!/usr/bin/env python3
"""Turn a Moesif "Export for Canvas" file into the dashboard template this app serves.

    python3 scripts/build-template.py ~/Downloads/canvas_ai_dashboard.json [output.json]

The export carries each chart's query. Canvas-only presentation is added here,
so a fresh export never loses it, and it works with anyone's Moesif dashboard:

- Single-number charts (no Group By, one metric) become KPI cards in the top
  row, cost totals first. A cost metric (a field containing "llmCost") gets a $ prefix, 4 decimals
  and a trend arrow where up is red; any other gets compact notation (12.3k)
  and a trend arrow where up is green.
- Every other chart follows, two to a row, in the order set in
  dashboard-layout.json ("order"; charts it does not name come last).
  Charts listed in "wide" take two thirds of their row.
- Tooltips come from "tooltips", keyed by chart name.
- Moesif's placeholder metric names ("Metric a") become readable labels from
  "metricLabels", keyed by the end of the field name.
- An "LLM proxy" filter (by proxy name) is added to the toolbar. Moesif
  only knows each call's proxy, not the agent behind it, so the filter says so.
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LAYOUT = ROOT / "dashboard-layout.json"
OUT = ROOT / "src/app/canvas-template.json"

AGENT_FILTER = {
    "id": "agent",
    "label": "LLM proxy",
    "field": "metadata.apiName.raw",
    "op": "contains",
    "type": "autocomplete",
    "multi": True,
    "default": None,
}
PLACEHOLDER_NAME = re.compile(r"^Metric [a-z]$")


def is_kpi(card: dict) -> bool:
    settings = card.get("settings", {})
    return (
        card.get("analyticType") == "seg"
        and not settings.get("groups")
        and len(settings.get("metrics", [])) == 1
    )


def kpi_format(card: dict) -> dict:
    metric = card["settings"]["metrics"][0]
    if "llmcost" in metric.get("field", "").lower():
        number = {"unit": "$", "prefixedUnits": True, "decimals": 4, "trendIndicator": {"isIncreasementGreen": False}}
    else:
        number = {"abbreviate": True, "decimals": 0, "trendIndicator": {"isIncreasementGreen": True}}
    return {"chartHeight": 80, "hideLabel": True, **number}


def url_encode(text: str) -> str:
    return text.replace(" ", "%20").replace("(", "%28").replace(")", "%29")


def relabel_metrics(card: dict, labels: dict) -> None:
    for metric in card["settings"].get("metrics", []):
        old = metric.get("customName", "")
        if not PLACEHOLDER_NAME.match(old):
            continue
        field_end = metric.get("field", "").rsplit(".", 1)[-1]
        new = labels.get(field_end)
        if new:
            metric["customName"] = new
            card["urlQuery"] = card["urlQuery"].replace(
                f"customName]={url_encode(old)}", f"customName]={url_encode(new)}"
            )


def main() -> None:
    if len(sys.argv) not in (2, 3):
        sys.exit(__doc__)
    out = Path(sys.argv[2]).resolve() if len(sys.argv) == 3 else OUT
    template = json.loads(Path(sys.argv[1]).expanduser().read_text())
    layout = json.loads(LAYOUT.read_text())
    if len(template.get("dashboards", [])) != 1:
        sys.exit("Expected an export of exactly one Moesif dashboard.")
    cards = template["workspaces"]
    if not cards:
        sys.exit("The export has no charts.")

    # Cost totals first, then cost averages, then counts.
    kpis = sorted(
        (c for c in cards if is_kpi(c)),
        key=lambda c: (
            "llmcost" not in c["settings"]["metrics"][0].get("field", "").lower(),
            "avg" in c["settings"]["metrics"][0].get("func", ""),
        ),
    )
    rank = {name: i for i, name in enumerate(layout.get("order", []))}
    others = sorted(
        (c for c in cards if not is_kpi(c)),
        key=lambda c: rank.get(c["name"], len(rank)),  # stable: unlisted keep export order
    )

    rows = []
    if kpis:
        rows.append([c["_id"] for c in kpis])
    for i in range(0, len(others), 2):
        rows.append([c["_id"] for c in others[i : i + 2]])

    dashboard = template["dashboards"][0]
    dashboard["name"] = layout.get("title", dashboard["name"])
    dashboard["workspace_ids"] = rows
    dashboard["dashboard_ids"] = []
    dashboard["filters"] = {"editable": [AGENT_FILTER]}

    wide = set(layout.get("wide", []))
    tooltips = layout.get("tooltips", {})
    for card in cards:
        card["width"] = 2 if card["name"] in wide and not is_kpi(card) else 1
        card["height"] = 1
        if card["name"] in tooltips:
            card["tooltip"] = tooltips[card["name"]]
        if is_kpi(card):
            card["settings"]["groups"] = []
            card["settings"]["singleValueSettings"] = kpi_format(card)
        relabel_metrics(card, layout.get("metricLabels", {}))

    out.write_text(json.dumps(template, indent=2) + "\n")
    print(f"Wrote {out}: {len(kpis)} KPI cards, {len(others)} charts.")
    for row in rows:
        print("  row:", ", ".join(next(c["name"] for c in cards if c["_id"] == cid) for cid in row))
    unnamed = [c["name"] for c in cards if c["name"] not in tooltips]
    if unnamed:
        print("  no tooltip for:", ", ".join(unnamed), "(add them to dashboard-layout.json if you like)")


if __name__ == "__main__":
    main()
