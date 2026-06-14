-- ============================================================
-- Phase 9: Rio Grande Valley Water Digital Twin
-- Run AFTER schema.sql + phase2-8 migrations.
-- Additive only: does not modify prior phase behavior.
-- ============================================================

-- 1) Unified Water Network (future-ready for all Texas regions)
create table if not exists public.network_nodes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  region_code text not null default 'RGV',
  region_name text not null default 'Rio Grande Valley',
  node_type text not null check (
    node_type in (
      'utility',
      'wsc',
      'irrigation_district',
      'drainage_district',
      'treatment_plant',
      'reservoir',
      'pipeline_junction',
      'pump_station',
      'storage_facility',
      'water_source',
      'customer'
    )
  ),
  name text not null,
  county text null,
  latitude numeric null,
  longitude numeric null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, region_code, node_type, name)
);

drop trigger if exists set_network_nodes_updated_at on public.network_nodes;
create trigger set_network_nodes_updated_at
before update on public.network_nodes
for each row
execute function public.set_current_timestamp_updated_at();

create index if not exists network_nodes_owner_region_idx on public.network_nodes (owner_id, region_code, updated_at desc);
create index if not exists network_nodes_owner_type_idx on public.network_nodes (owner_id, node_type, updated_at desc);

alter table public.network_nodes enable row level security;

drop policy if exists "Users can select own network_nodes" on public.network_nodes;
create policy "Users can select own network_nodes" on public.network_nodes for select using (owner_id = auth.uid());

drop policy if exists "Users can insert own network_nodes" on public.network_nodes;
create policy "Users can insert own network_nodes" on public.network_nodes for insert with check (owner_id = auth.uid());

drop policy if exists "Users can update own network_nodes" on public.network_nodes;
create policy "Users can update own network_nodes" on public.network_nodes for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "Users can delete own network_nodes" on public.network_nodes;
create policy "Users can delete own network_nodes" on public.network_nodes for delete using (owner_id = auth.uid());

-- 2) Infrastructure Relationships
create table if not exists public.network_connections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  region_code text not null default 'RGV',
  connection_type text not null check (
    connection_type in (
      'water_source_to_treatment',
      'treatment_to_storage',
      'transmission',
      'distribution',
      'customer_supply',
      'interconnect',
      'drainage'
    )
  ),
  from_node_id uuid not null references public.network_nodes(id) on delete cascade,
  to_node_id uuid not null references public.network_nodes(id) on delete cascade,
  length_miles numeric not null default 0,
  capacity_mgd numeric not null default 0,
  status text not null default 'active' check (status in ('active', 'planned', 'offline')),
  is_expansion_candidate boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (from_node_id <> to_node_id)
);

drop trigger if exists set_network_connections_updated_at on public.network_connections;
create trigger set_network_connections_updated_at
before update on public.network_connections
for each row
execute function public.set_current_timestamp_updated_at();

create index if not exists network_connections_owner_region_idx on public.network_connections (owner_id, region_code, updated_at desc);
create index if not exists network_connections_owner_candidate_idx on public.network_connections (owner_id, is_expansion_candidate, updated_at desc);

alter table public.network_connections enable row level security;

drop policy if exists "Users can select own network_connections" on public.network_connections;
create policy "Users can select own network_connections" on public.network_connections for select using (owner_id = auth.uid());

drop policy if exists "Users can insert own network_connections" on public.network_connections;
create policy "Users can insert own network_connections" on public.network_connections for insert with check (owner_id = auth.uid());

drop policy if exists "Users can update own network_connections" on public.network_connections;
create policy "Users can update own network_connections" on public.network_connections for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "Users can delete own network_connections" on public.network_connections;
create policy "Users can delete own network_connections" on public.network_connections for delete using (owner_id = auth.uid());

-- 3) Scenario Modeling + 4) Capacity Simulation
create table if not exists public.supply_models (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  region_code text not null default 'RGV',
  county text null,
  model_name text not null default 'Base Scenario',
  drought_pct numeric not null default 0,
  population_growth_pct numeric not null default 0,
  industrial_growth_pct numeric not null default 0,
  new_desal_capacity_mgd numeric not null default 0,
  available_supply_mgd numeric not null default 0,
  future_supply_mgd numeric generated always as (
    greatest(available_supply_mgd * (1 - (drought_pct / 100.0)) + new_desal_capacity_mgd, 0)
  ) stored,
  projected_demand_mgd numeric not null default 0,
  deficit_mgd numeric generated always as (
    greatest(projected_demand_mgd - (available_supply_mgd * (1 - (drought_pct / 100.0)) + new_desal_capacity_mgd), 0)
  ) stored,
  surplus_mgd numeric generated always as (
    greatest((available_supply_mgd * (1 - (drought_pct / 100.0)) + new_desal_capacity_mgd) - projected_demand_mgd, 0)
  ) stored,
  assumptions text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, region_code, county, model_name)
);

drop trigger if exists set_supply_models_updated_at on public.supply_models;
create trigger set_supply_models_updated_at
before update on public.supply_models
for each row
execute function public.set_current_timestamp_updated_at();

create index if not exists supply_models_owner_region_idx on public.supply_models (owner_id, region_code, updated_at desc);

alter table public.supply_models enable row level security;

drop policy if exists "Users can select own supply_models" on public.supply_models;
create policy "Users can select own supply_models" on public.supply_models for select using (owner_id = auth.uid());

drop policy if exists "Users can insert own supply_models" on public.supply_models;
create policy "Users can insert own supply_models" on public.supply_models for insert with check (owner_id = auth.uid());

drop policy if exists "Users can update own supply_models" on public.supply_models;
create policy "Users can update own supply_models" on public.supply_models for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "Users can delete own supply_models" on public.supply_models;
create policy "Users can delete own supply_models" on public.supply_models for delete using (owner_id = auth.uid());

create table if not exists public.demand_models (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  region_code text not null default 'RGV',
  county text null,
  utility_name text not null,
  baseline_demand_mgd numeric not null default 0,
  growth_5y_pct numeric not null default 0,
  growth_10y_pct numeric not null default 0,
  growth_20y_pct numeric not null default 0,
  projected_demand_5y_mgd numeric generated always as (baseline_demand_mgd * (1 + growth_5y_pct / 100.0)) stored,
  projected_demand_10y_mgd numeric generated always as (baseline_demand_mgd * (1 + growth_10y_pct / 100.0)) stored,
  projected_demand_20y_mgd numeric generated always as (baseline_demand_mgd * (1 + growth_20y_pct / 100.0)) stored,
  projected_revenue_5y numeric not null default 0,
  projected_revenue_10y numeric not null default 0,
  projected_revenue_20y numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, region_code, utility_name)
);

drop trigger if exists set_demand_models_updated_at on public.demand_models;
create trigger set_demand_models_updated_at
before update on public.demand_models
for each row
execute function public.set_current_timestamp_updated_at();

create index if not exists demand_models_owner_region_idx on public.demand_models (owner_id, region_code, updated_at desc);

alter table public.demand_models enable row level security;

drop policy if exists "Users can select own demand_models" on public.demand_models;
create policy "Users can select own demand_models" on public.demand_models for select using (owner_id = auth.uid());

drop policy if exists "Users can insert own demand_models" on public.demand_models;
create policy "Users can insert own demand_models" on public.demand_models for insert with check (owner_id = auth.uid());

drop policy if exists "Users can update own demand_models" on public.demand_models;
create policy "Users can update own demand_models" on public.demand_models for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "Users can delete own demand_models" on public.demand_models;
create policy "Users can delete own demand_models" on public.demand_models for delete using (owner_id = auth.uid());

create table if not exists public.simulation_runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  region_code text not null default 'RGV',
  name text not null,
  scenario_type text not null default 'capacity' check (scenario_type in ('capacity', 'expansion', 'risk', 'funding')),
  parameters jsonb not null default '{}'::jsonb,
  results jsonb not null default '{}'::jsonb,
  status text not null default 'completed' check (status in ('queued', 'running', 'completed', 'failed')),
  run_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_simulation_runs_updated_at on public.simulation_runs;
create trigger set_simulation_runs_updated_at
before update on public.simulation_runs
for each row
execute function public.set_current_timestamp_updated_at();

create index if not exists simulation_runs_owner_region_idx on public.simulation_runs (owner_id, region_code, run_at desc);

alter table public.simulation_runs enable row level security;

drop policy if exists "Users can select own simulation_runs" on public.simulation_runs;
create policy "Users can select own simulation_runs" on public.simulation_runs for select using (owner_id = auth.uid());

drop policy if exists "Users can insert own simulation_runs" on public.simulation_runs;
create policy "Users can insert own simulation_runs" on public.simulation_runs for insert with check (owner_id = auth.uid());

drop policy if exists "Users can update own simulation_runs" on public.simulation_runs;
create policy "Users can update own simulation_runs" on public.simulation_runs for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "Users can delete own simulation_runs" on public.simulation_runs;
create policy "Users can delete own simulation_runs" on public.simulation_runs for delete using (owner_id = auth.uid());

-- 5) Expansion Planning Assets
create table if not exists public.digital_twin_assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  region_code text not null default 'RGV',
  asset_type text not null check (asset_type in ('pipeline', 'customer', 'storage', 'plant', 'pump_station', 'reservoir')),
  asset_name text not null,
  county text null,
  status text not null default 'planned' check (status in ('planned', 'in_progress', 'active', 'deferred')),
  capacity_impact_mgd numeric not null default 0,
  estimated_cost numeric not null default 0,
  target_year int null,
  risk_score int not null default 0 check (risk_score between 0 and 100),
  opportunity_score int not null default 0 check (opportunity_score between 0 and 100),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_digital_twin_assets_updated_at on public.digital_twin_assets;
create trigger set_digital_twin_assets_updated_at
before update on public.digital_twin_assets
for each row
execute function public.set_current_timestamp_updated_at();

create index if not exists digital_twin_assets_owner_region_idx on public.digital_twin_assets (owner_id, region_code, updated_at desc);

alter table public.digital_twin_assets enable row level security;

drop policy if exists "Users can select own digital_twin_assets" on public.digital_twin_assets;
create policy "Users can select own digital_twin_assets" on public.digital_twin_assets for select using (owner_id = auth.uid());

drop policy if exists "Users can insert own digital_twin_assets" on public.digital_twin_assets;
create policy "Users can insert own digital_twin_assets" on public.digital_twin_assets for insert with check (owner_id = auth.uid());

drop policy if exists "Users can update own digital_twin_assets" on public.digital_twin_assets;
create policy "Users can update own digital_twin_assets" on public.digital_twin_assets for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "Users can delete own digital_twin_assets" on public.digital_twin_assets;
create policy "Users can delete own digital_twin_assets" on public.digital_twin_assets for delete using (owner_id = auth.uid());

-- Regional dashboard KPI helper
create or replace function public.get_digital_twin_dashboard(p_region_code text default 'RGV')
returns table (
  region_code text,
  total_demand_mgd numeric,
  total_supply_mgd numeric,
  capacity_gap_mgd numeric,
  growth_forecast_mgd numeric,
  active_assets int,
  high_risk_assets int,
  top_opportunity_count int
)
language sql
stable
security invoker
set search_path = public
as $$
  with demand as (
    select
      coalesce(sum(dm.baseline_demand_mgd), 0) as current_demand,
      coalesce(sum(dm.projected_demand_20y_mgd), 0) as future_demand
    from public.demand_models dm
    where dm.owner_id = auth.uid()
      and dm.region_code = p_region_code
  ),
  supply as (
    select coalesce(sum(sm.future_supply_mgd), 0) as future_supply
    from public.supply_models sm
    where sm.owner_id = auth.uid()
      and sm.region_code = p_region_code
  ),
  assets as (
    select
      count(*) filter (where dta.status = 'active')::int as active_assets,
      count(*) filter (where dta.risk_score >= 70)::int as high_risk_assets,
      count(*) filter (where dta.opportunity_score >= 70)::int as top_opportunity_count
    from public.digital_twin_assets dta
    where dta.owner_id = auth.uid()
      and dta.region_code = p_region_code
  )
  select
    p_region_code as region_code,
    demand.current_demand as total_demand_mgd,
    supply.future_supply as total_supply_mgd,
    greatest(demand.current_demand - supply.future_supply, 0) as capacity_gap_mgd,
    greatest(demand.future_demand - demand.current_demand, 0) as growth_forecast_mgd,
    assets.active_assets,
    assets.high_risk_assets,
    assets.top_opportunity_count
  from demand, supply, assets;
$$;

grant execute on function public.get_digital_twin_dashboard(text) to authenticated;

-- Capacity simulation helper (county level deficits/surplus)
create or replace function public.get_digital_twin_capacity(p_region_code text default 'RGV')
returns table (
  county text,
  available_supply_mgd numeric,
  future_supply_mgd numeric,
  projected_demand_mgd numeric,
  deficit_mgd numeric,
  surplus_mgd numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    coalesce(sm.county, 'Unspecified') as county,
    sum(sm.available_supply_mgd) as available_supply_mgd,
    sum(sm.future_supply_mgd) as future_supply_mgd,
    sum(sm.projected_demand_mgd) as projected_demand_mgd,
    sum(sm.deficit_mgd) as deficit_mgd,
    sum(sm.surplus_mgd) as surplus_mgd
  from public.supply_models sm
  where sm.owner_id = auth.uid()
    and sm.region_code = p_region_code
  group by coalesce(sm.county, 'Unspecified')
  order by deficit_mgd desc, county asc;
$$;

grant execute on function public.get_digital_twin_capacity(text) to authenticated;

-- Predictive analytics helper
create or replace function public.get_digital_twin_forecasts(p_region_code text default 'RGV')
returns table (
  utility_name text,
  county text,
  demand_5y_mgd numeric,
  demand_10y_mgd numeric,
  demand_20y_mgd numeric,
  revenue_5y numeric,
  revenue_10y numeric,
  revenue_20y numeric,
  capacity_need_mgd numeric,
  recommended_expansion_year int
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    dm.utility_name,
    coalesce(dm.county, 'Unspecified') as county,
    dm.projected_demand_5y_mgd as demand_5y_mgd,
    dm.projected_demand_10y_mgd as demand_10y_mgd,
    dm.projected_demand_20y_mgd as demand_20y_mgd,
    dm.projected_revenue_5y as revenue_5y,
    dm.projected_revenue_10y as revenue_10y,
    dm.projected_revenue_20y as revenue_20y,
    greatest(dm.projected_demand_20y_mgd - dm.baseline_demand_mgd, 0) as capacity_need_mgd,
    (extract(year from now())::int + case
      when dm.projected_demand_5y_mgd > dm.baseline_demand_mgd * 1.2 then 3
      when dm.projected_demand_10y_mgd > dm.baseline_demand_mgd * 1.35 then 6
      else 10
    end) as recommended_expansion_year
  from public.demand_models dm
  where dm.owner_id = auth.uid()
    and dm.region_code = p_region_code
  order by capacity_need_mgd desc, dm.utility_name asc;
$$;

grant execute on function public.get_digital_twin_forecasts(text) to authenticated;

-- Expansion route helper
create or replace function public.get_best_expansion_routes(p_region_code text default 'RGV')
returns table (
  connection_id uuid,
  from_node text,
  to_node text,
  connection_type text,
  length_miles numeric,
  capacity_mgd numeric,
  route_score numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    nc.id as connection_id,
    fn.name as from_node,
    tn.name as to_node,
    nc.connection_type,
    nc.length_miles,
    nc.capacity_mgd,
    (
      (nc.capacity_mgd * 10)
      - (nc.length_miles * 2)
      + case when nc.status = 'planned' then 8 else 0 end
      + case when nc.is_expansion_candidate then 12 else 0 end
    )::numeric as route_score
  from public.network_connections nc
  join public.network_nodes fn on fn.id = nc.from_node_id
  join public.network_nodes tn on tn.id = nc.to_node_id
  where nc.owner_id = auth.uid()
    and nc.region_code = p_region_code
    and nc.is_expansion_candidate = true
  order by route_score desc, nc.capacity_mgd desc, nc.length_miles asc;
$$;

grant execute on function public.get_best_expansion_routes(text) to authenticated;

-- AI assistant helpers
create or replace function public.get_highest_demand_utility(p_region_code text default 'RGV')
returns table (
  utility_name text,
  county text,
  projected_demand_20y_mgd numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    dm.utility_name,
    coalesce(dm.county, 'Unspecified') as county,
    dm.projected_demand_20y_mgd
  from public.demand_models dm
  where dm.owner_id = auth.uid()
    and dm.region_code = p_region_code
  order by dm.projected_demand_20y_mgd desc, dm.utility_name asc
  limit 1;
$$;

grant execute on function public.get_highest_demand_utility(text) to authenticated;

create or replace function public.get_future_shortages_by_county(p_region_code text default 'RGV')
returns table (
  county text,
  shortage_mgd numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    c.county,
    c.deficit_mgd as shortage_mgd
  from public.get_digital_twin_capacity(p_region_code) c
  where c.deficit_mgd > 0
  order by c.deficit_mgd desc, c.county asc;
$$;

grant execute on function public.get_future_shortages_by_county(text) to authenticated;

create or replace function public.get_digital_twin_funding_opportunities(p_region_code text default 'RGV')
returns table (
  program_name text,
  category text,
  estimated_gap_mgd numeric,
  rationale text
)
language sql
stable
security invoker
set search_path = public
as $$
  with gap as (
    select coalesce(sum(c.deficit_mgd), 0) as total_gap
    from public.get_digital_twin_capacity(p_region_code) c
  )
  select
    fp.program_name,
    fp.category,
    gap.total_gap as estimated_gap_mgd,
    ('Priority match for region gap of ' || round(gap.total_gap::numeric, 2)::text || ' MGD')::text as rationale
  from public.funding_programs fp
  cross join gap
  where fp.is_active = true
  order by
    case
      when fp.category ilike '%water%' then 0
      when fp.category ilike '%infrastructure%' then 1
      else 2
    end,
    fp.program_name asc
  limit 10;
$$;

grant execute on function public.get_digital_twin_funding_opportunities(text) to authenticated;

-- Optional admin bypass policies (requires phase6 is_admin function)
drop policy if exists "Admins have full access" on public.network_nodes;
create policy "Admins have full access" on public.network_nodes
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins have full access" on public.network_connections;
create policy "Admins have full access" on public.network_connections
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins have full access" on public.supply_models;
create policy "Admins have full access" on public.supply_models
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins have full access" on public.demand_models;
create policy "Admins have full access" on public.demand_models
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins have full access" on public.simulation_runs;
create policy "Admins have full access" on public.simulation_runs
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins have full access" on public.digital_twin_assets;
create policy "Admins have full access" on public.digital_twin_assets
  using (public.is_admin()) with check (public.is_admin());
