"use client";

import { useActionState } from "react";
import { updateTenantSettingsAction, type ActionResult } from "@/actions/settings";

type Props = {
  name: string;
  countryId: string;
  baseCurrencyId: string;
  fiscalYearStartMonth: number;
  timezone: string;
  countries: { id: string; name: string }[];
  currencies: { id: string; iso_code: string | null; name: string }[];
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function CompanySettingsForm(props: Props) {
  const [state, formAction, pending] = useActionState(
    async (_prevState: ActionResult | null, formData: FormData) =>
      updateTenantSettingsAction(formData),
    null
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field label="Company name">
        <input
          name="name"
          defaultValue={props.name}
          required
          className="input"
        />
      </Field>
      <Field label="Country">
        <select name="countryId" defaultValue={props.countryId} className="input">
          <option value="">—</option>
          {props.countries.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </Field>
      <Field label="Base currency">
        <select name="baseCurrencyId" defaultValue={props.baseCurrencyId} className="input">
          <option value="">—</option>
          {props.currencies.map((c) => (
            <option key={c.id} value={c.id}>{c.iso_code} — {c.name}</option>
          ))}
        </select>
      </Field>
      <Field label="Fiscal year start month">
        <select
          name="fiscalYearStartMonth"
          defaultValue={props.fiscalYearStartMonth}
          className="input"
        >
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>{m}</option>
          ))}
        </select>
      </Field>
      <Field label="Timezone">
        <input name="timezone" defaultValue={props.timezone} className="input" />
      </Field>
      {state && "error" in state && <p className="text-sm text-red-600">{state.error}</p>}
      {state && "success" in state && (
        <p className="text-sm text-emerald-600">Saved.</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</label>
      {children}
    </div>
  );
}
