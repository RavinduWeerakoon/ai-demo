import type { Metadata } from "next";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in · The Meridian Colombo",
};

export default function LoginPage() {
  return (
    <main className="hero-photo flex min-h-screen flex-1 items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-[400px] flex-col gap-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="text-[26px] font-bold tracking-[0.28em] text-[#f3f5fa]">THE MERIDIAN</span>
          <span className="text-[11px] font-bold tracking-[0.5em] text-ember">COLOMBO</span>
        </div>
        <LoginForm />
        <p className="text-center text-xs text-white/60">
          WSO2 Agent Manager demo. Sign-in is for the showcase only.
        </p>
      </div>
    </main>
  );
}
