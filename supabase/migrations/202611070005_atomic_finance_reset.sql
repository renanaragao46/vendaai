-- Atomic, household-scoped reset for financial test data.
-- Runs with the caller's privileges so existing RLS policies remain in force.
create or replace function public.reset_financial_test_data(p_household_id uuid)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_accounts integer;
  v_deleted integer;
begin
  if auth.uid() is null or not public.is_household_member(p_household_id) then
    raise exception 'Acesso negado ao espaço financeiro.';
  end if;

  perform 1
  from public.households
  where id = p_household_id
  for update;

  select count(*) into v_accounts
  from public.accounts
  where household_id = p_household_id and archived = false;

  if v_accounts <> 4 then
    raise exception 'Reset cancelado: esperado 4 contas ativas, encontradas %.', v_accounts;
  end if;

  delete from public.transactions
  where household_id = p_household_id;
  get diagnostics v_deleted = row_count;

  update public.accounts
  set initial_balance = 0,
      initial_status = 'confirmado',
      updated_at = now()
  where household_id = p_household_id
    and archived = false;

  return jsonb_build_object(
    'deleted_transactions', v_deleted,
    'accounts_zeroed', v_accounts,
    'cash_total', 0
  );
end;
$$;

revoke all on function public.reset_financial_test_data(uuid) from public;
grant execute on function public.reset_financial_test_data(uuid) to authenticated;
