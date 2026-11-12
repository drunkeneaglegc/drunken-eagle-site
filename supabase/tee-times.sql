-- =====================================================================
-- TEE TIME BOOKINGS — run once in Supabase → SQL Editor (after schema.sql)
-- Each reservation holds the simulator for a fixed length (default 2 hrs).
-- Overlapping reservations are impossible at the database level.
-- Members book with their name + the league PIN (set by the admin).
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.bookings (
  id           uuid primary key default gen_random_uuid(),
  slot_start   timestamptz not null,
  slot_end     timestamptz not null,
  player_id    text,
  player_name  text not null,
  note         text,
  created_at   timestamptz not null default now(),
  constraint bookings_no_overlap exclude using gist (tstzrange(slot_start, slot_end, '[)') with &&)
);
create index if not exists bookings_start_idx on public.bookings (slot_start);

-- Private config (PIN hash etc.). No policies = unreadable from the website.
create table if not exists public.booking_config (
  id           int primary key default 1 check (id = 1),
  pin_hash     text,
  days_ahead   int  not null default 14,
  length_min   int  not null default 120,
  step_min     int  not null default 30
);
insert into public.booking_config (id) values (1) on conflict (id) do nothing;

alter table public.bookings       enable row level security;
alter table public.booking_config enable row level security;

drop policy if exists "Anyone can see tee sheet" on public.bookings;
create policy "Anyone can see tee sheet" on public.bookings for select using (true);
drop policy if exists "Admins remove bookings" on public.bookings;
create policy "Admins remove bookings" on public.bookings for delete to authenticated using (public.is_league_admin());

-- Public, non-secret booking rules (so the site can show them)
create or replace function public.booking_rules()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object('days_ahead', days_ahead, 'length_min', length_min, 'step_min', step_min, 'pin_set', pin_hash is not null)
  from public.booking_config where id = 1;
$$;

create or replace function public._check_pin(p_pin text)
returns void language plpgsql stable security definer set search_path = public, extensions as $$
declare h text;
begin
  select pin_hash into h from public.booking_config where id = 1;
  if h is null then raise exception 'Booking is not open yet — the league admin needs to set a PIN.'; end if;
  if p_pin is null or crypt(p_pin, h) <> h then raise exception 'Incorrect league PIN.'; end if;
end $$;

create or replace function public.book_tee_time(p_start timestamptz, p_player_id text, p_player_name text, p_pin text, p_note text default null)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare cfg public.booking_config; new_id uuid;
begin
  perform public._check_pin(p_pin);
  select * into cfg from public.booking_config where id = 1;
  if coalesce(trim(p_player_name), '') = '' then raise exception 'Pick your name.'; end if;
  if extract(second from p_start) <> 0 or (extract(epoch from p_start)::bigint % (cfg.step_min * 60)) <> 0 then
    raise exception 'Tee times start every % minutes.', cfg.step_min; end if;
  if p_start < now() - interval '1 minute' then raise exception 'That time has already passed.'; end if;
  if p_start > now() + make_interval(days => cfg.days_ahead) then
    raise exception 'You can book up to % days ahead.', cfg.days_ahead; end if;
  begin
    insert into public.bookings (slot_start, slot_end, player_id, player_name, note)
    values (p_start, p_start + make_interval(mins => cfg.length_min), nullif(p_player_id, ''), left(trim(p_player_name), 60), left(nullif(trim(p_note), ''), 120))
    returning id into new_id;
  exception when exclusion_violation then
    raise exception 'Sorry — someone already has the sim during that time.';
  end;
  return new_id;
end $$;

create or replace function public.cancel_tee_time(p_id uuid, p_player_name text, p_pin text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._check_pin(p_pin);
  delete from public.bookings where id = p_id and lower(trim(player_name)) = lower(trim(p_player_name));
  if not found then raise exception 'That reservation is under a different name.'; end if;
end $$;

create or replace function public.set_booking_config(p_pin text, p_days_ahead int, p_length_min int, p_step_min int)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.is_league_admin() then raise exception 'Admins only.'; end if;
  update public.booking_config set
    pin_hash   = case when coalesce(p_pin, '') <> '' then crypt(p_pin, gen_salt('bf')) else pin_hash end,
    days_ahead = coalesce(p_days_ahead, days_ahead),
    length_min = coalesce(p_length_min, length_min),
    step_min   = coalesce(p_step_min, step_min)
  where id = 1;
end $$;

revoke all on function public._check_pin(text) from public, anon, authenticated;
grant execute on function public.booking_rules() to anon, authenticated;
grant execute on function public.book_tee_time(timestamptz, text, text, text, text) to anon, authenticated;
grant execute on function public.cancel_tee_time(uuid, text, text) to anon, authenticated;
grant execute on function public.set_booking_config(text, int, int, int) to authenticated;
