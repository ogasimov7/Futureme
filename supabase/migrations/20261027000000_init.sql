-- Future Roast: initial schema.
--
-- Principles
--   * Every user-owned row carries user_id -> auth.users(id) ON DELETE CASCADE, so deleting the
--     auth user (from the delete-account Edge Function) removes all of their data.
--   * RLS is enabled on every table. Clients get the narrowest grants that still work; rows
--     that only the server may write have no client write policies at all.
--   * Writes needing validation beyond a CHECK (letters, AI quota, delivery claiming) go
--     through functions. Those that bypass RLS are executable by service_role only.
--
-- STATUS (2026-10-27): applied cleanly to Postgres 17 (PGlite) with a stubbed auth schema,
-- and 16 RLS / function checks passed (cross-user isolation, sealed letter bodies, completion
-- date window, server-only functions, quota, delivery claiming, cascade delete). Not yet run
-- on a real Supabase stack. Do `supabase db reset` + pgTAP tests in stage 2.

-- ---------------------------------------------------------------------------
-- Types and helpers
-- ---------------------------------------------------------------------------

create type public.personality as enum ('sarcastic', 'supportive', 'strict', 'absurd');
create type public.delivery_kind as enum ('letter', 'mission_reminder', 'weekly_verdict');
create type public.delivery_status as enum (
  'pending',    -- waiting for send_at / next_attempt_at
  'sending',    -- claimed by a dispatcher run (lease; see claim_due_deliveries)
  'accepted',   -- Expo push service accepted the message (ticket ok); NOT proof of delivery
  'delivered',  -- push receipt confirmed hand-off to APNs/FCM
  'failed',     -- gave up after max attempts or permanent error
  'cancelled',  -- source removed (e.g. letter deleted) before sending
  'skipped'     -- user had notifications off or no device token at send time
);

create function public.is_valid_time_zone(tz text)
returns boolean
language sql stable
set search_path = ''
as $$
  select exists (select 1 from pg_catalog.pg_timezone_names where name = tz);
$$;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles and preferences
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 60),
  time_zone text not null default 'UTC' check (public.is_valid_time_zone(time_zone)),
  locale text not null default 'en' check (locale ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  personality public.personality not null default 'sarcastic',
  notify_mission_reminders boolean not null default true,
  notify_letter_deliveries boolean not null default true,
  notify_weekly_verdict boolean not null default true,
  quiet_hours_start smallint check (quiet_hours_start between 0 and 23),
  quiet_hours_end smallint check (quiet_hours_end between 0 and 23),
  ai_memory_enabled boolean not null default true,
  share_stats_with_ai boolean not null default true,
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger user_preferences_updated_at before update on public.user_preferences
  for each row execute function public.set_updated_at();

-- Create profile + preferences on sign-up. Time zone comes from sign-up metadata when valid.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tz text := coalesce(new.raw_user_meta_data ->> 'time_zone', 'UTC');
begin
  if not public.is_valid_time_zone(tz) then
    tz := 'UTC';
  end if;
  insert into public.profiles (id, display_name, time_zone)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 60), tz);
  insert into public.user_preferences (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- A user's current calendar day in their own time zone (server use).
create function public.user_today(uid uuid)
returns date
language sql stable
security definer
set search_path = ''
as $$
  select (now() at time zone coalesce((select time_zone from public.profiles where id = uid), 'UTC'))::date;
$$;

-- The caller's own current day; used by RLS policies.
create function public.my_today()
returns date
language sql stable
security definer
set search_path = ''
as $$
  select public.user_today(auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- AI chat
-- ---------------------------------------------------------------------------

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index conversations_user_idx on public.conversations (user_id, updated_at desc);
create trigger conversations_updated_at before update on public.conversations
  for each row execute function public.set_updated_at();

-- Inserted only by the `chat` Edge Function (service role), after validation and quota checks.
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 8000),
  personality public.personality not null,
  input_tokens integer check (input_tokens >= 0),
  output_tokens integer check (output_tokens >= 0),
  flagged boolean not null default false,  -- user reported this reply
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);

-- Facts the user explicitly approved for the AI to remember. Never written implicitly.
create table public.user_context_facts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  fact text not null check (char_length(fact) between 1 and 280),
  source_message_id uuid references public.messages (id) on delete set null,
  created_at timestamptz not null default now()
);
create index user_context_facts_user_idx on public.user_context_facts (user_id);

-- ---------------------------------------------------------------------------
-- Habits
-- ---------------------------------------------------------------------------

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  why text check (char_length(why) <= 200),
  created_at timestamptz not null default now(),
  archived_at timestamptz
);
create index goals_user_idx on public.goals (user_id);

create table public.missions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  goal_id uuid references public.goals (id) on delete set null,
  title text not null check (char_length(title) between 1 and 80),
  -- 0 = Sunday … 6 = Saturday; non-empty, no duplicates enforced by the client + this check.
  days smallint[] not null check (
    cardinality(days) between 1 and 7 and days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]
  ),
  created_at timestamptz not null default now(),
  archived_at timestamptz
);
create index missions_user_idx on public.missions (user_id);

create table public.mission_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  mission_id uuid not null references public.missions (id) on delete cascade,
  local_date date not null,
  completed_at timestamptz not null default now(),
  unique (mission_id, local_date)
);
create index mission_completions_user_date_idx on public.mission_completions (user_id, local_date);

create table public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  planned_minutes smallint not null check (planned_minutes between 1 and 240),
  actual_minutes smallint not null check (actual_minutes between 1 and 240),
  created_at timestamptz not null default now(),
  check (ended_at > started_at),
  -- Claimed minutes can't exceed wall-clock time (plus a minute of rounding slack).
  check (actual_minutes <= extract(epoch from (ended_at - started_at)) / 60 + 1)
);
create index focus_sessions_user_idx on public.focus_sessions (user_id, started_at desc);

-- ---------------------------------------------------------------------------
-- Letters
-- ---------------------------------------------------------------------------

create table public.letters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '' check (char_length(title) <= 80),
  deliver_at timestamptz not null,
  delivery_time_zone text not null check (public.is_valid_time_zone(delivery_time_zone)),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (deliver_at > created_at),
  check (read_at is null or read_at >= deliver_at)
);
create index letters_user_idx on public.letters (user_id, deliver_at);

-- The body lives apart from the metadata so RLS can hide it until delivery.
create table public.letter_contents (
  letter_id uuid primary key references public.letters (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 20 and 10000)
);

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  token text not null unique check (token ~ '^(Exponent|Expo)PushToken\[.+\]$'),
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens (user_id);

-- Outbox for anything delivered later. Written by functions/server only.
create table public.scheduled_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind public.delivery_kind not null,
  letter_id uuid references public.letters (id) on delete cascade,
  -- e.g. 'letter:<id>' or 'weekly_verdict:<user>:<week_start>'; guarantees at most one row per event.
  idempotency_key text not null unique,
  send_at timestamptz not null,
  status public.delivery_status not null default 'pending',
  attempts smallint not null default 0,
  next_attempt_at timestamptz not null,
  locked_at timestamptz,
  expo_ticket_ids text[] not null default '{}',
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind <> 'letter' or letter_id is not null)
);
create index scheduled_deliveries_due_idx on public.scheduled_deliveries (next_attempt_at)
  where status in ('pending', 'sending');
create trigger scheduled_deliveries_updated_at before update on public.scheduled_deliveries
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Weekly recaps and AI usage
-- ---------------------------------------------------------------------------

create table public.weekly_recaps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  stats jsonb not null,        -- computed in SQL from recorded rows only
  score smallint check (score between 0 and 100),
  copy jsonb,                  -- AI-written jokes; never the source of any number
  generated_at timestamptz not null default now(),
  unique (user_id, week_start)
);

create table public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  messages integer not null default 0,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  window_start timestamptz not null default now(),
  window_count integer not null default 0,
  primary key (user_id, day)
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.user_context_facts enable row level security;
alter table public.goals enable row level security;
alter table public.missions enable row level security;
alter table public.mission_completions enable row level security;
alter table public.focus_sessions enable row level security;
alter table public.letters enable row level security;
alter table public.letter_contents enable row level security;
alter table public.push_tokens enable row level security;
alter table public.scheduled_deliveries enable row level security;
alter table public.weekly_recaps enable row level security;
alter table public.ai_usage enable row level security;

-- Explicit grants: nothing for anon; authenticated gets only what policies below use.
revoke all on all tables in schema public from anon, authenticated;

grant select, update on public.profiles, public.user_preferences to authenticated;
grant select, delete on public.conversations, public.messages to authenticated;
grant select, insert, delete on public.user_context_facts to authenticated;
grant select, insert, update, delete on public.goals, public.missions to authenticated;
grant select, insert, delete on public.mission_completions to authenticated;
grant select, insert, delete on public.focus_sessions to authenticated;
grant select, delete on public.letters to authenticated;
grant select on public.letter_contents to authenticated;
grant select, insert, update, delete on public.push_tokens to authenticated;
grant select on public.scheduled_deliveries, public.weekly_recaps, public.ai_usage to authenticated;

-- (select auth.uid()) is wrapped so Postgres evaluates it once per statement.
create policy "own profile" on public.profiles
  for all to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "own preferences" on public.user_preferences
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own conversations" on public.conversations
  for all to authenticated using (user_id = (select auth.uid()));
create policy "own messages" on public.messages
  for all to authenticated using (user_id = (select auth.uid()));
create policy "own facts" on public.user_context_facts
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own goals" on public.goals
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own missions" on public.missions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (goal_id is null or exists (
      select 1 from public.goals g where g.id = goal_id and g.user_id = (select auth.uid())
    ))
  );

create policy "read own completions" on public.mission_completions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "delete own completions" on public.mission_completions
  for delete to authenticated using (user_id = (select auth.uid()));
-- Completions may be logged for today or backfilled up to 7 days, never for the future.
-- This keeps Future Court stats honest.
create policy "log own completions" on public.mission_completions
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and local_date <= (select public.my_today())
    and local_date >= (select public.my_today()) - 7
    and exists (
      select 1 from public.missions m where m.id = mission_id and m.user_id = (select auth.uid())
    )
  );

create policy "own focus sessions" on public.focus_sessions
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own letters" on public.letters
  for all to authenticated using (user_id = (select auth.uid()));
-- The core promise: a letter body is unreadable until its delivery time, even by its author.
create policy "read delivered letter bodies" on public.letter_contents
  for select to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.letters l
      where l.id = letter_id and l.user_id = (select auth.uid()) and l.deliver_at <= now()
    )
  );

create policy "own push tokens" on public.push_tokens
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "read own deliveries" on public.scheduled_deliveries
  for select to authenticated using (user_id = (select auth.uid()));
create policy "read own recaps" on public.weekly_recaps
  for select to authenticated using (user_id = (select auth.uid()));
create policy "read own ai usage" on public.ai_usage
  for select to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Client-callable functions (run as the caller's identity checks, then write)
-- ---------------------------------------------------------------------------

-- Creates a sealed letter. Delivery is 09:00 local time on deliver_on in `tz`.
create function public.create_letter(p_title text, p_body text, p_deliver_on date, p_tz text)
returns public.letters
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v_deliver_at timestamptz;
  v_letter public.letters;
  v_notify boolean;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if not public.is_valid_time_zone(p_tz) then
    raise exception 'invalid time zone' using errcode = '22023';
  end if;
  -- Same rule as the app: the delivery date must be after "today" in the letter's zone.
  if p_deliver_on <= (now() at time zone p_tz)::date then
    raise exception 'delivery must be at least a day ahead' using errcode = '22023';
  end if;
  v_deliver_at := (p_deliver_on + time '09:00') at time zone p_tz;
  if v_deliver_at > now() + interval '25 years' then
    raise exception 'delivery is too far in the future' using errcode = '22023';
  end if;
  if (select count(*) from public.letters where user_id = uid and created_at > now() - interval '1 day') >= 20 then
    raise exception 'daily letter limit reached' using errcode = '54000';
  end if;

  insert into public.letters (user_id, title, deliver_at, delivery_time_zone)
  values (uid, left(trim(coalesce(p_title, '')), 80), v_deliver_at, p_tz)
  returning * into v_letter;

  insert into public.letter_contents (letter_id, user_id, body) values (v_letter.id, uid, trim(p_body));

  select notify_letter_deliveries into v_notify from public.user_preferences where user_id = uid;
  insert into public.scheduled_deliveries (user_id, kind, letter_id, idempotency_key, send_at, next_attempt_at, status)
  values (
    uid, 'letter', v_letter.id, 'letter:' || v_letter.id, v_deliver_at, v_deliver_at,
    case when coalesce(v_notify, true) then 'pending'::public.delivery_status else 'skipped'::public.delivery_status end
  );

  return v_letter;
end;
$$;

create function public.mark_letter_read(p_letter_id uuid)
returns public.letters
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_letter public.letters;
begin
  update public.letters
     set read_at = coalesce(read_at, now())
   where id = p_letter_id and user_id = auth.uid() and deliver_at <= now()
  returning * into v_letter;
  if not found then
    raise exception 'letter not found or still sealed' using errcode = 'P0002';
  end if;
  return v_letter;
end;
$$;

revoke execute on function public.create_letter(text, text, date, text) from public, anon;
revoke execute on function public.mark_letter_read(uuid) from public, anon;
grant execute on function public.create_letter(text, text, date, text) to authenticated;
grant execute on function public.mark_letter_read(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Server-only functions (service_role)
-- ---------------------------------------------------------------------------

-- Atomically counts one AI message against daily and per-minute limits.
-- Returns false (and records nothing) when a limit is hit.
create function public.consume_ai_quota(p_user uuid, p_daily_limit integer, p_per_minute integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := public.user_today(p_user);
  v_row public.ai_usage;
begin
  insert into public.ai_usage (user_id, day) values (p_user, v_today)
  on conflict (user_id, day) do nothing;

  select * into v_row from public.ai_usage where user_id = p_user and day = v_today for update;

  if v_row.messages >= p_daily_limit then
    return false;
  end if;
  if v_row.window_start > now() - interval '1 minute' and v_row.window_count >= p_per_minute then
    return false;
  end if;

  update public.ai_usage
     set messages = messages + 1,
         window_count = case when window_start > now() - interval '1 minute' then window_count + 1 else 1 end,
         window_start = case when window_start > now() - interval '1 minute' then window_start else now() end
   where user_id = p_user and day = v_today;
  return true;
end;
$$;

-- Claims due deliveries for one dispatcher run. Rows stuck in 'sending' for over 10 minutes
-- (a crashed run) are reclaimed. SKIP LOCKED makes concurrent runs safe.
create function public.claim_due_deliveries(p_limit integer default 100)
returns setof public.scheduled_deliveries
language sql
security definer
set search_path = ''
as $$
  update public.scheduled_deliveries d
     set status = 'sending', locked_at = now(), attempts = d.attempts + 1
   where d.id in (
     select id from public.scheduled_deliveries
      where next_attempt_at <= now()
        and (status = 'pending' or (status = 'sending' and locked_at < now() - interval '10 minutes'))
      order by next_attempt_at
      limit p_limit
      for update skip locked
   )
  returning d.*;
$$;

revoke execute on function public.consume_ai_quota(uuid, integer, integer) from public, anon, authenticated;
revoke execute on function public.claim_due_deliveries(integer) from public, anon, authenticated;
grant execute on function public.consume_ai_quota(uuid, integer, integer) to service_role;
grant execute on function public.claim_due_deliveries(integer) to service_role;

revoke execute on function public.user_today(uuid) from public, anon, authenticated;
grant execute on function public.user_today(uuid) to service_role;
revoke execute on function public.my_today() from public, anon;
grant execute on function public.my_today() to authenticated;

-- Scheduling (stage 4, needs project secrets so it is not part of this migration):
--   select cron.schedule('dispatch-deliveries', '* * * * *', $$
--     select net.http_post(
--       url := (select decrypted_secret from vault.decrypted_secrets where name = 'dispatch_url'),
--       headers := jsonb_build_object('x-dispatch-secret',
--         (select decrypted_secret from vault.decrypted_secrets where name = 'dispatch_secret'))
--     ) $$);
