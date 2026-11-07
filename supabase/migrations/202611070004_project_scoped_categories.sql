-- Reusable project-scoped categories and durable links for financial records.
alter table public.categories
  add column if not exists project_node_id uuid references public.project_nodes(id) on delete cascade,
  add column if not exists color text not null default 'slate',
  add column if not exists icon text not null default 'tag';

create unique index if not exists categories_household_global_name_uq
  on public.categories (household_id, lower(name)) where project_node_id is null and archived = false;
create unique index if not exists categories_project_name_uq
  on public.categories (household_id, project_node_id, lower(name)) where project_node_id is not null and archived = false;

alter table public.transactions
  add column if not exists project_id uuid,
  add column if not exists category_id uuid;

create unique index if not exists project_nodes_id_household_uq on public.project_nodes(id, household_id);
create unique index if not exists categories_id_household_uq on public.categories(id, household_id);

alter table public.transactions
  add constraint transactions_project_household_fk
    foreign key (project_id, household_id) references public.project_nodes(id, household_id) on delete restrict,
  add constraint transactions_category_household_fk
    foreign key (category_id, household_id) references public.categories(id, household_id) on delete restrict;

create index if not exists transactions_project_date_idx on public.transactions(household_id, project_id, date desc);
create index if not exists transactions_category_date_idx on public.transactions(household_id, category_id, date desc);

-- Keep legacy records readable. Existing text labels are not force-mapped because ambiguous matches
-- could silently assign money to the wrong project or category.
