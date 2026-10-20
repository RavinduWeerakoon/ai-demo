"""Mock data for The Meridian Colombo.

Everything lives in memory and resets when the server restarts, so every demo
run starts from the same state (booking HX-48213 is always refundable).
"""

from __future__ import annotations

import copy

HOTEL = {
    "name": "The Meridian Colombo",
    "address": "Galle Road, Colombo 03, Sri Lanka",
    "check_in_time": "14:00",
    "check_out_time": "12:00",
    "currency": "USD",
}

ROOM_TYPES = [
    {
        "code": "CLASSIC",
        "name": "Classic Room",
        "description": "Garden-facing room in the original 1920s wing, queen bed.",
        "max_guests": 2,
        "nightly_rate": 140,
        "weekend_rate": 165,
        "available": 9,
    },
    {
        "code": "DELUXE",
        "name": "Deluxe Room",
        "description": "Larger room with a writing desk and a balcony over the courtyard.",
        "max_guests": 3,
        "nightly_rate": 190,
        "weekend_rate": 220,
        "available": 5,
    },
    {
        "code": "DELUXE_SUITE",
        "name": "Deluxe Sea-facing Suite",
        "description": "Separate lounge, sea view, deep-soak tub and butler service.",
        "max_guests": 3,
        "nightly_rate": 320,
        "weekend_rate": 365,
        "available": 2,
    },
    {
        "code": "HERITAGE_SUITE",
        "name": "Heritage Suite",
        "description": "The former merchant's quarters: two rooms, private verandah.",
        "max_guests": 4,
        "nightly_rate": 480,
        "weekend_rate": 540,
        "available": 1,
    },
]

DINING = {
    "restaurant": "The Verandah",
    "hours": "06:30 to 23:00, every day",
    "menu": [
        {"dish": "Jackfruit curry with red rice", "price": 14, "tags": ["vegetarian", "vegan", "gluten-free"]},
        {"dish": "String hoppers with dhal and pol sambol", "price": 11, "tags": ["vegetarian", "vegan"]},
        {"dish": "Lentil kottu roti", "price": 13, "tags": ["vegetarian"]},
        {"dish": "Paneer and cashew curry", "price": 15, "tags": ["vegetarian", "gluten-free"]},
        {"dish": "Devilled prawns", "price": 22, "tags": ["gluten-free"]},
        {"dish": "Negombo crab curry", "price": 34, "tags": ["gluten-free"]},
        {"dish": "Chicken lamprais", "price": 19, "tags": []},
        {"dish": "Watalappan (coconut custard)", "price": 8, "tags": ["vegetarian", "gluten-free"]},
    ],
}

_BOOKINGS = {
    "HX-48213": {
        "booking_id": "HX-48213",
        "guest_name": "Amaya Fernando",
        "room_type": "Deluxe Sea-facing Suite",
        "room_number": "412",
        "check_in": "2026-10-09",
        "check_out": "2026-10-11",
        "amount_paid": 730,
        "currency": "USD",
        "status": "confirmed",
    },
    "HX-48214": {
        "booking_id": "HX-48214",
        "guest_name": "Daniel Weber",
        "room_type": "Classic Room",
        "room_number": "108",
        "check_in": "2026-10-12",
        "check_out": "2026-10-15",
        "amount_paid": 420,
        "currency": "USD",
        "status": "confirmed",
    },
    "HX-48230": {
        "booking_id": "HX-48230",
        "guest_name": "Priya Raman",
        "room_type": "Deluxe Room",
        "room_number": "305",
        "check_in": "2026-10-18",
        "check_out": "2026-10-20",
        "amount_paid": 440,
        "currency": "USD",
        "status": "checked_out",
    },
}


class Store:
    """Mutable demo state: bookings, refunds, staff messages and tickets."""

    def __init__(self) -> None:
        self.reset()

    def reset(self) -> None:
        self.bookings = copy.deepcopy(_BOOKINGS)
        self.refunds: list[dict] = []
        self.staff_messages: list[dict] = []
        self.maintenance_tickets: list[dict] = []


STORE = Store()
