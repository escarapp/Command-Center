-- RGV Water GIS Command Center — Phase 4
-- Run AFTER supabase/schema.sql, supabase/phase2.sql, and supabase/phase3.sql in Supabase SQL Editor.

-- -----------------------------
-- 1) Scenarios (Decision support)
-- -----------------------------

create table if not exists public.project_scenarios (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid null references public.projects(id) on delete set null,
  name text not null,
  description text null,
  assumptions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_scenarios_owner_idx on public.project_scenarios (owner_id, updated_at desc);
create index if not exists project_scenarios_project_idx on public.project_scenarios (owner_id, project_id);

drop trigger if exists set_project_scenarios_updated_at on public.project_scenarios;
create trigger set_project_scenarios_updated_at
before update on public.project_scenarios
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.project_scenarios enable row level security;

drop policy if exists "Users can select own project_scenarios" on public.project_scenarios;
create policy "Users can select own project_scenarios" on public.project_scenarios for select using (owner_id = auth.uid());

drop policy if exists "Users can insert own project_scenarios" on public.project_scenarios;
create policy "Users can insert own project_scenarios" on public.project_scenarios for insert with check (owner_id = auth.uid());

drop policy if exists "Users can update own project_scenarios" on public.project_scenarios;
create policy "Users can update own project_scenarios" on public.project_scenarios for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "Users can delete own project_scenarios" on public.project_scenarios;
create policy "Users can delete own project_scenarios" on public.project_scenarios for delete using (owner_id = auth.uid());

create table if not exists public.scenario_utilities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  scenario_id uuid not null references public.project_scenarios(id) on delete cascade,
  organization_id uuid null references public.crm_organizations(id) on delete set null,
  utility_name text null,
  role text not null default 'stakeholder',
  notes text null,
  created_at timestamptz not null default now(),
  constraint scenario_utilities_role_check check (role in ('stakeholder','offtaker','partner','reviewer'))
);

create index if not exists scenario_utilities_owner_idx on public.scenario_utilities (owner_id, created_at desc);
create index if not exists scenario_utilities_scenario_idx on public.scenario_utilities (owner_id, scenario_id);

alter table public.scenario_utilities enable row level security;

drop policy if exists "Users can select own scenario_utilities" on public.scenario_utilities;
create policy "Users can select own scenario_utilities" on public.scenario_utilities for select using (owner_id = auth.uid());

drop policy if exists "Users can insert own scenario_utilities" on public.scenario_utilities;
create policy "Users can insert own scenario_utilities" on public.scenario_utilities for insert with check (owner_id = auth.uid());

drop policy if exists "Users can update own scenario_utilities" on public.scenario_utilities;
create policy "Users can update own scenario_utilities" on public.scenario_utilities for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "Users can delete own scenario_utilities" on public.scenario_utilities;
create policy "Users can delete own scenario_utilities" on public.scenario_utilities for delete using (owner_id = auth.uid());

create table if not exists public.scenario_routes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  scenario_id uuid not null references public.project_scenarios(id) on delete cascade,
  route_alternative_id uuid null references public.route_alternatives(id) on delete set null,
  notes text null,
  created_at timestamptz not null default now()
);

create index if not exists scenario_routes_owner_idx on public.scenario_routes (owner_id, created_at desc);
create index if not exists scenario_routes_scenario_idx on public.scenario_routes (owner_id, scenario_id);

alter table public.scenario_routes enable row level security;

drop policy if exists "Users can select own scenario_routes" on public.scenario_routes;
create policy "Users can select own scenario_routes" on public.scenario_routes for select using (owner_id = auth.uid());

drop policy if exists "Users can insert own scenario_routes" on public.scenario_routes;
create policy "Users can insert own scenario_routes" on public.scenario_routes for insert with check (owner_id = auth.uid());

drop policy if exists "Users can update own scenario_routes" on public.scenario_routes;
create policy "Users can update own scenario_routes" on public.scenario_routes for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "Users can delete own scenario_routes" on public.scenario_routes;
create policy "Users can delete own scenario_routes" on public.scenario_routes for delete using (owner_id = auth.uid());

-- -----------------------------
-- 2) Revenue Models
-- -----------------------------

create table if not exists public.revenue_models (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid null references public.projects(id) on delete set null,
  model jsonb not null default '{}'::jsonb,
  annual_revenue numeric null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists revenue_models_owner_idx on public.revenue_models (owner_id, updated_at desc);
create index if not exists revenue_models_project_idx on public.revenue_models (owner_id, project_id);

drop trigger if exists set_revenue_models_updated_at on public.revenue_models;
create trigger set_revenue_models_updated_at
before update on public.revenue_models
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.revenue_models enable row level security;

drop policy if exists "Users can select own revenue_models" on public.revenue_models;
create policy "Users can select own revenue_models" on public.revenue_models for select using (owner_id = auth.uid());

drop policy if exists "Users can insert own revenue_models" on public.revenue_models;
create policy "Users can insert own revenue_models" on public.revenue_models for insert with check (owner_id = auth.uid());

drop policy if exists "Users can update own revenue_models" on public.revenue_models;
create policy "Users can update own revenue_models" on public.revenue_models for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "Users can delete own revenue_models" on public.revenue_models;
create policy "Users can delete own revenue_models" on public.revenue_models for delete using (owner_id = auth.uid());

-- -----------------------------
-- 3) Risk Register
-- -----------------------------

create table if not exists public.risk_register (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid null references public.projects(id) on delete set null,
  severity text not null default 'medium',
  category text not null,
  description text not null,
  mitigation text null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint risk_register_severity_check check (severity in ('low','medium','high','critical')),
  constraint risk_register_status_check check (status in ('open','monitoring','closed'))
);

create index if not exists risk_register_owner_idx on public.risk_register (owner_id, updated_at desc);
create index if not exists risk_register_project_idx on public.risk_register (owner_id, project_id);


drop trigger if exists set_risk_register_updated_at on public.risk_register;
create trigger set_risk_register_updated_at
before update on public.risk_register
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.risk_register enable row level security;

drop policy if exists "Users can select own risk_register" on public.risk_register;
create policy "Users can select own risk_register" on public.risk_register for select using (owner_id = auth.uid());

drop policy if exists "Users can insert own risk_register" on public.risk_register;
create policy "Users can insert own risk_register" on public.risk_register for insert with check (owner_id = auth.uid());

drop policy if exists "Users can update own risk_register" on public.risk_register;
create policy "Users can update own risk_register" on public.risk_register for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "Users can delete own risk_register" on public.risk_register;
create policy "Users can delete own risk_register" on public.risk_register for delete using (owner_id = auth.uid());

-- -----------------------------
-- 4) Briefs + Snapshots + Export History
-- -----------------------------

create table if not exists public.meeting_briefs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid null references public.projects(id) on delete set null,
  organization_id uuid null references public.crm_organizations(id) on delete set null,
  audience text not null default 'executive',
  title text not null,
  brief_text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meeting_briefs_audience_check check (audience in ('executive','investor','legislative'))
);

create index if not exists meeting_briefs_owner_idx on public.meeting_briefs (owner_id, updated_at desc);
create index if not exists meeting_briefs_project_idx on public.meeting_briefs (owner_id, project_id);
create index if not exists meeting_briefs_org_idx on public.meeting_briefs (owner_id, organization_id);


drop trigger if exists set_meeting_briefs_updated_at on public.meeting_briefs;
create trigger set_meeting_briefs_updated_at
before update on public.meeting_briefs
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.meeting_briefs enable row level security;

drop policy if exists "Users can select own meeting_briefs" on public.meeting_briefs;
create policy "Users can select own meeting_briefs" on public.meeting_briefs for select using (owner_id = auth.uid());

drop policy if exists "Users can insert own meeting_briefs" on public.meeting_briefs;
create policy "Users can insert own meeting_briefs" on public.meeting_briefs for insert with check (owner_id = auth.uid());

drop policy if exists "Users can update own meeting_briefs" on public.meeting_briefs;
create policy "Users can update own meeting_briefs" on public.meeting_briefs for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "Users can delete own meeting_briefs" on public.meeting_briefs;
create policy "Users can delete own meeting_briefs" on public.meeting_briefs for delete using (owner_id = auth.uid());

create table if not exists public.dashboard_snapshots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  snapshot_type text not null,
  params jsonb not null default '{}'::jsonb,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists dashboard_snapshots_owner_idx on public.dashboard_snapshots (owner_id, created_at desc);
create index if not exists dashboard_snapshots_type_idx on public.dashboard_snapshots (owner_id, snapshot_type);

alter table public.dashboard_snapshots enable row level security;

drop policy if exists "Users can select own dashboard_snapshots" on public.dashboard_snapshots;
create policy "Users can select own dashboard_snapshots" on public.dashboard_snapshots for select using (owner_id = auth.uid());

drop policy if exists "Users can insert own dashboard_snapshots" on public.dashboard_snapshots;
create policy "Users can insert own dashboard_snapshots" on public.dashboard_snapshots for insert with check (owner_id = auth.uid());

drop policy if exists "Users can delete own dashboard_snapshots" on public.dashboard_snapshots;
create policy "Users can delete own dashboard_snapshots" on public.dashboard_snapshots for delete using (owner_id = auth.uid());

create table if not exists public.export_history (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  export_type text not null,
  params jsonb not null default '{}'::jsonb,
  file_name text not null,
  created_at timestamptz not null default now()
);

create index if not exists export_history_owner_idx on public.export_history (owner_id, created_at desc);
create index if not exists export_history_type_idx on public.export_history (owner_id, export_type);

alter table public.export_history enable row level security;

drop policy if exists "Users can select own export_history" on public.export_history;
create policy "Users can select own export_history" on public.export_history for select using (owner_id = auth.uid());

drop policy if exists "Users can insert own export_history" on public.export_history;
create policy "Users can insert own export_history" on public.export_history for insert with check (owner_id = auth.uid());

drop policy if exists "Users can delete own export_history" on public.export_history;
create policy "Users can delete own export_history" on public.export_history for delete using (owner_id = auth.uid());
