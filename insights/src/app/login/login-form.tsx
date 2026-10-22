"use client";

import { useActionState } from "react";
import { LogIn } from "lucide-react";

import { signIn, type SignInState } from "./actions";

const initialState: SignInState = { error: null };

const inputClass =
  "h-11 rounded-lg border border-line-strong bg-white px-3.5 text-sm text-ink outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25";

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(signIn, initialState);

  return (
    <form
      action={formAction}
      className="flex w-full flex-col gap-5 rounded-xl border border-line bg-paper p-7 text-ink shadow-lg shadow-black/5 backdrop-blur-md"
    >
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Sign in</h1>
        <p className="text-sm text-ink-muted">Use the demo account to open the dashboard.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="username" className="text-sm font-medium">
          Username
        </label>
        <input id="username" name="username" autoComplete="username" required autoFocus className={inputClass} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium">
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
        className="flex h-11 items-center justify-center gap-2 rounded-full bg-brand text-[15px] font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
      >
        <LogIn className="size-4" aria-hidden />
        {isPending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
