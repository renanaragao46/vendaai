-- New accounts start at a known zero, not an ambiguous pending balance.
alter table public.accounts alter column initial_balance set default 0, alter column initial_status set default 'confirmado';
-- Keep the shared household accounts aligned with the four real destinations.
do $$
declare
  h record;
  v_market_id uuid;
  v_placeholder_id uuid;
  v_active_count integer;
begin
  for h in select id from public.households loop
    update public.accounts
      set name = 'Pessoal — Renan'
      where household_id = h.id and lower(name) = lower('Pessoal — Usuário');

    update public.accounts
      set name = 'Pessoal — Leticia'
      where household_id = h.id and lower(name) = lower('Pessoal — Companheira');

    update public.accounts
      set name = 'Dinheiro em espécie'
      where household_id = h.id and lower(name) = lower('Dinheiro em espécie / caixa da operação');

    select id into v_market_id
      from public.accounts
      where household_id = h.id and archived = false
        and (name ilike '%mercado pago%' or holder in ('conjunto','nossa'))
      order by case when name ilike '%mercado pago%' then 0 else 1 end, created_at
      limit 1;

    if v_market_id is not null then
      update public.accounts
        set name = 'Mercado Pago — Nossa', holder = 'conjunto', type = 'digital'
        where id = v_market_id and household_id = h.id;
    else
      select id into v_placeholder_id
        from public.accounts
        where household_id = h.id and archived = false
          and (name ilike 'PJ%' or holder = 'empresa' or type = 'pj')
        order by created_at
        limit 1;

      if v_placeholder_id is not null then
        update public.accounts
          set name = 'Mercado Pago — Nossa', holder = 'conjunto', type = 'digital'
          where id = v_placeholder_id and household_id = h.id;
      else
        select count(*) into v_active_count from public.accounts
          where household_id = h.id and archived = false;
        if v_active_count < 4 then
          insert into public.accounts(household_id,name,holder,type,initial_balance,initial_status)
          values(h.id,'Mercado Pago — Nossa','conjunto','digital',null,'a_confirmar');
        end if;
      end if;
    end if;
  end loop;
end $$;

-- The source record is the canonical record; its finance entry is a durable, unique projection.
with duplicates as (
  select id, row_number() over (
    partition by household_id, operation
    order by created_at desc, id desc
  ) as rn
  from public.transactions
  where operation like 'pv:auto:%'
)
delete from public.transactions t
using duplicates d
where t.id = d.id and d.rn > 1;

create unique index if not exists transactions_household_auto_operation_uq
  on public.transactions(household_id, operation)
  where operation like 'pv:auto:%';

create or replace function public.sync_household_operational_income()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household_id uuid;
  v_source_id uuid;
  v_operation text;
  v_date date;
  v_amount numeric(14,2) := 0;
  v_description text;
  v_category text;
  v_destination text;
  v_holder text;
  v_account_id uuid;
  v_status text;
begin
  if TG_OP = 'DELETE' then
    v_household_id := OLD.household_id;
    v_source_id := OLD.id;
  else
    v_household_id := NEW.household_id;
    v_source_id := NEW.id;
  end if;

  if TG_TABLE_NAME = 'driving_sessions' then
    v_destination := 'renan';
    v_holder := 'usuario';
    v_date := case when TG_OP = 'DELETE' then OLD.date else NEW.date end;
    v_amount := case when TG_OP = 'DELETE' then 0 else coalesce(NEW.gross,0) + coalesce(NEW.tips,0) end;
    v_category := case when TG_OP = 'DELETE' then 'Uber/99' when NEW.platform = '99' then '99' else 'Uber' end;
    v_description := 'Uber/99 · ' || case when TG_OP = 'DELETE' then 'turno' else coalesce(NEW.platform,'turno') end || ' · ' || coalesce(v_date::text,'');
  elsif TG_TABLE_NAME = 'beverage_events' then
    v_destination := 'mercado_pago';
    v_holder := 'conjunto';
    v_date := case when TG_OP = 'DELETE' then OLD.date else NEW.date end;
    v_status := case when TG_OP = 'DELETE' then '' else lower(translate(coalesce(NEW.status,''),'áàâãéêíóôõúç','aaaaeeiooouc')) end;
    if TG_OP <> 'DELETE' and (v_status like '%realiz%' or v_status like '%conclu%' or v_status like '%finaliz%') then
      if jsonb_array_length(coalesce(NEW.items,'[]'::jsonb)) > 0 then
        select coalesce(sum(coalesce((item->>'qty_sold')::numeric,0) * coalesce((item->>'unit_price')::numeric,0)),0)
          into v_amount
          from jsonb_array_elements(NEW.items) as items(item);
      else
        v_amount := coalesce(NEW.revenue,0);
      end if;
    end if;
    v_category := 'Bebidas/eventos';
    v_description := 'Bebidas · ' || case when TG_OP = 'DELETE' then 'evento' else coalesce(NEW.name,'evento') end;
  elsif TG_TABLE_NAME = 'ecommerce_daily_metrics' then
    v_destination := 'mercado_pago';
    v_holder := 'conjunto';
    v_date := case when TG_OP = 'DELETE' then OLD.date else NEW.date end;
    v_amount := case when TG_OP = 'DELETE' then 0 else coalesce(NEW.revenue,0) end;
    v_category := 'MIMORA';
    v_description := 'MIMORA · repasse recebido · ' || case when TG_OP = 'DELETE' then 'venda' else coalesce(NEW.product,NEW.campaign,NEW.store,'venda') end;
  else
    raise exception 'Tabela de origem não suportada: %', TG_TABLE_NAME;
  end if;

  v_operation := 'pv:auto:' ||
    case TG_TABLE_NAME
      when 'driving_sessions' then '99_uber'
      when 'beverage_events' then 'bebidas'
      else 'mimora'
    end || ':' || v_source_id::text;

  if TG_OP = 'DELETE' or v_amount <= 0 then
    delete from public.transactions
      where household_id = v_household_id and operation = v_operation;
    if TG_OP = 'DELETE' then return OLD; end if;
    return NEW;
  end if;

  if v_destination = 'renan' then
    select id into v_account_id
      from public.accounts
      where household_id = v_household_id and archived = false
        and (name ilike '%renan%' or (holder = 'usuario' and type = 'pessoal'))
      order by case when name ilike '%renan%' then 0 else 1 end, created_at
      limit 1;
  else
    select id into v_account_id
      from public.accounts
      where household_id = v_household_id and archived = false
        and (name ilike '%mercado pago%' or holder in ('conjunto','nossa'))
      order by case when name ilike '%mercado pago%' then 0 else 1 end, created_at
      limit 1;
  end if;

  if v_account_id is null then
    raise exception 'Conta de destino não encontrada no Financeiro para a receita de %.', v_destination;
  end if;

  insert into public.transactions(
    household_id,date,amount,direction,description,category,account_id,holder,
    operation,status,nature,notes
  ) values (
    v_household_id,coalesce(v_date,current_date),v_amount,'entrada',v_description,
    v_category,v_account_id,v_holder,v_operation,'confirmado',case when v_destination = 'renan' then 'pessoal' else 'empresarial' end,
    'Gerado automaticamente a partir do registro operacional. Edite a origem para ajustar este lançamento.'
  )
  on conflict (household_id,operation) where operation like 'pv:auto:%'
  do update set
    date = excluded.date,
    amount = excluded.amount,
    direction = excluded.direction,
    description = excluded.description,
    category = excluded.category,
    account_id = excluded.account_id,
    holder = excluded.holder,
    status = 'confirmado',
    nature = case when v_destination = 'renan' then 'pessoal' else 'empresarial' end,
    notes = excluded.notes;

  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end;
$$;

drop trigger if exists sync_driving_income_to_finance on public.driving_sessions;
create trigger sync_driving_income_to_finance
after insert or update or delete on public.driving_sessions
for each row execute function public.sync_household_operational_income();

-- Link the costs entered in each Uber/99 shift to the same Renan cash account.
-- Each cost line has its own stable source key, so editing a shift updates rather than duplicates it.
create or replace function public.sync_driving_costs_to_finance()
returns trigger
language plpgsql
security definer
set search_path = public
as $
declare
  v_household_id uuid;
  v_source_id uuid;
  v_account_id uuid;
  v_date date;
  v_cost record;
  v_operation text;
begin
  if TG_OP = 'DELETE' then
    v_household_id := OLD.household_id;
    v_source_id := OLD.id;
    delete from public.transactions
      where household_id = v_household_id
        and operation like 'pv:auto:99_uber_cost:' || v_source_id::text || ':%';
    return OLD;
  end if;

  v_household_id := NEW.household_id;
  v_source_id := NEW.id;
  v_date := coalesce(NEW.date,current_date);

  select id into v_account_id
    from public.accounts
    where household_id = v_household_id and archived = false
      and (name ilike '%renan%' or (holder = 'usuario' and type = 'pessoal'))
    order by case when name ilike '%renan%' then 0 else 1 end, created_at
    limit 1;

  if v_account_id is null then
    raise exception 'Conta Pessoal — Renan não encontrada para registrar os custos do turno.';
  end if;

  for v_cost in
    select * from (values
      ('combustivel','Combustível',coalesce(NEW.fuel_cost,0)),
      ('pedagios','Pedágios',coalesce(NEW.tolls,0)),
      ('lavagem','Lavagem',coalesce(NEW.wash,0)),
      ('manutencao','Manutenção',coalesce(NEW.maintenance,0)),
      ('aluguel','Aluguel do veículo',coalesce(NEW.rent_alloc,0)),
      ('outros','Outros custos',coalesce(NEW.other_costs,0))
    ) as costs(code,label,amount)
  loop
    v_operation := 'pv:auto:99_uber_cost:' || v_source_id::text || ':' || v_cost.code;

    if v_cost.amount <= 0 then
      delete from public.transactions
        where household_id = v_household_id and operation = v_operation;
    else
      insert into public.transactions(
        household_id,date,amount,direction,description,category,account_id,holder,
        operation,status,nature,notes
      ) values (
        v_household_id,v_date,round(v_cost.amount,2),'saida',
        'Uber/99 · ' || v_cost.label || ' · turno ' || v_date::text,
        v_cost.label,v_account_id,'usuario',v_operation,'confirmado','pessoal',
        'Gerado automaticamente a partir dos custos informados no turno. Ajuste o turno para corrigir este valor.'
      )
      on conflict (household_id,operation) where operation like 'pv:auto:%'
      do update set
        date = excluded.date,
        amount = excluded.amount,
        direction = 'saida',
        description = excluded.description,
        category = excluded.category,
        account_id = excluded.account_id,
        holder = 'usuario',
        status = 'confirmado',
        nature = 'pessoal',
        notes = excluded.notes;
    end if;
  end loop;

  return NEW;
end;
$;

drop trigger if exists sync_driving_costs_to_finance_trigger on public.driving_sessions;
create trigger sync_driving_costs_to_finance_trigger
after insert or update or delete on public.driving_sessions
for each row execute function public.sync_driving_costs_to_finance();

drop trigger if exists sync_beverage_income_to_finance on public.beverage_events;
create trigger sync_beverage_income_to_finance
after insert or update or delete on public.beverage_events
for each row execute function public.sync_household_operational_income();

drop trigger if exists sync_mimora_income_to_finance on public.ecommerce_daily_metrics;
create trigger sync_mimora_income_to_finance
after insert or update or delete on public.ecommerce_daily_metrics
for each row execute function public.sync_household_operational_income();


-- A user belongs to one shared life workspace. Accept only one pending invite.
create or replace function public.accept_my_invites()
returns int
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_email text := lower(coalesce(auth.jwt() ->> 'email',''));
  r public.household_invites%rowtype;
  v_inserted integer := 0;
begin
  if auth.uid() is null or v_email = '' then return 0; end if;
  if exists (select 1 from public.household_members where user_id = auth.uid()) then
    return 0;
  end if;

  select * into r
    from public.household_invites
    where lower(email) = v_email and accepted_at is null
    order by created_at
    limit 1
    for update skip locked;

  if not found then return 0; end if;

  insert into public.household_members(household_id,user_id,email,role)
    values(r.household_id,auth.uid(),v_email,'member')
    on conflict do nothing;

  get diagnostics v_inserted = row_count;
  if v_inserted > 0 then
    update public.household_invites set accepted_at = now() where id = r.id;
  end if;

  return v_inserted;
end;
$function$;
grant execute on function public.accept_my_invites() to authenticated;

-- Retire the old brush test catalog without deleting its history.
update public.products
set status = 'pausado',
    notes = concat_ws(E'\n', nullif(notes,''), 'Produto de catálogo histórico; não considerar ativo na operação sazonal atual.')
where name in (
  'Escova Alisadora Multifuncional — MIMORA',
  'Escova 3 em 1 — MIMORA',
  'Escova 5 em 1 — MIMORA'
);

update public.notes
set body = 'Loja online em reposicionamento para produtos sazonais/Natal. Atualizar o catálogo conforme os produtos realmente ativos. Contar como receita somente o repasse líquido efetivamente recebido; acompanhar anúncios, pedidos aprovados, cancelamentos e margem sem presumir vendas.'
where title = 'MIMORA — situação inicial';

update public.project_nodes
set description = 'E-commerce em reposicionamento sazonal; registrar somente pedidos e repasses efetivamente confirmados.'
where label = 'MIMORA / Kaiross';

-- Normalize the visible labels stored with the shared workspace.
update public.households
set settings = jsonb_set(
  jsonb_set(coalesce(settings,'{}'::jsonb), '{user_label}', '"Renan"'::jsonb, true),
  '{partner_label}', '"Leticia"'::jsonb, true
);
