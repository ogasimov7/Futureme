-- Fields and tables the app gained after the initial schema (stage 1.5/1.6):
-- persona + onboarding preferences, "Peşman olacam?" history, and client-written chat
-- messages (users may store their own chat history; AI quota stays server-side).

-- ---------------------------------------------------------------------------
-- Persona and onboarding
-- ---------------------------------------------------------------------------

alter table public.user_preferences
  add column onboarded boolean not null default false,
  add column future_self_name text not null default 'Gələcək Sən'
    check (char_length(future_self_name) between 1 and 40),
  add column future_year smallint not null default (extract(year from now())::int + 5)
    check (future_year between 2026 and 2100);

alter table public.profiles alter column locale set default 'az';

-- ---------------------------------------------------------------------------
-- "Peşman olacam?" checks
-- ---------------------------------------------------------------------------

create table public.regret_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 200),
  category text not null check (category in (
    'shopping', 'ex', 'night', 'food', 'procrastination', 'skip_workout', 'good', 'danger', 'crisis', 'other'
  )),
  -- Joke meter; null for sincere answers (crisis, danger).
  regret smallint check (regret between 0 and 100),
  verdict text not null check (char_length(verdict) between 1 and 400),
  parallel text check (char_length(parallel) <= 300),
  personality public.personality not null,
  source text not null check (source in ('ai', 'offline')),
  outcome text check (outcome in ('skipped', 'did_it')),
  created_at timestamptz not null default now()
);
create index regret_checks_user_idx on public.regret_checks (user_id, created_at desc);

alter table public.regret_checks enable row level security;
-- Supabase's default privileges grant ALL on new tables to anon/authenticated; reset first so
-- the column-level update grant below is the only way to change a row.
revoke all on public.regret_checks from anon, authenticated;
grant select, insert, delete on public.regret_checks to authenticated;
-- After creation only the user's decision may change, never the verdict or the meter.
grant update (outcome) on public.regret_checks to authenticated;

create policy "own regret checks" on public.regret_checks
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Chat history written by the app
-- ---------------------------------------------------------------------------

alter table public.messages
  add column source text check (source in ('ai', 'offline'));

grant insert on public.conversations, public.messages to authenticated;

drop policy "own conversations" on public.conversations;
create policy "own conversations" on public.conversations
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Messages may only be added to the user's own conversation.
drop policy "own messages" on public.messages;
create policy "read own messages" on public.messages
  for select to authenticated using (user_id = (select auth.uid()));
create policy "delete own messages" on public.messages
  for delete to authenticated using (user_id = (select auth.uid()));
create policy "add own messages" on public.messages
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.conversations c where c.id = conversation_id and c.user_id = (select auth.uid())
    )
  );
