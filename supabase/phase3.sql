-- RGV Water GIS Command Center — Phase 3
-- Run AFTER supabase/schema.sql and supabase/phase2.sql in Supabase SQL Editor.

-- -----------------------------
-- 0) Storage buckets
-- -----------------------------

-- Private bucket for planning uploads (PDF/images/GeoJSON/KML/KMZ/shapefile zips)
insert into storage.buckets (id, name, public)
values ('planning_uploads', 'planning_uploads', false)
on conflict (id) do nothing;

-- Private bucket for generated exports
insert into storage.buckets (id, name, public)
values ('planning_exports', 'planning_exports', false)
on conflict (id) do nothing;

-- Storage policies (managed objects only)
-- NOTE: Avoid ALTER TABLE storage.objects; hosted Supabase may block ownership changes.

drop policy if exists "Planning: read own objects" on storage.objects;
create policy "Planning: read own objects" on storage.objects
  for select
  using (
    (bucket_id in ('planning_uploads','planning_exports'))
    and owner = auth.uid()
  );

drop policy if exists "Planning: upload own objects" on storage.objects;
create policy "Planning: upload own objects" on storage.objects
  for insert
  with check (
    (bucket_id in ('planning_uploads','planning_exports'))
    and owner = auth.uid()
  );

drop policy if exists "Planning: update own objects" on storage.objects;
create policy "Planning: update own objects" on storage.objects
  for update
  using (
    (bucket_id in ('planning_uploads','planning_exports'))
    and owner = auth.uid()
  )
  with check (
    (bucket_id in ('planning_uploads','planning_exports'))
    and owner = auth.uid()
  );

drop policy if exists "Planning: delete own objects" on storage.objects;
create policy "Planning: delete own objects" on storage.objects
  for delete
  using (
    (bucket_id in ('planning_uploads','planning_exports'))
    and owner = auth.uid()
  );

-- -----------------------------
-- 1) File Upload System
-- -----------------------------

create table if not exists public.uploaded_files (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  bucket text not null default 'planning_uploads',
  path text not null,
  filename text not null,
  mime_type text null,
  size_bytes bigint null,
  file_kind text not null,
  -- Assignment targets (Phase 3)
  project_id uuid null references public.projects(id) on delete set null,
  route_alternative_id uuid null,
  crm_organization_id uuid null references public.crm_organizations(id) on delete set null,
  county_name text null,
  district_name text null,
  utility_name text null,
  notes text null,
  created_at timestamptz not null default now(),
  constraint uploaded_files_bucket_check check (bucket in ('planning_uploads','planning_exports')),
  constraint uploaded_files_kind_check check (
    file_kind in ('pdf','png','jpg','jpeg','geojson','kml','kmz','shp_zip','other')
  )
);

create index if not exists uploaded_files_owner_idx on public.uploaded_files (owner_id, created_at desc);
create index if not exists uploaded_files_project_idx on public.uploaded_files (owner_id, project_id);

alter table public.uploaded_files enable row level security;

drop policy if exists "Users can select own uploaded_files" on public.uploaded_files;
create policy "Users can select own uploaded_files" on public.uploaded_files for select using (owner_id = auth.uid());

drop policy if exists "Users can insert own uploaded_files" on public.uploaded_files;
create policy "Users can insert own uploaded_files" on public.uploaded_files for insert with check (owner_id = auth.uid());

drop policy if exists "Users can update own uploaded_files" on public.uploaded_files;
create policy "Users can update own uploaded_files" on public.uploaded_files for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "Users can delete own uploaded_files" on public.uploaded_files;
create policy "Users can delete own uploaded_files" on public.uploaded_files for delete using (owner_id = auth.uid());

-- -----------------------------
-- 2) GIS Layer Import
-- -----------------------------

create table if not exists public.imported_layers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  source_file_id uuid null references public.uploaded_files(id) on delete set null,
  default_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_imported_layers_updated_at on public.imported_layers;
create trigger set_imported_layers_updated_at
before update on public.imported_layers
for each row
execute function public.set_current_timestamp_updated_at();

create index if not exists imported_layers_owner_idx on public.imported_layers (owner_id, updated_at desc);

alter table public.imported_layers enable row level security;

drop policy if exists "Users can select own imported_layers" on public.imported_layers;
create policy "Users can select own imported_layers" on public.imported_layers for select using (owner_id = auth.uid());

drop policy if exists "Users can insert own imported_layers" on public.imported_layers;
create policy "Users can insert own imported_layers" on public.imported_layers for insert with check (owner_id = auth.uid());

drop policy if exists "Users can update own imported_layers" on public.imported_layers;
create policy "Users can update own imported_layers" on public.imported_layers for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "Users can delete own imported_layers" on public.imported_layers;
create policy "Users can delete own imported_layers" on public.imported_layers for delete using (owner_id = auth.uid());

create table if not exists public.imported_geometries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  imported_layer_id uuid not null references public.imported_layers(id) on delete cascade,
  feature_type text not null,
  properties jsonb not null default '{}'::jsonb,
  geom geometry(Geometry, 4326) not null,
  created_at timestamptz not null default now(),
  constraint imported_geometries_type_check check (feature_type in ('Point','LineString','Polygon','MultiPoint','MultiLineString','MultiPolygon','GeometryCollection'))
);

create index if not exists imported_geometries_owner_idx on public.imported_geometries (owner_id, imported_layer_id);
create index if not exists imported_geometries_geom_idx on public.imported_geometries using gist (geom);

alter table public.imported_geometries enable row level security;

drop policy if exists "Users can select own imported_geometries" on public.imported_geometries;
create policy "Users can select own imported_geometries" on public.imported_geometries for select using (owner_id = auth.uid());

drop policy if exists "Users can insert own imported_geometries" on public.imported_geometries;
create policy "Users can insert own imported_geometries" on public.imported_geometries for insert with check (owner_id = auth.uid());

drop policy if exists "Users can delete own imported_geometries" on public.imported_geometries;
create policy "Users can delete own imported_geometries" on public.imported_geometries for delete using (owner_id = auth.uid());

-- Helper RPC: insert one imported geometry (used for client-side conversion pipeline)
create or replace function public.insert_imported_geometry(
  p_imported_layer_id uuid,
  p_feature_type text,
  p_geometry jsonb,
  p_properties jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_row_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  insert into public.imported_geometries (
    owner_id,
    imported_layer_id,
    feature_type,
    properties,
    geom
  )
  values (
    v_user_id,
    p_imported_layer_id,
    p_feature_type,
    coalesce(p_properties, '{}'::jsonb),
    st_setsrid(st_geomfromgeojson(p_geometry::text), 4326)
  )
  returning id into v_row_id;

  return v_row_id;
end;
$$;

grant execute on function public.insert_imported_geometry(uuid, text, jsonb, jsonb) to authenticated;

-- Helper RPC: get a FeatureCollection for a layer
create or replace function public.get_imported_layer_geojson(p_imported_layer_id uuid)
returns jsonb
language sql
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'type','FeatureCollection',
    'features', coalesce(jsonb_agg(
      jsonb_build_object(
        'type','Feature',
        'id', id,
        'properties', properties,
        'geometry', st_asgeojson(geom)::jsonb
      )
    ), '[]'::jsonb)
  )
  from public.imported_geometries
  where owner_id = auth.uid()
    and imported_layer_id = p_imported_layer_id;
$$;

grant execute on function public.get_imported_layer_geojson(uuid) to authenticated;

-- -----------------------------
-- 3) Map Overlays / Georeferencing (planning-level)
-- -----------------------------

create table if not exists public.map_overlays (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  uploaded_file_id uuid null references public.uploaded_files(id) on delete set null,
  image_bucket text not null default 'planning_uploads',
  image_path text not null,
  image_width integer null,
  image_height integer null,
  opacity numeric not null default 0.6,
  -- Four corners in lng/lat order: [[lng,lat],[lng,lat],[lng,lat],[lng,lat]]
  corners jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_map_overlays_updated_at on public.map_overlays;
create trigger set_map_overlays_updated_at
before update on public.map_overlays
for each row
execute function public.set_current_timestamp_updated_at();

create index if not exists map_overlays_owner_idx on public.map_overlays (owner_id, updated_at desc);

alter table public.map_overlays enable row level security;

drop policy if exists "Users can select own map_overlays" on public.map_overlays;
create policy "Users can select own map_overlays" on public.map_overlays for select using (owner_id = auth.uid());

drop policy if exists "Users can insert own map_overlays" on public.map_overlays;
create policy "Users can insert own map_overlays" on public.map_overlays for insert with check (owner_id = auth.uid());

drop policy if exists "Users can update own map_overlays" on public.map_overlays;
create policy "Users can update own map_overlays" on public.map_overlays for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "Users can delete own map_overlays" on public.map_overlays;
create policy "Users can delete own map_overlays" on public.map_overlays for delete using (owner_id = auth.uid());

create table if not exists public.overlay_control_points (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  overlay_id uuid not null references public.map_overlays(id) on delete cascade,
  image_x numeric not null,
  image_y numeric not null,
  map_lng numeric not null,
  map_lat numeric not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists overlay_points_owner_idx on public.overlay_control_points (owner_id, overlay_id, sort_order);

alter table public.overlay_control_points enable row level security;

drop policy if exists "Users can select own overlay_control_points" on public.overlay_control_points;
create policy "Users can select own overlay_control_points" on public.overlay_control_points for select using (owner_id = auth.uid());

drop policy if exists "Users can insert own overlay_control_points" on public.overlay_control_points;
create policy "Users can insert own overlay_control_points" on public.overlay_control_points for insert with check (owner_id = auth.uid());

drop policy if exists "Users can delete own overlay_control_points" on public.overlay_control_points;
create policy "Users can delete own overlay_control_points" on public.overlay_control_points for delete using (owner_id = auth.uid());

-- -----------------------------
-- 4) Right-of-Way and Corridor Layer Module
-- -----------------------------

create table if not exists public.row_corridors (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  corridor_type text not null,
  corridor_owner text null,
  width_ft numeric null,
  source text null,
  verification_status text not null default 'unverified',
  notes text null,
  geom geometry(Geometry, 4326) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint row_corridors_verification_check check (verification_status in ('unverified','partial','verified'))
);

drop trigger if exists set_row_corridors_updated_at on public.row_corridors;
create trigger set_row_corridors_updated_at
before update on public.row_corridors
for each row
execute function public.set_current_timestamp_updated_at();

create index if not exists row_corridors_owner_idx on public.row_corridors (owner_id, updated_at desc);
create index if not exists row_corridors_geom_idx on public.row_corridors using gist (geom);

alter table public.row_corridors enable row level security;

drop policy if exists "Users can select own row_corridors" on public.row_corridors;
create policy "Users can select own row_corridors" on public.row_corridors for select using (owner_id = auth.uid());

drop policy if exists "Users can insert own row_corridors" on public.row_corridors;
create policy "Users can insert own row_corridors" on public.row_corridors for insert with check (owner_id = auth.uid());

drop policy if exists "Users can update own row_corridors" on public.row_corridors;
create policy "Users can update own row_corridors" on public.row_corridors for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "Users can delete own row_corridors" on public.row_corridors;
create policy "Users can delete own row_corridors" on public.row_corridors for delete using (owner_id = auth.uid());

-- Helper RPC: upsert a ROW corridor with GeoJSON geometry
create or replace function public.upsert_row_corridor(
  p_id uuid,
  p_name text,
  p_corridor_type text,
  p_corridor_owner text default null,
  p_width_ft numeric default null,
  p_source text default null,
  p_verification_status text default 'unverified',
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
  v_row_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_name is null or btrim(p_name) = '' then
    raise exception 'Name is required';
  end if;

  if p_corridor_type is null or btrim(p_corridor_type) = '' then
    raise exception 'Corridor type is required';
  end if;

  if p_geometry is null then
    raise exception 'Geometry is required';
  end if;

  if p_id is null then
    insert into public.row_corridors (
      owner_id,
      name,
      corridor_type,
      corridor_owner,
      width_ft,
      source,
      verification_status,
      notes,
      geom
    )
    values (
      v_user_id,
      btrim(p_name),
      btrim(p_corridor_type),
      nullif(btrim(p_corridor_owner), ''),
      p_width_ft,
      nullif(btrim(p_source), ''),
      coalesce(nullif(btrim(p_verification_status), ''), 'unverified'),
      nullif(btrim(p_notes), ''),
      st_setsrid(st_geomfromgeojson(p_geometry::text), 4326)
    )
    returning id into v_row_id;
  else
    update public.row_corridors
    set
      name = btrim(p_name),
      corridor_type = btrim(p_corridor_type),
      corridor_owner = nullif(btrim(p_corridor_owner), ''),
      width_ft = p_width_ft,
      source = nullif(btrim(p_source), ''),
      verification_status = coalesce(nullif(btrim(p_verification_status), ''), 'unverified'),
      notes = nullif(btrim(p_notes), ''),
      geom = st_setsrid(st_geomfromgeojson(p_geometry::text), 4326)
    where id = p_id
      and owner_id = v_user_id
    returning id into v_row_id;

    if v_row_id is null then
      raise exception 'ROW corridor not found';
    end if;
  end if;

  return v_row_id;
end;
$$;

grant execute on function public.upsert_row_corridor(uuid, text, text, text, numeric, text, text, text, jsonb) to authenticated;

-- Helper RPC: get all corridors for current user as a FeatureCollection
create or replace function public.get_row_corridors_geojson()
returns jsonb
language sql
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'type','FeatureCollection',
    'features', coalesce(jsonb_agg(
      jsonb_build_object(
        'type','Feature',
        'id', id,
        'properties', jsonb_build_object(
          'name', name,
          'corridor_type', corridor_type,
          'corridor_owner', corridor_owner,
          'width_ft', width_ft,
          'source', source,
          'verification_status', verification_status,
          'notes', notes,
          'created_at', created_at,
          'updated_at', updated_at
        ),
        'geometry', st_asgeojson(geom)::jsonb
      )
    ), '[]'::jsonb)
  )
  from public.row_corridors
  where owner_id = auth.uid();
$$;

grant execute on function public.get_row_corridors_geojson() to authenticated;

-- -----------------------------
-- 5) Pipeline Route Comparison Tool
-- -----------------------------

create table if not exists public.route_alternatives (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  cost_per_mile numeric null,
  crossings text null,
  easement_concerns text null,
  permitting_concerns text null,
  environmental_concerns text null,
  notes text null,
  geom geometry(LineString, 4326) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_route_alternatives_updated_at on public.route_alternatives;
create trigger set_route_alternatives_updated_at
before update on public.route_alternatives
for each row
execute function public.set_current_timestamp_updated_at();

create index if not exists route_alternatives_owner_idx on public.route_alternatives (owner_id, project_id, updated_at desc);
create index if not exists route_alternatives_geom_idx on public.route_alternatives using gist (geom);

alter table public.route_alternatives enable row level security;

drop policy if exists "Users can select own route_alternatives" on public.route_alternatives;
create policy "Users can select own route_alternatives" on public.route_alternatives for select using (owner_id = auth.uid());

drop policy if exists "Users can insert own route_alternatives" on public.route_alternatives;
create policy "Users can insert own route_alternatives" on public.route_alternatives for insert with check (owner_id = auth.uid());

drop policy if exists "Users can update own route_alternatives" on public.route_alternatives;
create policy "Users can update own route_alternatives" on public.route_alternatives for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "Users can delete own route_alternatives" on public.route_alternatives;
create policy "Users can delete own route_alternatives" on public.route_alternatives for delete using (owner_id = auth.uid());

-- Helper RPC: upsert a route alternative with GeoJSON LineString geometry
create or replace function public.upsert_route_alternative(
  p_id uuid,
  p_project_id uuid,
  p_name text,
  p_cost_per_mile numeric default null,
  p_crossings text default null,
  p_easement_concerns text default null,
  p_permitting_concerns text default null,
  p_environmental_concerns text default null,
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
  v_row_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_geometry is null then
    raise exception 'Geometry is required';
  end if;

  if p_id is null then
    insert into public.route_alternatives (
      owner_id,
      project_id,
      name,
      cost_per_mile,
      crossings,
      easement_concerns,
      permitting_concerns,
      environmental_concerns,
      notes,
      geom
    )
    values (
      v_user_id,
      p_project_id,
      p_name,
      p_cost_per_mile,
      p_crossings,
      p_easement_concerns,
      p_permitting_concerns,
      p_environmental_concerns,
      p_notes,
      st_setsrid(st_geomfromgeojson(p_geometry::text), 4326)
    )
    returning id into v_row_id;
  else
    update public.route_alternatives
    set
      project_id = p_project_id,
      name = p_name,
      cost_per_mile = p_cost_per_mile,
      crossings = p_crossings,
      easement_concerns = p_easement_concerns,
      permitting_concerns = p_permitting_concerns,
      environmental_concerns = p_environmental_concerns,
      notes = p_notes,
      geom = st_setsrid(st_geomfromgeojson(p_geometry::text), 4326)
    where id = p_id
      and owner_id = v_user_id
    returning id into v_row_id;

    if v_row_id is null then
      raise exception 'Route alternative not found';
    end if;
  end if;

  return v_row_id;
end;
$$;

grant execute on function public.upsert_route_alternative(uuid, uuid, text, numeric, text, text, text, text, text, jsonb) to authenticated;

-- Helper RPC: get alternatives for a project as a FeatureCollection
create or replace function public.get_route_alternatives_geojson(p_project_id uuid)
returns jsonb
language sql
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'type','FeatureCollection',
    'features', coalesce(jsonb_agg(
      jsonb_build_object(
        'type','Feature',
        'id', id,
        'properties', jsonb_build_object(
          'project_id', project_id,
          'name', name,
          'cost_per_mile', cost_per_mile,
          'crossings', crossings,
          'easement_concerns', easement_concerns,
          'permitting_concerns', permitting_concerns,
          'environmental_concerns', environmental_concerns,
          'notes', notes,
          'updated_at', updated_at
        ),
        'geometry', st_asgeojson(geom)::jsonb
      )
    ), '[]'::jsonb)
  )
  from public.route_alternatives
  where owner_id = auth.uid()
    and project_id = p_project_id;
$$;

grant execute on function public.get_route_alternatives_geojson(uuid) to authenticated;

-- -----------------------------
-- 6) Cost Estimator
-- -----------------------------

create table if not exists public.route_cost_estimates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  pipeline_miles numeric null,
  cost_per_mile numeric null,
  pump_station_cost numeric null,
  storage_tank_cost numeric null,
  land_easement_cost numeric null,
  engineering_design_pct numeric null,
  permitting_environmental_pct numeric null,
  contingency_pct numeric null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_route_cost_estimates_updated_at on public.route_cost_estimates;
create trigger set_route_cost_estimates_updated_at
before update on public.route_cost_estimates
for each row
execute function public.set_current_timestamp_updated_at();

create index if not exists route_cost_estimates_owner_idx on public.route_cost_estimates (owner_id, project_id, updated_at desc);

alter table public.route_cost_estimates enable row level security;

drop policy if exists "Users can select own route_cost_estimates" on public.route_cost_estimates;
create policy "Users can select own route_cost_estimates" on public.route_cost_estimates for select using (owner_id = auth.uid());

drop policy if exists "Users can insert own route_cost_estimates" on public.route_cost_estimates;
create policy "Users can insert own route_cost_estimates" on public.route_cost_estimates for insert with check (owner_id = auth.uid());

drop policy if exists "Users can update own route_cost_estimates" on public.route_cost_estimates;
create policy "Users can update own route_cost_estimates" on public.route_cost_estimates for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "Users can delete own route_cost_estimates" on public.route_cost_estimates;
create policy "Users can delete own route_cost_estimates" on public.route_cost_estimates for delete using (owner_id = auth.uid());

-- Helper RPC: upsert a cost estimate per project (latest row per user/project)
create or replace function public.upsert_route_cost_estimate(
  p_id uuid,
  p_project_id uuid,
  p_pipeline_miles numeric default null,
  p_cost_per_mile numeric default null,
  p_pump_station_cost numeric default null,
  p_storage_tank_cost numeric default null,
  p_land_easement_cost numeric default null,
  p_engineering_design_pct numeric default null,
  p_permitting_environmental_pct numeric default null,
  p_contingency_pct numeric default null,
  p_notes text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_row_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_id is null then
    insert into public.route_cost_estimates (
      owner_id,
      project_id,
      pipeline_miles,
      cost_per_mile,
      pump_station_cost,
      storage_tank_cost,
      land_easement_cost,
      engineering_design_pct,
      permitting_environmental_pct,
      contingency_pct,
      notes
    )
    values (
      v_user_id,
      p_project_id,
      p_pipeline_miles,
      p_cost_per_mile,
      p_pump_station_cost,
      p_storage_tank_cost,
      p_land_easement_cost,
      p_engineering_design_pct,
      p_permitting_environmental_pct,
      p_contingency_pct,
      p_notes
    )
    returning id into v_row_id;
  else
    update public.route_cost_estimates
    set
      project_id = p_project_id,
      pipeline_miles = p_pipeline_miles,
      cost_per_mile = p_cost_per_mile,
      pump_station_cost = p_pump_station_cost,
      storage_tank_cost = p_storage_tank_cost,
      land_easement_cost = p_land_easement_cost,
      engineering_design_pct = p_engineering_design_pct,
      permitting_environmental_pct = p_permitting_environmental_pct,
      contingency_pct = p_contingency_pct,
      notes = p_notes
    where id = p_id
      and owner_id = v_user_id
    returning id into v_row_id;

    if v_row_id is null then
      raise exception 'Cost estimate not found';
    end if;
  end if;

  return v_row_id;
end;
$$;

grant execute on function public.upsert_route_cost_estimate(uuid, uuid, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, text) to authenticated;

-- -----------------------------
-- 7) Export Jobs
-- -----------------------------

create table if not exists public.export_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  export_type text not null,
  params jsonb not null default '{}'::jsonb,
  status text not null default 'queued',
  result_file_id uuid null references public.uploaded_files(id) on delete set null,
  error_message text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint export_jobs_status_check check (status in ('queued','running','succeeded','failed'))
);

drop trigger if exists set_export_jobs_updated_at on public.export_jobs;
create trigger set_export_jobs_updated_at
before update on public.export_jobs
for each row
execute function public.set_current_timestamp_updated_at();

create index if not exists export_jobs_owner_idx on public.export_jobs (owner_id, updated_at desc);

alter table public.export_jobs enable row level security;

drop policy if exists "Users can select own export_jobs" on public.export_jobs;
create policy "Users can select own export_jobs" on public.export_jobs for select using (owner_id = auth.uid());

drop policy if exists "Users can insert own export_jobs" on public.export_jobs;
create policy "Users can insert own export_jobs" on public.export_jobs for insert with check (owner_id = auth.uid());

drop policy if exists "Users can update own export_jobs" on public.export_jobs;
create policy "Users can update own export_jobs" on public.export_jobs for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "Users can delete own export_jobs" on public.export_jobs;
create policy "Users can delete own export_jobs" on public.export_jobs for delete using (owner_id = auth.uid());
