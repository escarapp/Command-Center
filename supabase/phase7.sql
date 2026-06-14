-- ============================================================
-- Phase 7: Water Market Intelligence Platform
-- Run AFTER schema.sql + phase2-6 migrations.
-- Additive only: does not modify prior phase behavior.
-- ============================================================

-- 1) Utility Intelligence
create table if not exists public.utility_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  utility_type text not null check (utility_type in ('city', 'wsc', 'irrigation_district', 'drainage_district', 'industrial_user')),
  county text null,
  service_area text null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, name)
);

drop trigger if exists set_utility_profiles_updated_at on public.utility_profiles;
create trigger set_utility_profiles_updated_at
before update on public.utility_profiles
for each row
execute function public.set_current_timestamp_updated_at();

create index if not exists utility_profiles_owner_idx on public.utility_profiles (owner_id, updated_at desc);
create index if not exists utility_profiles_owner_type_idx on public.utility_profiles (owner_id, utility_type);

alter table public.utility_profiles enable row level security;

drop policy if exists "Users can select own utility_profiles" on public.utility_profiles;
create policy "Users can select own utility_profiles" on public.utility_profiles for select using (owner_id = auth.uid());

drop policy if exists "Users can insert own utility_profiles" on public.utility_profiles;
create policy "Users can insert own utility_profiles" on public.utility_profiles for insert with check (owner_id = auth.uid());

drop policy if exists "Users can update own utility_profiles" on public.utility_profiles;
create policy "Users can update own utility_profiles" on public.utility_profiles for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "Users can delete own utility_profiles" on public.utility_profiles;
create policy "Users can delete own utility_profiles" on public.utility_profiles for delete using (owner_id = auth.uid());

-- 2) Demand Forecasting
create table if not exists public.demand_forecasts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  utility_id uuid not null references public.utility_profiles(id) on delete cascade,
  current_demand_mgd numeric not null default 0,
  demand_5y_mgd numeric not null default 0,
  demand_10y_mgd numeric not null default 0,
  demand_20y_mgd numeric not null default 0,
  assumptions text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, utility_id)
);

drop trigger if exists set_demand_forecasts_updated_at on public.demand_forecasts;
create trigger set_demand_forecasts_updated_at
before update on public.demand_forecasts
for each row
execute function public.set_current_timestamp_updated_at();

create index if not exists demand_forecasts_owner_idx on public.demand_forecasts (owner_id, updated_at desc);

alter table public.demand_forecasts enable row level security;

drop policy if exists "Users can select own demand_forecasts" on public.demand_forecasts;
create policy "Users can select own demand_forecasts" on public.demand_forecasts for select using (owner_id = auth.uid());

drop policy if exists "Users can insert own demand_forecasts" on public.demand_forecasts;
create policy "Users can insert own demand_forecasts" on public.demand_forecasts for insert with check (owner_id = auth.uid());

drop policy if exists "Users can update own demand_forecasts" on public.demand_forecasts;
create policy "Users can update own demand_forecasts" on public.demand_forecasts for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "Users can delete own demand_forecasts" on public.demand_forecasts;
create policy "Users can delete own demand_forecasts" on public.demand_forecasts for delete using (owner_id = auth.uid());

-- 3) Population Growth Analysis
create table if not exists public.population_data (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  utility_id uuid not null references public.utility_profiles(id) on delete cascade,
  population integer not null default 0,
  growth_rate_pct numeric not null default 0,
  new_developments integer not null default 0,
  data_year integer not null default extract(year from now())::int,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, utility_id, data_year)
);

drop trigger if exists set_population_data_updated_at on public.population_data;
create trigger set_population_data_updated_at
before update on public.population_data
for each row
execute function public.set_current_timestamp_updated_at();

create index if not exists population_data_owner_idx on public.population_data (owner_id, data_year desc);

alter table public.population_data enable row level security;

drop policy if exists "Users can select own population_data" on public.population_data;
create policy "Users can select own population_data" on public.population_data for select using (owner_id = auth.uid());

drop policy if exists "Users can insert own population_data" on public.population_data;
create policy "Users can insert own population_data" on public.population_data for insert with check (owner_id = auth.uid());

drop policy if exists "Users can update own population_data" on public.population_data;
create policy "Users can update own population_data" on public.population_data for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "Users can delete own population_data" on public.population_data;
create policy "Users can delete own population_data" on public.population_data for delete using (owner_id = auth.uid());

-- 4) Drought Vulnerability Index
create table if not exists public.drought_scores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  utility_id uuid not null references public.utility_profiles(id) on delete cascade,
  water_source_dependency_score int not null default 0 check (water_source_dependency_score between 0 and 40),
  reservoir_exposure_score int not null default 0 check (reservoir_exposure_score between 0 and 30),
  historic_shortages_score int not null default 0 check (historic_shortages_score between 0 and 30),
  total_score int generated always as (water_source_dependency_score + reservoir_exposure_score + historic_shortages_score) stored,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, utility_id)
);

drop trigger if exists set_drought_scores_updated_at on public.drought_scores;
create trigger set_drought_scores_updated_at
before update on public.drought_scores
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.drought_scores enable row level security;

drop policy if exists "Users can select own drought_scores" on public.drought_scores;
create policy "Users can select own drought_scores" on public.drought_scores for select using (owner_id = auth.uid());

drop policy if exists "Users can insert own drought_scores" on public.drought_scores;
create policy "Users can insert own drought_scores" on public.drought_scores for insert with check (owner_id = auth.uid());

drop policy if exists "Users can update own drought_scores" on public.drought_scores;
create policy "Users can update own drought_scores" on public.drought_scores for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "Users can delete own drought_scores" on public.drought_scores;
create policy "Users can delete own drought_scores" on public.drought_scores for delete using (owner_id = auth.uid());

-- 5) Customer Opportunity Scoring
create table if not exists public.opportunity_scores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  utility_id uuid not null references public.utility_profiles(id) on delete cascade,
  potential_mgd_demand numeric not null default 0,
  revenue_potential_score int not null default 0 check (revenue_potential_score between 0 and 30),
  political_support_score int not null default 0 check (political_support_score between 0 and 20),
  funding_access_score int not null default 0 check (funding_access_score between 0 and 20),
  total_opportunity_score int generated always as (revenue_potential_score + political_support_score + funding_access_score) stored,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, utility_id)
);

drop trigger if exists set_opportunity_scores_updated_at on public.opportunity_scores;
create trigger set_opportunity_scores_updated_at
before update on public.opportunity_scores
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.opportunity_scores enable row level security;

drop policy if exists "Users can select own opportunity_scores" on public.opportunity_scores;
create policy "Users can select own opportunity_scores" on public.opportunity_scores for select using (owner_id = auth.uid());

drop policy if exists "Users can insert own opportunity_scores" on public.opportunity_scores;
create policy "Users can insert own opportunity_scores" on public.opportunity_scores for insert with check (owner_id = auth.uid());

drop policy if exists "Users can update own opportunity_scores" on public.opportunity_scores;
create policy "Users can update own opportunity_scores" on public.opportunity_scores for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "Users can delete own opportunity_scores" on public.opportunity_scores;
create policy "Users can delete own opportunity_scores" on public.opportunity_scores for delete using (owner_id = auth.uid());

-- 6) Capital Improvement Tracking
create table if not exists public.cip_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  utility_id uuid not null references public.utility_profiles(id) on delete cascade,
  project_name text not null,
  estimated_cost numeric not null default 0,
  completion_date date null,
  status text not null default 'planned' check (status in ('planned', 'in_progress', 'on_hold', 'completed', 'cancelled')),
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_cip_projects_updated_at on public.cip_projects;
create trigger set_cip_projects_updated_at
before update on public.cip_projects
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.cip_projects enable row level security;

drop policy if exists "Users can select own cip_projects" on public.cip_projects;
create policy "Users can select own cip_projects" on public.cip_projects for select using (owner_id = auth.uid());

drop policy if exists "Users can insert own cip_projects" on public.cip_projects;
create policy "Users can insert own cip_projects" on public.cip_projects for insert with check (owner_id = auth.uid());

drop policy if exists "Users can update own cip_projects" on public.cip_projects;
create policy "Users can update own cip_projects" on public.cip_projects for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "Users can delete own cip_projects" on public.cip_projects;
create policy "Users can delete own cip_projects" on public.cip_projects for delete using (owner_id = auth.uid());

-- 7) Heat map helper (highest growth, drought risk, and opportunities)
create or replace function public.get_market_heat_map()
returns table (
  utility_id uuid,
  utility_name text,
  utility_type text,
  demand_growth_mgd numeric,
  drought_risk_score int,
  opportunity_score int,
  heat_score numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  with demand as (
    select
      df.utility_id,
      greatest(df.demand_20y_mgd - df.current_demand_mgd, 0) as growth_mgd
    from public.demand_forecasts df
    where df.owner_id = auth.uid()
  )
  select
    up.id as utility_id,
    up.name as utility_name,
    up.utility_type,
    coalesce(demand.growth_mgd, 0) as demand_growth_mgd,
    coalesce(ds.total_score, 0) as drought_risk_score,
    coalesce(os.total_opportunity_score, 0) as opportunity_score,
    (
      coalesce(demand.growth_mgd, 0) * 2
      + coalesce(ds.total_score, 0)
      + coalesce(os.total_opportunity_score, 0)
    )::numeric as heat_score
  from public.utility_profiles up
  left join demand on demand.utility_id = up.id
  left join public.drought_scores ds
    on ds.owner_id = auth.uid() and ds.utility_id = up.id
  left join public.opportunity_scores os
    on os.owner_id = auth.uid() and os.utility_id = up.id
  where up.owner_id = auth.uid()
  order by heat_score desc, up.name asc;
$$;

grant execute on function public.get_market_heat_map() to authenticated;

-- Optional admin bypass policies (requires phase6 is_admin function)
drop policy if exists "Admins have full access" on public.utility_profiles;
create policy "Admins have full access" on public.utility_profiles
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins have full access" on public.demand_forecasts;
create policy "Admins have full access" on public.demand_forecasts
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins have full access" on public.population_data;
create policy "Admins have full access" on public.population_data
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins have full access" on public.drought_scores;
create policy "Admins have full access" on public.drought_scores
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins have full access" on public.opportunity_scores;
create policy "Admins have full access" on public.opportunity_scores
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins have full access" on public.cip_projects;
create policy "Admins have full access" on public.cip_projects
  using (public.is_admin()) with check (public.is_admin());
