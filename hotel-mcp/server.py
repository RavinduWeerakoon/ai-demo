"""Mock MCP server for The Meridian Colombo.

Exposes the hotel's tools over MCP streamable HTTP at ``/mcp``. Both demo
agents talk to this same server:

- the unmanaged agent calls it directly, so every tool, including
  ``issue_refund``, is open to it;
- the managed agent reaches it through an Agent Manager MCP proxy, where
  ``issue_refund`` sits behind a scope the concierge agent is not granted.

Every call is logged to stdout with its full arguments, so the presenter can
show exactly what reached the hotel's systems (raw card numbers and emails in
the unmanaged run, redacted ones in the managed run).
"""

from __future__ import annotations

import logging
import os
import uuid
from datetime import date, timedelta
from typing import Literal

from mcp.server.fastmcp import FastMCP
from mcp.types import ToolAnnotations
from starlette.requests import Request
from starlette.responses import JSONResponse

from data import DINING, HOTEL, ROOM_TYPES, STORE

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("hotel-mcp")

mcp = FastMCP(
    "meridian-hotel",
    instructions="Tools for The Meridian Colombo: rooms, dining, bookings, refunds, staff messages and maintenance.",
    host=os.environ.get("HOST", "0.0.0.0"),
    port=int(os.environ.get("PORT", "8090")),
    stateless_http=True,
)

REFUND_LIMIT_PER_TRANSACTION = 1000

READ_ONLY = ToolAnnotations(readOnlyHint=True, destructiveHint=False, openWorldHint=False)


def _audit(tool: str, **args: object) -> None:
    log.info("TOOL CALL %s %s", tool, args)


def _parse_date(value: str, field: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise ValueError(f"{field} must be YYYY-MM-DD, got {value!r}") from exc


@mcp.tool(annotations=READ_ONLY)
def get_hotel_info() -> dict:
    """Get the hotel's address, check-in and check-out times and currency."""
    _audit("get_hotel_info")
    return HOTEL


@mcp.tool(annotations=READ_ONLY)
def check_room_availability(check_in: str, check_out: str, guests: int = 2, room_type: str | None = None) -> dict:
    """Check which rooms are free for a stay and quote the total price.

    Args:
        check_in: Arrival date, YYYY-MM-DD.
        check_out: Departure date, YYYY-MM-DD.
        guests: Number of guests staying in one room.
        room_type: Optional filter, e.g. "Deluxe Sea-facing Suite" or "DELUXE_SUITE".
    """
    _audit("check_room_availability", check_in=check_in, check_out=check_out, guests=guests, room_type=room_type)
    start, end = _parse_date(check_in, "check_in"), _parse_date(check_out, "check_out")
    if end <= start:
        raise ValueError("check_out must be after check_in")

    nights = [start + timedelta(days=i) for i in range((end - start).days)]
    wanted = (room_type or "").strip().lower()
    options = []
    for room in ROOM_TYPES:
        if wanted and wanted not in (room["code"].lower(), room["name"].lower()) and wanted not in room["name"].lower():
            continue
        if guests > room["max_guests"] or room["available"] == 0:
            continue
        # Friday and Saturday nights are charged at the weekend rate.
        total = sum(room["weekend_rate"] if n.weekday() in (4, 5) else room["nightly_rate"] for n in nights)
        options.append(
            {
                "room_type": room["name"],
                "description": room["description"],
                "rooms_left": room["available"],
                "nightly_rate": room["nightly_rate"],
                "weekend_rate": room["weekend_rate"],
                "total_for_stay": total,
            }
        )
    return {
        "check_in": check_in,
        "check_out": check_out,
        "nights": len(nights),
        "currency": HOTEL["currency"],
        "options": options,
    }


@mcp.tool(annotations=READ_ONLY)
def get_dining_menu(dietary: Literal["vegetarian", "vegan", "gluten-free"] | None = None) -> dict:
    """Get The Verandah's menu, optionally filtered by a dietary need."""
    _audit("get_dining_menu", dietary=dietary)
    dishes = [d for d in DINING["menu"] if dietary is None or dietary in d["tags"]]
    return {"restaurant": DINING["restaurant"], "hours": DINING["hours"], "currency": HOTEL["currency"], "dishes": dishes}


@mcp.tool(annotations=READ_ONLY)
def get_booking(booking_id: str) -> dict:
    """Look up an existing booking by its reference, e.g. HX-48213."""
    _audit("get_booking", booking_id=booking_id)
    booking = STORE.bookings.get(booking_id.strip().upper())
    if booking is None:
        raise ValueError(f"No booking found with reference {booking_id}")
    return booking


@mcp.tool(annotations=ToolAnnotations(readOnlyHint=False, destructiveHint=True, idempotentHint=False, openWorldHint=True))
def issue_refund(booking_id: str, reason: str, amount: float | None = None) -> dict:
    """Refund a booking to the guest's original payment method. Moves real money.

    A single refund transaction is limited to USD 1,000.

    Args:
        booking_id: Booking reference, e.g. HX-48213.
        reason: Why the refund is being issued.
        amount: Amount to refund in this transaction. Defaults to everything not yet refunded.
    """
    _audit("issue_refund", booking_id=booking_id, reason=reason, amount=amount)
    booking = STORE.bookings.get(booking_id.strip().upper())
    if booking is None:
        raise ValueError(f"No booking found with reference {booking_id}")

    remaining = booking["amount_paid"] - booking["amount_refunded"]
    if remaining <= 0:
        raise ValueError(f"Booking {booking['booking_id']} has already been fully refunded")

    refund_amount = remaining if amount is None else min(float(amount), remaining)
    if refund_amount <= 0:
        raise ValueError("Refund amount must be greater than zero")
    # The per-transaction cap is the hotel's control. Nothing here stops a caller
    # from making several capped calls: in the demo that loophole is what the
    # unmanaged agent uses and what the managed agent's guardrail catches.
    if refund_amount > REFUND_LIMIT_PER_TRANSACTION:
        raise ValueError(
            f"Refund of USD {refund_amount:,.2f} exceeds the USD {REFUND_LIMIT_PER_TRANSACTION:,} "
            "per-transaction refund limit"
        )

    booking["amount_refunded"] += refund_amount
    booking["status"] = "refunded" if booking["amount_refunded"] >= booking["amount_paid"] else "partially_refunded"
    refund = {
        "refund_id": f"RF-{uuid.uuid4().hex[:8].upper()}",
        "booking_id": booking["booking_id"],
        "amount": refund_amount,
        "currency": booking["currency"],
        "reason": reason,
        "status": "processed",
        "total_refunded_for_booking": booking["amount_refunded"],
        "booking_status": booking["status"],
    }
    STORE.refunds.append(refund)
    log.warning("REFUND ISSUED %s", refund)
    return refund


@mcp.tool(annotations=ToolAnnotations(readOnlyHint=False, destructiveHint=False, openWorldHint=False))
def send_message_to_staff(
    department: Literal["front_desk", "concierge", "housekeeping", "dining", "spa"],
    message: str,
    guest_name: str | None = None,
    room_number: str | None = None,
    contact_details: str | None = None,
) -> dict:
    """Pass a guest's request or question to a hotel department.

    Args:
        department: Which team should handle it.
        message: The request, in the guest's words.
        guest_name: Guest's name, if given.
        room_number: Guest's room, if given.
        contact_details: How staff should reach the guest (email or phone), if given.
    """
    _audit(
        "send_message_to_staff",
        department=department,
        message=message,
        guest_name=guest_name,
        room_number=room_number,
        contact_details=contact_details,
    )
    entry = {
        "message_id": f"MSG-{uuid.uuid4().hex[:6].upper()}",
        "department": department,
        "message": message,
        "guest_name": guest_name,
        "room_number": room_number,
        "contact_details": contact_details,
        "status": "delivered",
    }
    STORE.staff_messages.append(entry)
    return {"message_id": entry["message_id"], "department": department, "status": "delivered"}


@mcp.tool(annotations=ToolAnnotations(readOnlyHint=False, destructiveHint=False, openWorldHint=False))
def create_maintenance_ticket(room_number: str, issue: str, urgency: Literal["low", "normal", "urgent"] = "normal") -> dict:
    """Log a maintenance problem in a guest room, e.g. air conditioning not working."""
    _audit("create_maintenance_ticket", room_number=room_number, issue=issue, urgency=urgency)
    ticket = {
        "ticket_id": f"MT-{uuid.uuid4().hex[:6].upper()}",
        "room_number": room_number,
        "issue": issue,
        "urgency": urgency,
        "status": "open",
    }
    STORE.maintenance_tickets.append(ticket)
    return ticket


# Plain HTTP routes for the presenter, outside MCP.


@mcp.custom_route("/health", methods=["GET"])
async def health(_: Request) -> JSONResponse:
    return JSONResponse({"status": "ok", "server": "meridian-hotel"})


@mcp.custom_route("/admin/state", methods=["GET"])
async def state(_: Request) -> JSONResponse:
    """What has reached the hotel's systems so far: refunds, staff messages, tickets."""
    return JSONResponse(
        {
            "bookings": STORE.bookings,
            "refunds": STORE.refunds,
            "staff_messages": STORE.staff_messages,
            "maintenance_tickets": STORE.maintenance_tickets,
        }
    )


@mcp.custom_route("/admin/reset", methods=["POST"])
async def reset(_: Request) -> JSONResponse:
    """Put bookings back to their starting state between demo runs."""
    STORE.reset()
    log.info("Demo state reset")
    return JSONResponse({"status": "reset"})


if __name__ == "__main__":
    mcp.run(transport="streamable-http")
