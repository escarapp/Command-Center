-- ============================================================
-- Phase 6: Admin Roles & Full-Access Policies
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ============================================================

-- 1. User profiles table (stores role per user)
create table if not exists public.user_profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  role       text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

-- Users can read their own profile (needed so AppShell can check role client-side)
drop policy if exists "Users can read own profile" on public.user_profiles;
create policy "Users can read own profile"
  on public.user_profiles for select
  using (auth.uid() = id);

-- Admins can update any profile (for future admin management UI)
drop policy if exists "Admins can manage profiles" on public.user_profiles;
create policy "Admins can manage profiles"
  on public.user_profiles for all
  using (
    exists (
      select 1 from public.user_profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.user_profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- -------------------------------------------------------
-- 2. is_admin() helper function (security definer so it
--    bypasses RLS when reading user_profiles internally)
-- -------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.user_profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- -------------------------------------------------------
-- 3. Seed the two admin users
-- -------------------------------------------------------
insert into public.user_profiles (id, role)
select id, 'admin'
from auth.users
where email in (
  'alexsheab2009@gmail.com',
  'rgvwater@escarconsulting.com'
)
on conflict (id) do update set role = 'admin', updated_at = now();

-- -------------------------------------------------------
-- 4. Admin full-access policies on every table
--    (PERMISSIVE policies are OR'd with existing ones,
--     so admins bypass the owner_id = auth.uid() check)
-- -------------------------------------------------------

-- schema.sql tables
drop policy if exists "Admins have full access" on public.gis_features;
create policy "Admins have full access" on public.gis_features
  using (is_admin()) with check (is_admin());

drop policy if exists "Admins have full access" on public.gis_layers;
create policy "Admins have full access" on public.gis_layers
  using (is_admin()) with check (is_admin());

-- phase2.sql tables
drop policy if exists "Admins have full access" on public.projects;
create policy "Admins have full access" on public.projects
  using (is_admin()) with check (is_admin());

drop policy if exists "Admins have full access" on public.crm_organizations;
create policy "Admins have full access" on public.crm_organizations
  using (is_admin()) with check (is_admin());

drop policy if exists "Admins have full access" on public.crm_contacts;
create policy "Admins have full access" on public.crm_contacts
  using (is_admin()) with check (is_admin());

drop policy if exists "Admins have full access" on public.crm_meetings;
create policy "Admins have full access" on public.crm_meetings
  using (is_admin()) with check (is_admin());

drop policy if exists "Admins have full access" on public.crm_notes;
create policy "Admins have full access" on public.crm_notes
  using (is_admin()) with check (is_admin());

drop policy if exists "Admins have full access" on public.funding_programs;
create policy "Admins have full access" on public.funding_programs
  using (is_admin()) with check (is_admin());

drop policy if exists "Admins have full access" on public.funding_links;
create policy "Admins have full access" on public.funding_links
  using (is_admin()) with check (is_admin());

drop policy if exists "Admins have full access" on public.documents;
create policy "Admins have full access" on public.documents
  using (is_admin()) with check (is_admin());

-- phase3.sql tables
drop policy if exists "Admins have full access" on public.uploaded_files;
create policy "Admins have full access" on public.uploaded_files
  using (is_admin()) with check (is_admin());

drop policy if exists "Admins have full access" on public.imported_layers;
create policy "Admins have full access" on public.imported_layers
  using (is_admin()) with check (is_admin());

drop policy if exists "Admins have full access" on public.imported_geometries;
create policy "Admins have full access" on public.imported_geometries
  using (is_admin()) with check (is_admin());

drop policy if exists "Admins have full access" on public.map_overlays;
create policy "Admins have full access" on public.map_overlays
  using (is_admin()) with check (is_admin());

drop policy if exists "Admins have full access" on public.overlay_control_points;
create policy "Admins have full access" on public.overlay_control_points
  using (is_admin()) with check (is_admin());

drop policy if exists "Admins have full access" on public.row_corridors;
create policy "Admins have full access" on public.row_corridors
  using (is_admin()) with check (is_admin());

drop policy if exists "Admins have full access" on public.route_alternatives;
create policy "Admins have full access" on public.route_alternatives
  using (is_admin()) with check (is_admin());

drop policy if exists "Admins have full access" on public.route_cost_estimates;
create policy "Admins have full access" on public.route_cost_estimates
  using (is_admin()) with check (is_admin());

drop policy if exists "Admins have full access" on public.export_jobs;
create policy "Admins have full access" on public.export_jobs
  using (is_admin()) with check (is_admin());

-- phase4.sql tables
drop policy if exists "Admins have full access" on public.project_scenarios;
create policy "Admins have full access" on public.project_scenarios
  using (is_admin()) with check (is_admin());

drop policy if exists "Admins have full access" on public.scenario_utilities;
create policy "Admins have full access" on public.scenario_utilities
  using (is_admin()) with check (is_admin());

drop policy if exists "Admins have full access" on public.scenario_routes;
create policy "Admins have full access" on public.scenario_routes
  using (is_admin()) with check (is_admin());

drop policy if exists "Admins have full access" on public.revenue_models;
create policy "Admins have full access" on public.revenue_models
  using (is_admin()) with check (is_admin());

drop policy if exists "Admins have full access" on public.risk_register;
create policy "Admins have full access" on public.risk_register
  using (is_admin()) with check (is_admin());

drop policy if exists "Admins have full access" on public.meeting_briefs;
create policy "Admins have full access" on public.meeting_briefs
  using (is_admin()) with check (is_admin());

drop policy if exists "Admins have full access" on public.dashboard_snapshots;
create policy "Admins have full access" on public.dashboard_snapshots
  using (is_admin()) with check (is_admin());

drop policy if exists "Admins have full access" on public.export_history;
create policy "Admins have full access" on public.export_history
  using (is_admin()) with check (is_admin());

-- phase5.sql tables
drop policy if exists "Admins have full access" on public.ai_chat_threads;
create policy "Admins have full access" on public.ai_chat_threads
  using (is_admin()) with check (is_admin());

drop policy if exists "Admins have full access" on public.ai_chat_messages;
create policy "Admins have full access" on public.ai_chat_messages
  using (is_admin()) with check (is_admin());

drop policy if exists "Admins have full access" on public.funding_program_profiles;
create policy "Admins have full access" on public.funding_program_profiles
  using (is_admin()) with check (is_admin());

drop policy if exists "Admins have full access" on public.document_chunks;
create policy "Admins have full access" on public.document_chunks
  using (is_admin()) with check (is_admin());

-- ============================================================
-- Phase 6 (Engineering GIS & Right-of-Way Intelligence)
-- Additive schema: parcel intelligence, easements, environmental
-- constraints, utility crossing analysis, route risk scoring,
-- and engineering report tracking.
-- ============================================================

-- Existing table note:
-- public.row_corridors was introduced in phase3.sql.
-- We extend it here for engineering layer-library categorization.
alter table if exists public.row_corridors
  add column if not exists layer_name text,
  add column if not exists is_engineering_library boolean not null default false;

-- 1) Parcel Intelligence
create table if not exists public.parcels (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  parcel_id text not null,
  owner_name text not null,
  acreage numeric null,
  county text null,
  appraised_value numeric null,
  source text null,
  metadata jsonb not null default '{}'::jsonb,
  geom geometry(Geometry, 4326) null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, parcel_id)
);

drop trigger if exists set_parcels_updated_at on public.parcels;
create trigger set_parcels_updated_at
before update on public.parcels
for each row
execute function public.set_current_timestamp_updated_at();

create index if not exists parcels_owner_idx on public.parcels (owner_id, updated_at desc);
create index if not exists parcels_owner_ownername_idx on public.parcels (owner_id, owner_name);
create index if not exists parcels_owner_parcelid_idx on public.parcels (owner_id, parcel_id);
create index if not exists parcels_geom_idx on public.parcels using gist (geom);

alter table public.parcels enable row level security;

drop policy if exists "Users can select own parcels" on public.parcels;
create policy "Users can select own parcels" on public.parcels for select using (owner_id = auth.uid());

drop policy if exists "Users can insert own parcels" on public.parcels;
create policy "Users can insert own parcels" on public.parcels for insert with check (owner_id = auth.uid());

drop policy if exists "Users can update own parcels" on public.parcels;
create policy "Users can update own parcels" on public.parcels for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "Users can delete own parcels" on public.parcels;
create policy "Users can delete own parcels" on public.parcels for delete using (owner_id = auth.uid());

-- 2) Easement Management
create table if not exists public.easements (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  route_alternative_id uuid null references public.route_alternatives(id) on delete set null,
  parcel_id uuid null references public.parcels(id) on delete set null,
  easement_owner text not null,
  width_ft numeric null,
  length_ft numeric null,
  status text not null default 'proposed' check (status in ('proposed', 'in_review', 'negotiating', 'approved', 'recorded', 'closed')),
  notes text null,
  geom geometry(Geometry, 4326) null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_easements_updated_at on public.easements;
create trigger set_easements_updated_at
before update on public.easements
for each row
execute function public.set_current_timestamp_updated_at();

create index if not exists easements_owner_idx on public.easements (owner_id, updated_at desc);
create index if not exists easements_route_idx on public.easements (owner_id, route_alternative_id);
create index if not exists easements_parcel_idx on public.easements (owner_id, parcel_id);
create index if not exists easements_geom_idx on public.easements using gist (geom);

alter table public.easements enable row level security;

drop policy if exists "Users can select own easements" on public.easements;
create policy "Users can select own easements" on public.easements for select using (owner_id = auth.uid());

drop policy if exists "Users can insert own easements" on public.easements;
create policy "Users can insert own easements" on public.easements for insert with check (owner_id = auth.uid());

drop policy if exists "Users can update own easements" on public.easements;
create policy "Users can update own easements" on public.easements for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "Users can delete own easements" on public.easements;
create policy "Users can delete own easements" on public.easements for delete using (owner_id = auth.uid());

-- 3) Environmental Constraints
create table if not exists public.environmental_constraints (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  constraint_type text not null check (constraint_type in ('fema_floodplain', 'wetlands', 'coastal_barriers', 'protected_habitats', 'water_bodies', 'other')),
  name text null,
  severity integer not null default 3 check (severity between 1 and 5),
  notes text null,
  source text null,
  geom geometry(Geometry, 4326) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_environmental_constraints_updated_at on public.environmental_constraints;
create trigger set_environmental_constraints_updated_at
before update on public.environmental_constraints
for each row
execute function public.set_current_timestamp_updated_at();

create index if not exists environmental_constraints_owner_idx on public.environmental_constraints (owner_id, updated_at desc);
create index if not exists environmental_constraints_type_idx on public.environmental_constraints (owner_id, constraint_type);
create index if not exists environmental_constraints_geom_idx on public.environmental_constraints using gist (geom);

alter table public.environmental_constraints enable row level security;

drop policy if exists "Users can select own environmental_constraints" on public.environmental_constraints;
create policy "Users can select own environmental_constraints" on public.environmental_constraints for select using (owner_id = auth.uid());

drop policy if exists "Users can insert own environmental_constraints" on public.environmental_constraints;
create policy "Users can insert own environmental_constraints" on public.environmental_constraints for insert with check (owner_id = auth.uid());

drop policy if exists "Users can update own environmental_constraints" on public.environmental_constraints;
create policy "Users can update own environmental_constraints" on public.environmental_constraints for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "Users can delete own environmental_constraints" on public.environmental_constraints;
create policy "Users can delete own environmental_constraints" on public.environmental_constraints for delete using (owner_id = auth.uid());

-- 4) Utility Crossing Analysis
create table if not exists public.route_crossings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  route_alternative_id uuid not null references public.route_alternatives(id) on delete cascade,
  crossing_type text not null check (crossing_type in ('road', 'railroad', 'canal', 'utility')),
  crossing_count integer not null default 0,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, route_alternative_id, crossing_type)
);

drop trigger if exists set_route_crossings_updated_at on public.route_crossings;
create trigger set_route_crossings_updated_at
before update on public.route_crossings
for each row
execute function public.set_current_timestamp_updated_at();

create index if not exists route_crossings_owner_route_idx on public.route_crossings (owner_id, route_alternative_id);

alter table public.route_crossings enable row level security;

drop policy if exists "Users can select own route_crossings" on public.route_crossings;
create policy "Users can select own route_crossings" on public.route_crossings for select using (owner_id = auth.uid());

drop policy if exists "Users can insert own route_crossings" on public.route_crossings;
create policy "Users can insert own route_crossings" on public.route_crossings for insert with check (owner_id = auth.uid());

drop policy if exists "Users can update own route_crossings" on public.route_crossings;
create policy "Users can update own route_crossings" on public.route_crossings for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "Users can delete own route_crossings" on public.route_crossings;
create policy "Users can delete own route_crossings" on public.route_crossings for delete using (owner_id = auth.uid());

-- 5) Engineering Reports registry
create table if not exists public.engineering_reports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  report_type text not null check (report_type in ('route_summary_pdf', 'crossing_report', 'environmental_constraint_report', 'easement_report')),
  route_alternative_id uuid null references public.route_alternatives(id) on delete set null,
  project_id uuid null references public.projects(id) on delete set null,
  title text null,
  parameters jsonb not null default '{}'::jsonb,
  file_bucket text null,
  file_path text null,
  status text not null default 'generated' check (status in ('generated', 'failed')),
  notes text null,
  created_at timestamptz not null default now()
);

create index if not exists engineering_reports_owner_created_idx on public.engineering_reports (owner_id, created_at desc);

alter table public.engineering_reports enable row level security;

drop policy if exists "Users can select own engineering_reports" on public.engineering_reports;
create policy "Users can select own engineering_reports" on public.engineering_reports for select using (owner_id = auth.uid());

drop policy if exists "Users can insert own engineering_reports" on public.engineering_reports;
create policy "Users can insert own engineering_reports" on public.engineering_reports for insert with check (owner_id = auth.uid());

drop policy if exists "Users can delete own engineering_reports" on public.engineering_reports;
create policy "Users can delete own engineering_reports" on public.engineering_reports for delete using (owner_id = auth.uid());

-- 5b) RPC helpers for geometry-aware upserts
create or replace function public.upsert_parcel(
  p_id uuid,
  p_parcel_id text,
  p_owner_name text,
  p_acreage numeric default null,
  p_county text default null,
  p_appraised_value numeric default null,
  p_source text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_geometry jsonb default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_parcel_id is null or btrim(p_parcel_id) = '' then
    raise exception 'Parcel ID is required';
  end if;
  if p_owner_name is null or btrim(p_owner_name) = '' then
    raise exception 'Owner name is required';
  end if;

  if p_id is null then
    insert into public.parcels (
      owner_id,
      parcel_id,
      owner_name,
      acreage,
      county,
      appraised_value,
      source,
      metadata,
      geom
    ) values (
      v_user_id,
      btrim(p_parcel_id),
      btrim(p_owner_name),
      p_acreage,
      nullif(btrim(coalesce(p_county, '')), ''),
      p_appraised_value,
      nullif(btrim(coalesce(p_source, '')), ''),
      coalesce(p_metadata, '{}'::jsonb),
      case when p_geometry is null then null else st_setsrid(st_geomfromgeojson(p_geometry::text), 4326) end
    )
    returning id into v_id;
  else
    update public.parcels
    set
      parcel_id = btrim(p_parcel_id),
      owner_name = btrim(p_owner_name),
      acreage = p_acreage,
      county = nullif(btrim(coalesce(p_county, '')), ''),
      appraised_value = p_appraised_value,
      source = nullif(btrim(coalesce(p_source, '')), ''),
      metadata = coalesce(p_metadata, '{}'::jsonb),
      geom = case when p_geometry is null then geom else st_setsrid(st_geomfromgeojson(p_geometry::text), 4326) end,
      updated_at = now()
    where id = p_id and owner_id = v_user_id
    returning id into v_id;

    if v_id is null then
      raise exception 'Parcel not found or access denied';
    end if;
  end if;

  return v_id;
end;
$$;

grant execute on function public.upsert_parcel(uuid, text, text, numeric, text, numeric, text, jsonb, jsonb) to authenticated;

create or replace function public.upsert_easement(
  p_id uuid,
  p_easement_owner text,
  p_route_alternative_id uuid default null,
  p_parcel_id uuid default null,
  p_width_ft numeric default null,
  p_length_ft numeric default null,
  p_status text default 'proposed',
  p_notes text default null,
  p_geometry jsonb default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_easement_owner is null or btrim(p_easement_owner) = '' then
    raise exception 'Easement owner is required';
  end if;

  if p_id is null then
    insert into public.easements (
      owner_id,
      route_alternative_id,
      parcel_id,
      easement_owner,
      width_ft,
      length_ft,
      status,
      notes,
      geom
    ) values (
      v_user_id,
      p_route_alternative_id,
      p_parcel_id,
      btrim(p_easement_owner),
      p_width_ft,
      p_length_ft,
      coalesce(nullif(btrim(p_status), ''), 'proposed'),
      nullif(btrim(coalesce(p_notes, '')), ''),
      case when p_geometry is null then null else st_setsrid(st_geomfromgeojson(p_geometry::text), 4326) end
    )
    returning id into v_id;
  else
    update public.easements
    set
      route_alternative_id = p_route_alternative_id,
      parcel_id = p_parcel_id,
      easement_owner = btrim(p_easement_owner),
      width_ft = p_width_ft,
      length_ft = p_length_ft,
      status = coalesce(nullif(btrim(p_status), ''), 'proposed'),
      notes = nullif(btrim(coalesce(p_notes, '')), ''),
      geom = case when p_geometry is null then geom else st_setsrid(st_geomfromgeojson(p_geometry::text), 4326) end,
      updated_at = now()
    where id = p_id and owner_id = v_user_id
    returning id into v_id;

    if v_id is null then
      raise exception 'Easement not found or access denied';
    end if;
  end if;

  return v_id;
end;
$$;

grant execute on function public.upsert_easement(uuid, text, uuid, uuid, numeric, numeric, text, text, jsonb) to authenticated;

create or replace function public.upsert_environmental_constraint(
  p_id uuid,
  p_constraint_type text,
  p_geometry jsonb,
  p_name text default null,
  p_severity int default 3,
  p_notes text default null,
  p_source text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_constraint_type is null or btrim(p_constraint_type) = '' then
    raise exception 'Constraint type is required';
  end if;
  if p_geometry is null then
    raise exception 'Geometry is required';
  end if;

  if p_id is null then
    insert into public.environmental_constraints (
      owner_id,
      constraint_type,
      name,
      severity,
      notes,
      source,
      geom
    ) values (
      v_user_id,
      btrim(p_constraint_type),
      nullif(btrim(coalesce(p_name, '')), ''),
      least(greatest(coalesce(p_severity, 3), 1), 5),
      nullif(btrim(coalesce(p_notes, '')), ''),
      nullif(btrim(coalesce(p_source, '')), ''),
      st_setsrid(st_geomfromgeojson(p_geometry::text), 4326)
    )
    returning id into v_id;
  else
    update public.environmental_constraints
    set
      constraint_type = btrim(p_constraint_type),
      name = nullif(btrim(coalesce(p_name, '')), ''),
      severity = least(greatest(coalesce(p_severity, 3), 1), 5),
      notes = nullif(btrim(coalesce(p_notes, '')), ''),
      source = nullif(btrim(coalesce(p_source, '')), ''),
      geom = st_setsrid(st_geomfromgeojson(p_geometry::text), 4326),
      updated_at = now()
    where id = p_id and owner_id = v_user_id
    returning id into v_id;

    if v_id is null then
      raise exception 'Constraint not found or access denied';
    end if;
  end if;

  return v_id;
end;
$$;

grant execute on function public.upsert_environmental_constraint(uuid, text, jsonb, text, int, text, text) to authenticated;

-- 6) RPC: recompute crossing totals for one route alternative
create or replace function public.refresh_route_crossings(p_route_alternative_id uuid)
returns table (crossing_type text, crossing_count integer)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_road int := 0;
  v_rail int := 0;
  v_canal int := 0;
  v_utility int := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1 from public.route_alternatives ra
    where ra.id = p_route_alternative_id
      and ra.owner_id = v_user_id
  ) then
    raise exception 'Route alternative not found';
  end if;

  select count(*)::int into v_road
  from public.row_corridors rc
  join public.route_alternatives ra on ra.id = p_route_alternative_id
  where rc.owner_id = v_user_id
    and ra.owner_id = v_user_id
    and rc.geom is not null
    and st_intersects(ra.geom, rc.geom)
    and (
      lower(coalesce(rc.layer_name, '')) like '%road%'
      or lower(coalesce(rc.layer_name, '')) like '%street%'
      or lower(coalesce(rc.corridor_type, '')) like '%road%'
      or lower(coalesce(rc.corridor_type, '')) like '%street%'
    );

  select count(*)::int into v_rail
  from public.row_corridors rc
  join public.route_alternatives ra on ra.id = p_route_alternative_id
  where rc.owner_id = v_user_id
    and ra.owner_id = v_user_id
    and rc.geom is not null
    and st_intersects(ra.geom, rc.geom)
    and (
      lower(coalesce(rc.layer_name, '')) like '%rail%'
      or lower(coalesce(rc.corridor_type, '')) like '%rail%'
    );

  select count(*)::int into v_canal
  from public.row_corridors rc
  join public.route_alternatives ra on ra.id = p_route_alternative_id
  where rc.owner_id = v_user_id
    and ra.owner_id = v_user_id
    and rc.geom is not null
    and st_intersects(ra.geom, rc.geom)
    and (
      lower(coalesce(rc.layer_name, '')) like '%drainage%'
      or lower(coalesce(rc.layer_name, '')) like '%irrigation%'
      or lower(coalesce(rc.layer_name, '')) like '%canal%'
      or lower(coalesce(rc.corridor_type, '')) like '%drainage%'
      or lower(coalesce(rc.corridor_type, '')) like '%irrigation%'
      or lower(coalesce(rc.corridor_type, '')) like '%canal%'
    );

  select count(*)::int into v_utility
  from public.row_corridors rc
  join public.route_alternatives ra on ra.id = p_route_alternative_id
  where rc.owner_id = v_user_id
    and ra.owner_id = v_user_id
    and rc.geom is not null
    and st_intersects(ra.geom, rc.geom)
    and (
      lower(coalesce(rc.layer_name, '')) like '%utility%'
      or lower(coalesce(rc.corridor_type, '')) like '%utility%'
    );

  insert into public.route_crossings (owner_id, route_alternative_id, crossing_type, crossing_count)
  values
    (v_user_id, p_route_alternative_id, 'road', v_road),
    (v_user_id, p_route_alternative_id, 'railroad', v_rail),
    (v_user_id, p_route_alternative_id, 'canal', v_canal),
    (v_user_id, p_route_alternative_id, 'utility', v_utility)
  on conflict (owner_id, route_alternative_id, crossing_type)
  do update set
    crossing_count = excluded.crossing_count,
    updated_at = now();

  return query
  select rc.crossing_type, rc.crossing_count
  from public.route_crossings rc
  where rc.owner_id = v_user_id
    and rc.route_alternative_id = p_route_alternative_id
  order by rc.crossing_type;
end;
$$;

grant execute on function public.refresh_route_crossings(uuid) to authenticated;

-- 7) RPC: route risk scoring + comparison metrics
create or replace function public.get_engineering_route_risk(p_project_id uuid default null)
returns table (
  route_alternative_id uuid,
  project_id uuid,
  route_name text,
  length_miles double precision,
  estimated_cost double precision,
  environmental_risk int,
  row_complexity int,
  crossing_count int,
  land_acquisition_needs int,
  easement_requirements int,
  total_risk_score int
)
language sql
stable
security invoker
set search_path = public
as $$
  with routes as (
    select
      ra.id,
      ra.project_id,
      ra.name,
      ra.geom,
      (st_length(ra.geom::geography) / 1609.344)::double precision as length_miles,
      (coalesce(ra.cost_per_mile, 0)::double precision * (st_length(ra.geom::geography) / 1609.344)::double precision) as estimated_cost
    from public.route_alternatives ra
    where ra.owner_id = auth.uid()
      and (p_project_id is null or ra.project_id = p_project_id)
      and ra.geom is not null
  ),
  env as (
    select
      r.id as route_id,
      coalesce(sum(ec.severity), 0)::int as env_score
    from routes r
    left join public.environmental_constraints ec
      on ec.owner_id = auth.uid()
     and st_intersects(r.geom, ec.geom)
    group by r.id
  ),
  rowx as (
    select
      r.id as route_id,
      count(rc.id)::int as row_hits
    from routes r
    left join public.row_corridors rc
      on rc.owner_id = auth.uid()
     and st_intersects(r.geom, rc.geom)
    group by r.id
  ),
  crossing_totals as (
    select
      rc.route_alternative_id as route_id,
      coalesce(sum(rc.crossing_count), 0)::int as crossing_total
    from public.route_crossings rc
    where rc.owner_id = auth.uid()
    group by rc.route_alternative_id
  ),
  parcels_hit as (
    select
      r.id as route_id,
      count(p.id)::int as parcel_count
    from routes r
    left join public.parcels p
      on p.owner_id = auth.uid()
     and p.geom is not null
     and st_intersects(r.geom, p.geom)
    group by r.id
  ),
  easements_hit as (
    select
      r.id as route_id,
      count(e.id)::int as easement_count
    from routes r
    left join public.easements e
      on e.owner_id = auth.uid()
     and e.route_alternative_id = r.id
    group by r.id
  )
  select
    r.id as route_alternative_id,
    r.project_id,
    r.name as route_name,
    r.length_miles,
    r.estimated_cost,
    least(coalesce(env.env_score, 0), 40)::int as environmental_risk,
    least(coalesce(rowx.row_hits, 0), 20)::int as row_complexity,
    coalesce(crossing_totals.crossing_total, 0)::int as crossing_count,
    least(coalesce(parcels_hit.parcel_count, 0), 20)::int as land_acquisition_needs,
    coalesce(easements_hit.easement_count, 0)::int as easement_requirements,
    (
      least(coalesce(env.env_score, 0), 40)
      + least(coalesce(rowx.row_hits, 0), 20)
      + least(coalesce(crossing_totals.crossing_total, 0), 20)
      + least(coalesce(parcels_hit.parcel_count, 0), 20)
    )::int as total_risk_score
  from routes r
  left join env on env.route_id = r.id
  left join rowx on rowx.route_id = r.id
  left join crossing_totals on crossing_totals.route_id = r.id
  left join parcels_hit on parcels_hit.route_id = r.id
  left join easements_hit on easements_hit.route_id = r.id
  order by total_risk_score asc, r.length_miles asc;
$$;

grant execute on function public.get_engineering_route_risk(uuid) to authenticated;

-- 8) Admin full-access policies for new phase6 tables
drop policy if exists "Admins have full access" on public.parcels;
create policy "Admins have full access" on public.parcels
  using (is_admin()) with check (is_admin());

drop policy if exists "Admins have full access" on public.easements;
create policy "Admins have full access" on public.easements
  using (is_admin()) with check (is_admin());

drop policy if exists "Admins have full access" on public.environmental_constraints;
create policy "Admins have full access" on public.environmental_constraints
  using (is_admin()) with check (is_admin());

drop policy if exists "Admins have full access" on public.route_crossings;
create policy "Admins have full access" on public.route_crossings
  using (is_admin()) with check (is_admin());

drop policy if exists "Admins have full access" on public.engineering_reports;
create policy "Admins have full access" on public.engineering_reports
  using (is_admin()) with check (is_admin());
