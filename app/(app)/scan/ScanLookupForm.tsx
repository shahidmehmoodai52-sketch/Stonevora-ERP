"use client";

import { useActionState } from "react";
import { resolveScannedCodeAction, type ScannedMatch } from "@/actions/scanning";

type State = { error: string } | { matches: ScannedMatch[] } | null;

const MATCH_LABELS: Record<string, string> = {
  product: "Product",
  storage_location: "Storage location",
  inventory_unit: "Inventory unit (block/slab)",
  inventory_batch: "Inventory batch",
};

// A manual "type the code" lookup, not a camera scanner -- camera-based
// scanning is a separate, later pass this session can't verify the way it
// verifies SQL (see PHASES.md). This still exercises the exact same
// resolve_scanned_code RPC a real scanning screen would call.
export function ScanLookupForm() {
  const [state, formAction, pending] = useActionState<State, FormData>(
    async (_prev, formData) => resolveScannedCodeAction(formData),
    null
  );

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex items-end gap-2">
        <label className="flex flex-col gap-1 text-sm">
          Code
          <input name="code" required autoFocus className="input w-64" placeholder="Barcode, SKU, unit code, batch #..." />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {pending ? "Looking up…" : "Look up"}
        </button>
      </form>

      {state && "error" in state && <p className="text-sm text-red-600">{state.error}</p>}

      {state && "matches" in state && state.matches.length === 0 && (
        <p className="text-sm text-zinc-500">No match found.</p>
      )}

      {state && "matches" in state && state.matches.length > 0 && (
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
                <th className="py-2 pr-2">Type</th>
                <th className="py-2 pr-2">Label</th>
                <th className="py-2">Detail</th>
              </tr>
            </thead>
            <tbody>
              {state.matches.map((m) => (
                <tr key={`${m.match_type}-${m.id}`} className="border-b border-zinc-100 dark:border-zinc-900">
                  <td className="py-2 pr-2">{MATCH_LABELS[m.match_type] ?? m.match_type}</td>
                  <td className="py-2 pr-2 font-medium text-zinc-900 dark:text-zinc-50">{m.label}</td>
                  <td className="py-2">{m.secondary ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
