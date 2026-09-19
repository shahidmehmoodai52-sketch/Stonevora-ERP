"use client";

import { useState } from "react";

type PoLine = {
  id: string;
  productId: string;
  productLabel: string;
  uomId: string;
  outstanding: number;
  unitCost: number;
  trackingMode: "simple" | "batch" | "unit";
};

type Location = { id: string; path: string | null; code: string };
type Uom = { id: string; code: string };

type BlockRow = {
  unitCode: string;
  dimensionLength: string;
  dimensionWidth: string;
  dimensionHeight: string;
  dimensionUomId: string;
  volumeUomId: string;
  unitWeight: string;
  unitWeightUomId: string;
  quarrySource: string;
  unitQualityGrade: string;
  locationId: string;
  unitCost: string;
};

function emptyBlockRow(poLine: PoLine, dimensionUoms: Uom[], volumeUoms: Uom[], weightUoms: Uom[]): BlockRow {
  return {
    unitCode: "",
    dimensionLength: "",
    dimensionWidth: "",
    dimensionHeight: "",
    dimensionUomId: dimensionUoms[0]?.id ?? "",
    volumeUomId: volumeUoms[0]?.id ?? "",
    unitWeight: "",
    unitWeightUomId: weightUoms[0]?.id ?? "",
    quarrySource: "",
    unitQualityGrade: "",
    locationId: "",
    unitCost: String(poLine.unitCost),
  };
}

// Simple/batch products still map 1 PO line -> 1 GRN line (unchanged from
// before block intake existed). A unit-tracked (block) PO line is
// different: its "quantity" is a block COUNT, and post_goods_receipt
// requires exactly one GRN line per physical block (quantity = 1 each,
// its own dimensions/cost) -- so it gets its own addable/removable list of
// block rows instead of a single input row. Every row across both groups
// still serializes into one flat, globally-indexed `lines[i][...]` array,
// which is all the server-side parser (actions/purchasing.ts's
// parseGrnLines) actually cares about.
export function GrnLineItemsEditor({
  poLines,
  locations,
  dimensionUoms,
  volumeUoms,
  weightUoms,
  blockIntakeEnabled,
}: {
  poLines: PoLine[];
  locations: Location[];
  dimensionUoms: Uom[];
  volumeUoms: Uom[];
  weightUoms: Uom[];
  blockIntakeEnabled: boolean;
}) {
  const simplePoLines = poLines.filter((l) => l.trackingMode !== "unit");
  const unitPoLines = poLines.filter((l) => l.trackingMode === "unit");

  const [simpleRows, setSimpleRows] = useState(
    simplePoLines.map((l) => ({
      quantity: l.outstanding > 0 ? String(l.outstanding) : "",
      unitCost: String(l.unitCost),
      locationId: "",
      batchNumber: "",
      lotNumber: "",
      shadeCode: "",
      caliberCode: "",
    }))
  );

  const [blockRowsByPoLine, setBlockRowsByPoLine] = useState<Record<string, BlockRow[]>>(
    Object.fromEntries(
      unitPoLines.map((l) => [
        l.id,
        l.outstanding > 0 ? [emptyBlockRow(l, dimensionUoms, volumeUoms, weightUoms)] : [],
      ])
    )
  );

  function updateSimple(i: number, patch: Partial<(typeof simpleRows)[number]>) {
    setSimpleRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function updateBlockRow(poLineId: string, i: number, patch: Partial<BlockRow>) {
    setBlockRowsByPoLine((prev) => ({
      ...prev,
      [poLineId]: prev[poLineId].map((r, idx) => (idx === i ? { ...r, ...patch } : r)),
    }));
  }

  function addBlockRow(poLine: PoLine) {
    setBlockRowsByPoLine((prev) => ({
      ...prev,
      [poLine.id]: [...prev[poLine.id], emptyBlockRow(poLine, dimensionUoms, volumeUoms, weightUoms)],
    }));
  }

  function removeBlockRow(poLineId: string, i: number) {
    setBlockRowsByPoLine((prev) => ({ ...prev, [poLineId]: prev[poLineId].filter((_, idx) => idx !== i) }));
  }

  // Each unit-tracked PO line's block rows get a contiguous slice of the
  // global `lines[i]` index space, starting right after the simple/batch
  // rows -- precomputed here (not accumulated during render) so the index
  // math is a single, easy-to-check pass rather than an accumulator
  // threaded through JSX.
  const blockStartIndexByPoLine = new Map<string, number>();
  {
    let next = simplePoLines.length;
    for (const l of unitPoLines) {
      blockStartIndexByPoLine.set(l.id, next);
      next += (blockRowsByPoLine[l.id] ?? []).length;
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {simplePoLines.length > 0 && (
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
                <th className="py-2 pr-2">Product</th>
                <th className="py-2 pr-2">Qty received</th>
                <th className="py-2 pr-2">Unit cost</th>
                <th className="py-2 pr-2">Location</th>
                <th className="py-2 pr-2">Batch #</th>
                <th className="py-2 pr-2">Shade</th>
                <th className="py-2">Caliber</th>
              </tr>
            </thead>
            <tbody>
              {simplePoLines.map((l, i) => (
                <tr key={l.id} className="border-b border-zinc-100 dark:border-zinc-900">
                  <td className="py-2 pr-2">
                    {l.productLabel}
                    <input type="hidden" name={`lines[${i}][purchaseOrderLineId]`} value={l.id} />
                    <input type="hidden" name={`lines[${i}][productId]`} value={l.productId} />
                    <input type="hidden" name={`lines[${i}][uomId]`} value={l.uomId} />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      name={`lines[${i}][quantity]`}
                      type="number"
                      step="0.01"
                      value={simpleRows[i].quantity}
                      onChange={(e) => updateSimple(i, { quantity: e.target.value })}
                      className="input w-24"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      name={`lines[${i}][unitCost]`}
                      type="number"
                      step="0.0001"
                      value={simpleRows[i].unitCost}
                      onChange={(e) => updateSimple(i, { unitCost: e.target.value })}
                      className="input w-28"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <select
                      name={`lines[${i}][locationId]`}
                      value={simpleRows[i].locationId}
                      onChange={(e) => updateSimple(i, { locationId: e.target.value })}
                      className="input min-w-32"
                    >
                      <option value="">—</option>
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>{loc.path ?? loc.code}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      name={`lines[${i}][batchNumber]`}
                      value={simpleRows[i].batchNumber}
                      onChange={(e) => updateSimple(i, { batchNumber: e.target.value })}
                      disabled={l.trackingMode !== "batch"}
                      className="input w-28 disabled:opacity-40"
                      placeholder={l.trackingMode === "batch" ? "required" : "n/a"}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      name={`lines[${i}][shadeCode]`}
                      value={simpleRows[i].shadeCode}
                      onChange={(e) => updateSimple(i, { shadeCode: e.target.value })}
                      disabled={l.trackingMode !== "batch"}
                      className="input w-20 disabled:opacity-40"
                    />
                  </td>
                  <td className="py-2">
                    <input
                      name={`lines[${i}][caliberCode]`}
                      value={simpleRows[i].caliberCode}
                      onChange={(e) => updateSimple(i, { caliberCode: e.target.value })}
                      disabled={l.trackingMode !== "batch"}
                      className="input w-20 disabled:opacity-40"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {unitPoLines.map((l) => {
        const rows = blockRowsByPoLine[l.id] ?? [];
        const startIndex = blockStartIndexByPoLine.get(l.id) ?? 0;
        return (
          <div key={l.id}>
            <h3 className="mb-2 text-sm font-medium text-zinc-900 dark:text-zinc-50">
              {l.productLabel} — blocks ({rows.length} of {l.outstanding} outstanding)
            </h3>
            {!blockIntakeEnabled && (
              <p className="mb-2 text-sm text-amber-600">
                The Block/Slab Factory capability isn&apos;t enabled — receiving this line will be rejected.
              </p>
            )}
            <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
                    <th className="py-2 pr-2">Block code</th>
                    <th className="py-2 pr-2">L</th>
                    <th className="py-2 pr-2">W</th>
                    <th className="py-2 pr-2">H</th>
                    <th className="py-2 pr-2">Dim. unit</th>
                    <th className="py-2 pr-2">Vol. unit</th>
                    <th className="py-2 pr-2">Weight</th>
                    <th className="py-2 pr-2">Wt unit</th>
                    <th className="py-2 pr-2">Quarry</th>
                    <th className="py-2 pr-2">Grade</th>
                    <th className="py-2 pr-2">Location</th>
                    <th className="py-2 pr-2">Unit cost</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const idx = startIndex + i;
                    return (
                      <tr key={i} className="border-b border-zinc-100 dark:border-zinc-900">
                        <td className="py-2 pr-2">
                          <input type="hidden" name={`lines[${idx}][purchaseOrderLineId]`} value={l.id} />
                          <input type="hidden" name={`lines[${idx}][productId]`} value={l.productId} />
                          <input type="hidden" name={`lines[${idx}][uomId]`} value={l.uomId} />
                          <input type="hidden" name={`lines[${idx}][quantity]`} value="1" />
                          <input
                            name={`lines[${idx}][unitCode]`}
                            value={row.unitCode}
                            onChange={(e) => updateBlockRow(l.id, i, { unitCode: e.target.value })}
                            className="input w-24"
                            placeholder="required"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            name={`lines[${idx}][dimensionLength]`}
                            type="number"
                            step="0.01"
                            value={row.dimensionLength}
                            onChange={(e) => updateBlockRow(l.id, i, { dimensionLength: e.target.value })}
                            className="input w-16"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            name={`lines[${idx}][dimensionWidth]`}
                            type="number"
                            step="0.01"
                            value={row.dimensionWidth}
                            onChange={(e) => updateBlockRow(l.id, i, { dimensionWidth: e.target.value })}
                            className="input w-16"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            name={`lines[${idx}][dimensionHeight]`}
                            type="number"
                            step="0.01"
                            value={row.dimensionHeight}
                            onChange={(e) => updateBlockRow(l.id, i, { dimensionHeight: e.target.value })}
                            className="input w-16"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <select
                            name={`lines[${idx}][dimensionUomId]`}
                            value={row.dimensionUomId}
                            onChange={(e) => updateBlockRow(l.id, i, { dimensionUomId: e.target.value })}
                            className="input w-20"
                          >
                            <option value="">—</option>
                            {dimensionUoms.map((u) => (
                              <option key={u.id} value={u.id}>{u.code}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 pr-2">
                          <select
                            name={`lines[${idx}][volumeUomId]`}
                            value={row.volumeUomId}
                            onChange={(e) => updateBlockRow(l.id, i, { volumeUomId: e.target.value })}
                            className="input w-20"
                          >
                            <option value="">—</option>
                            {volumeUoms.map((u) => (
                              <option key={u.id} value={u.id}>{u.code}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            name={`lines[${idx}][unitWeight]`}
                            type="number"
                            step="0.01"
                            value={row.unitWeight}
                            onChange={(e) => updateBlockRow(l.id, i, { unitWeight: e.target.value })}
                            className="input w-20"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <select
                            name={`lines[${idx}][unitWeightUomId]`}
                            value={row.unitWeightUomId}
                            onChange={(e) => updateBlockRow(l.id, i, { unitWeightUomId: e.target.value })}
                            className="input w-20"
                          >
                            <option value="">—</option>
                            {weightUoms.map((u) => (
                              <option key={u.id} value={u.id}>{u.code}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            name={`lines[${idx}][quarrySource]`}
                            value={row.quarrySource}
                            onChange={(e) => updateBlockRow(l.id, i, { quarrySource: e.target.value })}
                            className="input w-24"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            name={`lines[${idx}][unitQualityGrade]`}
                            value={row.unitQualityGrade}
                            onChange={(e) => updateBlockRow(l.id, i, { unitQualityGrade: e.target.value })}
                            className="input w-20"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <select
                            name={`lines[${idx}][locationId]`}
                            value={row.locationId}
                            onChange={(e) => updateBlockRow(l.id, i, { locationId: e.target.value })}
                            className="input min-w-32"
                          >
                            <option value="">—</option>
                            {locations.map((loc) => (
                              <option key={loc.id} value={loc.id}>{loc.path ?? loc.code}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            name={`lines[${idx}][unitCost]`}
                            type="number"
                            step="0.0001"
                            value={row.unitCost}
                            onChange={(e) => updateBlockRow(l.id, i, { unitCost: e.target.value })}
                            className="input w-28"
                          />
                        </td>
                        <td className="py-2">
                          <button
                            type="button"
                            onClick={() => removeBlockRow(l.id, i)}
                            className="text-zinc-400 hover:text-red-600"
                            aria-label="Remove block"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {rows.length < l.outstanding && (
              <button
                type="button"
                onClick={() => addBlockRow(l)}
                className="mt-2 text-sm font-medium text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50"
              >
                + Add block
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
