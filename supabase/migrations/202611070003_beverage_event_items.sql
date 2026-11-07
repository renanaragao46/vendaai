-- Multi-product event register for beverage operations.
alter table public.beverage_events
  add column if not exists items jsonb not null default '[]'::jsonb;

alter table public.beverage_events
  drop constraint if exists beverage_events_items_is_array;

alter table public.beverage_events
  add constraint beverage_events_items_is_array
  check (jsonb_typeof(items) = 'array');
