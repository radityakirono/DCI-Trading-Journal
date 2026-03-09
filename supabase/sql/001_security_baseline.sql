-- DCI Security Baseline
-- Run this script in Supabase SQL Editor before production deployment.

create extension if not exists pgcrypto;

-- Ensure owner columns exist for row-level security.
alter table if exists public.transactions
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists created_at timestamptz not null default now();

alter table if exists public.cash_journal
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists created_at timestamptz not null default now();

alter table if exists public.signal_notifications
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists created_at timestamptz not null default now();

alter table if exists public.transactions
  alter column user_id set default auth.uid();

alter table if exists public.cash_journal
  alter column user_id set default auth.uid();

alter table if exists public.signal_notifications
  alter column user_id set default auth.uid();

create index if not exists idx_transactions_user_date
  on public.transactions (user_id, date desc);

create index if not exists idx_cash_journal_user_date
  on public.cash_journal (user_id, date desc);

create index if not exists idx_signal_notifications_user_created
  on public.signal_notifications (user_id, created_at desc);

-- Strict row-level security for core tables.
alter table if exists public.transactions enable row level security;
alter table if exists public.cash_journal enable row level security;
alter table if exists public.signal_notifications enable row level security;

drop policy if exists "transactions_select_own" on public.transactions;
create policy "transactions_select_own"
  on public.transactions for select
  using (auth.uid() = user_id);

drop policy if exists "transactions_insert_own" on public.transactions;
create policy "transactions_insert_own"
  on public.transactions for insert
  with check (auth.role() = 'authenticated' and auth.uid() = user_id);

drop policy if exists "transactions_update_own" on public.transactions;
create policy "transactions_update_own"
  on public.transactions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "transactions_delete_own" on public.transactions;
create policy "transactions_delete_own"
  on public.transactions for delete
  using (auth.uid() = user_id);

drop policy if exists "cash_journal_select_own" on public.cash_journal;
create policy "cash_journal_select_own"
  on public.cash_journal for select
  using (auth.uid() = user_id);

drop policy if exists "cash_journal_insert_own" on public.cash_journal;
create policy "cash_journal_insert_own"
  on public.cash_journal for insert
  with check (auth.role() = 'authenticated' and auth.uid() = user_id);

drop policy if exists "cash_journal_update_own" on public.cash_journal;
create policy "cash_journal_update_own"
  on public.cash_journal for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "cash_journal_delete_own" on public.cash_journal;
create policy "cash_journal_delete_own"
  on public.cash_journal for delete
  using (auth.uid() = user_id);

drop policy if exists "signal_notifications_select_own" on public.signal_notifications;
create policy "signal_notifications_select_own"
  on public.signal_notifications for select
  using (auth.uid() = user_id);

drop policy if exists "signal_notifications_insert_own_or_service" on public.signal_notifications;
create policy "signal_notifications_insert_own_or_service"
  on public.signal_notifications for insert
  with check (
    auth.role() = 'service_role'
    or (auth.role() = 'authenticated' and auth.uid() = user_id)
  );

drop policy if exists "signal_notifications_update_own" on public.signal_notifications;
create policy "signal_notifications_update_own"
  on public.signal_notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "signal_notifications_delete_own" on public.signal_notifications;
create policy "signal_notifications_delete_own"
  on public.signal_notifications for delete
  using (auth.uid() = user_id);

-- Centralized audit trail for sensitive mutations.
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  entity_type text not null,
  entity_id text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_user_created
  on public.audit_logs (user_id, created_at desc);

alter table public.audit_logs enable row level security;

drop policy if exists "audit_logs_select_own" on public.audit_logs;
create policy "audit_logs_select_own"
  on public.audit_logs for select
  using (auth.uid() = user_id);

drop policy if exists "audit_logs_insert_own" on public.audit_logs;
create policy "audit_logs_insert_own"
  on public.audit_logs for insert
  with check (auth.role() = 'authenticated' and auth.uid() = user_id);

drop function if exists public.log_financial_mutation();
create or replace function public.log_financial_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid;
  entity_id_value text;
  before_payload jsonb;
  after_payload jsonb;
begin
  actor_id := coalesce(new.user_id, old.user_id);
  entity_id_value := coalesce(new.id::text, old.id::text);
  before_payload := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) - 'user_id' else null end;
  after_payload := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) - 'user_id' else null end;

  if actor_id is not null and entity_id_value is not null then
    insert into public.audit_logs (user_id, action, entity_type, entity_id, payload)
    values (
      actor_id,
      tg_op,
      tg_table_name,
      entity_id_value,
      jsonb_build_object('before', before_payload, 'after', after_payload)
    );
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_transactions_audit on public.transactions;
create trigger trg_transactions_audit
after insert or update or delete on public.transactions
for each row
execute function public.log_financial_mutation();

drop trigger if exists trg_cash_journal_audit on public.cash_journal;
create trigger trg_cash_journal_audit
after insert or update or delete on public.cash_journal
for each row
execute function public.log_financial_mutation();
