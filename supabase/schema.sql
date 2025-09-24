-- Supabase schema for Olingo
-- Safe to run in a new project.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  display_name text,
  settings jsonb default '{}'::jsonb
);

-- Base vocabulary shared or per-user (we'll keep a shared catalog).
create table if not exists public.words (
  id uuid primary key default gen_random_uuid(),
  italian text not null,
  english text not null,
  pos text,
  category text,
  created_at timestamptz default now()
);
create index if not exists words_category_idx on public.words (category);
create index if not exists words_pos_idx on public.words (pos);

-- Per-user card state (spaced repetition info)
create table if not exists public.user_cards (
  user_id uuid not null references auth.users(id) on delete cascade,
  word_id uuid not null references public.words(id) on delete cascade,
  last_reviewed_at timestamptz,
  next_due_at timestamptz,
  correct_count int not null default 0,
  wrong_count int not null default 0,
  ease numeric not null default 2.3,
  interval_days int not null default 0,
  archived boolean not null default false,
  primary key (user_id, word_id)
);
create index if not exists user_cards_due_idx on public.user_cards (user_id, next_due_at) where archived = false;

-- Review logs
create table if not exists public.review_logs (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  word_id uuid not null references public.words(id) on delete cascade,
  ts timestamptz not null default now(),
  correct boolean not null
);
create index if not exists review_logs_user_ts_idx on public.review_logs (user_id, ts);

-- Achievements / badges (future)
create table if not exists public.badges (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  description text
);

create table if not exists public.user_badges (
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_id uuid not null references public.badges(id) on delete cascade,
  earned_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

-- RLS policies
alter table public.profiles enable row level security;
alter table public.user_cards enable row level security;
alter table public.review_logs enable row level security;
alter table public.user_badges enable row level security;

-- Allow users to see their own data only
create policy if not exists "profiles.select_own" on public.profiles for select using (auth.uid() = id);
create policy if not exists "profiles.insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy if not exists "profiles.update_own" on public.profiles for update using (auth.uid() = id);

create policy if not exists "user_cards.own" on public.user_cards for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy if not exists "review_logs.own" on public.review_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy if not exists "user_badges.own" on public.user_badges for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
