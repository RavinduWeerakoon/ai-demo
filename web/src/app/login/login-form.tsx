"use client";

import { useActionState } from "react";
import { LogIn } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signIn, type SignInState } from "./actions";

const initialState: SignInState = { error: null };

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(signIn, initialState);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-5 rounded-2xl border border-chat-border bg-white p-7 text-chat-ink shadow-2xl shadow-black/40"
    >
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">Sign in</h1>
        <p className="text-sm text-chat-ink-muted">Use the demo account to open the site.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="username" className="text-sm font-semibold">
          Username
        </label>
        <Input
          id="username"
          name="username"
          autoComplete="username"
          required
          autoFocus
          className="h-11 rounded-[10px] border-chat-border bg-white px-3.5 text-sm text-chat-ink"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-semibold">
          Password
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="h-11 rounded-[10px] border-chat-border bg-white px-3.5 text-sm text-chat-ink"
        />
      </div>

      {state.error && (
        <p role="alert" className="rounded-lg bg-error-soft px-3 py-2 text-sm font-medium text-error-ink">
          {state.error}
        </p>
      )}

      <Button
        type="submit"
        disabled={isPending}
        className="h-12 rounded-full bg-ember text-[15px] font-bold text-navy hover:bg-ember/90"
      >
        <LogIn aria-hidden />
        {isPending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
