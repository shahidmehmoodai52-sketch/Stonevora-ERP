import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./OnboardingForm";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h1 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Create your company
        </h1>
        <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
          This sets up a new tenant, fully isolated from every other company on
          Stonevora ERP, with you as its Owner.
        </p>
        <OnboardingForm />
      </div>
    </div>
  );
}
