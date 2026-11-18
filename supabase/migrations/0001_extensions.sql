-- 0001_extensions.sql
-- Extensions required by later QuickBiz Studio stages.
-- Applied once per environment. Safe to re-run because of IF NOT EXISTS.

create extension if not exists pgcrypto;   -- gen_random_uuid(), digest()
create extension if not exists citext;     -- case-insensitive email/name columns
create extension if not exists pg_trgm;    -- trigram search for tool/saved-result search

comment on extension pgcrypto is 'UUID generation and hashing helpers';
comment on extension citext is 'Case-insensitive text for identity fields';
comment on extension pg_trgm is 'Fuzzy search for catalogue and saved results';
