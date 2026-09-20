// Shared server-side pagination helpers -- every transactional list screen
// (products, orders, invoices, blocks, ...) uses the same page size and the
// same ?page= query param shape, so behavior stays identical across the app
// instead of each screen inventing its own convention.
export const PAGE_SIZE = 25;

export function parsePage(searchParams: { page?: string } | undefined): number {
  const raw = Number(searchParams?.page);
  return Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 1;
}

export function pageRange(page: number, pageSize: number = PAGE_SIZE): [number, number] {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  return [from, to];
}
