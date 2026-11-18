-- 0002_conventions.sql
-- Shared conventions that every later table relies on.
-- These functions are internal plumbing; the browser never calls them directly.

-- Keep updated_at honest on every table that has the column.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.touch_updated_at() is
  'Trigger function: sets updated_at = now() on row update.';

-- Append-only guard for ledgers and audit tables. A ledger row must never change
-- after it is written; corrections are new compensating rows.
create or replace function public.reject_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Table %.% is append-only; insert a compensating row instead',
    tg_table_schema, tg_table_name;
end;
$$;

comment on function public.reject_mutation() is
  'Trigger function: blocks UPDATE/DELETE on append-only tables.';

-- Usage reminder for Stage 4+:
--   create trigger set_updated_at before update on public.profiles
--     for each row execute function public.touch_updated_at();
--   create trigger no_update before update or delete on public.credit_transactions
--     for each row execute function public.reject_mutation();
