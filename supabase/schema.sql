-- =====================================================================
-- THE DRUNKEN EAGLE GOLF LEAGUE — database setup
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Then add your admin email(s) at the bottom and run that line too.
-- =====================================================================

-- 1) League data (players, teams, weeks, scores, courses, news, settings)
create table if not exists public.records (
  id          text primary key,
  kind        text not null,
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);
create index if not exists records_kind_idx on public.records (kind);

-- 2) Who is allowed to edit (league administrators)
create table if not exists public.admins (
  email text primary key
);

create or replace function public.is_league_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where lower(email) = lower(auth.jwt() ->> 'email'));
$$;

-- 3) Security: everyone can read, only admins can change anything
alter table public.records enable row level security;
alter table public.admins  enable row level security;

drop policy if exists "Anyone can read league data" on public.records;
create policy "Anyone can read league data" on public.records for select using (true);

drop policy if exists "Admins insert" on public.records;
create policy "Admins insert" on public.records for insert to authenticated with check (public.is_league_admin());
drop policy if exists "Admins update" on public.records;
create policy "Admins update" on public.records for update to authenticated using (public.is_league_admin()) with check (public.is_league_admin());
drop policy if exists "Admins delete" on public.records;
create policy "Admins delete" on public.records for delete to authenticated using (public.is_league_admin());

-- (admins table has no policies = nobody can read/change it from the website)

-- 4) Photo storage (player, course, team and site photos)
insert into storage.buckets (id, name, public) values ('photos', 'photos', true)
on conflict (id) do nothing;

drop policy if exists "Anyone can view photos" on storage.objects;
create policy "Anyone can view photos" on storage.objects for select using (bucket_id = 'photos');
drop policy if exists "Admins upload photos" on storage.objects;
create policy "Admins upload photos" on storage.objects for insert to authenticated with check (bucket_id = 'photos' and public.is_league_admin());
drop policy if exists "Admins delete photos" on storage.objects;
create policy "Admins delete photos" on storage.objects for delete to authenticated using (bucket_id = 'photos' and public.is_league_admin());

-- 5) ADD YOUR ADMIN EMAIL(S) — change the address, then run this line:
-- insert into public.admins (email) values ('you@example.com');
