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

-- ─── Phase 6: Analytics, Challenges, Clubs, Segments, Dark Mode ───────────

-- Challenges
create table public.challenges (
  id uuid default gen_random_uuid() primary key,
  creator_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  description text,
  activity_type text default 'all',
  metric text not null check (metric in ('distance','duration','elevation','activities')),
  target_value float not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_public boolean default true,
  participant_count int default 0,
  created_at timestamptz default now()
);
alter table public.challenges enable row level security;
create policy "Public challenges are viewable" on public.challenges
  for select using (is_public = true or auth.uid() = creator_id);
create policy "Users can create challenges" on public.challenges
  for insert with check (auth.uid() = creator_id);
create policy "Creators can update own challenges" on public.challenges
  for update using (auth.uid() = creator_id);

-- Challenge participants
create table public.challenge_participants (
  challenge_id uuid references public.challenges(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  progress float default 0,
  joined_at timestamptz default now(),
  primary key (challenge_id, user_id)
);
alter table public.challenge_participants enable row level security;
create policy "Challenge participants are viewable" on public.challenge_participants for select using (true);
create policy "Users can join challenges" on public.challenge_participants
  for insert with check (auth.uid() = user_id);
create policy "Users can update own progress" on public.challenge_participants
  for update using (auth.uid() = user_id);
create policy "Users can leave challenges" on public.challenge_participants
  for delete using (auth.uid() = user_id);

-- Clubs
create table public.clubs (
  id uuid default gen_random_uuid() primary key,
  owner_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  description text,
  activity_type text default 'all',
  avatar_url text,
  is_public boolean default true,
  member_count int default 1,
  created_at timestamptz default now()
);
alter table public.clubs enable row level security;
create policy "Public clubs are viewable" on public.clubs
  for select using (is_public = true or auth.uid() = owner_id);
create policy "Users can create clubs" on public.clubs
  for insert with check (auth.uid() = owner_id);
create policy "Owners can update clubs" on public.clubs
  for update using (auth.uid() = owner_id);
create policy "Owners can delete clubs" on public.clubs
  for delete using (auth.uid() = owner_id);

-- Club members
create table public.club_members (
  club_id uuid references public.clubs(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text default 'member' check (role in ('owner','member')),
  joined_at timestamptz default now(),
  primary key (club_id, user_id)
);
alter table public.club_members enable row level security;
create policy "Club members are viewable" on public.club_members for select using (true);
create policy "Users can join clubs" on public.club_members
  for insert with check (auth.uid() = user_id);
create policy "Users can leave clubs" on public.club_members
  for delete using (auth.uid() = user_id);

-- Segments
create table public.segments (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  activity_type text default 'run',
  polyline jsonb not null,
  distance float not null,
  elevation_gain float,
  is_public boolean default true,
  created_at timestamptz default now()
);
alter table public.segments enable row level security;
create policy "Public segments are viewable" on public.segments
  for select using (is_public = true or auth.uid() = user_id);
create policy "Users can create segments" on public.segments
  for insert with check (auth.uid() = user_id);
create policy "Users can delete own segments" on public.segments
  for delete using (auth.uid() = user_id);

-- Segment efforts (times)
create table public.segment_efforts (
  id uuid default gen_random_uuid() primary key,
  segment_id uuid references public.segments(id) on delete cascade not null,
  activity_id uuid references public.activities(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  elapsed_time int not null,
  is_pr boolean default false,
  created_at timestamptz default now()
);
alter table public.segment_efforts enable row level security;
create policy "Segment efforts are viewable" on public.segment_efforts for select using (true);
create policy "Users can log own efforts" on public.segment_efforts
  for insert with check (auth.uid() = user_id);

-- Phase 6 migration only (existing DB):
-- alter table public.profiles add column if not exists dark_mode boolean default false;
-- alter table public.profiles add column if not exists strava_id text;
-- create table if not exists public.challenges ( ... see above ... );
-- create table if not exists public.challenge_participants ( ... see above ... );
-- create table if not exists public.clubs ( ... see above ... );
-- create table if not exists public.club_members ( ... see above ... );
-- create table if not exists public.segments ( ... see above ... );
-- create table if not exists public.segment_efforts ( ... see above ... );

-- ─── Phase 7: Push Notifications, Events, Stories, Reactions, Admin ───────

-- Events & Races
create table public.events (
  id uuid default gen_random_uuid() primary key,
  creator_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  description text,
  activity_type text default 'run',
  event_date timestamptz not null,
  location text,
  distance float,
  elevation_gain float,
  is_public boolean default true,
  is_virtual boolean default false,
  participant_count int default 0,
  created_at timestamptz default now()
);
alter table public.events enable row level security;
create policy "Public events are viewable" on public.events
  for select using (is_public = true or auth.uid() = creator_id);
create policy "Users can create events" on public.events
  for insert with check (auth.uid() = creator_id);
create policy "Creators can update events" on public.events
  for update using (auth.uid() = creator_id);
create policy "Creators can delete events" on public.events
  for delete using (auth.uid() = creator_id);

-- Event participants (RSVP + results)
create table public.event_participants (
  event_id uuid references public.events(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  rsvp text default 'going' check (rsvp in ('going','maybe','not_going')),
  finish_time int,   -- seconds
  joined_at timestamptz default now(),
  primary key (event_id, user_id)
);
alter table public.event_participants enable row level security;
create policy "Event participants are viewable" on public.event_participants for select using (true);
create policy "Users can RSVP to events" on public.event_participants
  for insert with check (auth.uid() = user_id);
create policy "Users can update own RSVP" on public.event_participants
  for update using (auth.uid() = user_id);
create policy "Users can cancel RSVP" on public.event_participants
  for delete using (auth.uid() = user_id);

-- Stories (24-hour expiring content)
create table public.stories (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  activity_id uuid references public.activities(id) on delete set null,
  media_url text not null,
  caption text,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz default now()
);
alter table public.stories enable row level security;
create policy "Stories from followed users are viewable" on public.stories for select using (true);
create policy "Users can create own stories" on public.stories
  for insert with check (auth.uid() = user_id);
create policy "Users can delete own stories" on public.stories
  for delete using (auth.uid() = user_id);

-- Activity reactions (emoji reactions beyond kudos)
create table public.reactions (
  id uuid default gen_random_uuid() primary key,
  activity_id uuid references public.activities(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  emoji text not null check (emoji in ('🔥','💪','👏','😮','❤️')),
  created_at timestamptz default now(),
  unique(activity_id, user_id, emoji)
);
alter table public.reactions enable row level security;
create policy "Reactions are viewable" on public.reactions for select using (true);
create policy "Users can react" on public.reactions
  for insert with check (auth.uid() = user_id);
create policy "Users can remove own reaction" on public.reactions
  for delete using (auth.uid() = user_id);

-- Push notification subscriptions
create table public.push_subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now(),
  unique(user_id, endpoint)
);
alter table public.push_subscriptions enable row level security;
create policy "Users can manage own push subscriptions" on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Admin content flags
create table public.admin_flags (
  id uuid default gen_random_uuid() primary key,
  reporter_id uuid references public.profiles(id) on delete cascade not null,
  content_type text not null check (content_type in ('activity','comment','profile')),
  content_id uuid not null,
  reason text not null,
  status text default 'open' check (status in ('open','reviewed','dismissed')),
  created_at timestamptz default now()
);
alter table public.admin_flags enable row level security;
create policy "Admins can view flags" on public.admin_flags
  for select using (auth.uid() = reporter_id);
create policy "Users can submit flags" on public.admin_flags
  for insert with check (auth.uid() = reporter_id);

-- Phase 7 migration only (existing DB):
-- alter table public.activities add column if not exists avg_heart_rate int;
-- alter table public.activities add column if not exists max_heart_rate int;
-- create table if not exists public.events ( ... see above ... );
-- create table if not exists public.event_participants ( ... see above ... );
-- create table if not exists public.stories ( ... see above ... );
-- create table if not exists public.reactions ( ... see above ... );
-- create table if not exists public.push_subscriptions ( ... see above ... );
-- create table if not exists public.admin_flags ( ... see above ... );

