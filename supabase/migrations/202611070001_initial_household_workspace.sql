-- Projeto de Vida: isolated household workspace schema.
create extension if not exists pgcrypto;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create or replace function public.is_workspace_member(target_workspace uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = target_workspace and user_id = auth.uid()
  );
$$;

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  transaction_date date not null default current_date,
  description text not null,
  amount numeric(14,2) not null check (amount > 0),
  direction text not null check (direction in ('income','expense')),
  category text not null,
  account_name text,
  project text,
  notes text,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  creditor text not null,
  description text not null,
  original_amount numeric(14,2),
  current_balance numeric(14,2),
  installment_amount numeric(14,2),
  installments_total integer,
  installments_paid integer not null default 0,
  monthly_rate numeric(8,4),
  cet_annual numeric(8,4),
  due_day integer,
  status text not null default 'active' check (status in ('active','paid','renegotiating')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  log_date date not null default current_date,
  operation text not null,
  hours numeric(7,2) not null default 0,
  kilometers numeric(10,2) not null default 0,
  gross_revenue numeric(14,2) not null default 0,
  fuel_cost numeric(14,2) not null default 0,
  rental_cost numeric(14,2) not null default 0,
  other_costs numeric(14,2) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  area text not null,
  status text not null default 'planned' check (status in ('planned','active','paused','done')),
  priority text not null default 'medium' check (priority in ('low','medium','high','critical')),
  target_date date,
  budget numeric(14,2),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  title text not null,
  details text,
  due_date date,
  status text not null default 'todo' check (status in ('todo','doing','done')),
  priority text not null default 'medium' check (priority in ('low','medium','high','critical')),
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  content text not null default '',
  area text not null default 'general',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  description text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.knowledge_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  source text,
  content text not null default '',
  category text not null default 'finance',
  created_at timestamptz not null default now()
);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  target_amount numeric(14,2),
  current_amount numeric(14,2) not null default 0,
  target_date date,
  status text not null default 'active' check (status in ('active','completed','paused')),
  created_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['transactions','debts','daily_logs','projects','tasks','notes','rules','knowledge_entries','goals'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists workspace_members_only on public.%I', t);
    execute format('create policy workspace_members_only on public.%I for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id))', t);
  end loop;
end $$;

alter table public.workspaces enable row level security;
drop policy if exists workspace_read_members on public.workspaces;
create policy workspace_read_members on public.workspaces for select using (public.is_workspace_member(id));
drop policy if exists workspace_update_members on public.workspaces;
create policy workspace_update_members on public.workspaces for update using (public.is_workspace_member(id)) with check (public.is_workspace_member(id));

alter table public.workspace_members enable row level security;
drop policy if exists members_read_same_workspace on public.workspace_members;
create policy members_read_same_workspace on public.workspace_members for select using (public.is_workspace_member(workspace_id));

grant select, insert, update, delete on public.transactions, public.debts, public.daily_logs, public.projects, public.tasks, public.notes, public.rules, public.knowledge_entries, public.goals to authenticated;
grant select, update on public.workspaces to authenticated;
grant select on public.workspace_members to authenticated;
