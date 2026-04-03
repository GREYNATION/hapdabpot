-- SonicStream Database Schema
-- Run this in Supabase SQL editor

-- Artists
create table if not exists artists (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  avatar_url text,
  bio text,
  spotify_id text,
  created_at timestamptz default now()
);

-- Songs
create table if not exists songs (
  id uuid default gen_random_uuid() primary key,
  artist_id uuid references artists(id) on delete cascade,
  title text not null,
  cover_url text,
  audio_url text,
  video_url text,
  genre text default 'other',
  total_shares integer default 10000,
  shares_sold integer default 0,
  price_per_share decimal(10,2) default 10.00,
  total_streams bigint default 0,
  monthly_streams bigint default 0,
  is_exclusive boolean default false,
  release_date date,
  created_at timestamptz default now()
);

-- Investments
create table if not exists investments (
  id uuid default gen_random_uuid() primary key,
  investor_id uuid references auth.users(id) on delete cascade,
  song_id uuid references songs(id) on delete cascade,
  shares integer not null,
  price_per_share decimal(10,2) not null,
  total_paid decimal(10,2) not null,
  created_at timestamptz default now(),
  unique(investor_id, song_id)
);

-- Royalty payouts
create table if not exists royalty_payouts (
  id uuid default gen_random_uuid() primary key,
  investment_id uuid references investments(id) on delete cascade,
  investor_id uuid references auth.users(id) on delete cascade,
  song_id uuid references songs(id) on delete cascade,
  amount decimal(10,4) not null,
  streams_this_period bigint default 0,
  period_start date not null,
  period_end date not null,
  created_at timestamptz default now()
);

-- Wallets
create table if not exists wallets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade unique,
  balance decimal(10,2) default 0,
  total_deposited decimal(10,2) default 0,
  total_withdrawn decimal(10,2) default 0,
  total_earned decimal(10,4) default 0,
  updated_at timestamptz default now()
);

-- Profiles (extends auth.users)
create table if not exists profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  username text unique,
  full_name text,
  avatar_url text,
  is_artist boolean default false,
  created_at timestamptz default now()
);

-- Trigger to auto-create wallet on signup
create or replace function create_wallet_on_signup()
returns trigger as $$
begin
  insert into wallets (user_id) values (new.id);
  insert into profiles (id) values (new.id);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure create_wallet_on_signup();

-- Royalty distribution function
-- Called monthly to distribute earnings to all shareholders
create or replace function distribute_royalties(
  p_song_id uuid,
  p_period_start date,
  p_period_end date,
  p_streams bigint
)
returns void as $$
declare
  inv record;
  song record;
  ownership_pct decimal;
  payout_amount decimal;
begin
  select * into song from songs where id = p_song_id;

  for inv in
    select * from investments where song_id = p_song_id
  loop
    ownership_pct := inv.shares::decimal / song.total_shares::decimal;
    payout_amount := p_streams * 0.004 * ownership_pct;

    insert into royalty_payouts (
      investment_id, investor_id, song_id,
      amount, streams_this_period,
      period_start, period_end
    ) values (
      inv.id, inv.investor_id, p_song_id,
      payout_amount, p_streams,
      p_period_start, p_period_end
    );

    update wallets
    set
      balance = balance + payout_amount,
      total_earned = total_earned + payout_amount,
      updated_at = now()
    where user_id = inv.investor_id;
  end loop;

  update songs
  set total_streams = total_streams + p_streams,
      monthly_streams = p_streams
  where id = p_song_id;
end;
$$ language plpgsql security definer;

-- RLS Policies
alter table artists enable row level security;
alter table songs enable row level security;
alter table investments enable row level security;
alter table royalty_payouts enable row level security;
alter table wallets enable row level security;
alter table profiles enable row level security;

-- Public can read songs and artists
create policy "Songs are public" on songs for select using (true);
create policy "Artists are public" on artists for select using (true);

-- Investors see their own data
create policy "Own investments" on investments for all using (auth.uid() = investor_id);
create policy "Own payouts" on royalty_payouts for all using (auth.uid() = investor_id);
create policy "Own wallet" on wallets for all using (auth.uid() = user_id);
create policy "Own profile" on profiles for all using (auth.uid() = id);

-- Artists manage their songs
create policy "Artist manages songs" on songs for insert
  with check (artist_id in (select id from artists where user_id = auth.uid()));
create policy "Artist updates songs" on songs for update
  using (artist_id in (select id from artists where user_id = auth.uid()));
