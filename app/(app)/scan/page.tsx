import { ScanLookupForm } from "./ScanLookupForm";

export default function ScanLookupPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">Scan lookup</h1>
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        Type or paste a scanned code to find the product, storage location, inventory unit (block/slab), or
        batch it matches.
      </p>
      <ScanLookupForm />
    </div>
  );
}
