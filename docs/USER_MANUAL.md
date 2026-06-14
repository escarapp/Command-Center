# RGV Water GIS Command Center — User Manual

This manual is for planners, analysts, and stakeholders using the RGV Water GIS Command Center day-to-day.

---

## 1) Overview

**What this system does**
- Provides a secure GIS map workspace for the Rio Grande Valley (RGV).
- Lets you create/edit infrastructure features (points + lines) and assign them to layers and projects.
- Adds planning tools (route alternatives, cost estimation, ROW corridors, overlays, imported reference layers).
- Adds decision dashboards for executive/investor/legislative communication.

**Data ownership / privacy**
- Data is user-scoped by default (you see what you create under your login).
- If you log in with a different account, you will not see your prior account’s records.

---

## 2) Getting Started

### 2.1 Sign in
1. Open the app URL provided by your administrator.
2. Go to the Login screen.
3. Sign up or sign in using your email/password.

**If you can’t sign in**
- Confirm with your admin that Email auth is enabled in Supabase Auth.
- If email confirmation is required, verify your email first.

> Screenshot placeholder: Login screen (email + password)

### 2.2 Navigation (Where to go)
- **Map**: the primary GIS workspace (dashboard/map view).
- **Planning Tools**: Imported Layers, Map Overlays, File Uploads, ROW Corridors, Route Comparison, Cost Estimator, Exports.
- **Dashboards**: Executive Summary, Investor Snapshot, Project Performance, Legislative Briefs, Dashboard Exports.

> Screenshot placeholder: Left navigation menu

---

## 3) Dashboard Overview

### 3.1 Executive Summary
**Purpose**
- Portfolio totals across projects, cost estimates, CRM follow-ups, and upcoming funding deadlines.

**How to use**
1. Open **Dashboards → Executive Summary**.
2. Review key totals: Projects, Demand (MGD), Revenue, Capex (Estimated), Follow-ups, Funding deadlines.
3. Use **Refresh** to reload.

> Screenshot placeholder: Executive Summary tiles + Upcoming Funding Deadlines

### 3.2 Investor Snapshot
**Purpose**
- Ranks projects by revenue and shows ROI as $\text{Revenue} / \text{Capex}$ using the latest cost estimate per project.

**How to use**
1. Open **Dashboards → Investor Snapshot**.
2. Use **Refresh** to reload.
3. Review the table for Revenue, Capex, ROI.

> Screenshot placeholder: Investor Snapshot table

### 3.3 Project Performance
**Purpose**
- Quick health view: counts by status and priority, plus recently updated projects.

**How to use**
1. Open **Dashboards → Project Performance**.
2. Use **Refresh** to reload.
3. Review the “By Status” and “By Priority” cards.

> Screenshot placeholder: Project Performance (By Status / By Priority)

---

## 4) Maps

### 4.1 Layer Controls
The Map sidebar begins with **Layer Controls**.

**Choose a layer (what you are adding/editing)**
1. Use the **Choose a layer** dropdown.
2. The selected layer is the target for new/edited features.

**Show/hide layers**
- In the layer list, toggle the checkbox next to a layer to show/hide it.

**Add a layer**
1. Click **Add Layer**.
2. Enter **New layer name**.
3. Click **Save**.

**Delete a layer**
- Click **Delete Layer** (for the active layer) or click the **×** next to a layer in the list.
- You must keep at least one layer.

> Screenshot placeholder: Layer Controls (dropdown + Add Layer + layer list)

### 4.2 Add and edit map features (Points and Lines)

**Create a point**
1. Click **Point**.
2. Click once on the map to place the point.
3. Fill in **Feature Details** (title, notes, project, etc.).
4. Click **Save**.

**Create a line (pipeline route)**
1. Click **Line**.
2. Click to add vertices along the route.
3. Double-click the last point to finish.
4. Fill in **Feature Details**.
5. Click **Save**.

**Move/edit geometry**
1. Click an item on the map (or from **Items In Selected Layer**).
2. Drag to adjust geometry.
3. Click **Save**.

**Delete an item**
1. Click the **×** next to the item in **Items In Selected Layer**.
2. Confirm removal.
3. Click **Save** to sync deletions to the database.

> Screenshot placeholder: Map with a selected feature + Feature Details panel

### 4.3 Feature Details (metadata)
When a feature is selected, you can set:
- **Layer** (move the feature to a different layer)
- **Project** (associate with a project)
- **Feature title** and **Notes**
- **Estimated construction cost (USD)**
- **Priority** (e.g., HIGH/MEDIUM/LOW)
- **Contact name / Phone / Email**
- **Source URL**

**Route distance**
- When a line feature is selected, the sidebar shows **Route distance: X miles**.

> Screenshot placeholder: Feature Details fields list

### 4.4 Map exports
**GeoJSON export (current layer set)**
1. Click **GeoJSON**.
2. A file named `rgv-water-gis-export.geojson` downloads.

> Screenshot placeholder: Export buttons (Save / GeoJSON)

---

## 5) Layers (User-Managed)

### 5.1 When to create a new layer
Use layers to separate different planning “themes,” such as:
- Desal plants
- Pipelines / transmission
- Storage tanks
- Candidate wellfields
- Constraints / issues

### 5.2 Recommended layer naming
- Keep labels short and scannable.
- Use a consistent naming scheme across teams (e.g., `Pipelines — South`, `Pipelines — North`).

---

## 6) Stakeholders (CRM)

### 6.1 Stakeholder CRM (Organizations)
**Purpose**
- Track utilities, cities, counties, agencies, and partners as Organizations.

**How to use**
1. Open **Stakeholder CRM**.
2. Enter **New organization name**.
3. Enter **Type** (e.g., utility, city, county).
4. Click **Add**.
5. To remove, click **Delete**.

> Screenshot placeholder: Stakeholder CRM list + Add form

**Note on contacts/meetings/notes**
- The database contains tables for contacts, meetings, and notes; the current UI focuses on Organizations (the foundation record).

---

## 7) Funding Database

### 7.1 Funding programs
**Purpose**
- Track program name, agency, deadline, and URL.

**How to use**
1. Open **Funding**.
2. Fill in:
   - Program name
   - Agency
   - Deadline (YYYY-MM-DD)
   - URL
3. Click **Add Program**.
4. To remove a program, click **Delete**.

> Screenshot placeholder: Funding programs list

**How it connects to dashboards**
- Executive Summary shows upcoming deadlines in the next 30 days.

---

## 8) Pipeline Route Builder

There are two route-related workflows:

### 8.1 Quick route sketching on the Map
**Purpose**
- Draw a line on the Map as a pipeline concept and store it as a GIS feature.

**Steps**
1. Open **Map**.
2. Select an appropriate layer.
3. Click **Line**.
4. Draw the route and double-click to finish.
5. In **Feature Details**, choose a **Project** (optional but recommended).
6. Click **Save**.

**Tip:** Select the line later to view distance in miles.

### 8.2 Route Comparison tool (A/B/C alternatives)
**Purpose**
- Create named alternatives (Route A/B/C) for a specific project and compare length and cost.

**Steps**
1. Open **Planning Tools → Route Comparison**.
2. Select a **Project**.
3. Click **New Alternative**.
4. Draw the route line on the map.
5. Fill in inputs (as available):
   - Name (A/B/C or label)
   - Cost per mile
   - Crossings
   - Easement concerns
   - Permitting concerns
   - Environmental concerns
6. Click **Save**.

> Screenshot placeholder: Route Comparison (project selector + map)

---

## 9) Cost Estimator

### 9.1 Create or update a cost estimate
**Purpose**
- Estimate a total cost using pipeline miles, cost-per-mile, lump sums, and percentage adders.

**Steps**
1. Open **Planning Tools → Cost Estimator**.
2. Select a **Project**.
3. Enter values:
   - Pipeline miles
   - Cost per mile
   - Pump station cost
   - Storage tank cost
   - Land / easement cost
   - Engineering/design % (optional)
   - Permitting/environmental % (optional)
   - Contingency % (optional)
4. Review **Totals** (Base + Total).
5. Click **Save Estimate**.

**Example workflow**
- Use Route Comparison length (miles) to seed Pipeline miles.
- Use engineering/permitting/contingency percentages for concept-level ranges.

> Screenshot placeholder: Cost Estimator (inputs + Totals)

---

## 10) Scenario Builder (Phase 4 — Database Ready)

**Status**
- Phase 4 installs the Scenario tables in the database.
- A dedicated Scenario Builder UI is planned (Phase 4.x).

**What scenarios will do (intended)**
- Compare “bundles” of utilities/routes/capex under a scenario name.

**Current workaround (until Scenario UI ships)**
- Use Projects + Route Comparison + Cost Estimator as the working scenario proxy.
- Use file uploads to attach supporting assumptions.

---

## 11) Revenue Model (Phase 4 — Database Ready)

**Status**
- Phase 4 installs `revenue_models` for storing assumptions.
- A Revenue Model UI is planned (Phase 4.x).

**Current workaround**
- Populate Project `revenue` for dashboard ROI.
- Attach spreadsheets and assumptions under File Uploads or Documents.

---

## 12) Risk Register (Phase 4 — Database Ready)

**Status**
- Phase 4 installs `risk_register`.
- A Risk Register UI is planned (Phase 4.x).

**Current workaround**
- Maintain risks as uploaded documents/spreadsheets.
- Summarize key risks in Legislative Briefs until the UI is available.

---

## 13) Meeting Brief Generator

### 13.1 Legislative Briefs
**Purpose**
- Generate and store a policy-ready draft brief for a project.

**Steps**
1. Open **Dashboards → Legislative Briefs**.
2. Choose a **Project**.
3. Optionally choose an **Organization**.
4. Optionally enter a **Title**.
5. Click **Generate Draft**.
6. Edit **Brief Text** as needed.
7. Click **Save Brief**.
8. To re-open a saved brief, click an entry under **Recent Saved Briefs**.

> Screenshot placeholder: Legislative Brief editor + saved list

---

## 14) Document Repository

### 14.1 Project documents
**Purpose**
- Store per-project documents in Supabase Storage under `documents/project/<project_id>/...`.

**Steps**
1. Open **Documents**.
2. Choose a **Project**.
3. Under **Upload**, select a file.
4. Wait for “Uploaded.”
5. To delete, click **Delete** next to a document.

> Screenshot placeholder: Documents (project picker + file list)

---

## 15) File Uploads (Planning Uploads)

### 15.1 Upload planning files
**Purpose**
- Upload GIS and supporting files and tag them to project/organization/county/district/utility.

**Supported file types**
- PDF, PNG, JPG/JPEG
- GeoJSON/JSON
- KML/KMZ
- Shapefile ZIP

**Steps**
1. Open **Planning Tools → File Uploads**.
2. (Optional) Choose **Project** and/or **Organization**.
3. (Optional) Fill in County, District, Utility, Notes.
4. Select a **File**.
5. Click **Upload**.

**Delete an upload**
- Click **Delete** next to a file.

> Screenshot placeholder: File Uploads form

---

## 16) Imported Layers (Reference GIS)

### 16.1 Import GIS files into read-only map overlays
**Purpose**
- Import external GIS layers into PostGIS for reference (not editable from the Map).

**Supported import types**
- GeoJSON, KML, KMZ, zipped shapefile (.zip)

**Steps**
1. Open **Planning Tools → Imported Layers**.
2. Enter **Layer name** (example: “FEMA Floodplain”).
3. Choose either:
   - **Import from existing upload**, or
   - **Or upload a new GIS file**
4. Click **Import Layer**.
5. Return to the **Map** sidebar to toggle the imported layer on/off.

**Performance guardrail**
- Imports are limited to 5000 features per layer for performance.

> Screenshot placeholder: Imported Layers import form

---

## 17) Map Overlays (PDF / Image Overlays)

### 17.1 Create a raster overlay
**Purpose**
- Place a PDF (first page) or image as a semi-transparent overlay on the map, then georeference it using corner coordinates.

**Steps (high level)**
1. Open **Planning Tools → Map Overlays**.
2. Create an overlay from an existing upload or a new file.
   - PDFs are automatically converted to a PNG of the first page.
3. Select the overlay and set its **corners** by clicking four points on the map.
4. Adjust opacity as needed.
5. Return to the **Map** sidebar to toggle overlay visibility.

> Screenshot placeholder: Map Overlays creation + corner placement

---

## 18) ROW Corridors

### 18.1 Create or edit a ROW corridor
**Purpose**
- Store right-of-way corridors (point/line/polygon) with metadata and map visibility toggles.

**Steps**
1. Open **Planning Tools → ROW Corridors**.
2. Draw a corridor geometry (point/line/polygon) using the draw tools.
3. Fill in:
   - Name
   - Corridor type
   - Corridor owner (optional)
   - Width (ft) (optional)
   - Source (optional)
   - Verification status (unverified/partial/verified)
   - Notes (optional)
4. Click **Save**.

**Visibility**
- Use the corridor list toggles to show/hide corridors on the map.

> Screenshot placeholder: ROW Corridors editor

---

## 19) Export Center

### 19.1 Dashboard exports
**Purpose**
- Download sharable data files for leadership/investor workflows.

**Exports available**
- Executive Summary JSON
- Investor Snapshot CSV

**Steps**
1. Open **Dashboards → Dashboard Exports**.
2. Click **Download JSON** or **Download CSV**.
3. If export persistence is enabled, the export is also uploaded to Supabase Storage (`planning_exports`).

> Screenshot placeholder: Dashboard Exports cards

### 19.2 Planning exports (coming online)
- **Planning Tools → Exports** currently describes the intended export set and is planned to become an export launcher + history screen.

---

## 20) Troubleshooting

### 20.1 “Load failed… Did you run supabase/phaseX.sql?”
- This usually means the database tables/RPC/policies for that module are not installed yet.
- Notify your admin to run the appropriate SQL migration (Phase 2/3/4).

### 20.2 I can’t see data my teammate created
- Data is user-scoped. Confirm you are using the same account or your admin has implemented shared/role-based access.

### 20.3 GeoJSON/KML import fails
- Confirm the file contains features.
- Split large files to stay under 5000 features.

### 20.4 Overlay says “(set corners)”
- The overlay exists, but its georeferencing corners are not yet set.
- Go to Map Overlays and place the four corners.

---

## 21) FAQ

**Q: What coordinate system is used?**
- GIS features are stored in WGS84 (EPSG:4326).

**Q: Can I export everything to share externally?**
- Map GeoJSON export is available now.
- Dashboard exports (JSON/CSV) are available now.
- Full planning export packs (PDFs, map renders) are planned.

**Q: Are imported layers editable?**
- No. Imported Layers are read-only reference overlays.
