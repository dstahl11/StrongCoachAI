"use client";

import { useActionState } from "react";
import { Dumbbell, Loader2 } from "lucide-react";
import { login, type LoginState } from "@/app/login/actions";

export default function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    login,
    {},
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white">
            <Dumbbell size={24} />
          </div>
          <h1 className="mt-3 text-2xl font-bold">
            Strong<span className="text-brand-600">Coach</span>
          </h1>
          <p className="mt-1 text-sm text-muted">Sign in to your account</p>
        </div>

        <form
          action={formAction}
          className="space-y-3 rounded-2xl border border-line bg-card p-6 shadow-sm"
        >
          <input type="hidden" name="next" value={next} />
          <label className="block text-sm font-medium">
            Email
            <input
              name="email"
              type="email"
              autoComplete="email"
              autoFocus
              required
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </label>
          <label className="block text-sm font-medium">
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </label>

          {state.error && (
            <p className="rounded-lg bg-bad/10 px-3 py-2 text-sm text-bad">
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {pending && <Loader2 size={16} className="animate-spin" />}
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
