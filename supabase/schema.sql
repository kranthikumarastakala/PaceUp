-- Run this in Supabase SQL Editor (fresh install)
-- For existing databases, see the "-- Migration --" section at the bottom.

-- Profiles table (extends auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  full_name text,
  avatar_url text,
  bio text,
  location text,
  created_at timestamptz default now()
);

-- Activities table
create table public.activities (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  type text not null check (type in ('run','ride','swim','walk','hike','workout')),
  distance float,         -- meters
  duration int,           -- seconds
  elevation_gain float,   -- meters
  avg_pace float,         -- seconds per km
  avg_speed float,        -- km/h
  calories int,
  gpx_data jsonb,         -- parsed GPX route points [{lat,lng,ele,time}]
  start_latlng float[],
  description text,
  is_public boolean default true,
  kudos_count int default 0,
  photo_url text,
  created_at timestamptz default now()
);

-- Kudos table
create table public.kudos (
  id uuid default gen_random_uuid() primary key,
  activity_id uuid references public.activities(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(activity_id, user_id)
);

-- Follows table
create table public.follows (
  follower_id uuid references public.profiles(id) on delete cascade not null,
  following_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  primary key (follower_id, following_id)
);

-- Comments table
create table public.comments (
  id uuid default gen_random_uuid() primary key,
  activity_id uuid references public.activities(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  body text not null check (char_length(body) >= 1 and char_length(body) <= 1000),
  created_at timestamptz default now()
);

-- Notifications table (Phase 2)
create table public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,   -- recipient
  actor_id uuid references public.profiles(id) on delete cascade not null,  -- who triggered
  type text not null check (type in ('kudos', 'follow', 'comment')),
  activity_id uuid references public.activities(id) on delete cascade,      -- null for follows
  is_read boolean default false,
  created_at timestamptz default now()
);

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.activities enable row level security;
alter table public.kudos enable row level security;
alter table public.follows enable row level security;
alter table public.comments enable row level security;
alter table public.notifications enable row level security;

-- Profiles
create policy "Public profiles are viewable by everyone" on public.profiles for select using (true);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- Activities
create policy "Public activities are viewable" on public.activities
  for select using (is_public = true or auth.uid() = user_id);
create policy "Users can insert own activities" on public.activities
  for insert with check (auth.uid() = user_id);
create policy "Users can update own activities" on public.activities
  for update using (auth.uid() = user_id);
create policy "Users can delete own activities" on public.activities
  for delete using (auth.uid() = user_id);

-- Kudos
create policy "Kudos are viewable by everyone" on public.kudos for select using (true);
create policy "Users can give kudos" on public.kudos for insert with check (auth.uid() = user_id);
create policy "Users can remove own kudos" on public.kudos for delete using (auth.uid() = user_id);

-- Follows
create policy "Follows are viewable by everyone" on public.follows for select using (true);
create policy "Users can follow others" on public.follows for insert with check (auth.uid() = follower_id);
create policy "Users can unfollow" on public.follows for delete using (auth.uid() = follower_id);

-- Comments
create policy "Comments on public activities are viewable" on public.comments
  for select using (
    exists (
      select 1 from public.activities a
      where a.id = activity_id and (a.is_public = true or a.user_id = auth.uid())
    )
  );
create policy "Authenticated users can comment" on public.comments
  for insert with check (auth.uid() = user_id);
create policy "Users can delete own comments" on public.comments
  for delete using (auth.uid() = user_id);

-- Notifications
create policy "Users can see own notifications" on public.notifications
  for select using (auth.uid() = user_id);
create policy "Authenticated users can create notifications" on public.notifications
  for insert with check (auth.uid() = actor_id);
create policy "Users can mark own notifications read" on public.notifications
  for update using (auth.uid() = user_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', '')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Migration (run these if upgrading an existing database)
-- alter table public.activities add column if not exists photo_url text;
-- (create notifications table as above if not exists)
-- Enable Realtime: alter publication supabase_realtime add table public.notifications;

-- Storage bucket (Supabase dashboard -> Storage -> New bucket)
-- Name: activity-photos | Public: true | Max size: 5 MB

-- ─── Phase 3: Goals & Challenges ─────────────────────────────────────────
create table public.goals (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  type text not null check (type in ('distance', 'duration', 'elevation', 'activities')),
  period text not null check (period in ('weekly', 'monthly', 'yearly')),
  activity_type text check (activity_type in ('run','ride','swim','walk','hike','workout','all')) default 'all',
  target_value float not null,      -- meters / seconds / meters / count
  is_active boolean default true,
  created_at timestamptz default now()
);

alter table public.goals enable row level security;
create policy "Users can manage own goals" on public.goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Phase 3 migration only (existing DB):
-- create table if not exists public.goals ( ... see above ... );

