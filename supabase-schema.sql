-- ============================================================
-- Nightingale Library — Supabase Schema
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- If your tables already exist, just run these lines to add
-- the "currently reading" toggle column and the parent-approved
-- level (gamification — avatar upgrades unlock only once a parent
-- reviews completed books and approves the level-up with a PIN):
-- alter table reading_records add column if not exists currently_reading boolean default false;
-- alter table profiles add column if not exists approved_level integer not null default 1;

-- Profiles (kids)
create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  avatar text not null default '🦁',
  color text not null default '#FF6B6B',
  approved_level integer not null default 1,
  created_at timestamptz default now()
);

-- Books (metadata cache — fetched once, stored forever)
create table if not exists books (
  id uuid primary key default gen_random_uuid(),
  isbn text unique,
  title text not null,
  author text not null,
  cover_url text,
  series_name text,
  series_position integer,
  total_in_series integer,
  description text,
  open_library_id text,
  google_books_id text,
  created_at timestamptz default now()
);

-- Reading records (which kid read which book)
create table if not exists reading_records (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  book_id uuid not null references books(id) on delete cascade,
  read_at timestamptz default now(),
  liked boolean default true,
  currently_reading boolean default false,
  unique(profile_id, book_id)
);

-- Recommendations cache (per child — refreshed by Claude weekly)
create table if not exists recommendations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  book_title text not null,
  book_author text,
  book_cover_url text,
  reason text,
  based_on_titles text[],
  dismissed boolean default false,
  created_at timestamptz default now()
);

-- New release alerts (populated by daily cron job)
create table if not exists release_alerts (
  id uuid primary key default gen_random_uuid(),
  series_name text not null,
  book_title text not null,
  author text,
  release_info text,
  seen boolean default false,
  created_at timestamptz default now()
);

-- ─── Row Level Security ────────────────────────────────────────
-- For a family app, disable RLS so the anon key can read/write.
-- If you need per-user security, add Supabase Auth and policies.

alter table profiles enable row level security;
alter table books enable row level security;
alter table reading_records enable row level security;
alter table recommendations enable row level security;
alter table release_alerts enable row level security;

-- Allow all operations with anon key (family app — no auth)
create policy "Public access" on profiles for all using (true) with check (true);
create policy "Public access" on books for all using (true) with check (true);
create policy "Public access" on reading_records for all using (true) with check (true);
create policy "Public access" on recommendations for all using (true) with check (true);
create policy "Public access" on release_alerts for all using (true) with check (true);

-- ─── Indexes ───────────────────────────────────────────────────
create index if not exists idx_reading_records_profile on reading_records(profile_id);
create index if not exists idx_recommendations_profile on recommendations(profile_id);
create index if not exists idx_books_isbn on books(isbn);
create index if not exists idx_books_series on books(series_name);
create index if not exists idx_alerts_seen on release_alerts(seen);
