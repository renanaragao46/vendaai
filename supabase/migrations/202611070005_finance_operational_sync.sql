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

    if v_market_id is null then
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
          values(h.id,'Mercado Pago — Nossa','conjunto','digital',0,'confirmado');
        end if;
      end if;
    end if;
  end loop;
end $$;

alter table public.beverage_events add column if not exists items_revenue numeric(12,2), add column if not exists items_goods_cost numeric(12,2), add column if not exists items_net numeric(12,2);

create or replace function public.calculate_beverage_item_totals()
returns trigger
language plpgsql
set search_path = public
as $
declare
  v_revenue numeric(14,2);
  v_goods_cost numeric(14,2);
begin
  if jsonb_array_length(coalesce(NEW.items,'[]'::jsonb)) > 0 then
    select
      coalesce(sum(coalesce((item->>'qty_sold')::numeric,0) * coalesce((item->>'unit_price')::numeric,0)),0),
      coalesce(sum((coalesce((item->>'qty_sold')::numeric,0) + coalesce((item->>'qty_loss')::numeric,0)) * coalesce((item->>'unit_cost')::numeric,0)),0)
    into v_revenue, v_goods_cost
    from jsonb_array_elements(NEW.items) as item;

    NEW.items_revenue := round(v_revenue,2);
    NEW.items_goods_cost := round(v_goods_cost,2);
    NEW.items_net := round(
      v_revenue - v_goods_cost - coalesce(NEW.ice,0) - coalesce(NEW.transport,0) -
      coalesce(NEW.space_fee,0) - coalesce(NEW.helpers,0) - coalesce(NEW.other_costs,0),
      2
    );
  else
    NEW.items_revenue := null;
    NEW.items_goods_cost := null;
    NEW.items_net := null;
  end if;
  return NEW;
end;
$;

drop trigger if exists beverage_calculate_item_totals on public.beverage_events;
create trigger beverage_calculate_item_totals
before insert or update on public.beverage_events
for each row execute function public.calculate_beverage_item_totals();

-- Recalculate legacy multi-product events with the same item-level arithmetic.
update public.beverage_events set items = items
where jsonb_array_length(coalesce(items,'[]'::jsonb)) > 0;

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
      v_amount := coalesce(NEW.items_revenue,NEW.revenue,0);
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
    v_category,v_account_id,v_holder,v_operation,'confirmado','receita',
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
    nature = 'receita',
    notes = excluded.notes;

  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end;
$$;

drop trigger if exists sync_driving_income_to_finance on public.driving_sessions;
create trigger sync_driving_income_to_finance
after insert or update or delete on public.driving_sessions
for each row execute function public.sync_household_operational_income();

drop trigger if exists sync_beverage_income_to_finance on public.beverage_events;
create trigger sync_beverage_income_to_finance
after insert or update or delete on public.beverage_events
for each row execute function public.sync_household_operational_income();

drop trigger if exists sync_mimora_income_to_finance on public.ecommerce_daily_metrics;
create trigger sync_mimora_income_to_finance
after insert or update or delete on public.ecommerce_daily_metrics
for each row execute function public.sync_household_operational_income();

-- Normalize the visible labels stored with the shared workspace.
update public.households
set settings = jsonb_set(
  jsonb_set(coalesce(settings,'{}'::jsonb), '{user_label}', '"Renan"'::jsonb, true),
  '{partner_label}', '"Leticia"'::jsonb, true
);
