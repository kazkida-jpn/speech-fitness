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

-- Log of promo posts already sent by /social/publish (see marketing/social/README.md).
-- Written with the service role only, so no policies are granted.
create table if not exists public.social_posts (
  post_id text not null,
  channel text not null check (channel in ('instagram', 'facebook')),
  external_id text,
  published_at timestamptz not null default now(),
  primary key (post_id, channel)
);

alter table public.social_posts enable row level security;

-- One row per started speech check, written by the /assessment and /diagnosis routes to enforce
-- the per-plan limits (see src/server/check-quota.ts). A signed-out visitor is recorded by a
-- device id and a keyed hash of the IP address. Written with the service role only, so no
-- policies are granted.
create table if not exists public.check_passes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  device_id text,
  ip_hash text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  assessment_count integer not null default 0,
  diagnosis_count integer not null default 0
);

alter table public.check_passes enable row level security;

create index if not exists check_passes_user_date on public.check_passes(user_id, started_at desc);
create index if not exists check_passes_device_date on public.check_passes(device_id, started_at desc);
create index if not exists check_passes_ip_date on public.check_passes(ip_hash, started_at desc);
