-- Vigor trial: database schema, access rules and storage.
-- Run this once in the Supabase dashboard: SQL Editor > New query > paste > Run.
-- Safe to re-run: it drops and recreates policies and functions, not data.

create extension if not exists citext;

-- ---------- Tables ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle citext not null unique check (handle ~ '^[a-z0-9._]{3,24}$'),
  name text not null check (char_length(name) between 1 and 60),
  bio text not null default '' check (char_length(bio) <= 200),
  tags text[] not null default '{}',
  goal_label text not null default '' check (char_length(goal_label) <= 60),
  goal_ex text,
  goal_target numeric,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  key text primary key,
  value text not null
);

create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  title text not null default 'Workout' check (char_length(title) <= 60),
  started_at timestamptz not null default now(),
  ended_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists workouts_user_idx on public.workouts(user_id, created_at desc);

create table if not exists public.sets (
  id bigint generated always as identity primary key,
  workout_id uuid not null references public.workouts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  ex text not null check (char_length(ex) <= 40),
  idx int not null default 0,
  weight numeric not null check (weight >= 0 and weight < 5000),
  reps int not null check (reps > 0 and reps < 1000),
  is_pr boolean not null default false,
  pr_types text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists sets_user_ex_idx on public.sets(user_id, ex);
create index if not exists sets_workout_idx on public.sets(workout_id);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  category text not null check (category in ('Workout','PR','Cardio','Progress','Nutrition','Recovery','Mental health','Tip')),
  caption text not null default '' check (char_length(caption) <= 2000),
  media_path text,
  media_kind text check (media_kind in ('photo','video')),
  workout_id uuid references public.workouts(id) on delete set null,
  status text not null default 'visible' check (status in ('visible','held','removed')),
  created_at timestamptz not null default now()
);
create index if not exists posts_created_idx on public.posts(created_at desc);
create index if not exists posts_user_idx on public.posts(user_id, created_at desc);

create table if not exists public.follows (
  follower uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  followee uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower, followee),
  check (follower <> followee)
);
create index if not exists follows_followee_idx on public.follows(followee);

create table if not exists public.reactions (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  kind text not null check (kind in ('strong','form','inspired','like')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id, kind)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists comments_post_idx on public.comments(post_id, created_at);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  reason text not null check (char_length(reason) <= 120),
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  body text not null check (char_length(body) between 1 and 4000),
  screen text not null default '' check (char_length(screen) <= 60),
  app_version text not null default '',
  device text not null default '' check (char_length(device) <= 300),
  done boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- v2: set types, likes, member-created exercises ----------
alter table public.sets add column if not exists kind text not null default 'normal';
do $$ begin
  alter table public.sets add constraint sets_kind_check check (kind in ('normal','warmup','drop'));
exception when duplicate_object then null; end $$;

alter table public.reactions drop constraint if exists reactions_kind_check;
alter table public.reactions add constraint reactions_kind_check check (kind in ('strong','form','inspired','like'));

create table if not exists public.exercises (
  id text primary key default ('x' || substr(md5(random()::text || clock_timestamp()::text), 1, 10)),
  name text not null check (char_length(name) between 3 and 40),
  name_key text not null unique,
  grp text not null default 'Other' check (grp in ('Legs','Push','Pull','Hinge','Arms','Shoulders','Core','Cardio','Mobility','Other')),
  added boolean not null default false,
  status text not null default 'pending' check (status in ('approved','pending','rejected')),
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

-- ---------- v3: profile photos, comment replies and comment votes ----------
alter table public.profiles add column if not exists avatar_path text;
alter table public.comments add column if not exists parent_id uuid references public.comments(id) on delete cascade;
create index if not exists comments_parent_idx on public.comments(parent_id);

create table if not exists public.comment_votes (
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  value smallint not null check (value in (1, -1)),
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

-- ---------- v4: cardio (typed in, or imported from Apple Health / Health Connect) ----------
alter table public.posts drop constraint if exists posts_category_check;
alter table public.posts add constraint posts_category_check
  check (category in ('Workout','PR','Cardio','Progress','Nutrition','Recovery','Mental health','Tip'));

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  kind text not null check (kind in ('run','walk','hike','ride','swim','row','other')),
  idx int not null default 0,
  title text not null default '' check (char_length(title) <= 80),
  started_at timestamptz not null default now(),
  duration_s int not null check (duration_s > 0 and duration_s < 172800),
  distance_m numeric check (distance_m is null or (distance_m >= 0 and distance_m < 1000000)),
  elevation_m numeric check (elevation_m is null or (elevation_m >= 0 and elevation_m < 20000)),
  avg_hr int check (avg_hr is null or avg_hr between 30 and 250),
  calories int check (calories is null or calories between 0 and 20000),
  effort smallint check (effort is null or effort between 1 and 5),
  is_pr boolean not null default false,
  pr_types text[] not null default '{}',
  source text not null default 'manual' check (source in ('manual','apple_health','health_connect','garmin','file')),
  external_id text check (external_id is null or char_length(external_id) <= 200),
  created_at timestamptz not null default now()
);
create index if not exists activities_user_idx on public.activities(user_id, kind, started_at);
create index if not exists activities_workout_idx on public.activities(workout_id);
-- the same Apple Health or Health Connect workout can only be imported once per person
create unique index if not exists activities_external_idx on public.activities(user_id, source, external_id) where external_id is not null;

-- ---------- Helpers ----------
create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid());
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$;

-- Creates the caller's profile. The very first account becomes the admin and needs no
-- invite code; everyone after that needs the current invite code.
create or replace function public.create_profile(p_handle text, p_name text, p_bio text, p_tags text[], p_code text)
returns public.profiles
language plpgsql security definer set search_path = public as $$
declare
  first_user boolean;
  want_code text;
  row profiles;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if exists (select 1 from profiles where id = auth.uid()) then
    select * into row from profiles where id = auth.uid();
    return row;
  end if;
  perform pg_advisory_xact_lock(42);
  select not exists (select 1 from profiles) into first_user;
  if not first_user then
    select value into want_code from app_settings where key = 'invite_code';
    if want_code is null or lower(trim(coalesce(p_code, ''))) <> lower(want_code) then
      raise exception 'That invite code is not right. Ask the person who invited you for the current code.';
    end if;
  end if;
  insert into profiles (id, handle, name, bio, tags, is_admin)
  values (auth.uid(), lower(trim(p_handle)), trim(p_name), coalesce(p_bio, ''), coalesce(p_tags, '{}'), first_user)
  returning * into row;
  if first_user then
    insert into app_settings (key, value) values ('invite_code', 'vigor-' || substr(md5(random()::text), 1, 6))
    on conflict (key) do nothing;
  end if;
  return row;
end;
$$;

create or replace function public.get_invite_code() returns text
language sql stable security definer set search_path = public as $$
  select value from app_settings where key = 'invite_code' and public.is_admin();
$$;

create or replace function public.set_invite_code(p_code text) returns text
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only admins can change the invite code'; end if;
  if char_length(trim(p_code)) < 4 then raise exception 'Use at least 4 characters'; end if;
  insert into app_settings (key, value) values ('invite_code', trim(p_code))
  on conflict (key) do update set value = excluded.value;
  return trim(p_code);
end;
$$;

-- Off-topic screen: posts whose caption looks unrelated to health are held for review.
-- Members cannot set status themselves; only admins can.
create or replace function public.screen_post() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.status := 'visible';
    new.user_id := auth.uid();
    if new.caption ~* '\m(crypto|bitcoin|nft|forex|election|vote for|giveaway|promo code|dm me|onlyfans|politic\w*)\M' then
      new.status := 'held';
    end if;
  elsif tg_op = 'UPDATE' and new.status <> old.status and not public.is_admin() then
    if not (old.user_id = auth.uid() and new.status = 'removed') then
      new.status := old.status;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists posts_screen on public.posts;
create trigger posts_screen before insert or update on public.posts
  for each row execute function public.screen_post();

-- Members cannot make themselves admin.
create or replace function public.guard_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.is_admin <> old.is_admin and not public.is_admin() then new.is_admin := old.is_admin; end if;
  new.id := old.id;
  -- a profile photo has to be a file in that person's own media folder
  if new.avatar_path is distinct from old.avatar_path and new.avatar_path is not null
     and new.avatar_path not like old.id::text || '/%' then
    raise exception 'Profile photos must be uploaded from your own account';
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile();

-- Replies hang off a top-level comment on the same post. A reply to a reply
-- is attached to that thread's top comment, so threads stay one level deep.
create or replace function public.screen_comment() returns trigger
language plpgsql security definer set search_path = public as $$
declare parent record;
begin
  if new.parent_id is not null then
    select post_id, parent_id into parent from comments where id = new.parent_id;
    if not found or parent.post_id <> new.post_id then raise exception 'That comment is no longer there'; end if;
    if parent.parent_id is not null then new.parent_id := parent.parent_id; end if;
  end if;
  return new;
end;
$$;
drop trigger if exists comments_screen on public.comments;
create trigger comments_screen before insert on public.comments
  for each row execute function public.screen_comment();

-- Members add exercises only through this function. It screens the name:
-- links, ads and offensive words are refused; names that read like a movement
-- or name equipment join the shared library at once; anything else is usable
-- by its creator and waits for an admin to approve it for everyone.
create or replace function public.add_exercise(p_name text, p_group text, p_added boolean)
returns public.exercises
language plpgsql security definer set search_path = public as $$
declare
  n text; k text; row exercises; ok boolean;
begin
  if not public.is_member() then raise exception 'Join Vigor first'; end if;
  n := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
  if char_length(n) < 3 or char_length(n) > 40 then raise exception 'Exercise names need 3 to 40 characters.'; end if;
  if (select count(*) from regexp_matches(n, '[[:alpha:]]', 'g')) < 3 then
    raise exception 'Use the exercise''s name, for example "Cable lateral raise".';
  end if;
  if n ~* '(https?://|www\.|\.com|@|\m(crypto|bitcoin|nft|casino|betting|giveaway|buy|sale|discount|promo\w*|coupon|subscribe|onlyfans|porn\w*|sex\w*|nude\w*|fuck\w*|shit\w*|bitch\w*|dick\w*)\M)' then
    raise exception 'That doesn''t look like an exercise. Names can''t include links, ads or offensive words.';
  end if;
  k := lower(regexp_replace(n, '[^[:alnum:]]', '', 'g'));
  select * into row from exercises where name_key = k;
  if found then return row; end if;
  ok := n ~* '\m(squat|press|bench|deadlift|row|curl|raise|pull|push|chin|dip|lunge|step|thrust|bridge|extension|fly|flye|crunch|plank|hold|carry|walk|swing|clean|snatch|jerk|jump|hop|sprint|run|bike|cycle|erg|rower|ski|swim|stretch|rotation|twist|rollout|situp|sit-up|shrug|calf|kickback|pulldown|pullover|abduction|adduction|crossover|morning|hyper|nordic|sled|rope|burpee|thruster|climber|lift|hang|toes|leg|hip|glute|hamstring|quad|chest|shoulder|delt|tricep|bicep|lat|trap|core|abs|oblique|grip|wrist|forearm|dumbbell|barbell|kettlebell|cable|machine|band|smith|landmine|trx|ring|bodyweight|db|bb|kb|yoga|pose|flow|mobility|foam|roll)\w*';
  insert into exercises (name, name_key, grp, added, status, created_by)
  values (n, k, coalesce(nullif(p_group, ''), 'Other'), coalesce(p_added, false), case when ok then 'approved' else 'pending' end, auth.uid())
  returning * into row;
  return row;
end;
$$;

-- Lets the app check which version of this file the database has.
create or replace function public.vigor_schema_version() returns int language sql immutable as $$ select 4 $$;

-- ---------- Row level security ----------
alter table public.profiles enable row level security;
alter table public.app_settings enable row level security;
alter table public.workouts enable row level security;
alter table public.sets enable row level security;
alter table public.posts enable row level security;
alter table public.follows enable row level security;
alter table public.reactions enable row level security;
alter table public.comments enable row level security;
alter table public.reports enable row level security;
alter table public.feedback enable row level security;
alter table public.exercises enable row level security;
alter table public.comment_votes enable row level security;
alter table public.activities enable row level security;

do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public'
    and tablename in ('profiles','app_settings','workouts','sets','posts','follows','reactions','comments','reports','feedback','exercises','comment_votes','activities')
  loop execute format('drop policy %I on public.%I', r.policyname, r.tablename); end loop;
end $$;

-- app_settings: no direct access; only through the functions above.
create policy "members read profiles" on public.profiles for select to authenticated using (public.is_member() or id = auth.uid());
create policy "edit own profile" on public.profiles for update to authenticated using (id = auth.uid() or public.is_admin());

create policy "members read workouts" on public.workouts for select to authenticated using (public.is_member());
create policy "add own workouts" on public.workouts for insert to authenticated with check (user_id = auth.uid() and public.is_member());
create policy "delete own workouts" on public.workouts for delete to authenticated using (user_id = auth.uid());

create policy "members read sets" on public.sets for select to authenticated using (public.is_member());
create policy "add own sets" on public.sets for insert to authenticated with check (user_id = auth.uid() and public.is_member());
create policy "delete own sets" on public.sets for delete to authenticated using (user_id = auth.uid());

create policy "read visible posts" on public.posts for select to authenticated
  using (public.is_member() and (status = 'visible' or user_id = auth.uid() or public.is_admin()));
create policy "add own posts" on public.posts for insert to authenticated with check (public.is_member());
create policy "edit own posts" on public.posts for update to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "delete own posts" on public.posts for delete to authenticated using (user_id = auth.uid() or public.is_admin());

create policy "members read follows" on public.follows for select to authenticated using (public.is_member());
create policy "follow" on public.follows for insert to authenticated with check (follower = auth.uid() and public.is_member());
create policy "unfollow" on public.follows for delete to authenticated using (follower = auth.uid());

create policy "members read reactions" on public.reactions for select to authenticated using (public.is_member());
create policy "react" on public.reactions for insert to authenticated with check (user_id = auth.uid() and public.is_member());
create policy "unreact" on public.reactions for delete to authenticated using (user_id = auth.uid());

create policy "members read comments" on public.comments for select to authenticated using (public.is_member());
create policy "comment" on public.comments for insert to authenticated with check (user_id = auth.uid() and public.is_member());
create policy "delete comment" on public.comments for delete to authenticated using (user_id = auth.uid() or public.is_admin());

create policy "members read activities" on public.activities for select to authenticated using (public.is_member());
create policy "add own activities" on public.activities for insert to authenticated with check (user_id = auth.uid() and public.is_member());
create policy "delete own activities" on public.activities for delete to authenticated using (user_id = auth.uid());

create policy "members read comment votes" on public.comment_votes for select to authenticated using (public.is_member());
create policy "vote on comments" on public.comment_votes for insert to authenticated with check (user_id = auth.uid() and public.is_member());
create policy "change own vote" on public.comment_votes for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "remove own vote" on public.comment_votes for delete to authenticated using (user_id = auth.uid());

create policy "report" on public.reports for insert to authenticated with check (user_id = auth.uid() and public.is_member());
create policy "admins read reports" on public.reports for select to authenticated using (public.is_admin());
create policy "admins resolve reports" on public.reports for update to authenticated using (public.is_admin());

create policy "send feedback" on public.feedback for insert to authenticated with check (user_id = auth.uid() and public.is_member());
create policy "read own feedback" on public.feedback for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "admins mark feedback" on public.feedback for update to authenticated using (public.is_admin());

grant execute on function public.create_profile(text, text, text, text[], text) to authenticated;
grant execute on function public.get_invite_code() to authenticated;
grant execute on function public.set_invite_code(text) to authenticated;
grant execute on function public.add_exercise(text, text, boolean) to authenticated;
grant execute on function public.vigor_schema_version() to authenticated;

-- Everyone can read every exercise so names in old posts still resolve; the app's picker shows
-- approved ones plus the viewer's own. Only admins change status.
create policy "members read exercises" on public.exercises for select to authenticated using (public.is_member());
create policy "admins review exercises" on public.exercises for update to authenticated using (public.is_admin());

-- ---------- Storage for photos and videos ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 52428800, array['image/jpeg','image/png','image/webp','image/heic','video/mp4','video/quicktime','video/webm'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "vigor upload own media" on storage.objects;
drop policy if exists "vigor delete own media" on storage.objects;
create policy "vigor upload own media" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text and public.is_member());
create policy "vigor delete own media" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
