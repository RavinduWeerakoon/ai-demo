"""Predefined conversations the traffic generator replays.

Each conversation is a system prompt plus the user's turns; the model's replies
are generated live and fed back, so every run is a real multi-turn exchange.
They vary in length on purpose, so token usage and cost differ per call.

AGENT_CONVERSATIONS holds the conversations that fit each demo agent, keyed by
the agent id used in TRAFFIC_AGENTS. An agent with no entry of its own draws
from GENERAL_CONVERSATIONS.
"""

GENERAL_CONVERSATIONS: list[dict] = [
    {
        "id": "hotel-weekend-stay",
        "system": "You are a concise concierge for The Meridian Colombo, a heritage hotel on Galle Road.",
        "turns": [
            "We're arriving Friday evening for two nights. What should we not miss nearby?",
            "Which of those are walkable from the hotel?",
        ],
    },
    {
        "id": "hotel-dietary",
        "system": "You are a helpful restaurant host at The Verandah, an all-day Sri Lankan dining room.",
        "turns": [
            "I'm vegan and allergic to cashews. What Sri Lankan dishes usually work for me?",
        ],
    },
    {
        "id": "refund-policy-email",
        "system": "You write short, polite customer-service emails for a hotel.",
        "turns": [
            "Draft a reply to a guest asking for a refund on a non-refundable rate because of a flight cancellation.",
            "Make it warmer and offer a 20% credit for a future stay instead.",
        ],
    },
    {
        "id": "travel-itinerary",
        "system": "You are a travel planner. Keep answers under 150 words.",
        "turns": [
            "Plan a 3-day trip from Colombo covering Galle and a tea plantation.",
            "Swap the tea plantation for a whale-watching trip.",
            "What should I pack?",
        ],
    },
    {
        "id": "code-review",
        "system": "You are a senior Python reviewer. Be specific and brief.",
        "turns": [
            "Review this function:\n\ndef avg(xs):\n    return sum(xs) / len(xs)",
            "Rewrite it so it handles an empty list and non-numeric values.",
        ],
    },
    {
        "id": "sql-help",
        "system": "You help analysts write SQL for PostgreSQL.",
        "turns": [
            "Write a query for total revenue per month from a bookings(id, amount, created_at) table.",
            "Now only include months where revenue grew compared to the previous month.",
        ],
    },
    {
        "id": "meeting-summary",
        "system": "You summarise meeting notes into decisions and action items.",
        "turns": [
            "Notes: We agreed to launch the loyalty program in March. Priya owns the email campaign. "
            "Budget is capped at 40k. Open question: whether suites get double points. Daniel to check with finance by Friday.",
        ],
    },
    {
        "id": "product-description",
        "system": "You are a marketing copywriter for a boutique hotel.",
        "turns": [
            "Write a 60-word description of a sea-facing suite with a deep-soak tub and butler service.",
            "Give me three headline options for it.",
        ],
    },
    {
        "id": "explain-concept",
        "system": "You explain technical ideas to non-technical hotel managers.",
        "turns": [
            "What is an AI agent, and how is it different from a chatbot?",
            "Why would a hotel want guardrails on one?",
        ],
    },
    {
        "id": "translation",
        "system": "You translate hospitality messages accurately and naturally.",
        "turns": [
            "Translate into Sinhala and Tamil: 'Breakfast is served from 6:30 to 10:30 on the verandah.'",
        ],
    },
    {
        "id": "complaint-triage",
        "system": "You classify guest complaints by department and urgency. Answer as a short list.",
        "turns": [
            "1) The AC in 412 is dripping. 2) Room service was 40 minutes late. "
            "3) The Wi-Fi password at reception is wrong. 4) There's a strange smell in the corridor on floor 3.",
        ],
    },
    {
        "id": "data-extraction",
        "system": "Extract structured data. Reply with JSON only.",
        "turns": [
            "Extract guest name, dates and room type: 'Hi, this is Anil Perera, booking a Deluxe Room from 14 to 17 November for two adults.'",
        ],
    },
]


AGENT_CONVERSATIONS: dict[str, list[dict]] = {
    "hotel-booking": [
        {
            "id": "booking-weekend-suite",
            "system": "You are the booking assistant for The Meridian Colombo. Be concise and confirm details.",
            "turns": [
                "Do you have a sea-facing suite for two adults from Friday to Sunday?",
                "What's included in the rate, and can we check in early?",
            ],
        },
        {
            "id": "booking-change-dates",
            "system": "You are the booking assistant for The Meridian Colombo. Be concise and confirm details.",
            "turns": [
                "I need to move booking HX-48214 to start two days later. Same room type.",
                "Will the price change?",
            ],
        },
        {
            "id": "booking-family",
            "system": "You are the booking assistant for The Meridian Colombo. Be concise and confirm details.",
            "turns": [
                "We're a family of four with two kids under 10. Which rooms fit us for 3 nights in December?",
            ],
        },
        {
            "id": "booking-cancellation-policy",
            "system": "You are the booking assistant for The Meridian Colombo. Be concise and confirm details.",
            "turns": [
                "What's your cancellation policy for the Heritage Suite?",
                "If I cancel 5 days before arrival, how much do I get back on a 1,620 USD booking?",
            ],
        },
        {
            "id": "booking-airport-transfer",
            "system": "You are the booking assistant for The Meridian Colombo. Be concise and confirm details.",
            "turns": [
                "Can you add an airport pickup to my booking? We land at 11:40 pm on the 14th.",
            ],
        },
    ],
    "leave-assistant": [
        {
            "id": "leave-annual-request",
            "system": "You are an HR leave assistant for hotel staff. Be clear about balances and next steps.",
            "turns": [
                "I'd like to take annual leave from the 22nd to the 26th of December.",
                "How many days will that use, given the 25th is a public holiday?",
            ],
        },
        {
            "id": "leave-sick-day",
            "system": "You are an HR leave assistant for hotel staff. Be clear about balances and next steps.",
            "turns": [
                "I'm sick today and can't make my morning shift at the front desk. What do I need to do?",
            ],
        },
        {
            "id": "leave-balance",
            "system": "You are an HR leave assistant for hotel staff. Be clear about balances and next steps.",
            "turns": [
                "How is annual leave usually accrued for full-time staff, and can unused days carry over?",
                "Summarise that as three bullet points I can share with my team.",
            ],
        },
        {
            "id": "leave-shift-swap",
            "system": "You are an HR leave assistant for hotel staff. Be clear about balances and next steps.",
            "turns": [
                "Can I swap my Saturday night shift with a colleague instead of taking leave? What approvals are needed?",
            ],
        },
        {
            "id": "leave-parental",
            "system": "You are an HR leave assistant for hotel staff. Be clear about balances and next steps.",
            "turns": [
                "My partner is due in March. What should I know about planning parental leave?",
                "Draft a short email to my manager letting them know early.",
            ],
        },
    ],
    "room-service": [
        {
            "id": "room-service-dinner",
            "system": "You are the in-room dining assistant at The Meridian Colombo. Take orders and confirm them.",
            "turns": [
                "Can I order dinner to room 412? Something vegetarian and not too spicy.",
                "Add a mango lassi and a watalappan for dessert.",
            ],
        },
        {
            "id": "room-service-breakfast",
            "system": "You are the in-room dining assistant at The Meridian Colombo. Take orders and confirm them.",
            "turns": [
                "I'd like breakfast delivered to room 305 at 7:15 tomorrow: string hoppers, dhal and black coffee.",
            ],
        },
        {
            "id": "room-service-allergy",
            "system": "You are the in-room dining assistant at The Meridian Colombo. Take orders and confirm them.",
            "turns": [
                "I have a severe peanut allergy. Which dishes on the late-night menu are safe?",
                "Please order the safest one to room 108 and flag the allergy to the kitchen.",
            ],
        },
        {
            "id": "room-service-amenities",
            "system": "You are the in-room dining assistant at The Meridian Colombo. Take orders and confirm them.",
            "turns": [
                "Could you send extra towels, two pillows and a kettle to room 501?",
            ],
        },
        {
            "id": "room-service-celebration",
            "system": "You are the in-room dining assistant at The Meridian Colombo. Take orders and confirm them.",
            "turns": [
                "It's our anniversary. Can you arrange a cake and a bottle of sparkling wine in the room by 8 pm?",
                "What would that cost in total?",
            ],
        },
    ],
}
