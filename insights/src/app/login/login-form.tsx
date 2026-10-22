"use client";

import { useActionState } from "react";
import { LogIn } from "lucide-react";

import { signIn, type SignInState } from "./actions";

const initialState: SignInState = { error: null };

const inputClass =
  "h-11 rounded-[10px] border border-line bg-white px-3.5 text-sm text-ink outline-none focus-visible:border-ember focus-visible:ring-2 focus-visible:ring-ember/30";

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(signIn, initialState);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-5 rounded-2xl border border-line bg-white p-7 text-ink shadow-2xl shadow-black/40"
    >
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">Sign in</h1>
        <p className="text-sm text-ink-muted">Use the demo account to open the dashboard.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="username" className="text-sm font-semibold">
          Username
        </label>
        <input id="username" name="username" autoComplete="username" required autoFocus className={inputClass} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-semibold">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={inputClass}
        />
      </div>

      {state.error && (
        <p role="alert" className="rounded-lg bg-error-soft px-3 py-2 text-sm font-medium text-error-ink">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="flex h-12 items-center justify-center gap-2 rounded-full bg-ember text-[15px] font-bold text-navy hover:bg-ember/90 disabled:opacity-60"
      >
        <LogIn className="size-4" aria-hidden />
        {isPending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
