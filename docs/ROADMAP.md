# RGV Water GIS Command Center — Roadmap

This roadmap summarizes delivered phases and planned future phases for the RGV Water GIS Command Center.

> Notes
> - This is a living document; timelines are intentionally not date-committed.
> - All phases keep the core security model: user-scoped data access via Supabase Auth + Postgres Row Level Security (RLS).

---

## Phase 1 — GIS Core Map (Delivered)

**Goal:** Provide a secure, interactive GIS map for the RGV region with editable features.

**Delivered capabilities**
- Authenticated login and protected map view.
- Interactive map (MapLibre) with draw/edit/delete (Mapbox Draw).
- Dynamic user-managed GIS layers (`gis_layers`).
- Per-feature metadata (priority, contacts, notes, source URL).
- Save/load GIS features to/from PostGIS (`gis_features`) via Supabase RPC.
- Export GIS data as GeoJSON and CSV.

---

## Phase 2 — Projects + CRM + Funding + Documents (Delivered)

**Goal:** Add business context around GIS features.

**Delivered capabilities**
- Projects (`projects`) with basic fields (MGD, revenue, priority, status).
- Stakeholder CRM foundations (`crm_organizations`, plus tables for contacts/meetings/notes).
- Funding programs (`funding_programs`) and link table (`funding_links`).
- Document repository using Supabase Storage bucket `documents` and `documents` table.

---

## Phase 3 — Planning Tools (Delivered / In Progress)

**Goal:** Support planning workflows beyond raw feature editing.

**Delivered capabilities**
- File Uploads to `planning_uploads` / `planning_exports` storage + `uploaded_files` table.
- Imported Layers: import GeoJSON/KML/KMZ/Shapefile ZIP to PostGIS (`imported_layers`, `imported_geometries`) and toggle on map.
- Map Overlays: create georeferenced image overlays (PDF first page supported) (`map_overlays`).
- ROW Corridors editor (`row_corridors`) with geometry editing and map visibility toggles.
- Route Comparison editor (`route_alternatives`) with editable LineStrings.
- Cost Estimator (`route_cost_estimates`) for CAPEX-like rollups.

**Still pending / to finalize**
- Planning “Exports” center (`/planning/exports`) currently provides a placeholder UI; a full job-driven export pipeline can be implemented using `export_jobs`.

---

## Phase 4 — Decision & Investor Dashboards (Delivered / Expanding)

**Goal:** Turn planning data into decision-grade dashboard metrics and sharable materials.

**Delivered capabilities**
- Dashboards navigation + pages:
  - Executive Summary
  - Investor Snapshot
  - Project Performance
  - Legislative Briefs (draft + save)
  - Dashboard Exports (download + upload to Storage + export history)
- Phase 4 database schema (`supabase/phase4.sql`) including:
  - Scenario scaffolding (`project_scenarios`, `scenario_*`)
  - Revenue model storage (`revenue_models`)
  - Risk register storage (`risk_register`)
  - Meeting briefs (`meeting_briefs`)
  - Dashboard snapshots (`dashboard_snapshots`)
  - Export history (`export_history`)

**Recommended next increments (Phase 4.x)**
- Add an exports history list + signed download links in Dashboard Exports.
- Add “Scenario Builder” UI screens (create scenario, attach utilities and routes).
- Add Revenue Model UI screens (simple annual revenue inputs and assumptions JSON).
- Add Risk Register UI screens (severity, category, mitigation, status).

---

## Future Phase 5 — Multi-Organization + Roles

**Goal:** Enable collaboration across utilities, partners, and consultants.

**Planned capabilities**
- Organization-scoped tenancy (multiple users per organization).
- Roles such as Admin, Planner, Viewer, External Partner.
- Permission boundaries by organization + project.
- Audit logging for exports and record changes.

---

## Future Phase 6 — Automated Investor/Regulatory Export Pipelines

**Goal:** Produce repeatable, branded report packages and compliance-ready exports.

**Planned capabilities**
- Server-side export jobs (PDF packs, map renders, bundled ZIPs).
- Scheduled snapshots and “as-of” reporting.
- Template system for briefs (executive/investor/legislative).
- Enhanced georeferencing workflows (control points, QA checks).
- Large-data scaling for imported layers (tiling / vector tiles).
