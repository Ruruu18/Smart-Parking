-- Vehicles table for admin CRUD in Vehicle Management
-- Run this in Supabase SQL Editor

-- Enable extension (usually enabled by default)
create extension if not exists "pgcrypto";

-- Create table
create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  vehicle_type text not null check (vehicle_type in ('car','truck','van','pickup','bike','motorcycle','scooter')),
  vehicle_model text not null,
  vehicle_plate_number text not null unique,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Ensure RLS is enabled
alter table public.vehicles enable row level security;

-- RLS Policies
-- Authenticated users can read vehicles (needed for listing/joins)
drop policy if exists "Authenticated can read vehicles" on public.vehicles;
create policy "Authenticated can read vehicles"
  on public.vehicles for select
  to authenticated
  using (true);

-- Only admins can insert/update/delete vehicles
-- Assumes admin role is stored in public.user_profiles(id uuid pk -> auth.users(id))
drop policy if exists "Admins can modify vehicles" on public.vehicles;
create policy "Admins can modify vehicles"
  on public.vehicles for all
  to authenticated
  using (is_admin_from_jwt())
  with check (is_admin_from_jwt());

-- Trigger to auto-update updated_at
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger vehicles_set_updated_at
before update on public.vehicles
for each row execute function public.set_updated_at();

-- Helpful index for search by plate number
create index if not exists vehicles_plate_number_idx on public.vehicles (lower(vehicle_plate_number));
