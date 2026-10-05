import Link from "next/link";

type Step = { label: string; href: string; done: boolean };

// The real fix for "the app has no sequence, too complicated to understand" --
// a brand-new tenant was previously dropped straight onto an empty Products
// list with zero guidance (see app/page.tsx / select-tenant's old redirect).
// This is the ordered, minimal path every business on this platform actually
// follows (set up where you operate, add what you sell, then buy and sell it)
// -- deliberately 5 steps, not a step per settings screen, so it stays
// scannable rather than becoming its own wall of text. Shown only until every
// step is done; a returning user who's already set up just sees their KPIs,
// not a permanent checklist competing for their attention.
export function GettingStarted({ steps }: { steps: Step[] }) {
  const allDone = steps.every((s) => s.done);
  if (allDone) return null;

  return (
    <div className="mb-8 rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="mb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Getting started</h2>
      <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
        Follow these in order to get your business running on Stonevora.
      </p>
      <ol className="flex flex-col gap-2">
        {steps.map((s, i) => (
          <li key={s.href} className="flex items-center gap-3 text-sm">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                s.done
                  ? "bg-emerald-600 text-white dark:bg-emerald-500"
                  : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
              }`}
            >
              {s.done ? "✓" : i + 1}
            </span>
            {s.done ? (
              <span className="text-zinc-500 line-through dark:text-zinc-500">{s.label}</span>
            ) : (
              <Link href={s.href} className="font-medium text-zinc-900 underline hover:no-underline dark:text-zinc-50">
                {s.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
