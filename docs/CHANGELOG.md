# RGV Water GIS Command Center — Changelog

This changelog tracks high-level product changes by phase.

> Conventions
> - **Added**: new features, routes, tables, or workflows.
> - **Changed**: behavior changes that remain backward compatible.
> - **Fixed**: bug fixes.
> - **Notes**: operational or migration notes.

---

## Unreleased

**Added**
- Documentation set under `/docs` (User Manual, Admin Manual, System Architecture, Roadmap, Changelog).

---

## Phase 4 — Decision & Investor Dashboard

**Added**
- Dashboard routes/pages:
  - Executive Summary
  - Investor Snapshot
  - Project Performance
  - Legislative Briefs (draft + save)
  - Dashboard Exports (download + optional upload + history logging)
- Phase 4 database schema (additive):
  - `project_scenarios`, `scenario_utilities`, `scenario_routes`
  - `revenue_models`
  - `risk_register`
  - `meeting_briefs`
  - `dashboard_snapshots`
  - `export_history`

**Changed**
- Export flows enhanced to optionally upload artifacts to Supabase Storage and log rows to `export_history`.

---

## Phase 3 — Planning Tools

**Added**
- File Uploads (`uploaded_files`) backed by Supabase Storage buckets `planning_uploads` and `planning_exports`.
- Imported Layers (GeoJSON/KML/KMZ/Shapefile ZIP) into PostGIS (`imported_layers`, `imported_geometries`).
- Map Overlays (PDF/image to raster overlay) with georeferencing corners (`map_overlays`).
- ROW Corridors editing (`row_corridors`) and geojson retrieval RPC.
- Route Alternatives editing (`route_alternatives`) and geojson retrieval RPC.
- Route Cost Estimates (`route_cost_estimates`) including CAPEX rollup helpers.
- Export jobs scaffold (`export_jobs`) for future server-driven exports.

**Fixed**
- Supabase Postgres migration error `42P13` (function parameter defaults ordering): function signatures were updated so that once a default parameter exists, subsequent parameters also have defaults.

---

## Phase 2 — Projects + CRM + Funding + Documents

**Added**
- Projects (`projects`) and related GIS/project linkage fields.
- Stakeholder CRM foundations (`crm_organizations`, `crm_contacts`, `crm_meetings`, `crm_notes`).
- Funding programs (`funding_programs`) and project/program linking (`funding_links`).
- Document repository (`documents` table + Supabase Storage bucket `documents`).

---

## Phase 1 — GIS Core

**Added**
- Map editing (MapLibre + Mapbox Draw) backed by PostGIS.
- User-managed GIS layers (`gis_layers`).
- Feature store (`gis_features`) and GeoJSON view (`gis_features_geojson`).
- RPC-based feature upsert/delete.
- Basic exports (GeoJSON/CSV).
