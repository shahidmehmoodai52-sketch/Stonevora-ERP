import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";
import { parsePage, pageRange } from "@/lib/pagination";
import { Pagination } from "@/components/Pagination";

export default async function JournalEntriesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const tenant = await requireActiveTenant();
  const supabase = await createClient();
  const page = parsePage(await searchParams);
  const [from, to] = pageRange(page);

  const { data: entries, count } = await supabase
    .from("journal_entries")
    .select("id, entry_date, reference_type, description, reverses_entry_id", { count: "exact" })
    .eq("tenant_id", tenant.tenantId)
    .order("entry_date", { ascending: false })
    .range(from, to);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Journal entries</h1>
        <Link href="/accounting/journal-entries/new" className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
          New entry
        </Link>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
              <th className="py-2 pr-2">Date</th>
              <th className="py-2 pr-2">Reference</th>
              <th className="py-2">Description</th>
            </tr>
          </thead>
          <tbody>
            {(entries ?? []).map((e) => (
              <tr key={e.id} className="border-b border-zinc-100 dark:border-zinc-900">
                <td className="py-2 pr-2">
                  <Link href={`/accounting/journal-entries/${e.id}`} className="font-medium text-zinc-900 hover:underline dark:text-zinc-50">
                    {e.entry_date}
                  </Link>
                </td>
                <td className="py-2 pr-2">{e.reference_type}{e.reverses_entry_id ? " (reversal)" : ""}</td>
                <td className="py-2">{e.description ?? "—"}</td>
              </tr>
            ))}
            {(entries ?? []).length === 0 && (
              <tr>
                <td colSpan={3} className="py-4 text-zinc-500">No journal entries yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination currentPage={page} totalCount={count ?? 0} basePath="/accounting/journal-entries" />
    </div>
  );
}
