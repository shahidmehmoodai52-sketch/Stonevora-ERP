"use client";

import { useActionState } from "react";
import { createTenantAction } from "@/actions/tenants";

type State = { error: string } | null;

export function OnboardingForm() {
  const [state, formAction, pending] = useActionState(
    async (_prevState: State, formData: FormData) => {
      const result = await createTenantAction(formData);
      return result ?? null;
    },
    null
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Company name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          placeholder="e.g. Al-Noor Marble & Granite"
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
        {pending ? "Creating…" : "Create company"}
      </button>
    </form>
  );
}
