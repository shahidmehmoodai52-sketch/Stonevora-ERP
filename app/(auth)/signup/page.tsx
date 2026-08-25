"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUpAction, type ActionResult } from "@/actions/auth";

const initialState: ActionResult | null = null;

export default function SignUpPage() {
  const [state, formAction, pending] = useActionState(
    async (_prevState: ActionResult | null, formData: FormData) => signUpAction(formData),
    initialState
  );

  if (state && "success" in state) {
    return (
      <p className="text-sm text-zinc-700 dark:text-zinc-300">
        Check your email to confirm your account, then{" "}
        <Link href="/login" className="font-medium text-zinc-900 dark:text-zinc-50">
          sign in
        </Link>
        .
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="fullName" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Full name
        </label>
        <input
          id="fullName"
          name="fullName"
          type="text"
          required
          className="input"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="input"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={6}
          className="input"
        />
      </div>
      {state && "error" in state && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? "Creating account…" : "Sign up"}
      </button>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-zinc-900 dark:text-zinc-50">
          Sign in
        </Link>
      </p>
    </form>
  );
}
