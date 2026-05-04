-- Run this in Supabase SQL Editor

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

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.activities enable row level security;
alter table public.kudos enable row level security;
alter table public.follows enable row level security;
alter table public.comments enable row level security;

create policy "Public profiles are viewable by everyone" on public.profiles for select using (true);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

create policy "Public activities are viewable" on public.activities for select using (is_public = true or auth.uid() = user_id);
create policy "Users can insert own activities" on public.activities for insert with check (auth.uid() = user_id);
create policy "Users can update own activities" on public.activities for update using (auth.uid() = user_id);
create policy "Users can delete own activities" on public.activities for delete using (auth.uid() = user_id);

create policy "Kudos are viewable by everyone" on public.kudos for select using (true);
create policy "Users can give kudos" on public.kudos for insert with check (auth.uid() = user_id);
create policy "Users can remove own kudos" on public.kudos for delete using (auth.uid() = user_id);

create policy "Follows are viewable by everyone" on public.follows for select using (true);
create policy "Users can follow others" on public.follows for insert with check (auth.uid() = follower_id);
create policy "Users can unfollow" on public.follows for delete using (auth.uid() = follower_id);

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
