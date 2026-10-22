import { LogOut } from "lucide-react";

import { signOut } from "@/app/login/actions";
import { AgentManagerLogo } from "@/components/agent-manager-logo";
import { CanvasEmbed } from "./canvas-embed";

export default function InsightsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-paper backdrop-blur-md">
        <div className="flex h-[72px] items-center justify-between gap-4 px-4 sm:px-8">
          <div className="flex items-center gap-4">
            <AgentManagerLogo className="h-6 w-auto text-black" />
            <span className="hidden h-6 w-px bg-line-strong sm:block" aria-hidden />
            <span className="hidden text-sm font-medium text-ink-muted sm:block">Agent Insights</span>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="flex items-center gap-2 rounded-full border border-line-strong px-4 py-1.5 text-sm text-ink transition-colors hover:border-brand hover:text-brand"
              title="Sign out of the demo"
            >
              <LogOut className="size-4" aria-hidden />
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-8 px-4 py-10 sm:px-8 lg:px-12">
        <div className="flex flex-col gap-2">
          <h1 className="text-[34px] leading-tight font-normal text-ink">LLM Cost &amp; Usage</h1>
          <p className="max-w-[760px] text-[15px] text-ink-muted">
            What your agents spend on LLM calls through the AI gateway, by model, agent and day. Data from Moesif.
          </p>
        </div>
        <CanvasEmbed />
      </main>

      <footer className="border-t border-line bg-paper px-4 py-4 text-sm text-ink-muted backdrop-blur-md sm:px-8">
        © 2026 WSO2 LLC.
      </footer>
    </div>
  );
}
