-- Phase 5 (AI Water Intelligence)
-- Additive migration: AI chat history + document chunk indexing for search.

-- Required for vector embeddings (Supabase typically supports this extension).
create extension if not exists vector;

-- ===== AI chat =====
create table if not exists public.ai_chat_threads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.ai_chat_threads(id) on delete cascade,
  owner_id uuid not null default auth.uid(),
  role text not null check (role in ('user','assistant','tool','system')),
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.ai_chat_threads enable row level security;
alter table public.ai_chat_messages enable row level security;

drop policy if exists "ai_chat_threads_select_own" on public.ai_chat_threads;
create policy "ai_chat_threads_select_own" on public.ai_chat_threads
  for select using (owner_id = auth.uid());

drop policy if exists "ai_chat_threads_insert_own" on public.ai_chat_threads;
create policy "ai_chat_threads_insert_own" on public.ai_chat_threads
  for insert with check (owner_id = auth.uid());

drop policy if exists "ai_chat_threads_update_own" on public.ai_chat_threads;
create policy "ai_chat_threads_update_own" on public.ai_chat_threads
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "ai_chat_threads_delete_own" on public.ai_chat_threads;
create policy "ai_chat_threads_delete_own" on public.ai_chat_threads
  for delete using (owner_id = auth.uid());

-- Messages follow their own owner_id and also require thread ownership.
drop policy if exists "ai_chat_messages_select_own" on public.ai_chat_messages;
create policy "ai_chat_messages_select_own" on public.ai_chat_messages
  for select using (
    owner_id = auth.uid()
    and exists (
      select 1 from public.ai_chat_threads t
      where t.id = ai_chat_messages.thread_id
        and t.owner_id = auth.uid()
    )
  );

drop policy if exists "ai_chat_messages_insert_own" on public.ai_chat_messages;
create policy "ai_chat_messages_insert_own" on public.ai_chat_messages
  for insert with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.ai_chat_threads t
      where t.id = ai_chat_messages.thread_id
        and t.owner_id = auth.uid()
    )
  );

drop policy if exists "ai_chat_messages_delete_own" on public.ai_chat_messages;
create policy "ai_chat_messages_delete_own" on public.ai_chat_messages
  for delete using (
    owner_id = auth.uid()
    and exists (
      select 1 from public.ai_chat_threads t
      where t.id = ai_chat_messages.thread_id
        and t.owner_id = auth.uid()
    )
  );

-- ===== Funding program profiles (optional structured enrichment for AI advisor) =====
create table if not exists public.funding_program_profiles (
  program_id uuid primary key references public.funding_programs(id) on delete cascade,
  owner_id uuid not null default auth.uid(),
  tags text[] not null default '{}',
  eligibility_notes text,
  match_notes text,
  updated_at timestamptz not null default now()
);

alter table public.funding_program_profiles enable row level security;

drop policy if exists "funding_program_profiles_select_own" on public.funding_program_profiles;
create policy "funding_program_profiles_select_own" on public.funding_program_profiles
  for select using (owner_id = auth.uid());

drop policy if exists "funding_program_profiles_upsert_own" on public.funding_program_profiles;
create policy "funding_program_profiles_upsert_own" on public.funding_program_profiles
  for insert with check (owner_id = auth.uid());

drop policy if exists "funding_program_profiles_update_own" on public.funding_program_profiles;
create policy "funding_program_profiles_update_own" on public.funding_program_profiles
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "funding_program_profiles_delete_own" on public.funding_program_profiles;
create policy "funding_program_profiles_delete_own" on public.funding_program_profiles
  for delete using (owner_id = auth.uid());

-- ===== Document chunk index (FTS + optional embeddings) =====
-- source_table: 'documents' or 'uploaded_files'
create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  source_table text not null check (source_table in ('documents','uploaded_files')),
  source_id uuid not null,
  bucket text not null,
  path text not null,
  chunk_index int not null,
  content_text text not null,
  content_tsv tsvector generated always as (to_tsvector('english', content_text)) stored,
  embedding vector(1536),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, source_table, source_id, chunk_index)
);

alter table public.document_chunks enable row level security;

drop policy if exists "document_chunks_select_own" on public.document_chunks;
create policy "document_chunks_select_own" on public.document_chunks
  for select using (owner_id = auth.uid());

drop policy if exists "document_chunks_insert_own" on public.document_chunks;
create policy "document_chunks_insert_own" on public.document_chunks
  for insert with check (owner_id = auth.uid());

drop policy if exists "document_chunks_update_own" on public.document_chunks;
create policy "document_chunks_update_own" on public.document_chunks
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "document_chunks_delete_own" on public.document_chunks;
create policy "document_chunks_delete_own" on public.document_chunks
  for delete using (owner_id = auth.uid());

create index if not exists document_chunks_owner_source_idx
  on public.document_chunks (owner_id, source_table, source_id);

create index if not exists document_chunks_tsv_idx
  on public.document_chunks using gin (content_tsv);

-- Vector index is optional and only indexes non-null embeddings.
create index if not exists document_chunks_embedding_ivfflat
  on public.document_chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 100)
  where (embedding is not null);

-- Optional RPC for semantic search.
create or replace function public.match_document_chunks(
  p_query_embedding vector(1536),
  p_match_count int default 8
)
returns table (
  id uuid,
  source_table text,
  source_id uuid,
  bucket text,
  path text,
  chunk_index int,
  content_text text,
  metadata jsonb,
  similarity float
)
language sql
stable
as $$
  select
    dc.id,
    dc.source_table,
    dc.source_id,
    dc.bucket,
    dc.path,
    dc.chunk_index,
    dc.content_text,
    dc.metadata,
    (1 - (dc.embedding <=> p_query_embedding))::float as similarity
  from public.document_chunks dc
  where dc.owner_id = auth.uid()
    and dc.embedding is not null
  order by dc.embedding <=> p_query_embedding
  limit greatest(p_match_count, 1);
$$;

grant execute on function public.match_document_chunks(vector(1536), int) to authenticated;

-- Optional RPC for route ranking (leverages Phase 4 route_alternatives geometry).
create or replace function public.rank_route_alternatives(
  p_project_id uuid,
  p_criteria text default 'cheapest'
)
returns table (
  id uuid,
  name text,
  length_miles double precision,
  total_cost_estimated double precision,
  risk_score int
)
language sql
stable
as $$
  with base as (
    select
      ra.id,
      ra.name,
      (st_length(ra.geom::geography) / 1609.344)::double precision as length_miles,
      (coalesce(ra.cost_per_mile, 0)::double precision * (st_length(ra.geom::geography) / 1609.344)::double precision) as total_cost_estimated,
      (
        coalesce(nullif(regexp_replace(coalesce(ra.crossings, ''), '\\D', '', 'g'), ''), '0')::int * 2
        + case when coalesce(ra.easement_concerns, '') <> '' then 3 else 0 end
        + case when coalesce(ra.permitting_concerns, '') <> '' then 3 else 0 end
        + case when coalesce(ra.environmental_concerns, '') <> '' then 3 else 0 end
        + case when coalesce(ra.notes, '') ilike '%risk%' then 1 else 0 end
      )::int as risk_score
    from public.route_alternatives ra
    where ra.owner_id = auth.uid()
      and ra.project_id = p_project_id
      and ra.geom is not null
  )
  select *
  from base
  order by
    case when lower(p_criteria) = 'shortest' then length_miles end asc nulls last,
    case when lower(p_criteria) = 'cheapest' then total_cost_estimated end asc nulls last,
    case when lower(p_criteria) in ('lowest_risk','lowestrisk','risk') then risk_score end asc nulls last,
    length_miles asc;
$$;

grant execute on function public.rank_route_alternatives(uuid, text) to authenticated;

-- ===== GIS helper RPCs for AI spatial queries =====

create or replace function public.find_imported_geometries_near_route(
  p_route_alternative_id uuid,
  p_imported_layer_id uuid,
  p_miles numeric default 1,
  p_limit int default 200
)
returns table (
  id uuid,
  feature_type text,
  properties jsonb,
  distance_miles double precision
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    ig.id,
    ig.feature_type,
    ig.properties,
    (st_distance(ig.geom::geography, ra.geom::geography) / 1609.344)::double precision as distance_miles
  from public.imported_geometries ig
  join public.route_alternatives ra
    on ra.id = p_route_alternative_id
  where ig.owner_id = auth.uid()
    and ra.owner_id = auth.uid()
    and ig.imported_layer_id = p_imported_layer_id
    and st_dwithin(ig.geom::geography, ra.geom::geography, (greatest(p_miles, 0.01) * 1609.344))
  order by ig.geom <-> ra.geom
  limit greatest(p_limit, 1);
$$;

grant execute on function public.find_imported_geometries_near_route(uuid, uuid, numeric, int) to authenticated;

create or replace function public.find_gis_features_near_route(
  p_route_alternative_id uuid,
  p_miles numeric default 1,
  p_layer_key text default null,
  p_limit int default 200
)
returns table (
  id uuid,
  layer_key text,
  title text,
  notes text,
  distance_miles double precision
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    gf.id,
    gf.layer_key,
    gf.title,
    gf.notes,
    (st_distance(gf.geom::geography, ra.geom::geography) / 1609.344)::double precision as distance_miles
  from public.gis_features gf
  join public.route_alternatives ra
    on ra.id = p_route_alternative_id
  where gf.owner_id = auth.uid()
    and ra.owner_id = auth.uid()
    and (p_layer_key is null or gf.layer_key = p_layer_key)
    and st_dwithin(gf.geom::geography, ra.geom::geography, (greatest(p_miles, 0.01) * 1609.344))
  order by gf.geom <-> ra.geom
  limit greatest(p_limit, 1);
$$;

grant execute on function public.find_gis_features_near_route(uuid, numeric, text, int) to authenticated;

create or replace function public.find_imported_geometries_intersect_corridor(
  p_row_corridor_id uuid,
  p_imported_layer_id uuid,
  p_limit int default 200
)
returns table (
  id uuid,
  feature_type text,
  properties jsonb
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    ig.id,
    ig.feature_type,
    ig.properties
  from public.imported_geometries ig
  join public.row_corridors rc
    on rc.id = p_row_corridor_id
  where ig.owner_id = auth.uid()
    and rc.owner_id = auth.uid()
    and ig.imported_layer_id = p_imported_layer_id
    and st_intersects(ig.geom, rc.geom)
  limit greatest(p_limit, 1);
$$;

grant execute on function public.find_imported_geometries_intersect_corridor(uuid, uuid, int) to authenticated;

create or replace function public.find_gis_features_within_imported_polygon(
  p_polygon_imported_geometry_id uuid,
  p_layer_key text default null,
  p_limit int default 200
)
returns table (
  id uuid,
  layer_key text,
  title text,
  notes text
)
language sql
stable
security invoker
set search_path = public
as $$
  with poly as (
    select ig.geom
    from public.imported_geometries ig
    where ig.owner_id = auth.uid()
      and ig.id = p_polygon_imported_geometry_id
    limit 1
  )
  select
    gf.id,
    gf.layer_key,
    gf.title,
    gf.notes
  from public.gis_features gf
  cross join poly
  where gf.owner_id = auth.uid()
    and (p_layer_key is null or gf.layer_key = p_layer_key)
    and st_within(gf.geom, poly.geom)
  limit greatest(p_limit, 1);
$$;

grant execute on function public.find_gis_features_within_imported_polygon(uuid, text, int) to authenticated;
