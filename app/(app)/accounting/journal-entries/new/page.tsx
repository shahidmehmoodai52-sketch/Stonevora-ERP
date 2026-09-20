import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";
import { NewJournalEntryForm } from "./NewJournalEntryForm";

export default async function NewJournalEntryPage() {
  const tenant = await requireActiveTenant();
  const supabase = await createClient();

  const [{ data: branches }, { data: accounts }] = await Promise.all([
    supabase.from("branches").select("id, name").eq("tenant_id", tenant.tenantId).order("name"),
    supabase
      .from("chart_of_accounts")
      .select("id, code, name")
      .eq("tenant_id", tenant.tenantId)
      .eq("is_active", true)
      .order("code"),
  ]);

  return (
    <div className="max-w-3xl">
      <h1 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">New journal entry</h1>
      <NewJournalEntryForm branches={branches ?? []} accounts={accounts ?? []} />
    </div>
  );
}
