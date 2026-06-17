-- RGV Water GIS Command Center — Phase 2
-- Run AFTER supabase/schema.sql in Supabase SQL Editor.

-- -----------------------------
-- 1) Projects
-- -----------------------------

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create index if not exists companies_owner_idx on public.companies (owner_id);

create table if not exists public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  member_role text not null default 'member',
  created_at timestamptz not null default now(),
  constraint company_members_unique unique (company_id, user_id)
);

create index if not exists company_members_company_idx on public.company_members (company_id);
create index if not exists company_members_user_idx on public.company_members (user_id);

alter table public.company_members
  drop constraint if exists company_members_member_role_check;

alter table public.company_members
  add constraint company_members_member_role_check
  check (member_role in ('employee', 'manager', 'company_admin'));

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  company_id uuid null,
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

alter table public.projects
  add column if not exists company_id uuid null;

create index if not exists projects_owner_idx on public.projects (owner_id);
create index if not exists projects_company_idx on public.projects (company_id);
create index if not exists projects_org_idx on public.projects (owner_id, organization_id);

alter table public.projects
  drop constraint if exists projects_company_id_fkey;

alter table public.projects
  add constraint projects_company_id_fkey
  foreign key (company_id) references public.companies(id) on delete set null;

create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  access_role text not null default 'editor',
  created_at timestamptz not null default now(),
  constraint project_members_unique unique (project_id, user_id)
);

create index if not exists project_members_project_idx on public.project_members (project_id);
create index if not exists project_members_user_idx on public.project_members (user_id);

alter table public.project_members
  drop constraint if exists project_members_access_role_check;

alter table public.project_members
  add constraint project_members_access_role_check
  check (access_role in ('employee', 'manager', 'company_admin'));

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'employee',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_profiles_role_check check (role in ('employee', 'platform_manager', 'user', 'admin'))
);

alter table public.user_profiles
  drop constraint if exists user_profiles_role_check;

alter table public.user_profiles
  add constraint user_profiles_role_check
  check (role in ('employee', 'platform_manager', 'user', 'admin'));

create index if not exists user_profiles_role_idx on public.user_profiles (role);

drop trigger if exists set_user_profiles_updated_at on public.user_profiles;
create trigger set_user_profiles_updated_at
before update on public.user_profiles
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.user_profiles enable row level security;

insert into public.user_profiles (id, role)
select id, 'platform_manager'
from auth.users
where lower(email) = 'alescobedo2009@gmail.com'
on conflict (id)
do update set
  role = 'platform_manager',
  updated_at = now();

create or replace function public.is_company_member(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_members cm
    where cm.company_id = p_company_id
      and cm.user_id = auth.uid()
  );
$$;

create or replace function public.is_project_member(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.project_members pm
    where pm.project_id = p_project_id
      and pm.user_id = auth.uid()
  );
$$;

create or replace function public.is_company_owner(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.companies c
    where c.id = p_company_id
      and c.owner_id = auth.uid()
  );
$$;

create or replace function public.is_project_owner(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.projects p
    where p.id = p_project_id
      and p.owner_id = auth.uid()
  );
$$;

create or replace function public.is_platform_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_profiles up
    where up.id = auth.uid()
      and up.role in ('platform_manager', 'admin')
  );
$$;

create or replace function public.user_management_rank(p_role text)
returns integer
language sql
immutable
set search_path = public
as $$
  select case
    when p_role in ('company_admin', 'admin', 'platform_manager') then 3
    when p_role = 'manager' then 2
    when p_role in ('employee', 'user') then 1
    else 0
  end;
$$;

create or replace function public.can_manage_company(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (
    public.is_platform_manager()
    or public.is_company_owner(p_company_id)
    or exists (
      select 1
      from public.company_members cm
      where cm.company_id = p_company_id
        and cm.user_id = auth.uid()
        and cm.member_role in ('company_admin', 'manager')
    )
  );
$$;

create or replace function public.can_manage_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (
    public.is_platform_manager()
    or public.is_project_owner(p_project_id)
    or exists (
      select 1
      from public.project_members pm
      where pm.project_id = p_project_id
        and pm.user_id = auth.uid()
        and pm.access_role in ('company_admin', 'manager')
    )
    or exists (
      select 1
      from public.projects p
      where p.id = p_project_id
        and p.company_id is not null
        and public.can_manage_company(p.company_id)
    )
  );
$$;

create or replace function public.upsert_platform_role_by_email(p_email text, p_role text)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_target_user_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_platform_manager() then
    raise exception 'Only platform managers can assign platform roles';
  end if;

  if p_role not in ('employee', 'platform_manager', 'user', 'admin') then
    raise exception 'Invalid platform role';
  end if;

  select u.id
    into v_target_user_id
  from auth.users u
  where lower(u.email) = lower(trim(p_email))
  limit 1;

  if v_target_user_id is null then
    raise exception 'No user found with email %', p_email;
  end if;

  insert into public.user_profiles (id, role)
  values (v_target_user_id, p_role)
  on conflict (id)
  do update set
    role = excluded.role,
    updated_at = now();

  return v_target_user_id;
end;
$$;

create or replace function public.assign_company_member_by_email(
  p_company_id uuid,
  p_email text,
  p_member_role text default 'employee'
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_target_user_id uuid;
  v_actor_role text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_member_role not in ('employee', 'manager', 'company_admin') then
    raise exception 'Invalid company role';
  end if;

  select u.id
    into v_target_user_id
  from auth.users u
  where lower(u.email) = lower(trim(p_email))
  limit 1;

  if v_target_user_id is null then
    raise exception 'No user found with email %', p_email;
  end if;

  if public.is_platform_manager() then
    v_actor_role := 'platform_manager';
  elsif public.is_company_owner(p_company_id) then
    v_actor_role := 'company_admin';
  else
    select cm.member_role
      into v_actor_role
    from public.company_members cm
    where cm.company_id = p_company_id
      and cm.user_id = auth.uid();
  end if;

  if v_actor_role is null then
    raise exception 'No permission to manage this company';
  end if;

  if not public.is_platform_manager()
     and public.user_management_rank(p_member_role) > public.user_management_rank(v_actor_role) then
    raise exception 'Cannot assign role above your own permission level';
  end if;

  if not public.is_platform_manager() then
    if v_actor_role = 'manager' and p_member_role <> 'employee' then
      raise exception 'Managers can only assign employee role';
    end if;

    if v_actor_role = 'company_admin' and p_member_role = 'company_admin' then
      raise exception 'Company admins can only assign manager or employee roles';
    end if;
  end if;

  insert into public.company_members (company_id, user_id, member_role)
  values (p_company_id, v_target_user_id, p_member_role)
  on conflict (company_id, user_id)
  do update set
    member_role = excluded.member_role,
    created_at = public.company_members.created_at;

  return v_target_user_id;
end;
$$;

create or replace function public.assign_project_member_by_email(
  p_project_id uuid,
  p_email text,
  p_access_role text default 'employee'
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_target_user_id uuid;
  v_actor_role text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_access_role not in ('employee', 'manager', 'company_admin') then
    raise exception 'Invalid project role';
  end if;

  select u.id
    into v_target_user_id
  from auth.users u
  where lower(u.email) = lower(trim(p_email))
  limit 1;

  if v_target_user_id is null then
    raise exception 'No user found with email %', p_email;
  end if;

  if public.is_platform_manager() then
    v_actor_role := 'platform_manager';
  elsif public.is_project_owner(p_project_id) then
    v_actor_role := 'company_admin';
  else
    select pm.access_role
      into v_actor_role
    from public.project_members pm
    where pm.project_id = p_project_id
      and pm.user_id = auth.uid();
  end if;

  if v_actor_role is null then
    raise exception 'No permission to manage this project';
  end if;

  if not public.is_platform_manager()
     and public.user_management_rank(p_access_role) > public.user_management_rank(v_actor_role) then
    raise exception 'Cannot assign role above your own permission level';
  end if;

  if not public.is_platform_manager() then
    if v_actor_role = 'manager' and p_access_role <> 'employee' then
      raise exception 'Managers can only assign employee role';
    end if;

    if v_actor_role = 'company_admin' and p_access_role = 'company_admin' then
      raise exception 'Company admins can only assign manager or employee roles';
    end if;
  end if;

  insert into public.project_members (project_id, user_id, access_role)
  values (p_project_id, v_target_user_id, p_access_role)
  on conflict (project_id, user_id)
  do update set
    access_role = excluded.access_role,
    created_at = public.project_members.created_at;

  return v_target_user_id;
end;
$$;

create or replace function public.remove_company_member_assignment(p_company_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role text;
  v_target_role text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if public.is_platform_manager() then
    delete from public.company_members
    where company_id = p_company_id
      and user_id = p_user_id;
    return;
  end if;

  if public.is_company_owner(p_company_id) then
    v_actor_role := 'company_admin';
  else
    select cm.member_role
      into v_actor_role
    from public.company_members cm
    where cm.company_id = p_company_id
      and cm.user_id = auth.uid();
  end if;

  if v_actor_role is null then
    raise exception 'No permission to remove company membership';
  end if;

  select cm.member_role
    into v_target_role
  from public.company_members cm
  where cm.company_id = p_company_id
    and cm.user_id = p_user_id;

  if v_target_role is null then
    return;
  end if;

  if public.user_management_rank(v_target_role) >= public.user_management_rank(v_actor_role) then
    raise exception 'Cannot remove a user with equal or higher role';
  end if;

  delete from public.company_members
  where company_id = p_company_id
    and user_id = p_user_id;
end;
$$;

create or replace function public.remove_project_member_assignment(p_project_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role text;
  v_target_role text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if public.is_platform_manager() then
    delete from public.project_members
    where project_id = p_project_id
      and user_id = p_user_id;
    return;
  end if;

  if public.is_project_owner(p_project_id) then
    v_actor_role := 'company_admin';
  else
    select pm.access_role
      into v_actor_role
    from public.project_members pm
    where pm.project_id = p_project_id
      and pm.user_id = auth.uid();
  end if;

  if v_actor_role is null then
    raise exception 'No permission to remove project membership';
  end if;

  select pm.access_role
    into v_target_role
  from public.project_members pm
  where pm.project_id = p_project_id
    and pm.user_id = p_user_id;

  if v_target_role is null then
    return;
  end if;

  if public.user_management_rank(v_target_role) >= public.user_management_rank(v_actor_role) then
    raise exception 'Cannot remove a user with equal or higher role';
  end if;

  delete from public.project_members
  where project_id = p_project_id
    and user_id = p_user_id;
end;
$$;

create or replace function public.list_accessible_employees()
returns table (
  user_id uuid,
  email text,
  platform_role text,
  company_memberships jsonb,
  project_memberships jsonb
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not (
    public.is_platform_manager()
    or exists (
      select 1
      from public.company_members cm
      where cm.user_id = auth.uid()
        and cm.member_role in ('company_admin', 'manager')
    )
    or exists (
      select 1
      from public.project_members pm
      where pm.user_id = auth.uid()
        and pm.access_role in ('company_admin', 'manager')
    )
    or exists (
      select 1
      from public.companies c
      where c.owner_id = auth.uid()
    )
    or exists (
      select 1
      from public.projects p
      where p.owner_id = auth.uid()
    )
  ) then
    return;
  end if;

  return query
  with accessible_users as (
    select distinct
      u.id as u_id,
      u.email as u_email,
      coalesce(up.role, 'employee') as u_platform_role
    from auth.users u
    left join public.user_profiles up on up.id = u.id
    where public.is_platform_manager()
      or u.id = auth.uid()
      or exists (
        select 1
        from public.company_members my_cm
        join public.company_members target_cm
          on target_cm.company_id = my_cm.company_id
         and target_cm.user_id = u.id
        where my_cm.user_id = auth.uid()
          and my_cm.member_role in ('company_admin', 'manager')
      )
      or exists (
        select 1
        from public.project_members my_pm
        join public.project_members target_pm
          on target_pm.project_id = my_pm.project_id
         and target_pm.user_id = u.id
        where my_pm.user_id = auth.uid()
          and my_pm.access_role in ('company_admin', 'manager')
      )
      or exists (
        select 1
        from public.companies my_c
        join public.company_members target_cm
          on target_cm.company_id = my_c.id
         and target_cm.user_id = u.id
        where my_c.owner_id = auth.uid()
      )
      or exists (
        select 1
        from public.projects my_p
        join public.project_members target_pm
          on target_pm.project_id = my_p.id
         and target_pm.user_id = u.id
        where my_p.owner_id = auth.uid()
      )
  )
  select
    au.u_id as user_id,
    au.u_email as email,
    au.u_platform_role as platform_role,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'company_id', cm.company_id,
          'company_name', c.name,
          'member_role', cm.member_role
        )
        order by c.name
      )
      from public.company_members cm
      join public.companies c on c.id = cm.company_id
      where cm.user_id = au.u_id
    ), '[]'::jsonb) as company_memberships,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'project_id', pm.project_id,
          'project_name', p.name,
          'access_role', pm.access_role
        )
        order by p.name
      )
      from public.project_members pm
      join public.projects p on p.id = pm.project_id
      where pm.user_id = au.u_id
    ), '[]'::jsonb) as project_memberships
  from accessible_users au
  order by lower(au.u_email);
end;
$$;

grant execute on function public.upsert_platform_role_by_email(text, text) to authenticated;
grant execute on function public.assign_company_member_by_email(uuid, text, text) to authenticated;
grant execute on function public.assign_project_member_by_email(uuid, text, text) to authenticated;
grant execute on function public.remove_company_member_assignment(uuid, uuid) to authenticated;
grant execute on function public.remove_project_member_assignment(uuid, uuid) to authenticated;
grant execute on function public.list_accessible_employees() to authenticated;

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

alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.project_members enable row level security;

drop policy if exists "Users can select accessible companies" on public.companies;
create policy "Users can select accessible companies"
on public.companies
for select
using (
  owner_id = auth.uid()
  or public.is_company_member(id)
);

drop policy if exists "Users can insert companies" on public.companies;
create policy "Users can insert companies"
on public.companies
for insert
with check (owner_id = auth.uid());

drop policy if exists "Users can update own companies" on public.companies;
create policy "Users can update own companies"
on public.companies
for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "Users can delete own companies" on public.companies;
create policy "Users can delete own companies"
on public.companies
for delete
using (owner_id = auth.uid());

drop policy if exists "Users can select company memberships" on public.company_members;
create policy "Users can select company memberships"
on public.company_members
for select
using (
  user_id = auth.uid()
  or public.is_company_owner(company_id)
  or public.can_manage_company(company_id)
);

drop policy if exists "Company owners can manage memberships" on public.company_members;
create policy "Company owners can manage memberships"
on public.company_members
for all
using (
  public.is_company_owner(company_id)
  or public.can_manage_company(company_id)
)
with check (
  public.is_company_owner(company_id)
  or public.can_manage_company(company_id)
);

drop policy if exists "Users can select project memberships" on public.project_members;
create policy "Users can select project memberships"
on public.project_members
for select
using (
  user_id = auth.uid()
  or public.is_project_owner(project_id)
  or public.can_manage_project(project_id)
);

drop policy if exists "Project owners can manage memberships" on public.project_members;
create policy "Project owners can manage memberships"
on public.project_members
for all
using (
  public.is_project_owner(project_id)
  or public.can_manage_project(project_id)
)
with check (
  public.is_project_owner(project_id)
  or public.can_manage_project(project_id)
);

drop policy if exists "Users can read own profile" on public.user_profiles;
create policy "Users can read own profile"
on public.user_profiles
for select
using (
  id = auth.uid()
  or public.is_platform_manager()
);

drop policy if exists "Platform managers can manage profiles" on public.user_profiles;
create policy "Platform managers can manage profiles"
on public.user_profiles
for all
using (public.is_platform_manager())
with check (public.is_platform_manager());

drop policy if exists "Users can select accessible projects" on public.projects;
create policy "Users can select accessible projects"
on public.projects
for select
using (
  owner_id = auth.uid()
  or public.is_company_member(company_id)
  or public.is_project_member(id)
);

drop policy if exists "Users can insert own projects" on public.projects;
create policy "Users can insert own projects"
on public.projects
for insert
with check (
  owner_id = auth.uid()
  and (
    company_id is null
    or public.is_company_member(company_id)
  )
);

drop policy if exists "Users can update own projects" on public.projects;
create policy "Users can update own projects"
on public.projects
for update
using (
  owner_id = auth.uid()
  or public.is_company_member(company_id)
  or public.is_project_member(id)
)
with check (
  owner_id = auth.uid()
  or public.is_company_member(company_id)
  or public.is_project_member(id)
);

drop policy if exists "Users can delete own projects" on public.projects;
create policy "Users can delete own projects"
on public.projects
for delete
using (
  owner_id = auth.uid()
  or public.is_project_member(id)
);

-- -----------------------------
-- 2) Stakeholder CRM
-- -----------------------------

create table if not exists public.crm_organizations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid null,
  name text not null,
  org_type text not null default 'utility',
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.crm_organizations
  add column if not exists project_id uuid null;

alter table public.crm_organizations
  drop constraint if exists crm_organizations_project_id_fkey;

alter table public.crm_organizations
  add constraint crm_organizations_project_id_fkey
  foreign key (project_id) references public.projects(id) on delete set null;

create index if not exists crm_org_owner_idx on public.crm_organizations (owner_id);
create index if not exists crm_org_name_idx on public.crm_organizations (owner_id, name);
create index if not exists crm_org_project_idx on public.crm_organizations (owner_id, project_id);

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
  project_id uuid null,
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

alter table public.funding_programs
  add column if not exists project_id uuid null;

alter table public.funding_programs
  drop constraint if exists funding_programs_project_id_fkey;

alter table public.funding_programs
  add constraint funding_programs_project_id_fkey
  foreign key (project_id) references public.projects(id) on delete set null;

create index if not exists funding_programs_owner_idx on public.funding_programs (owner_id);
create index if not exists funding_programs_deadline_idx on public.funding_programs (owner_id, deadline);
create index if not exists funding_programs_project_idx on public.funding_programs (owner_id, project_id);

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
