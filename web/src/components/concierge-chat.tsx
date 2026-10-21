"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { Minus, RotateCcw, SendHorizontal, ShieldCheck, TriangleAlert } from "lucide-react";

import { sendChatMessage } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAgentMode, type AgentMode } from "@/components/agent-mode";
import { cn } from "@/lib/utils";

type ChatMessage = { id: string; role: "guest" | "concierge" | "error"; text: string };
type Conversation = { sessionId: string | null; messages: ChatMessage[] };

const GREETING =
  "Good afternoon and welcome to The Meridian Colombo. I can help with dining, rooms and existing bookings.";

// The demo scenarios: short chip labels, full guest messages.
const SUGGESTIONS = [
  { label: "Deluxe suites this weekend?", message: "Do you have any deluxe suites free this weekend?" },
  { label: "Refund for HX-48231", message: "I need to cancel booking HX-48231. Please refund the full amount." },
  {
    label: "AC not working, room 412",
    message: "The air conditioning isn't working in room 412. Can you get someone to fix it?",
  },
  {
    label: "Late checkout",
    message:
      "Please tell the front desk I need a late checkout tomorrow. I'm Amaya Fernando, room 412, my email is amaya@example.com and my card is 4111 1111 1111 1111.",
  },
] as const;

const emptyConversation = (): Conversation => ({ sessionId: null, messages: [] });

export function ConciergeChat() {
  const { mode } = useAgentMode();
  const [conversations, setConversations] = useState<Record<AgentMode, Conversation>>({
    unmanaged: emptyConversation(),
    managed: emptyConversation(),
  });
  const [draft, setDraft] = useState("");
  const [isPending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);

  const conversation = conversations[mode];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [conversation.messages.length, isPending]);

  function append(target: AgentMode, message: ChatMessage, sessionId?: string) {
    setConversations((prev) => ({
      ...prev,
      [target]: {
        sessionId: sessionId ?? prev[target].sessionId,
        messages: [...prev[target].messages, message],
      },
    }));
  }

  function send(text: string) {
    const message = text.trim();
    if (!message || isPending) return;

    // Pin the conversation to the agent that was live when the guest hit send,
    // even if the presenter flips the toggle while the reply is on its way.
    const target = mode;
    const sessionId = conversations[target].sessionId ?? crypto.randomUUID();
    append(target, { id: crypto.randomUUID(), role: "guest", text: message }, sessionId);
    setDraft("");

    startTransition(async () => {
      const result = await sendChatMessage({ mode: target, sessionId, message });
      if (result.ok) {
        append(target, { id: crypto.randomUUID(), role: "concierge", text: result.reply }, result.sessionId);
      } else {
        append(target, { id: crypto.randomUUID(), role: "error", text: result.error });
      }
    });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    send(draft);
  }

  function resetConversation() {
    setConversations((prev) => ({ ...prev, [mode]: emptyConversation() }));
  }

  return (
    <section
      aria-label="Meridian Concierge chat"
      className="flex h-[660px] w-full flex-col overflow-hidden rounded-2xl border border-chat-border bg-white text-chat-ink shadow-2xl shadow-black/30"
    >
      <header className="flex items-center gap-3.5 bg-navy px-5 py-4 text-white">
        <Avatar size="lg" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-base font-bold">Meridian Concierge</span>
          <span className="flex items-center gap-1.5 text-xs text-white/75">
            <span className="size-2 rounded-full bg-online" aria-hidden />
            Online · replies instantly
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon-lg"
          className="size-11 text-white/75 hover:bg-white/10 hover:text-white"
          aria-label="Start a new conversation"
          title="New conversation"
          onClick={resetConversation}
          disabled={isPending}
        >
          <RotateCcw />
        </Button>
        <Button
          variant="ghost"
          size="icon-lg"
          className="size-11 text-white/75 hover:bg-white/10 hover:text-white"
          aria-label="Minimise chat"
        >
          <Minus />
        </Button>
      </header>

      {mode === "managed" ? (
        <div className="flex items-center gap-2 border-b border-managed-soft-border bg-managed-soft px-5 py-2 text-xs font-semibold text-managed-ink">
          <ShieldCheck className="size-3.5" aria-hidden />
          Managed by WSO2 Agent Manager
        </div>
      ) : (
        <div className="flex items-center gap-2 border-b border-chat-border bg-chat-muted px-5 py-2 text-xs font-semibold text-chat-ink-muted">
          <TriangleAlert className="size-3.5 text-warning-ink" aria-hidden />
          Unmanaged agent · not governed
        </div>
      )}

      <div
        ref={scrollRef}
        className="flex flex-1 flex-col gap-3.5 overflow-y-auto bg-chat-surface p-5"
        aria-live="polite"
      >
        <ConciergeBubble text={GREETING} />
        {conversation.messages.map((m) =>
          m.role === "guest" ? (
            <div key={m.id} className="flex justify-end">
              <p className="max-w-[80%] rounded-[14px_14px_4px_14px] bg-navy px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap text-white">
                {m.text}
              </p>
            </div>
          ) : m.role === "concierge" ? (
            <ConciergeBubble key={m.id} text={m.text} />
          ) : (
            <p
              key={m.id}
              role="alert"
              className="self-center rounded-lg bg-error-soft px-3 py-2 text-center text-xs font-medium text-error-ink"
            >
              {m.text}
            </p>
          ),
        )}
        {isPending && <TypingBubble />}
      </div>

      <div className="flex flex-col gap-3 border-t border-chat-border px-4 pt-3.5 pb-4">
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <Button
              key={s.label}
              variant="outline"
              className="h-10 rounded-full border-chat-border bg-white px-3.5 text-[13px] font-medium text-chat-ink hover:bg-chat-muted"
              onClick={() => send(s.message)}
              disabled={isPending}
            >
              {s.label}
            </Button>
          ))}
        </div>
        <form onSubmit={onSubmit} className="flex items-center gap-2.5">
          <label htmlFor="chat-input" className="sr-only">
            Message
          </label>
          <Input
            id="chat-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type your message"
            autoComplete="off"
            maxLength={2000}
            className="h-11 flex-1 rounded-[10px] border-chat-border bg-white px-3.5 text-sm text-chat-ink placeholder:text-chat-ink-muted"
          />
          <Button
            type="submit"
            size="icon-lg"
            aria-label="Send message"
            className="size-12 rounded-full bg-navy text-white hover:bg-navy/90"
            disabled={isPending || !draft.trim()}
          >
            <SendHorizontal />
          </Button>
        </form>
      </div>
    </section>
  );
}

function Avatar({ size }: { size: "lg" | "sm" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex flex-none items-center justify-center rounded-full bg-ember font-extrabold text-navy",
        size === "lg" ? "size-11 text-lg" : "size-7 text-xs",
      )}
    >
      M
    </span>
  );
}

function ConciergeBubble({ text }: { text: string }) {
  return (
    <div className="flex items-end gap-2.5">
      <Avatar size="sm" />
      <p className="max-w-[80%] rounded-[14px_14px_14px_4px] border border-chat-bubble-border bg-white px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">
        {text}
      </p>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex items-end gap-2.5" aria-label="The concierge is typing">
      <Avatar size="sm" />
      <span className="flex gap-1 rounded-[14px_14px_14px_4px] border border-chat-bubble-border bg-white px-4 py-4">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="size-1.5 animate-bounce rounded-full bg-chat-ink-muted"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </span>
    </div>
  );
}
