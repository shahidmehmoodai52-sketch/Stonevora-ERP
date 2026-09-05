import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { adminClient, createSignedInTestUser, deleteTestUser, hasServiceRoleKey } from "./helpers";

// Automated version of the live-database verification performed while
// building Phase 6 (Accounting depth: Chart of Accounts + double-entry
// ledger + P&L/Balance Sheet). Requires SUPABASE_SERVICE_ROLE_KEY (test
// setup only, see tests/rls/helpers.ts).
describe.skipIf(!hasServiceRoleKey)("Phase 6: Accounting", () => {
  let owner: { userId: string; client: ReturnType<typeof adminClient> };
  let branchBUser: { userId: string; client: ReturnType<typeof adminClient> };
  let viewer: { userId: string; client: ReturnType<typeof adminClient> };
  let tenantId: string;
  let branchAId: string;
  let branchBId: string;
  let warehouseAId: string;
  let supplierId: string;
  let customerId: string;
  let productId: string;
  let pcsUomId: string;

  beforeAll(async () => {
    const suffix = Date.now();
    owner = await createSignedInTestUser(`p6-owner-${suffix}@stonevora.test`, "test-password-123");
    branchBUser = await createSignedInTestUser(`p6-branchb-${suffix}@stonevora.test`, "test-password-123");
    viewer = await createSignedInTestUser(`p6-viewer-${suffix}@stonevora.test`, "test-password-123");

    const { data: tId } = await owner.client.rpc("create_tenant_for_user", {
      p_tenant_name: `Phase6 Test ${suffix}`,
      p_tenant_slug: `phase6-test-${suffix}`,
    });
    tenantId = tId!;

    const admin = adminClient();
    const { data: pcsUom } = await admin.from("uom").select("id").eq("code", "PCS").is("tenant_id", null).single();
    pcsUomId = pcsUom!.id;

    const { data: branchA } = await owner.client
      .from("branches").insert({ tenant_id: tenantId, code: "BA", name: "Branch A", is_head_office: true }).select("id").single();
    branchAId = branchA!.id;
    const { data: branchB } = await owner.client
      .from("branches").insert({ tenant_id: tenantId, code: "BB", name: "Branch B" }).select("id").single();
    branchBId = branchB!.id;

    const { data: warehouseA } = await owner.client
      .from("warehouses").insert({ tenant_id: tenantId, branch_id: branchAId, code: "WA", name: "Warehouse A" }).select("id").single();
    warehouseAId = warehouseA!.id;

    const { data: supplier } = await owner.client
      .from("suppliers").insert({ tenant_id: tenantId, code: "SUP1", name: "Test Supplier" }).select("id").single();
    supplierId = supplier!.id;
    const { data: customer } = await owner.client
      .from("customers").insert({ tenant_id: tenantId, code: "CUST1", name: "Test Customer" }).select("id").single();
    customerId = customer!.id;

    const { data: product } = await owner.client
      .from("products").insert({ tenant_id: tenantId, sku: "TILE-01", name: "Test Tile", inventory_tracking_mode: "simple", base_uom_id: pcsUomId }).select("id").single();
    productId = product!.id;

    const { data: viewerRole } = await admin.from("roles").select("id").eq("tenant_id", tenantId).eq("code", "viewer").single();
    const { data: ownerRole } = await admin.from("roles").select("id").eq("tenant_id", tenantId).eq("code", "owner").single();
    await admin.from("user_tenants").insert([
      { user_id: branchBUser.userId, tenant_id: tenantId },
      { user_id: viewer.userId, tenant_id: tenantId },
    ]);
    await admin.from("user_roles").insert([
      { user_id: branchBUser.userId, tenant_id: tenantId, role_id: ownerRole!.id, branch_id: branchBId },
      { user_id: viewer.userId, tenant_id: tenantId, role_id: viewerRole!.id },
    ]);
  });

  afterAll(async () => {
    const admin = adminClient();
    await admin.from("audit_log").delete().in("changed_by", [owner.userId, branchBUser.userId, viewer.userId]);
    await admin.from("tenants").delete().eq("id", tenantId);
    await deleteTestUser(owner.userId);
    await deleteTestUser(branchBUser.userId);
    await deleteTestUser(viewer.userId);
  });

  async function accountId(code: string) {
    const { data } = await owner.client.from("chart_of_accounts").select("id").eq("tenant_id", tenantId).eq("code", code).single();
    return data!.id as string;
  }

  test("create_tenant_for_user seeds the standard chart of accounts and grants trading_distribution", async () => {
    const { data: accounts } = await owner.client.from("chart_of_accounts").select("code, is_system").eq("tenant_id", tenantId);
    expect(accounts).toHaveLength(10);
    expect(accounts?.every((a) => a.is_system)).toBe(true);

    const admin = adminClient();
    const { data: tradingCapability } = await admin.from("business_capabilities").select("id").eq("code", "trading_distribution").single();
    const { data: grant } = await owner.client
      .from("tenant_capabilities").select("id").eq("tenant_id", tenantId).eq("capability_id", tradingCapability!.id).maybeSingle();
    expect(grant).not.toBeNull();
  });

  test("golden path: GRN posts Inventory/Payable, invoicing posts Receivable/Revenue and COGS/Inventory, payments post Cash movements, and P&L/Balance Sheet agree", async () => {
    const suffix = `${Date.now()}-GOLDEN`;

    const { data: po } = await owner.client
      .from("purchase_orders").insert({ tenant_id: tenantId, branch_id: branchAId, supplier_id: supplierId, po_number: `PO-${suffix}`, status: "confirmed" }).select("id").single();
    const { data: poLine } = await owner.client
      .from("purchase_order_lines").insert({ tenant_id: tenantId, purchase_order_id: po!.id, product_id: productId, quantity: 100, uom_id: pcsUomId, unit_price: 20 }).select("id").single();
    const { data: grn } = await owner.client
      .from("goods_receipts").insert({ tenant_id: tenantId, branch_id: branchAId, warehouse_id: warehouseAId, purchase_order_id: po!.id, grn_number: `GRN-${suffix}`, landed_cost_basis: "value" }).select("id").single();
    await owner.client.from("goods_receipt_lines").insert({ tenant_id: tenantId, goods_receipt_id: grn!.id, purchase_order_line_id: poLine!.id, product_id: productId, quantity: 100, uom_id: pcsUomId, unit_cost: 20 });
    const { error: grnErr } = await owner.client.rpc("post_goods_receipt", { p_goods_receipt_id: grn!.id });
    expect(grnErr).toBeNull();

    const { data: grnLines } = await owner.client
      .from("journal_entry_lines").select("debit, credit, chart_of_accounts(code)")
      .eq("journal_entry_id", (await owner.client.from("journal_entries").select("id").eq("reference_type", "goods_receipt").eq("reference_id", grn!.id).single()).data!.id);
    const grnByCode = Object.fromEntries((grnLines ?? []).map((l) => [(l as unknown as { chart_of_accounts: { code: string } }).chart_of_accounts.code, l]));
    expect(Number(grnByCode["1200"].debit)).toBeCloseTo(2000, 4); // Inventory
    expect(Number(grnByCode["2000"].credit)).toBeCloseTo(2000, 4); // Accounts Payable

    const { data: so } = await owner.client
      .from("sales_orders").insert({ tenant_id: tenantId, branch_id: branchAId, customer_id: customerId, warehouse_id: warehouseAId, so_number: `SO-${suffix}`, status: "draft" }).select("id").single();
    const { data: soLine } = await owner.client
      .from("sales_order_lines").insert({ tenant_id: tenantId, sales_order_id: so!.id, product_id: productId, quantity: 40, uom_id: pcsUomId, unit_price: 30 }).select("id").single();
    await owner.client.rpc("confirm_sales_order", { p_sales_order_id: so!.id });
    const { data: delivery } = await owner.client
      .from("deliveries").insert({ tenant_id: tenantId, branch_id: branchAId, warehouse_id: warehouseAId, sales_order_id: so!.id, delivery_number: `DEL-${suffix}` }).select("id").single();
    await owner.client.from("delivery_lines").insert({ tenant_id: tenantId, delivery_id: delivery!.id, sales_order_line_id: soLine!.id, product_id: productId, quantity: 40 });
    await owner.client.rpc("dispatch_delivery", { p_delivery_id: delivery!.id });
    const { data: invoiceId, error: invErr } = await owner.client.rpc("generate_sales_invoice_from_delivery", { p_delivery_id: delivery!.id, p_invoice_number: `INV-${suffix}` });
    expect(invErr).toBeNull();

    const { data: revenueEntry } = await owner.client.from("journal_entries").select("id").eq("reference_type", "sales_invoice").eq("reference_id", invoiceId!).ilike("description", "Sales invoice%").single();
    const { data: revenueLines } = await owner.client.from("journal_entry_lines").select("debit, credit, chart_of_accounts(code)").eq("journal_entry_id", revenueEntry!.id);
    const revByCode = Object.fromEntries((revenueLines ?? []).map((l) => [(l as unknown as { chart_of_accounts: { code: string } }).chart_of_accounts.code, l]));
    expect(Number(revByCode["1100"].debit)).toBeCloseTo(1200, 4); // AR: 40 * 30
    expect(Number(revByCode["4000"].credit)).toBeCloseTo(1200, 4); // Revenue

    const { data: cogsEntry } = await owner.client.from("journal_entries").select("id").eq("reference_type", "sales_invoice").eq("reference_id", invoiceId!).ilike("description", "COGS%").single();
    const { data: cogsLines } = await owner.client.from("journal_entry_lines").select("debit, credit, chart_of_accounts(code)").eq("journal_entry_id", cogsEntry!.id);
    const cogsByCode = Object.fromEntries((cogsLines ?? []).map((l) => [(l as unknown as { chart_of_accounts: { code: string } }).chart_of_accounts.code, l]));
    expect(Number(cogsByCode["5000"].debit)).toBeCloseTo(800, 4); // COGS: 40 * 20
    expect(Number(cogsByCode["1200"].credit)).toBeCloseTo(800, 4); // Inventory

    const { data: payment } = await owner.client
      .from("customer_payments").insert({ tenant_id: tenantId, branch_id: branchAId, customer_id: customerId, sales_invoice_id: invoiceId!, amount: 500, method: "cash" }).select("id").single();
    const { data: payEntry } = await owner.client.from("journal_entries").select("id").eq("reference_type", "customer_payment").eq("reference_id", payment!.id).single();
    const { data: payLines } = await owner.client.from("journal_entry_lines").select("debit, credit, chart_of_accounts(code)").eq("journal_entry_id", payEntry!.id);
    const payByCode = Object.fromEntries((payLines ?? []).map((l) => [(l as unknown as { chart_of_accounts: { code: string } }).chart_of_accounts.code, l]));
    expect(Number(payByCode["1000"].debit)).toBeCloseTo(500, 4); // Cash
    expect(Number(payByCode["1100"].credit)).toBeCloseTo(500, 4); // AR

    // The pre-existing (Phase 1) payment-sync trigger fires alongside the new journal-posting trigger.
    const { data: invoiceAfterPay } = await owner.client.from("sales_invoices").select("status, amount_paid").eq("id", invoiceId!).single();
    expect(invoiceAfterPay?.status).toBe("partially_paid");
    expect(Number(invoiceAfterPay?.amount_paid)).toBeCloseTo(500, 4);

    const { data: pnl } = await owner.client.rpc("get_profit_and_loss", { p_tenant_id: tenantId, p_branch_id: branchAId, p_start_date: "2000-01-01", p_end_date: "2100-01-01" });
    const pnlByCode = Object.fromEntries((pnl ?? []).map((r) => [r.code, r.amount]));
    expect(Number(pnlByCode["4000"])).toBeCloseTo(1200, 4);
    expect(Number(pnlByCode["5000"])).toBeCloseTo(800, 4);

    const { data: bs } = await owner.client.rpc("get_balance_sheet", { p_tenant_id: tenantId, p_branch_id: branchAId, p_as_of_date: "2100-01-01" });
    const totalAssets = (bs ?? []).filter((r) => r.account_type === "asset").reduce((s, r) => s + Number(r.amount), 0);
    const totalLiabAndEquity = (bs ?? []).filter((r) => r.account_type !== "asset").reduce((s, r) => s + Number(r.amount), 0);
    expect(totalAssets).toBeCloseTo(totalLiabAndEquity, 4); // the fundamental accounting identity must hold
    const earnings = (bs ?? []).find((r) => r.code === "3999");
    expect(Number(earnings?.amount)).toBeCloseTo(400, 4); // 1200 revenue - 800 COGS
  });

  test("manual post_journal_entry: balance validation, and reverse_journal_entry mirrors and rejects double-reversal", async () => {
    const cashId = await accountId("1000");
    const opexId = await accountId("6000");

    const { error: unbalancedErr } = await owner.client.rpc("post_journal_entry", {
      p_tenant_id: tenantId, p_branch_id: branchAId, p_entry_date: new Date().toISOString().slice(0, 10), p_description: "Unbalanced",
      p_lines: [{ account_id: opexId, debit: 100, credit: 0 }, { account_id: cashId, debit: 0, credit: 50 }],
    });
    expect(unbalancedErr?.message).toMatch(/does not balance/);

    const { data: entryId, error: postErr } = await owner.client.rpc("post_journal_entry", {
      p_tenant_id: tenantId, p_branch_id: branchAId, p_entry_date: new Date().toISOString().slice(0, 10), p_description: "Office rent",
      p_lines: [{ account_id: opexId, debit: 150, credit: 0 }, { account_id: cashId, debit: 0, credit: 150 }],
    });
    expect(postErr).toBeNull();

    const { data: reversalId, error: reverseErr } = await owner.client.rpc("reverse_journal_entry", { p_journal_entry_id: entryId!, p_reason: "Entered in error" });
    expect(reverseErr).toBeNull();
    const { data: reversalLines } = await owner.client.from("journal_entry_lines").select("debit, credit, account_id").eq("journal_entry_id", reversalId!);
    const cashLine = reversalLines?.find((l) => l.account_id === cashId);
    const opexLine = reversalLines?.find((l) => l.account_id === opexId);
    expect(Number(cashLine?.debit)).toBeCloseTo(150, 4); // mirror image of the original
    expect(Number(opexLine?.credit)).toBeCloseTo(150, 4);

    const { error: doubleReverseErr } = await owner.client.rpc("reverse_journal_entry", { p_journal_entry_id: entryId!, p_reason: "again" });
    expect(doubleReverseErr?.message).toMatch(/already been reversed/);
  });

  test("system accounts are protected: identity cannot change or be deleted, but name/is_active remain editable", async () => {
    const inventoryId = await accountId("1200");
    const { error: deleteErr } = await owner.client.from("chart_of_accounts").delete().eq("id", inventoryId);
    expect(deleteErr?.message).toMatch(/cannot be deleted/);

    const { error: recodeErr } = await owner.client.from("chart_of_accounts").update({ code: "9999" }).eq("id", inventoryId);
    expect(recodeErr?.message).toMatch(/cannot be changed/);

    const { error: renameErr } = await owner.client.from("chart_of_accounts").update({ name: "Merchandise Inventory" }).eq("id", inventoryId);
    expect(renameErr).toBeNull();
    await owner.client.from("chart_of_accounts").update({ name: "Inventory" }).eq("id", inventoryId); // restore
  });

  test("branch scoping: a Branch-B-scoped owner cannot post, reverse, or report on Branch-A accounting", async () => {
    const cashId = await accountId("1000");
    const opexId = await accountId("6000");
    const lines = [{ account_id: opexId, debit: 10, credit: 0 }, { account_id: cashId, debit: 0, credit: 10 }];

    const { error: postErr } = await branchBUser.client.rpc("post_journal_entry", { p_tenant_id: tenantId, p_branch_id: branchAId, p_entry_date: new Date().toISOString().slice(0, 10), p_description: "x", p_lines: lines });
    expect(postErr?.message).toMatch(/do not have access to this branch/);

    const { data: entryId } = await owner.client.rpc("post_journal_entry", { p_tenant_id: tenantId, p_branch_id: branchAId, p_entry_date: new Date().toISOString().slice(0, 10), p_description: "x", p_lines: lines });
    const { error: reverseErr } = await branchBUser.client.rpc("reverse_journal_entry", { p_journal_entry_id: entryId!, p_reason: "x" });
    expect(reverseErr?.message).toMatch(/do not have access to the branch/);

    const { error: pnlErr } = await branchBUser.client.rpc("get_profit_and_loss", { p_tenant_id: tenantId, p_branch_id: branchAId, p_start_date: "2000-01-01", p_end_date: "2100-01-01" });
    expect(pnlErr?.message).toMatch(/do not have access to this branch/);

    const { error: bsErr } = await branchBUser.client.rpc("get_balance_sheet", { p_tenant_id: tenantId, p_branch_id: branchAId, p_as_of_date: "2100-01-01" });
    expect(bsErr?.message).toMatch(/do not have access to this branch/);
  });

  test("permission denial: a Viewer cannot post, reverse, or view financial reports", async () => {
    const cashId = await accountId("1000");
    const opexId = await accountId("6000");
    const lines = [{ account_id: opexId, debit: 10, credit: 0 }, { account_id: cashId, debit: 0, credit: 10 }];

    const { error: postErr } = await viewer.client.rpc("post_journal_entry", { p_tenant_id: tenantId, p_branch_id: branchAId, p_entry_date: new Date().toISOString().slice(0, 10), p_description: "x", p_lines: lines });
    expect(postErr?.message).toMatch(/Missing permission: accounting.create/);

    const { data: entryId } = await owner.client.rpc("post_journal_entry", { p_tenant_id: tenantId, p_branch_id: branchAId, p_entry_date: new Date().toISOString().slice(0, 10), p_description: "x", p_lines: lines });
    const { error: reverseErr } = await viewer.client.rpc("reverse_journal_entry", { p_journal_entry_id: entryId!, p_reason: "x" });
    expect(reverseErr?.message).toMatch(/Missing permission: accounting.edit/);

    const { error: pnlErr } = await viewer.client.rpc("get_profit_and_loss", { p_tenant_id: tenantId, p_branch_id: branchAId, p_start_date: "2000-01-01", p_end_date: "2100-01-01" });
    expect(pnlErr?.message).toMatch(/Missing permission: accounting.view_financial/);

    const { error: bsErr } = await viewer.client.rpc("get_balance_sheet", { p_tenant_id: tenantId, p_branch_id: branchAId, p_as_of_date: "2100-01-01" });
    expect(bsErr?.message).toMatch(/Missing permission: accounting.view_financial/);
  });
});
