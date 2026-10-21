"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

export type AgentMode = "unmanaged" | "managed";

type AgentModeContext = { mode: AgentMode; setMode: (mode: AgentMode) => void };

const Context = createContext<AgentModeContext | null>(null);

/** Which concierge the chat talks to. Shared by the banner toggle and the chat. */
export function AgentModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<AgentMode>("unmanaged");
  return <Context value={{ mode, setMode }}>{children}</Context>;
}

export function useAgentMode(): AgentModeContext {
  const value = useContext(Context);
  if (!value) throw new Error("useAgentMode must be used inside AgentModeProvider");
  return value;
}
