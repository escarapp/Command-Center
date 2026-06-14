-- RGV Water GIS Command Center — Phase 2
-- Run AFTER supabase/schema.sql in Supabase SQL Editor.

-- -----------------------------
-- 1) Projects
-- -----------------------------

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  organization_id uuid null,
  name text not null,
  estimated_mgd numeric null,
  revenue numeric null,
  priority text not null default 'low',
  status text not null default 'idea',
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_priority_check check (priority in ('low', 'medium', 'high', 'critical'))
);

create index if not exists projects_owner_idx on public.projects (owner_id);
create index if not exists projects_org_idx on public.projects (owner_id, organization_id);

-- Add fields to GIS features for pipeline builder + project linking.
alter table public.gis_features add column if not exists project_id uuid null;
alter table public.gis_features add column if not exists estimated_cost numeric null;

alter table public.gis_features
  drop constraint if exists gis_features_project_id_fkey;

alter table public.gis_features
  add constraint gis_features_project_id_fkey
  foreign key (project_id) references public.projects(id) on delete set null;

-- Extend the GeoJSON view to include Phase 2 fields.
-- IMPORTANT: Postgres does not allow CREATE OR REPLACE VIEW to rename/reorder
-- existing columns. Keep the original column order and append new columns.
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
  updated_at,
  project_id,
  estimated_cost
from public.gis_features;

-- Keep grants in place after view replace.
grant select on public.gis_features_geojson to authenticated;

-- Updated-at trigger for projects.
drop trigger if exists set_projects_updated_at on public.projects;
create trigger set_projects_updated_at
before update on public.projects
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.projects enable row level security;

drop policy if exists "Users can select own projects" on public.projects;
create policy "Users can select own projects" on public.projects
  for select using (owner_id = auth.uid());

drop policy if exists "Users can insert own projects" on public.projects;
create policy "Users can insert own projects" on public.projects
  for insert with check (owner_id = auth.uid());

drop policy if exists "Users can update own projects" on public.projects;
create policy "Users can update own projects" on public.projects
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "Users can delete own projects" on public.projects;
create policy "Users can delete own projects" on public.projects
  for delete using (owner_id = auth.uid());

-- -----------------------------
-- 2) Stakeholder CRM
-- -----------------------------

create table if not exists public.crm_organizations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  org_type text not null default 'utility',
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_org_owner_idx on public.crm_organizations (owner_id);
create index if not exists crm_org_name_idx on public.crm_organizations (owner_id, name);

-- Now that orgs exist, add foreign key from projects.
alter table public.projects
  drop constraint if exists projects_organization_id_fkey;

alter table public.projects
  add constraint projects_organization_id_fkey
  foreign key (organization_id) references public.crm_organizations(id) on delete set null;

create table if not exists public.crm_contacts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  organization_id uuid null references public.crm_organizations(id) on delete set null,
  name text not null,
  title text null,
  email text null,
  phone text null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_contacts_owner_idx on public.crm_contacts (owner_id);
create index if not exists crm_contacts_org_idx on public.crm_contacts (owner_id, organization_id);

create table if not exists public.crm_meetings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  organization_id uuid null references public.crm_organizations(id) on delete set null,
  contact_id uuid null references public.crm_contacts(id) on delete set null,
  occurred_at timestamptz not null default now(),
  subject text null,
  notes text null,
  follow_up_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_meetings_owner_idx on public.crm_meetings (owner_id);
create index if not exists crm_meetings_org_idx on public.crm_meetings (owner_id, organization_id);
create index if not exists crm_meetings_followup_idx on public.crm_meetings (owner_id, follow_up_at);

-- Generic notes that can attach to org/contact/project/funding/etc.
create table if not exists public.crm_notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  note text not null,
  follow_up_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_notes_owner_idx on public.crm_notes (owner_id);
create index if not exists crm_notes_entity_idx on public.crm_notes (owner_id, entity_type, entity_id);
create index if not exists crm_notes_followup_idx on public.crm_notes (owner_id, follow_up_at);

-- Updated-at triggers
do $$
declare
  _tbl text;
begin
  foreach _tbl in array array['crm_organizations','crm_contacts','crm_meetings','crm_notes']
  loop
    execute format('drop trigger if exists set_%s_updated_at on public.%s;', _tbl, _tbl);
    execute format(
      'create trigger set_%s_updated_at before update on public.%s for each row execute function public.set_current_timestamp_updated_at();',
      _tbl,
      _tbl
    );
  end loop;
end $$;

-- RLS + policies
alter table public.crm_organizations enable row level security;
alter table public.crm_contacts enable row level security;
alter table public.crm_meetings enable row level security;
alter table public.crm_notes enable row level security;

-- Organizations
drop policy if exists "Users can select own orgs" on public.crm_organizations;
create policy "Users can select own orgs" on public.crm_organizations for select using (owner_id = auth.uid());
drop policy if exists "Users can insert own orgs" on public.crm_organizations;
create policy "Users can insert own orgs" on public.crm_organizations for insert with check (owner_id = auth.uid());
drop policy if exists "Users can update own orgs" on public.crm_organizations;
create policy "Users can update own orgs" on public.crm_organizations for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "Users can delete own orgs" on public.crm_organizations;
create policy "Users can delete own orgs" on public.crm_organizations for delete using (owner_id = auth.uid());

-- Contacts
drop policy if exists "Users can select own contacts" on public.crm_contacts;
create policy "Users can select own contacts" on public.crm_contacts for select using (owner_id = auth.uid());
drop policy if exists "Users can insert own contacts" on public.crm_contacts;
create policy "Users can insert own contacts" on public.crm_contacts for insert with check (owner_id = auth.uid());
drop policy if exists "Users can update own contacts" on public.crm_contacts;
create policy "Users can update own contacts" on public.crm_contacts for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "Users can delete own contacts" on public.crm_contacts;
create policy "Users can delete own contacts" on public.crm_contacts for delete using (owner_id = auth.uid());

-- Meetings
drop policy if exists "Users can select own meetings" on public.crm_meetings;
create policy "Users can select own meetings" on public.crm_meetings for select using (owner_id = auth.uid());
drop policy if exists "Users can insert own meetings" on public.crm_meetings;
create policy "Users can insert own meetings" on public.crm_meetings for insert with check (owner_id = auth.uid());
drop policy if exists "Users can update own meetings" on public.crm_meetings;
create policy "Users can update own meetings" on public.crm_meetings for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "Users can delete own meetings" on public.crm_meetings;
create policy "Users can delete own meetings" on public.crm_meetings for delete using (owner_id = auth.uid());

-- Notes
drop policy if exists "Users can select own crm notes" on public.crm_notes;
create policy "Users can select own crm notes" on public.crm_notes for select using (owner_id = auth.uid());
drop policy if exists "Users can insert own crm notes" on public.crm_notes;
create policy "Users can insert own crm notes" on public.crm_notes for insert with check (owner_id = auth.uid());
drop policy if exists "Users can update own crm notes" on public.crm_notes;
create policy "Users can update own crm notes" on public.crm_notes for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "Users can delete own crm notes" on public.crm_notes;
create policy "Users can delete own crm notes" on public.crm_notes for delete using (owner_id = auth.uid());

-- -----------------------------
-- 3) Funding database
-- -----------------------------

create table if not exists public.funding_programs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  agency text null,
  eligibility text null,
  deadline date null,
  notes text null,
  url text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint funding_programs_url_check check (url is null or url ~* '^https?://')
);

create index if not exists funding_programs_owner_idx on public.funding_programs (owner_id);
create index if not exists funding_programs_deadline_idx on public.funding_programs (owner_id, deadline);

create table if not exists public.funding_links (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  program_id uuid not null references public.funding_programs(id) on delete cascade,
  organization_id uuid null references public.crm_organizations(id) on delete set null,
  project_id uuid null references public.projects(id) on delete set null,
  notes text null,
  created_at timestamptz not null default now()
);

create index if not exists funding_links_owner_idx on public.funding_links (owner_id);
create index if not exists funding_links_program_idx on public.funding_links (owner_id, program_id);
create index if not exists funding_links_org_idx on public.funding_links (owner_id, organization_id);
create index if not exists funding_links_project_idx on public.funding_links (owner_id, project_id);

drop trigger if exists set_funding_programs_updated_at on public.funding_programs;
create trigger set_funding_programs_updated_at
before update on public.funding_programs
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.funding_programs enable row level security;
alter table public.funding_links enable row level security;

drop policy if exists "Users can select own funding programs" on public.funding_programs;
create policy "Users can select own funding programs" on public.funding_programs for select using (owner_id = auth.uid());

drop policy if exists "Users can insert own funding programs" on public.funding_programs;
create policy "Users can insert own funding programs" on public.funding_programs for insert with check (owner_id = auth.uid());

drop policy if exists "Users can update own funding programs" on public.funding_programs;
create policy "Users can update own funding programs" on public.funding_programs for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "Users can delete own funding programs" on public.funding_programs;
create policy "Users can delete own funding programs" on public.funding_programs for delete using (owner_id = auth.uid());

-- Links
drop policy if exists "Users can select own funding links" on public.funding_links;
create policy "Users can select own funding links" on public.funding_links for select using (owner_id = auth.uid());
drop policy if exists "Users can insert own funding links" on public.funding_links;
create policy "Users can insert own funding links" on public.funding_links for insert with check (owner_id = auth.uid());
drop policy if exists "Users can update own funding links" on public.funding_links;
create policy "Users can update own funding links" on public.funding_links for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "Users can delete own funding links" on public.funding_links;
create policy "Users can delete own funding links" on public.funding_links for delete using (owner_id = auth.uid());

-- -----------------------------
-- 5) Extend GIS RPC for Phase 2 fields
-- -----------------------------

-- Drop the v1 signature so we don't end up with overloaded functions.
drop function if exists public.upsert_gis_feature(
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
);

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
  p_source_url text default null,
  p_project_id uuid default null,
  p_estimated_cost numeric default null
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
    project_id,
    estimated_cost,
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
    p_project_id,
    p_estimated_cost,
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
    project_id = excluded.project_id,
    estimated_cost = excluded.estimated_cost,
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
  text,
  uuid,
  numeric
) to authenticated;

-- -----------------------------
-- 4) Document repository (Supabase Storage)
-- -----------------------------

-- Create a private bucket for documents.
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  bucket text not null default 'documents',
  path text not null,
  filename text not null,
  mime_type text null,
  size_bytes bigint null,
  created_at timestamptz not null default now()
);

create index if not exists documents_owner_idx on public.documents (owner_id);
create index if not exists documents_entity_idx on public.documents (owner_id, entity_type, entity_id);

alter table public.documents enable row level security;

drop policy if exists "Users can select own documents" on public.documents;
create policy "Users can select own documents" on public.documents for select using (owner_id = auth.uid());

drop policy if exists "Users can insert own documents" on public.documents;
create policy "Users can insert own documents" on public.documents for insert with check (owner_id = auth.uid());

drop policy if exists "Users can delete own documents" on public.documents;
create policy "Users can delete own documents" on public.documents for delete using (owner_id = auth.uid());

-- Storage object policies for the documents bucket.
-- Note: Supabase Storage uses `storage.objects.owner` to track the uploader.
-- Allow authenticated users to manage ONLY their own objects in this bucket.

-- NOTE: In hosted Supabase, `storage.objects` already has RLS enabled and
-- `ALTER TABLE storage.objects ...` can fail due to ownership/privileges.
-- We only need to define the policies here.

drop policy if exists "Documents: read own objects" on storage.objects;
create policy "Documents: read own objects" on storage.objects
  for select
  using (bucket_id = 'documents' and owner = auth.uid());

drop policy if exists "Documents: upload own objects" on storage.objects;
create policy "Documents: upload own objects" on storage.objects
  for insert
  with check (bucket_id = 'documents' and owner = auth.uid());

drop policy if exists "Documents: update own objects" on storage.objects;
create policy "Documents: update own objects" on storage.objects
  for update
  using (bucket_id = 'documents' and owner = auth.uid())
  with check (bucket_id = 'documents' and owner = auth.uid());

drop policy if exists "Documents: delete own objects" on storage.objects;
create policy "Documents: delete own objects" on storage.objects
  for delete
  using (bucket_id = 'documents' and owner = auth.uid());
