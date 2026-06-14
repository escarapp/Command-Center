-- ============================================================
-- Phase 8: Investor Portal & Deal Room
-- Run AFTER schema.sql + phase2-7 migrations.
-- Additive only: does not modify prior phase behavior.
-- ============================================================

-- 1) Investor Authentication / Permissions
create table if not exists public.investors (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  investor_user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  organization text null,
  role text not null default 'investor' check (role in ('investor', 'analyst', 'admin')),
  can_view_documents boolean not null default true,
  can_view_financials boolean not null default true,
  can_view_reports boolean not null default true,
  status text not null default 'active' check (status in ('active', 'invited', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, investor_user_id)
);

drop trigger if exists set_investors_updated_at on public.investors;
create trigger set_investors_updated_at
before update on public.investors
for each row
execute function public.set_current_timestamp_updated_at();

create index if not exists investors_owner_idx on public.investors (owner_id, updated_at desc);
create index if not exists investors_user_idx on public.investors (investor_user_id, updated_at desc);

alter table public.investors enable row level security;

drop policy if exists "Investors can select owner and self" on public.investors;
create policy "Investors can select owner and self" on public.investors
for select
using (
  owner_id = auth.uid()
  or investor_user_id = auth.uid()
);

drop policy if exists "Owners can insert investors" on public.investors;
create policy "Owners can insert investors" on public.investors
for insert
with check (owner_id = auth.uid());

drop policy if exists "Owners can update investors" on public.investors;
create policy "Owners can update investors" on public.investors
for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "Owners can delete investors" on public.investors;
create policy "Owners can delete investors" on public.investors
for delete
using (owner_id = auth.uid());

-- 2) Data Room Documents
create table if not exists public.investor_documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  investor_id uuid null references public.investors(id) on delete set null,
  project_id uuid null references public.projects(id) on delete set null,
  doc_type text not null check (doc_type in ('financial_model', 'engineering_report', 'permit', 'presentation', 'contract', 'study')),
  bucket text not null default 'documents',
  path text not null,
  filename text not null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_investor_documents_updated_at on public.investor_documents;
create trigger set_investor_documents_updated_at
before update on public.investor_documents
for each row
execute function public.set_current_timestamp_updated_at();

create index if not exists investor_documents_owner_idx on public.investor_documents (owner_id, updated_at desc);
create index if not exists investor_documents_project_idx on public.investor_documents (owner_id, project_id);

alter table public.investor_documents enable row level security;

drop policy if exists "Owner or permitted investor can select investor_documents" on public.investor_documents;
create policy "Owner or permitted investor can select investor_documents" on public.investor_documents
for select
using (
  owner_id = auth.uid()
  or exists (
    select 1 from public.investors i
    where i.id = investor_documents.investor_id
      and i.investor_user_id = auth.uid()
      and i.status = 'active'
      and i.can_view_documents = true
  )
);

drop policy if exists "Owners can insert investor_documents" on public.investor_documents;
create policy "Owners can insert investor_documents" on public.investor_documents
for insert with check (owner_id = auth.uid());

drop policy if exists "Owners can update investor_documents" on public.investor_documents;
create policy "Owners can update investor_documents" on public.investor_documents
for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "Owners can delete investor_documents" on public.investor_documents;
create policy "Owners can delete investor_documents" on public.investor_documents
for delete using (owner_id = auth.uid());

-- 3) Scenario Financial Models + Revenue Models
create table if not exists public.financial_models (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  investor_id uuid null references public.investors(id) on delete set null,
  project_id uuid null references public.projects(id) on delete set null,
  scenario_mgd int not null check (scenario_mgd in (25, 50, 100, 150)),
  annual_sales numeric not null default 0,
  om_costs numeric not null default 0,
  debt_service numeric not null default 0,
  cash_flow numeric generated always as (annual_sales - om_costs - debt_service) stored,
  assumptions text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, project_id, scenario_mgd)
);

drop trigger if exists set_financial_models_updated_at on public.financial_models;
create trigger set_financial_models_updated_at
before update on public.financial_models
for each row
execute function public.set_current_timestamp_updated_at();

create index if not exists financial_models_owner_idx on public.financial_models (owner_id, updated_at desc);

alter table public.financial_models enable row level security;

drop policy if exists "Owner or permitted investor can select financial_models" on public.financial_models;
create policy "Owner or permitted investor can select financial_models" on public.financial_models
for select
using (
  owner_id = auth.uid()
  or exists (
    select 1 from public.investors i
    where i.id = financial_models.investor_id
      and i.investor_user_id = auth.uid()
      and i.status = 'active'
      and i.can_view_financials = true
  )
);

drop policy if exists "Owners can insert financial_models" on public.financial_models;
create policy "Owners can insert financial_models" on public.financial_models
for insert with check (owner_id = auth.uid());

drop policy if exists "Owners can update financial_models" on public.financial_models;
create policy "Owners can update financial_models" on public.financial_models
for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "Owners can delete financial_models" on public.financial_models;
create policy "Owners can delete financial_models" on public.financial_models
for delete using (owner_id = auth.uid());

-- 4) Capital Stack Module
create table if not exists public.capital_stack (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  investor_id uuid null references public.investors(id) on delete set null,
  project_id uuid null references public.projects(id) on delete set null,
  equity numeric not null default 0,
  debt numeric not null default 0,
  grants numeric not null default 0,
  wifia numeric not null default 0,
  swift numeric not null default 0,
  texas_water_fund numeric not null default 0,
  total_capital numeric generated always as (equity + debt + grants + wifia + swift + texas_water_fund) stored,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, project_id)
);

drop trigger if exists set_capital_stack_updated_at on public.capital_stack;
create trigger set_capital_stack_updated_at
before update on public.capital_stack
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.capital_stack enable row level security;

drop policy if exists "Owner or permitted investor can select capital_stack" on public.capital_stack;
create policy "Owner or permitted investor can select capital_stack" on public.capital_stack
for select
using (
  owner_id = auth.uid()
  or exists (
    select 1 from public.investors i
    where i.id = capital_stack.investor_id
      and i.investor_user_id = auth.uid()
      and i.status = 'active'
      and i.can_view_financials = true
  )
);

drop policy if exists "Owners can insert capital_stack" on public.capital_stack;
create policy "Owners can insert capital_stack" on public.capital_stack
for insert with check (owner_id = auth.uid());

drop policy if exists "Owners can update capital_stack" on public.capital_stack;
create policy "Owners can update capital_stack" on public.capital_stack
for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "Owners can delete capital_stack" on public.capital_stack;
create policy "Owners can delete capital_stack" on public.capital_stack
for delete using (owner_id = auth.uid());

-- 5) Due Diligence Tracker
create table if not exists public.due_diligence (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  investor_id uuid null references public.investors(id) on delete set null,
  project_id uuid null references public.projects(id) on delete set null,
  item text not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'closed')),
  responsible_party text null,
  due_date date null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_due_diligence_updated_at on public.due_diligence;
create trigger set_due_diligence_updated_at
before update on public.due_diligence
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.due_diligence enable row level security;

drop policy if exists "Owner or assigned investor can select due_diligence" on public.due_diligence;
create policy "Owner or assigned investor can select due_diligence" on public.due_diligence
for select
using (
  owner_id = auth.uid()
  or exists (
    select 1 from public.investors i
    where i.id = due_diligence.investor_id
      and i.investor_user_id = auth.uid()
      and i.status = 'active'
  )
);

drop policy if exists "Owners can insert due_diligence" on public.due_diligence;
create policy "Owners can insert due_diligence" on public.due_diligence
for insert with check (owner_id = auth.uid());

drop policy if exists "Owners can update due_diligence" on public.due_diligence;
create policy "Owners can update due_diligence" on public.due_diligence
for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "Owners can delete due_diligence" on public.due_diligence;
create policy "Owners can delete due_diligence" on public.due_diligence
for delete using (owner_id = auth.uid());

-- 6) Investor Report Generator Registry
create table if not exists public.investor_reports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  investor_id uuid null references public.investors(id) on delete set null,
  project_id uuid null references public.projects(id) on delete set null,
  report_type text not null check (report_type in ('executive_summary', 'investment_memorandum', 'financial_summary')),
  title text null,
  parameters jsonb not null default '{}'::jsonb,
  status text not null default 'generated' check (status in ('generated', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_investor_reports_updated_at on public.investor_reports;
create trigger set_investor_reports_updated_at
before update on public.investor_reports
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.investor_reports enable row level security;

drop policy if exists "Owner or permitted investor can select investor_reports" on public.investor_reports;
create policy "Owner or permitted investor can select investor_reports" on public.investor_reports
for select
using (
  owner_id = auth.uid()
  or exists (
    select 1 from public.investors i
    where i.id = investor_reports.investor_id
      and i.investor_user_id = auth.uid()
      and i.status = 'active'
      and i.can_view_reports = true
  )
);

drop policy if exists "Owners can insert investor_reports" on public.investor_reports;
create policy "Owners can insert investor_reports" on public.investor_reports
for insert with check (owner_id = auth.uid());

drop policy if exists "Owners can update investor_reports" on public.investor_reports;
create policy "Owners can update investor_reports" on public.investor_reports
for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "Owners can delete investor_reports" on public.investor_reports;
create policy "Owners can delete investor_reports" on public.investor_reports
for delete using (owner_id = auth.uid());

-- 7) Investor dashboard helper view-like RPC
create or replace function public.get_investor_dashboard()
returns table (
  project_id uuid,
  project_name text,
  capacity_mgd numeric,
  pipeline_miles numeric,
  revenue_projection numeric,
  funding_program_count int
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    p.id as project_id,
    p.name as project_name,
    coalesce(p.estimated_mgd, 0)::numeric as capacity_mgd,
    coalesce(rce.pipeline_miles, 0)::numeric as pipeline_miles,
    coalesce(p.revenue, 0)::numeric as revenue_projection,
    (
      select count(*)::int
      from public.funding_links fl
      where fl.project_id = p.id
    ) as funding_program_count
  from public.projects p
  left join public.route_cost_estimates rce
    on rce.project_id = p.id
  where p.owner_id = auth.uid()
  order by p.updated_at desc;
$$;

grant execute on function public.get_investor_dashboard() to authenticated;

-- 8) Helper RPC: invite/link investor by email
-- Uses SECURITY DEFINER so owners can resolve auth.users by email without exposing auth table directly.
create or replace function public.invite_investor_by_email(
  p_email text,
  p_display_name text default null,
  p_organization text default null,
  p_role text default 'investor'
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_owner uuid := auth.uid();
  v_investor_user_id uuid;
  v_row_id uuid;
  v_name text;
begin
  if v_owner is null then
    raise exception 'Authentication required';
  end if;

  if p_email is null or btrim(p_email) = '' then
    raise exception 'Email is required';
  end if;

  if p_role not in ('investor', 'analyst', 'admin') then
    raise exception 'Invalid role';
  end if;

  select u.id
    into v_investor_user_id
  from auth.users u
  where lower(u.email) = lower(btrim(p_email))
  limit 1;

  if v_investor_user_id is null then
    raise exception 'No auth user found for email: %', p_email;
  end if;

  v_name := coalesce(nullif(btrim(coalesce(p_display_name, '')), ''), split_part(lower(btrim(p_email)), '@', 1));

  insert into public.investors (
    owner_id,
    investor_user_id,
    display_name,
    organization,
    role,
    can_view_documents,
    can_view_financials,
    can_view_reports,
    status
  )
  values (
    v_owner,
    v_investor_user_id,
    v_name,
    nullif(btrim(coalesce(p_organization, '')), ''),
    p_role,
    true,
    true,
    true,
    'active'
  )
  on conflict (owner_id, investor_user_id)
  do update set
    display_name = excluded.display_name,
    organization = excluded.organization,
    role = excluded.role,
    status = 'active',
    updated_at = now()
  returning id into v_row_id;

  return v_row_id;
end;
$$;

grant execute on function public.invite_investor_by_email(text, text, text, text) to authenticated;

-- Optional admin bypass policies (requires phase6 is_admin function)
drop policy if exists "Admins have full access" on public.investors;
create policy "Admins have full access" on public.investors
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins have full access" on public.investor_documents;
create policy "Admins have full access" on public.investor_documents
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins have full access" on public.financial_models;
create policy "Admins have full access" on public.financial_models
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins have full access" on public.capital_stack;
create policy "Admins have full access" on public.capital_stack
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins have full access" on public.due_diligence;
create policy "Admins have full access" on public.due_diligence
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins have full access" on public.investor_reports;
create policy "Admins have full access" on public.investor_reports
  using (public.is_admin()) with check (public.is_admin());
