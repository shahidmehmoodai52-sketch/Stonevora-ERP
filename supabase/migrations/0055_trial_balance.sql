-- Trial Balance report: the third real gap this session's own 36-part spec
-- audit found in the accounting depth Part 17 asks for (alongside the P&L
-- and Balance Sheet already built in 0051) -- a single as-of-date listing
-- of every account's net debit or credit balance, used to prove the ledger
-- itself balances before P&L/BS are trusted.
--
-- Unlike get_profit_and_loss/get_balance_sheet, which apply a fixed
-- debit-is-positive-for-assets/expenses-or-credit-is-positive-for-the-rest
-- formula per account_type, a trial balance shows each account's *actual*
-- net posting direction regardless of type -- a revenue account with a
-- debit balance (e.g. from a correcting entry) must show in the debit
-- column, not be forced negative into the credit column. So this reports
-- both a debit and a credit column per account, split by the sign of
-- (total debit - total credit) for that account: a non-negative net goes
-- entirely into the debit column, a negative net goes (as its absolute
-- value) entirely into the credit column. Because every journal entry is
-- itself balanced (post_journal_entry rejects an unbalanced one, and every
-- auto-posting site inserts balanced pairs), summing debit-minus-credit
-- across *all* accounts is always exactly zero -- which means the debit
-- column total and credit column total produced by this split are
-- mathematically guaranteed to be equal, the defining property of a
-- correct trial balance, with no separate balancing logic required.
--
-- Same shape as get_profit_and_loss/get_balance_sheet: single-branch only
-- (p_branch_id required), gated on accounting.view_financial, cumulative
-- from inception through p_as_of_date (not a date range -- a trial balance
-- is a point-in-time snapshot of every account's life-to-date balance, the
-- same convention get_balance_sheet already uses for asset/liability/
-- equity accounts). Every account in the tenant's chart is returned, zero
-- balances included -- the same "list the whole thing" convention
-- get_balance_sheet already uses, since a trial balance is meant to be
-- checked against the full chart of accounts, not a filtered subset of it.

create function get_trial_balance(p_tenant_id uuid, p_branch_id uuid, p_as_of_date date)
returns table (account_id uuid, code text, name text, account_type account_type, debit numeric, credit numeric)
language plpgsql security definer stable set search_path = public as $$
begin
  if not has_permission(p_tenant_id, 'accounting', 'view_financial') then
    raise exception 'Missing permission: accounting.view_financial';
  end if;
  if not has_branch_access(p_tenant_id, p_branch_id) then
    raise exception 'You do not have access to this branch';
  end if;

  return query
    select coa.id, coa.code, coa.name, coa.account_type,
      greatest(coalesce(sum(jel.debit - jel.credit), 0), 0) as debit,
      greatest(-coalesce(sum(jel.debit - jel.credit), 0), 0) as credit
    from chart_of_accounts coa
    left join journal_entry_lines jel on jel.account_id = coa.id
    left join journal_entries je on je.id = jel.journal_entry_id
      and je.branch_id = p_branch_id and je.entry_date <= p_as_of_date
    where coa.tenant_id = p_tenant_id
    group by coa.id, coa.code, coa.name, coa.account_type
    order by coa.code;
end;
$$;

revoke execute on function get_trial_balance(uuid, uuid, date) from public, anon;
