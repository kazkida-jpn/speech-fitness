create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'premium')),
  created_at timestamptz not null default now()
);

create table if not exists public.drill_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  performed_at timestamptz not null default now(),
  drill_id text not null,
  duration_seconds integer not null check (duration_seconds >= 0),
  sentence_count integer not null check (sentence_count > 0)
);

create table if not exists public.assessment_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  performed_at timestamptz not null default now(),
  headline text not null,
  recommended_drill_ids text[] not null default '{}',
  result jsonb
);

alter table public.profiles enable row level security;
alter table public.drill_sessions enable row level security;
alter table public.assessment_sessions enable row level security;

create policy "profiles are private" on public.profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "drill history is private" on public.drill_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "assessment history is private" on public.assessment_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists drill_sessions_user_date on public.drill_sessions(user_id, performed_at desc);
create index if not exists assessment_sessions_user_date on public.assessment_sessions(user_id, performed_at desc);
