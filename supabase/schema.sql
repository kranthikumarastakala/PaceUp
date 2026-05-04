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

-- ─── Phase 4: Achievements, Multi-photos, Settings ────────────────────────

-- User achievements (earned milestones)
create table public.user_achievements (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  achievement_id text not null,
  activity_id uuid references public.activities(id) on delete set null,
  earned_at timestamptz default now(),
  unique(user_id, achievement_id)
);
alter table public.user_achievements enable row level security;
create policy "Achievements are public" on public.user_achievements for select using (true);
create policy "Users can earn own achievements" on public.user_achievements
  for insert with check (auth.uid() = user_id);

-- Activity photos (gallery - multiple per activity)
create table public.activity_photos (
  id uuid default gen_random_uuid() primary key,
  activity_id uuid references public.activities(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  url text not null,
  position int default 0,
  created_at timestamptz default now()
);
alter table public.activity_photos enable row level security;
create policy "Activity photos are viewable" on public.activity_photos for select using (true);
create policy "Users can add photos to own activities" on public.activity_photos
  for insert with check (auth.uid() = user_id);
create policy "Users can delete own photos" on public.activity_photos
  for delete using (auth.uid() = user_id);

-- Phase 4 migration only (existing DB):
-- alter table public.profiles add column if not exists unit_system text default 'metric' check (unit_system in ('metric', 'imperial'));
-- create table if not exists public.user_achievements ( ... see above ... );
-- create table if not exists public.activity_photos ( ... see above ... );

-- ─── Phase 5: DMs, Routes, Training Plans ──────────────────────────────────

-- Direct messages
create table public.messages (
  id uuid default gen_random_uuid() primary key,
  sender_id uuid references public.profiles(id) on delete cascade not null,
  recipient_id uuid references public.profiles(id) on delete cascade not null,
  body text not null check (char_length(body) >= 1 and char_length(body) <= 2000),
  is_read boolean default false,
  created_at timestamptz default now()
);
alter table public.messages enable row level security;
create policy "Users can see own messages" on public.messages
  for select using (auth.uid() = sender_id or auth.uid() = recipient_id);
create policy "Users can send messages" on public.messages
  for insert with check (auth.uid() = sender_id);
create policy "Recipients can mark messages read" on public.messages
  for update using (auth.uid() = recipient_id);

-- Shared routes
create table public.routes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  description text,
  activity_type text check (activity_type in ('run','ride','walk','hike')) default 'run',
  gpx_data jsonb,
  distance float,
  elevation_gain float,
  is_public boolean default true,
  star_count int default 0,
  created_at timestamptz default now()
);
alter table public.routes enable row level security;
create policy "Public routes are viewable" on public.routes
  for select using (is_public = true or auth.uid() = user_id);
create policy "Users can create routes" on public.routes
  for insert with check (auth.uid() = user_id);
create policy "Users can update own routes" on public.routes
  for update using (auth.uid() = user_id);
create policy "Users can delete own routes" on public.routes
  for delete using (auth.uid() = user_id);

-- Route stars (bookmarks)
create table public.route_stars (
  route_id uuid references public.routes(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  primary key (route_id, user_id)
);
alter table public.route_stars enable row level security;
create policy "Route stars are public" on public.route_stars for select using (true);
create policy "Users can star routes" on public.route_stars for insert with check (auth.uid() = user_id);
create policy "Users can unstar routes" on public.route_stars for delete using (auth.uid() = user_id);

-- Training plans
create table public.training_plans (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  description text,
  duration_weeks int not null default 4,
  activity_type text check (activity_type in ('run','ride','swim','walk','hike','workout','all')) default 'run',
  is_public boolean default true,
  created_at timestamptz default now()
);
alter table public.training_plans enable row level security;
create policy "Public training plans are viewable" on public.training_plans
  for select using (is_public = true or auth.uid() = user_id);
create policy "Users can create own plans" on public.training_plans
  for insert with check (auth.uid() = user_id);
create policy "Users can update own plans" on public.training_plans
  for update using (auth.uid() = user_id);
create policy "Users can delete own plans" on public.training_plans
  for delete using (auth.uid() = user_id);

-- Training plan days
create table public.training_plan_days (
  id uuid default gen_random_uuid() primary key,
  plan_id uuid references public.training_plans(id) on delete cascade not null,
  week int not null,
  day_of_week int not null check (day_of_week between 0 and 6),
  activity_type text check (activity_type in ('run','ride','swim','walk','hike','workout','rest')) default 'run',
  target_distance float,
  target_duration int,
  notes text,
  created_at timestamptz default now()
);
alter table public.training_plan_days enable row level security;
create policy "Plan days viewable with plan" on public.training_plan_days
  for select using (
    exists (
      select 1 from public.training_plans p
      where p.id = plan_id and (p.is_public = true or p.user_id = auth.uid())
    )
  );
create policy "Plan owner can manage days" on public.training_plan_days
  for all using (
    exists (select 1 from public.training_plans p where p.id = plan_id and p.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.training_plans p where p.id = plan_id and p.user_id = auth.uid())
  );

-- Phase 5 migration only (existing DB):
-- create table if not exists public.messages ( ... see above ... );
-- create table if not exists public.routes ( ... see above ... );
-- create table if not exists public.route_stars ( ... see above ... );
-- create table if not exists public.training_plans ( ... see above ... );
-- create table if not exists public.training_plan_days ( ... see above ... );
-- Enable Realtime for messages: alter publication supabase_realtime add table public.messages;

