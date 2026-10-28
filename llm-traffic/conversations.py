"""Predefined conversations the traffic generator replays.

Each conversation is a system prompt plus the user's turns; the model's replies
are generated live and fed back, so every run is a real multi-turn exchange.
They vary in length on purpose, so token usage and cost differ per call.
"""

CONVERSATIONS: list[dict] = [
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
