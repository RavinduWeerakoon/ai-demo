import { LogOut } from "lucide-react";

import { signOut } from "@/app/login/actions";
import { CanvasEmbed } from "./canvas-embed";

const gutter = "px-4 sm:px-[5vw] xl:px-20";

export default function InsightsPage() {
  return (
    <div className="min-h-screen bg-navy text-[#e8ecf4]">
      <header className={`border-b border-navy-rule ${gutter}`}>
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 py-5">
          <div className="flex flex-col gap-2">
            <span className="text-[26px] font-bold tracking-[0.28em] text-[#f3f5fa]">THE MERIDIAN</span>
            <span className="text-[11px] font-bold tracking-[0.5em] text-ember">AI INSIGHTS</span>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="flex items-center gap-1.5 text-sm font-medium text-white/70 hover:text-ember"
              title="Sign out of the demo"
            >
              <LogOut className="size-4" aria-hidden />
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main className={`mx-auto flex max-w-[1440px] flex-col gap-6 py-10 ${gutter}`}>
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-extrabold tracking-tight text-white">AI cost and usage</h1>
          <p className="max-w-[720px] text-body-muted">
            What the hotel&apos;s agents spend on LLM calls through the WSO2 AI gateway, by model and over time.
            Data from Moesif.
          </p>
        </div>
        <CanvasEmbed />
      </main>
    </div>
  );
}
