"use client";

import { useState } from "react";
import { ActionForm } from "@/components/ActionForm";
import { completeProcessingJobAction } from "@/actions/factory";

type Uom = { id: string; code: string };

type Row = {
  unitType: "slab" | "remnant";
  length: string;
  width: string;
  thickness: string;
  dimensionUomId: string;
  areaUomId: string;
  qualityGrade: string;
  usableArea: string;
};

function emptyRow(dimensionUoms: Uom[], areaUoms: Uom[]): Row {
  return {
    unitType: "slab",
    length: "",
    width: "",
    thickness: "",
    dimensionUomId: dimensionUoms[0]?.id ?? "",
    areaUomId: areaUoms[0]?.id ?? "",
    qualityGrade: "",
    usableArea: "",
  };
}

// The output list may legitimately be submitted empty -- a block that
// turned out fully unusable is completed as 100% waste, not blocked by a
// client-side "at least one row" rule (see actions/factory.ts's own comment
// on parseOutputLines/completeProcessingJobAction).
export function CompleteJobForm({
  processingJobId,
  dimensionUoms,
  areaUoms,
}: {
  processingJobId: string;
  dimensionUoms: Uom[];
  areaUoms: Uom[];
}) {
  const [rows, setRows] = useState<Row[]>([emptyRow(dimensionUoms, areaUoms)]);

  function update(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  return (
    <ActionForm
      action={(formData) => completeProcessingJobAction(processingJobId, formData)}
      submitLabel="Complete job"
      pendingLabel="Completing…"
      offlineActionKey="completeProcessingJob"
    >
      <input type="hidden" name="__processingJobId" value={processingJobId} />
      <div className="flex flex-col gap-3">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
                <th className="py-2 pr-2">Type</th>
                <th className="py-2 pr-2">Length</th>
                <th className="py-2 pr-2">Width</th>
                <th className="py-2 pr-2">Thickness</th>
                <th className="py-2 pr-2">Dim. unit</th>
                <th className="py-2 pr-2">Area unit</th>
                <th className="py-2 pr-2">Usable area</th>
                <th className="py-2 pr-2">Grade</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-zinc-100 dark:border-zinc-900">
                  <td className="py-2 pr-2">
                    <select
                      name={`lines[${i}][unitType]`}
                      value={row.unitType}
                      onChange={(e) => update(i, { unitType: e.target.value as Row["unitType"] })}
                      className="input w-24"
                    >
                      <option value="slab">Slab</option>
                      <option value="remnant">Remnant</option>
                    </select>
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      name={`lines[${i}][length]`}
                      type="number"
                      step="0.01"
                      min="0"
                      value={row.length}
                      onChange={(e) => update(i, { length: e.target.value })}
                      className="input w-20"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      name={`lines[${i}][width]`}
                      type="number"
                      step="0.01"
                      min="0"
                      value={row.width}
                      onChange={(e) => update(i, { width: e.target.value })}
                      className="input w-20"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      name={`lines[${i}][thickness]`}
                      type="number"
                      step="0.01"
                      min="0"
                      value={row.thickness}
                      onChange={(e) => update(i, { thickness: e.target.value })}
                      className="input w-20"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <select
                      name={`lines[${i}][dimensionUomId]`}
                      value={row.dimensionUomId}
                      onChange={(e) => update(i, { dimensionUomId: e.target.value })}
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
                      name={`lines[${i}][areaUomId]`}
                      value={row.areaUomId}
                      onChange={(e) => update(i, { areaUomId: e.target.value })}
                      className="input w-20"
                    >
                      <option value="">—</option>
                      {areaUoms.map((u) => (
                        <option key={u.id} value={u.id}>{u.code}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      name={`lines[${i}][usableArea]`}
                      type="number"
                      step="0.01"
                      min="0"
                      value={row.usableArea}
                      onChange={(e) => update(i, { usableArea: e.target.value })}
                      placeholder="gross"
                      className="input w-24"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      name={`lines[${i}][qualityGrade]`}
                      value={row.qualityGrade}
                      onChange={(e) => update(i, { qualityGrade: e.target.value })}
                      className="input w-20"
                    />
                  </td>
                  <td className="py-2">
                    <button
                      type="button"
                      onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-zinc-400 hover:text-red-600"
                      aria-label="Remove line"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-2 text-zinc-500">
                    No output — completing with zero lines records the whole block as waste.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          onClick={() => setRows((prev) => [...prev, emptyRow(dimensionUoms, areaUoms)])}
          className="self-start text-sm font-medium text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50"
        >
          + Add output piece
        </button>
      </div>
    </ActionForm>
  );
}
