-- RGV Water GIS Command Center v1
-- Run this in Supabase SQL Editor.

create extension if not exists postgis;
create extension if not exists pgcrypto;

create table if not exists public.gis_features (
  id uuid primary key default gen_random_uuid(),
  external_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  layer_key text not null,
  title text,
  notes text,
  priority text not null default 'low',
  contact_name text,
  contact_phone text,
  contact_email text,
  source_url text,
  geom geometry(Geometry, 4326) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, external_id),
  constraint gis_features_priority_check check (priority in ('low', 'medium', 'high', 'critical')),
  constraint gis_features_source_url_check check (source_url is null or source_url ~* '^https?://')
);

-- Migration helper: if you ran an older version of this schema, remove the hard-coded layer_key constraint.
alter table public.gis_features drop constraint if exists gis_features_layer_key_check;

-- Dynamic GIS layers (user-manageable)
create table if not exists public.gis_layers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  key text not null,
  label text not null,
  color text not null default '#3bb2d0',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gis_layers_key_unique unique (owner_id, key),
  constraint gis_layers_color_check check (color ~ '^#[0-9a-fA-F]{6}$')
);

-- Migration helper: if gis_layers already existed, ensure inserts default to the current user.
alter table public.gis_layers alter column owner_id set default auth.uid();

create index if not exists gis_features_owner_idx on public.gis_features (owner_id);
create index if not exists gis_features_layer_idx on public.gis_features (layer_key);
create index if not exists gis_features_geom_idx on public.gis_features using gist (geom);

create index if not exists gis_layers_owner_id_idx on public.gis_layers (owner_id);
create index if not exists gis_layers_sort_order_idx on public.gis_layers (owner_id, sort_order);

create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_gis_features_updated_at on public.gis_features;
create trigger set_gis_features_updated_at
before update on public.gis_features
for each row
execute function public.set_current_timestamp_updated_at();

drop trigger if exists set_gis_layers_updated_at on public.gis_layers;
create trigger set_gis_layers_updated_at
before update on public.gis_layers
for each row
execute function public.set_current_timestamp_updated_at();

create or replace view public.gis_features_geojson as
select
  id,
  external_id,
  owner_id,
  layer_key,
  title,
  notes,
  priority,
  contact_name,
  contact_phone,
  contact_email,
  source_url,
  st_asgeojson(geom)::jsonb as geometry,
  created_at,
  updated_at
from public.gis_features;

grant select on public.gis_features_geojson to authenticated;

grant select, insert, update, delete on public.gis_layers to authenticated;

create or replace function public.upsert_gis_feature(
  p_external_id uuid,
  p_layer_key text,
  p_geometry jsonb,
  p_title text default null,
  p_notes text default null,
  p_priority text default 'low',
  p_contact_name text default null,
  p_contact_phone text default null,
  p_contact_email text default null,
  p_source_url text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_feature_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  insert into public.gis_features (
    external_id,
    owner_id,
    layer_key,
    title,
    notes,
    priority,
    contact_name,
    contact_phone,
    contact_email,
    source_url,
    geom
  )
  values (
    p_external_id,
    v_user_id,
    p_layer_key,
    p_title,
    p_notes,
    coalesce(p_priority, 'low'),
    p_contact_name,
    p_contact_phone,
    p_contact_email,
    p_source_url,
    st_setsrid(st_geomfromgeojson(p_geometry::text), 4326)
  )
  on conflict (owner_id, external_id)
  do update set
    layer_key = excluded.layer_key,
    title = excluded.title,
    notes = excluded.notes,
    priority = excluded.priority,
    contact_name = excluded.contact_name,
    contact_phone = excluded.contact_phone,
    contact_email = excluded.contact_email,
    source_url = excluded.source_url,
    geom = excluded.geom
  returning id into v_feature_id;

  return v_feature_id;
end;
$$;

grant execute on function public.upsert_gis_feature(
  uuid,
  text,
  jsonb,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) to authenticated;

create or replace function public.delete_gis_feature(p_external_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  delete from public.gis_features
  where owner_id = auth.uid()
    and external_id = p_external_id;
end;
$$;

grant execute on function public.delete_gis_feature(uuid) to authenticated;

alter table public.gis_features enable row level security;

alter table public.gis_layers enable row level security;

drop policy if exists "Users can select own features" on public.gis_features;
create policy "Users can select own features"
on public.gis_features
for select
using (auth.uid() = owner_id);

drop policy if exists "Users can insert own features" on public.gis_features;

create policy "Users can insert own features"
on public.gis_features
for insert
with check (auth.uid() = owner_id);

drop policy if exists "Users can update own features" on public.gis_features;
create policy "Users can update own features"
on public.gis_features
for update
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists "Users can delete own features" on public.gis_features;
create policy "Users can delete own features"
on public.gis_features
for delete
using (auth.uid() = owner_id);

drop policy if exists "Users can view their own layers" on public.gis_layers;
create policy "Users can view their own layers" on public.gis_layers
  for select using (owner_id = auth.uid());

drop policy if exists "Users can create layers" on public.gis_layers;
create policy "Users can create layers" on public.gis_layers
  for insert with check (owner_id = auth.uid());

drop policy if exists "Users can update their own layers" on public.gis_layers;
create policy "Users can update their own layers" on public.gis_layers
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "Users can delete their own layers" on public.gis_layers;
create policy "Users can delete their own layers" on public.gis_layers
  for delete using (owner_id = auth.uid());
