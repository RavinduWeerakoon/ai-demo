"use client";

import { ShieldCheck, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAgentMode } from "@/components/agent-mode";

/** The strip above the site header: which agent is live, and the switch. */
export function ModeBanner() {
  const { mode, setMode } = useAgentMode();

  if (mode === "managed") {
    return (
      <div className="bg-managed text-white">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-[5vw] xl:px-20">
          <div className="flex flex-wrap items-center gap-3">
            <ShieldCheck className="size-5" aria-hidden />
            <span className="text-[15px] font-bold">Managed by WSO2 Agent Manager</span>
            <span className="text-sm text-white/90">
              Guardrails on · Tool access by policy · Every conversation traced
            </span>
          </div>
          <Button
            variant="outline"
            className="h-11 rounded-full border-white bg-transparent px-5 text-white hover:bg-white/10 hover:text-white"
            onClick={() => setMode("unmanaged")}
          >
            Switch to unmanaged agent
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-white/10 bg-unmanaged text-white">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-[5vw] xl:px-20">
        <div className="flex flex-wrap items-center gap-3">
          <TriangleAlert className="size-5 text-warning" aria-hidden />
          <span className="text-[15px] font-bold">Unmanaged agent</span>
          <span className="text-sm text-white/75">No guardrails · Direct tool and LLM access · No tracing</span>
        </div>
        <Button
          className="h-11 rounded-full bg-white px-5 text-navy hover:bg-white/90"
          onClick={() => setMode("managed")}
        >
          Switch to managed agent
        </Button>
      </div>
    </div>
  );
}
