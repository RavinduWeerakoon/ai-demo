import type { Metadata } from "next";

import { AgentManagerLogo } from "@/components/agent-manager-logo";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in · Agent Insights",
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-1 items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-[400px] flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-3">
          <AgentManagerLogo className="h-8 w-auto text-black" />
          <span className="text-sm font-medium text-ink-muted">Agent Insights</span>
        </div>
        <LoginForm />
        <p className="text-center text-xs text-ink-muted">WSO2 Agent Manager demo. Sign-in is for the showcase only.</p>
      </div>
    </main>
  );
}
