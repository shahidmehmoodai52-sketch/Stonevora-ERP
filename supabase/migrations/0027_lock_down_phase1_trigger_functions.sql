-- Same fix as supabase/migrations/0013: these two are trigger-only functions,
-- never meant to be called directly via PostgREST RPC. Trigger firing does not
-- require EXECUTE on the function, so revoking here only blocks direct calls.
revoke execute on function sync_sales_invoice_paid_amount() from public, anon, authenticated;
revoke execute on function sync_purchase_invoice_paid_amount() from public, anon, authenticated;
