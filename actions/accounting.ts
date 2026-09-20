"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/guard";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";

export type ActionResult = { error: string } | { success: true };

export async function createChartOfAccountAction(formData: FormData): Promise<ActionResult> {
  const tenant = await requireActiveTenant();
  await requirePermission(tenant.tenantId, "accounting", "create");

  const code = String(formData.get("code") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const accountType = String(formData.get("accountType") ?? "");
  const parentAccountId = String(formData.get("parentAccountId") ?? "") || null;

  if (!code || !name || !accountType) {
    return { error: "Code, name and account type are required" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("chart_of_accounts").insert({
    tenant_id: tenant.tenantId,
    code,
    name,
    account_type: accountType as "asset" | "liability" | "equity" | "revenue" | "expense",
    parent_account_id: parentAccountId,
  });
  if (error) return { error: error.message };

  revalidatePath("/accounting/chart-of-accounts");
  return { success: true };
}

type JournalLineInput = { accountId: string; debit: string; credit: string; description: string };

function parseJournalLines(formData: FormData): JournalLineInput[] {
  const lines: JournalLineInput[] = [];
  let i = 0;
  while (formData.has(`lines[${i}][accountId]`)) {
    lines.push({
      accountId: String(formData.get(`lines[${i}][accountId]`) ?? ""),
      debit: String(formData.get(`lines[${i}][debit]`) ?? ""),
      credit: String(formData.get(`lines[${i}][credit]`) ?? ""),
      description: String(formData.get(`lines[${i}][description]`) ?? ""),
    });
    i += 1;
  }
  return lines.filter((l) => l.accountId && (Number(l.debit) > 0 || Number(l.credit) > 0));
}

export async function postJournalEntryAction(formData: FormData): Promise<ActionResult> {
  const tenant = await requireActiveTenant();
  await requirePermission(tenant.tenantId, "accounting", "create");

  const branchId = String(formData.get("branchId") ?? "");
  const entryDate = String(formData.get("entryDate") ?? "").trim() || new Date().toISOString().slice(0, 10);
  const description = String(formData.get("description") ?? "").trim();
  const lines = parseJournalLines(formData);

  if (!branchId) return { error: "Branch is required" };
  if (lines.length < 2) return { error: "A journal entry requires at least two lines" };

  const supabase = await createClient();
  const { data: journalEntryId, error } = await supabase.rpc("post_journal_entry", {
    p_tenant_id: tenant.tenantId,
    p_branch_id: branchId,
    p_entry_date: entryDate,
    p_description: description,
    p_lines: lines.map((l) => ({
      account_id: l.accountId,
      debit: l.debit ? Number(l.debit) : 0,
      credit: l.credit ? Number(l.credit) : 0,
      description: l.description || undefined,
    })),
  });
  if (error) return { error: error.message };

  revalidatePath("/accounting/journal-entries");
  redirect(`/accounting/journal-entries/${journalEntryId}`);
}

export async function reverseJournalEntryAction(
  journalEntryId: string,
  formData: FormData
): Promise<ActionResult> {
  await requireActiveTenant();
  const reason = String(formData.get("reason") ?? "").trim();

  const supabase = await createClient();
  const { error } = await supabase.rpc("reverse_journal_entry", {
    p_journal_entry_id: journalEntryId,
    p_reason: reason,
  });
  if (error) return { error: error.message };

  revalidatePath(`/accounting/journal-entries/${journalEntryId}`);
  revalidatePath("/accounting/journal-entries");
  return { success: true };
}
