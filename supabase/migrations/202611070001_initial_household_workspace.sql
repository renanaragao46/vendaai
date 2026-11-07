create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  settings jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null,
  email text,
  display_name text,
  role text not null default 'member' check (role in ('owner','member')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, user_id)
);
create table public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  email text not null,
  invited_by uuid default auth.uid(),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, email)
);

create or replace function public.is_household_member(_hid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.household_members where household_id = _hid and user_id = auth.uid())
$$;

create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;

-- domain tables
create table public.accounts (id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  name text not null, holder text not null default 'usuario', type text not null default 'pessoal', initial_balance numeric(14,2), initial_status text not null default 'a_confirmar', archived boolean not null default false, notes text,
  created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.categories (id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  name text not null, kind text not null default 'despesa', archived boolean not null default false,
  created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.transactions (id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  date date not null default current_date, amount numeric(14,2) not null check (amount > 0), direction text not null check (direction in ('entrada','saida','transferencia')),
  description text not null, category text, account_id uuid references public.accounts(id) on delete set null, transfer_account_id uuid references public.accounts(id) on delete set null,
  holder text not null default 'usuario', counterparty text, operation text, payment_method text, recurrence text default 'nenhuma', receipt_link text,
  status text not null default 'confirmado', nature text not null default 'despesa', notes text,
  created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (direction <> 'transferencia' or transfer_account_id is not null));
create table public.debts (id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  creditor text not null, holder text not null default 'usuario', contract text, contract_date date, original_amount numeric(14,2), rate numeric(8,4), cet numeric(8,4),
  installments_total int, installment_value numeric(14,2), installments_paid int default 0, periodicity text default 'mensal', due_day int, next_due date,
  balance_informed numeric(14,2), payoff_value numeric(14,2), fees_insurance text, overdue boolean default false, guarantees text, contract_link text,
  status text not null default 'a_confirmar', notes text, archived boolean not null default false,
  created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.budgets (id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  name text not null, kind text not null default 'despesa', month date, holder text default 'usuario', account_id uuid references public.accounts(id) on delete set null,
  category text, envelope text, planned_amount numeric(14,2), percent numeric(5,2), recurrence text default 'mensal', essential boolean default false,
  status text not null default 'a_confirmar', notes text,
  created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.assets (id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  name text not null, kind text not null default 'ativo' check (kind in ('ativo','passivo')), class text default 'uso_pessoal', holder text default 'usuario',
  value numeric(14,2), documented boolean default false, status text not null default 'a_confirmar', notes text,
  created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.project_nodes (id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  parent_id uuid references public.project_nodes(id) on delete set null, label text not null, description text, objectives text, status text default 'planejado',
  owner text, due_date date, metrics text, risks text, costs numeric(14,2), links text, notes text, pos_x double precision default 0, pos_y double precision default 0,
  collapsed boolean not null default false, archived boolean not null default false,
  created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.project_edges (id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  source uuid not null references public.project_nodes(id) on delete cascade, target uuid not null references public.project_nodes(id) on delete cascade, label text,
  created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.tasks (id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  title text not null, description text, status text not null default 'todo' check (status in ('todo','doing','done','blocked')), priority text default 'media',
  assignee text, due_date date, est_minutes int, actual_minutes int, project text, node_id uuid references public.project_nodes(id) on delete set null,
  checklist jsonb not null default '[]'::jsonb, recurrence text default 'nenhuma', depends_on text, attachment_link text, is_template boolean default false, notes text, archived boolean not null default false,
  created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.driving_sessions (id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  date date not null default current_date, platform text not null default 'Uber', start_time time, end_time time, hours_online numeric(6,2),
  km_start numeric(10,1), km_end numeric(10,1), gross numeric(12,2) not null default 0, tips numeric(12,2) default 0,
  fuel_liters numeric(8,2), fuel_price numeric(8,3), fuel_cost numeric(12,2) default 0, tolls numeric(12,2) default 0, wash numeric(12,2) default 0,
  maintenance numeric(12,2) default 0, rent_alloc numeric(12,2) default 0, other_costs numeric(12,2) default 0, notes text,
  km numeric(10,1) generated always as (case when km_end is not null and km_start is not null then km_end - km_start end) stored,
  net numeric(12,2) generated always as (gross + coalesce(tips,0) - coalesce(fuel_cost,0) - coalesce(tolls,0) - coalesce(wash,0) - coalesce(maintenance,0) - coalesce(rent_alloc,0) - coalesce(other_costs,0)) stored,
  created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.beverage_events (id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  name text not null, location text, date date, status text not null default 'planejado', permissions text, supplier text,
  stock_initial int default 0, unit_cost numeric(10,2) default 0, unit_price numeric(10,2) default 0, qty_sold int default 0, losses int default 0,
  ice numeric(10,2) default 0, transport numeric(10,2) default 0, space_fee numeric(10,2) default 0, helpers numeric(10,2) default 0, other_costs numeric(10,2) default 0, hours numeric(6,2), notes text,
  revenue numeric(12,2) generated always as (coalesce(qty_sold,0) * coalesce(unit_price,0)) stored,
  stock_final int generated always as (coalesce(stock_initial,0) - coalesce(qty_sold,0) - coalesce(losses,0)) stored,
  net numeric(12,2) generated always as (coalesce(qty_sold,0)*coalesce(unit_price,0) - coalesce(qty_sold,0)*coalesce(unit_cost,0) - coalesce(losses,0)*coalesce(unit_cost,0) - coalesce(ice,0) - coalesce(transport,0) - coalesce(space_fee,0) - coalesce(helpers,0) - coalesce(other_costs,0)) stored,
  created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.ecommerce_daily_metrics (id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  date date not null default current_date, store text default 'MIMORA', campaign text, creative text, product text,
  ad_spend numeric(12,2) default 0, impressions int default 0, reach int default 0, clicks int default 0, conversations int default 0, qualified_leads int default 0,
  orders int default 0, approved_payments int default 0, cancellations int default 0, refunds numeric(12,2) default 0, revenue numeric(12,2) default 0,
  platform_cost numeric(12,2) default 0, fees numeric(12,2) default 0, notes text,
  contribution numeric(12,2) generated always as (coalesce(revenue,0) - coalesce(platform_cost,0) - coalesce(fees,0) - coalesce(refunds,0) - coalesce(ad_spend,0)) stored,
  created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.products (id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  name text not null, store text default 'MIMORA', price numeric(10,2), cost numeric(10,2), fee numeric(10,2), status text default 'teste', link text, notes text,
  created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.six_month_phases (id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  number int not null, title text not null, start_date date, end_date date, objectives text, checklist jsonb not null default '[]'::jsonb, deliverables text,
  owner text, status text default 'planejado', risks text, metrics text, review_note text,
  created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.notes (id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  title text not null, body text, tags text[] not null default '{}', linked_type text, linked_id uuid, pinned boolean default false, attachment_link text,
  created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.decisions (id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  date date default current_date, title text not null, context text, alternatives text, decision text, reason text, owner text, risk text, review_date date, result text, status text default 'aberta',
  created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.meetings (id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  date date not null default current_date, kind text default 'semanal', agenda jsonb not null default '[]'::jsonb, minutes text, decisions text, actions jsonb not null default '[]'::jsonb,
  created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.knowledge_lessons (id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  title text not null, summary text, concepts text, application text, personal_notes text, actions text, study_status text default 'a_estudar',
  created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.rules (id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  kind text not null default 'regra' check (kind in ('regra','prioridade')), number int, title text not null, status text default 'ativa', exception text, notes text, history jsonb not null default '[]'::jsonb,
  created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now());

-- grants, RLS, policies, triggers
grant select, insert, update, delete on public.households, public.household_members, public.household_invites to authenticated;
grant all on public.households, public.household_members, public.household_invites to service_role;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invites enable row level security;
create policy "members read household" on public.households for select to authenticated using (public.is_household_member(id));
create policy "members update household" on public.households for update to authenticated using (public.is_household_member(id)) with check (public.is_household_member(id));
create policy "members read members" on public.household_members for select to authenticated using (public.is_household_member(household_id));
create policy "members update own row" on public.household_members for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_household_member(household_id));
create policy "owner removes members" on public.household_members for delete to authenticated using (exists (select 1 from public.household_members m where m.household_id = household_members.household_id and m.user_id = auth.uid() and m.role='owner') and user_id <> auth.uid());
create policy "members manage invites" on public.household_invites for all to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create trigger t_households before update on public.households for each row execute function public.touch_updated_at();
create trigger t_members before update on public.household_members for each row execute function public.touch_updated_at();

do $$
declare t text;
begin
  foreach t in array array['accounts','categories','transactions','debts','budgets','assets','project_nodes','project_edges','tasks','driving_sessions','beverage_events','ecommerce_daily_metrics','products','six_month_phases','notes','decisions','meetings','knowledge_lessons','rules'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "household members all" on public.%I for all to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id))', t);
    execute format('create trigger t_%s before update on public.%I for each row execute function public.touch_updated_at()', t, t);
    execute format('create index on public.%I (household_id)', t);
  end loop;
end $$;

-- accept pending invites for the signed-in user's email
create or replace function public.accept_my_invites() returns int language plpgsql security definer set search_path = public as $$
declare v_email text := lower(coalesce(auth.jwt() ->> 'email','')); n int := 0; r record;
begin
  if auth.uid() is null or v_email = '' then return 0; end if;
  for r in select * from public.household_invites where lower(email) = v_email and accepted_at is null loop
    insert into public.household_members(household_id, user_id, email, role) values (r.household_id, auth.uid(), v_email, 'member') on conflict do nothing;
    update public.household_invites set accepted_at = now() where id = r.id;
    n := n + 1;
  end loop;
  return n;
end $$;

-- create household + seed
create or replace function public.create_household(p_name text, p_display_name text) returns uuid language plpgsql security definer set search_path = public as $$
declare h uuid; root uuid; b uuid; i int; j int; uid uuid := auth.uid();
  branches text[] := array['Base financeira familiar','Geração de caixa','Estrutura empresarial','Desenvolvimento pessoal e rotina','Patrimônio e liberdade'];
  kids text[][] := array[
    array['Saldos e fluxo de caixa','Dívidas e renegociação','Orçamento pessoal de cada um','Obrigações e despesas fixas','Reserva de emergência','Patrimônio líquido'],
    array['Uber e 99 (motorista)','Venda de bebidas em eventos/estádio','MIMORA / Kaiross (e-commerce)','Futuro negócio de moda feminina','',''],
    array['Avaliar abertura de CNPJ','Titularidade e responsabilidades','CNAEs e regime tributário com contador','Conta PJ e separação patrimonial','Contabilidade e documentação',''],
    array['Rotina diária','Revisão semanal do casal','Aprendizado financeiro e empresarial','Saúde, descanso e consistência','',''],
    array['Reserva','Redução de dívidas','Investimentos','Ativos produtivos','Marcos de patrimônio','']];
  n uuid;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if exists (select 1 from public.household_members where user_id = uid) then raise exception 'Você já participa de um household'; end if;
  insert into public.households(name, created_by, settings) values (coalesce(nullif(p_name,''),'Projeto de Vida'), uid, jsonb_build_object(
    'week_start','segunda','timezone','America/Sao_Paulo','currency','BRL','plan_start','2026-11-07','plan_end','2027-05-07',
    'reserve_target', null, 'reserve_months_ref','3–6 meses de despesas essenciais (referência)',
    'uber_goal_day_min',350,'uber_goal_day_max',500,'uber_goal_week_min',2500,'uber_goal_week_ideal',3000,'uber_goals_status','historico',
    'car_rent_week',735,'car_rent_status','a_confirmar','partner_label','Leticia','user_label','Renan')) returning id into h;
  insert into public.household_members(household_id,user_id,email,display_name,role) values (h, uid, auth.jwt()->>'email', p_display_name, 'owner');

  insert into public.accounts(household_id,name,holder,type,initial_balance,initial_status) values
    (h,'Pessoal — Renan','usuario','pessoal',0,'confirmado'),(h,'Pessoal — Leticia','companheira','pessoal',0,'confirmado'),
    (h,'Mercado Pago — Nossa','conjunto','digital',0,'confirmado'),(h,'Dinheiro em espécie','conjunto','especie',0,'confirmado');
  insert into public.categories(household_id,name,kind) select h, c, 'despesa' from unnest(array['Moradia','Alimentação','Combustível','Aluguel do veículo','Manutenção','Telefone/internet','Saúde','Lazer','Maçonaria/compromissos pessoais','Parcelas de dívidas','Impostos','Taxas','Estoque','Gelo','Transporte/logística','Anúncios','Taxas de plataforma','Pró-labore','Aporte','Empréstimo entre partes','Retirada','Investimento','Outros']) c;
  insert into public.categories(household_id,name,kind) select h, c, 'receita' from unnest(array['Uber','99','Bebidas/eventos','MIMORA','Salário CLT','Reembolso','Outros']) c;

  insert into public.debts(household_id,creditor,holder,contract,installments_total,installment_value,status,notes) values (h,'Empréstimo familiar refinanciado (credor a confirmar)','usuario','A levantar',108,566,'a_confirmar',
   'A confirmar — conferir contrato. Estimativas: primeira operação ~R$6.000–7.000; refinanciamento/novo crédito ~R$16.000; ~108 parcelas de ~R$566 (total aritmético R$61.128 se confirmado). Principal, CET, taxa e saldo atual NÃO informados. Dinheiro foi usado em consumo e custos do carro, sem retorno produtivo. Prioridade: impedir repetição e levantar contrato, CET, saldo de quitação, vencimentos e parcelas pagas.');

  insert into public.budgets(household_id,name,kind,holder,category,planned_amount,recurrence,essential,status,notes) values
   (h,'Aluguel do veículo (R$735/semana)','despesa','usuario','Aluguel do veículo',3185,'semanal',true,'a_confirmar','Histórico: R$735/semana ≈ R$3.185/mês (735×52/12) ≈ R$38.220/ano enquanto o contrato semanal estiver ativo. Confirmar contrato atual.'),
   (h,'Maçonaria','despesa','usuario','Maçonaria/compromissos pessoais',250,'mensal',false,'a_confirmar','Cerca de R$250/mês + custos associados. Confirmar valor atual.'),
   (h,'Parcela empréstimo familiar','despesa','usuario','Parcelas de dívidas',566,'mensal',true,'a_confirmar','Estimativa ~R$566 — conferir contrato.'),
   (h,'Salário CLT Leticia (novo emprego a partir de 09/11/2026)','receita','companheira','Salário CLT',null,'mensal',false,'a_confirmar','"R$2 mil e alguma coisa" — líquido/bruto desconhecido. Previsão pessoal a confirmar; NÃO é dinheiro disponível nem receita PJ.');
  insert into public.budgets(household_id,name,kind,envelope,status,notes) select h, e, 'envelope', e, 'a_confirmar', 'Percentual configurável — definir após conhecer receitas e despesas reais.' from unnest(array['Operação','Vida/Essenciais','Obrigações','Proteção/Reserva','Crescimento']) e;

  insert into public.project_nodes(household_id,label,description,status,pos_x,pos_y) values (h,'Projeto de Vida','Construir em silêncio. Executar com método.','em_andamento',0,0) returning id into root;
  for i in 1..5 loop
    insert into public.project_nodes(household_id,parent_id,label,status,pos_x,pos_y) values (h,root,branches[i],'planejado',(i-3)*300,180) returning id into b;
    insert into public.project_edges(household_id,source,target) values (h,root,b);
    for j in 1..6 loop
      if kids[i][j] <> '' then
        insert into public.project_nodes(household_id,parent_id,label,status,pos_x,pos_y,description) values (h,b,kids[i][j],
          case when kids[i][j] like 'Futuro%' or kids[i][j] like 'Avaliar%' then 'ideia' else 'planejado' end,(i-3)*300,300+(j-1)*80,
          case kids[i][j] when 'Futuro negócio de moda feminina' then 'Ideia futura da Leticia — não é receita atual.' when 'Avaliar abertura de CNPJ' then 'Em avaliação — não assumir aberto.' when 'Venda de bebidas em eventos/estádio' then 'Ideia/operação a estruturar; sem receita confirmada.' when 'MIMORA / Kaiross (e-commerce)' then 'E-commerce em reposicionamento sazonal; registrar somente pedidos e repasses efetivamente confirmados.' else null end) returning id into n;
        insert into public.project_edges(household_id,source,target) values (h,b,n);
      end if;
    end loop;
  end loop;

  insert into public.tasks(household_id,title,project,recurrence,is_template,est_minutes,checklist,description) values
   (h,'Rotina da manhã','Rotina','diaria',true,15,'[{"text":"Olhar saldo de cada conta","done":false},{"text":"Revisar vencimentos","done":false},{"text":"Escolher 3 prioridades","done":false},{"text":"Definir meta de faturamento e horas","done":false},{"text":"Checar veículo/combustível e agenda","done":false},{"text":"Planejar tarefa principal do projeto","done":false}]','10–15 min, horário ajustável.'),
   (h,'Turno de trabalho','Uber/99','diaria',true,null,'[{"text":"Registrar início/fim","done":false},{"text":"Registrar km e custos","done":false},{"text":"Acompanhar desempenho por hora e segurança","done":false},{"text":"Evitar gasto impulsivo durante o trabalho","done":false}]','Horários conforme disponibilidade (referência histórica: manhã e tarde/noite, a confirmar).'),
   (h,'Bloco de operação digital','MIMORA','diaria',true,45,'[{"text":"Responder leads","done":false},{"text":"Conferir pedidos/pagamentos","done":false},{"text":"Verificar campanhas e custo por conversa","done":false},{"text":"Registrar leads/vendas","done":false},{"text":"Ajustar criativos com hipótese","done":false},{"text":"Não mudar por amostra pequena","done":false}]','30–60 min, ajustável.'),
   (h,'Evento de bebidas (quando houver)','Bebidas','por_evento',true,null,'[{"text":"Checar autorização","done":false},{"text":"Preparar estoque e gelo","done":false},{"text":"Registrar quantidade/custo","done":false},{"text":"Fechar caixa e contar estoque","done":false}]',null),
   (h,'Fechamento da noite','Rotina','diaria',true,20,'[{"text":"Lançar todas entradas/saídas","done":false},{"text":"Reconciliar dinheiro físico e contas","done":false},{"text":"Registrar métricas Uber/99 e projetos","done":false},{"text":"Atualizar tarefas","done":false},{"text":"Planejar amanhã","done":false},{"text":"Anotar aprendizado/erro e correção","done":false}]','15–20 min.'),
   (h,'Revisão semanal do casal','Rotina','semanal',true,40,'[{"text":"Receitas por fonte","done":false},{"text":"Despesas","done":false},{"text":"Dívidas","done":false},{"text":"Saldo e reserva","done":false},{"text":"Lucro de cada operação","done":false},{"text":"Campanhas e eventos","done":false},{"text":"Tarefas e agenda da semana","done":false},{"text":"Decisão de reinvestimento","done":false}]','Registrar ata em Reuniões.'),
   (h,'Fechamento mensal','Rotina','mensal',true,90,'[{"text":"Fechamento de caixa","done":false},{"text":"Orçamento previsto x realizado","done":false},{"text":"Balanço patrimonial simples","done":false},{"text":"Análise de dívidas","done":false},{"text":"Performance por negócio","done":false},{"text":"Atualizar metas 6 meses","done":false}]',null);
  insert into public.tasks(household_id,title,project,priority,status) select h, t, 'CNPJ', 'media', 'todo' from unnest(array['Consulta com contador','Escolher atividade real','Definir CNAE','Definir regime tributário','Contrato/estrutura societária','Inscrição e licenças','Abrir conta PJ','Configurar emissão fiscal','Fluxo de caixa da empresa','Política de reembolso/retiradas','Organizar documentação']) t;
  insert into public.tasks(household_id,title,project,priority,status,due_date) values
   (h,'Levantar contrato do empréstimo (CET, saldo, quitação, parcelas pagas)','Dívidas','alta','todo','2026-11-20'),
   (h,'Informar saldo inicial de todas as contas','Finanças','alta','todo','2026-11-10'),
   (h,'Confirmar contrato atual do aluguel do carro','Uber/99','alta','todo','2026-11-15');

  insert into public.six_month_phases(household_id,number,title,start_date,end_date,objectives,deliverables,checklist) values
   (h,1,'Diagnóstico e controle','2026-11-07','2026-12-06','Levantar contratos, saldo de todas as contas, despesas pessoais e fixas, vencimentos, custo real do carro, horas/ganhos Uber/99, métricas MIMORA, regras e custos de bebidas. Separar contas e lançar 100% das movimentações. Definir rotina e reunião semanal.','Mapa completo de dívidas, orçamento real, dashboard confiável, baseline de operações.','[{"text":"Contratos levantados","done":false},{"text":"Saldos informados","done":false},{"text":"100% das movimentações lançadas","done":false},{"text":"Reunião semanal definida","done":false}]'),
   (h,2,'Estabilizar caixa e execução','2026-12-07','2027-01-06','Intensificar Uber/99 com metas líquidas por hora/dia; controlar combustível e aluguel; testar bebidas com lote limitado e fechar DRE por evento; manter MIMORA em testes medidos; evitar expansão de gastos.','4 semanas de dados, margem real das operações, plano de pagamentos.','[]'),
   (h,3,'Avaliar veículo e empresa','2027-01-07','2027-02-06','Analisar por escrito qualquer proposta do carro (preço total, entrada, parcelas, propriedade, manutenção, seguro, inadimplência, saída) — não tratar como próprio antes da transferência. Consultar contador e decidir CNPJ. Reavaliar dívida com CET/quitação.','Decisão documentada sobre carro/CNPJ.','[]'),
   (h,4,'Otimizar e validar','2027-02-07','2027-03-06','Concentrar em operações com lucro comprovado; melhorar conversão e margem MIMORA; repetir só eventos rentáveis; reserva inicial sem retirar das obrigações. Se houver capacidade, desenhar teste de moda sem grande estoque.',null,'[]'),
   (h,5,'Consolidar processo','2027-03-07','2027-04-06','Automatizar relatórios; formalizar rotinas; avaliar margem, estabilidade e capacidade; piloto de roupas de baixo risco se validado; rever alocação de caixa.',null,'[]'),
   (h,6,'Fechamento e próximo ciclo','2027-04-07','2027-05-07','Comparar baseline e resultado; patrimônio líquido; redução de dívidas; reserva; lucro por operação; plano dos próximos 12 meses. Metas numéricas só após baseline.',null,'[]');

  insert into public.rules(household_id,kind,number,title) select h,'prioridade',o,t from unnest(array['Visibilidade total do dinheiro','Cobrir custos necessários para trabalhar e despesas essenciais','Entender e cumprir dívidas','Evitar novo endividamento de consumo','Formar reserva','Medir e validar operações','Reinvestir somente em operação comprovada','Avaliar CNPJ e veículo','Moda somente após caixa e validação']) with ordinality as x(t,o);
  insert into public.rules(household_id,kind,number,title) select h,'regra',o,t from unnest(array['Não contrair dívida para consumo.','Não misturar dinheiro pessoal e empresarial.','Registrar 100% das entradas e saídas.','Transferências entre contas não são receita nova.','Salário CLT não é faturamento PJ.','Não escalar anúncios sem conversão e margem.','Não comprar estoque grande sem validação.','Não comprometer receita futura incerta.','Não drenar reserva para despesas não essenciais.','Toda decisão de crédito passa por CET, custo total, fluxo de caixa e cenário pessimista.','Não contar carro como patrimônio próprio antes de contrato e transferência de titularidade.','Reunião semanal e fechamento diário.','Descanso e segurança fazem parte do sistema.']) with ordinality as x(t,o);

  insert into public.knowledge_lessons(household_id,title,summary,concepts) values
   (h,'Aula 01 — Educação financeira','Gerar, preservar e multiplicar dinheiro.','Valor do trabalho/dinheiro/tempo; escassez e escala; inflação e juros compostos; patrimônio e fluxo de caixa; estilo de vida inflacionado; orçamento; reserva de 3–6 meses; investimentos em termos reais; impostos e planejamento legal.'),
   (h,'Aula 02 — Alavancagem financeira','Capital de terceiros amplia ganhos e perdas.','Crédito produtivo vs. consumo; CET; fluxo de caixa precisa suportar parcelas; vacância/manutenção/impostos reduzem retorno de aluguel; valorização não paga parcela; home equity arrisca o imóvel; banco aprovar não valida o investimento. Quatro perguntas: o que financia, custo completo, fonte de pagamento, cenário pessimista.');

  insert into public.notes(household_id,title,body,tags,pinned) values
   (h,'MIMORA — situação inicial','Loja online em reposicionamento para produtos sazonais/Natal. Atualizar o catálogo conforme os produtos realmente ativos. Contar como receita somente o repasse líquido efetivamente recebido; acompanhar anúncios, pedidos aprovados, cancelamentos e margem sem presumir vendas.','{mimora,historico}',true),
   (h,'Carro — possível aquisição a partir de jan/2027','Não registrar como propriedade. Exigir contrato por escrito, custo total, titularidade e condições de saída antes de qualquer decisão.','{carro,a_confirmar}',true),
   (h,'CNPJ — em avaliação','Ideia de abrir no nome da Leticia (relata nome limpo). Titular do CNPJ é responsável legal; nome limpo não garante crédito. Definir participação, poderes, responsabilidades, CNAEs, regime, município, licenças e contador antes de abrir. Não "aquecer" CNPJ com movimentação artificial.','{cnpj}',false),
   (h,'Moda feminina — ideia futura','Sourcing no Brás, vendas/entregas no ABC com Meta, Instagram, site, WhatsApp e automação. Validar sem grande estoque (lote pequeno, pré-venda, consignação se viável). Papéis sugeridos: Renan — tecnologia, anúncios, automação e finanças; Leticia — curadoria, fornecedores, produto e atendimento (validar agenda após o novo emprego). Não misturar posicionamento com escovas sem testar coerência de marca.','{moda,ideia}',false),
   (h,'Bebidas — exemplo ilustrativo (não é venda real)','Exemplo: 100 unidades a R$3, venda a R$6 = R$600 de receita e R$300 de margem bruta ANTES de gelo, transporte, taxas e perdas. Validar autorização/regras do evento e testar demanda antes de comprar coolers/estoque adicional.','{bebidas,ilustrativo}',false);
  return h;
end $$;

grant execute on function public.create_household(text,text) to authenticated;
grant execute on function public.accept_my_invites() to authenticated;
grant execute on function public.is_household_member(uuid) to authenticated;