# RGV Water GIS Command Center — Admin Manual

This manual is for administrators who deploy, secure, and operate the RGV Water GIS Command Center.

---

## 1) System Requirements

### 1.1 Accounts / services
- **Supabase** project (Auth + Postgres + Storage)
- **Vercel** (recommended) or another Next.js hosting provider
- **GitHub** repo for source control

### 1.2 Local tooling (for development)
- Node.js (LTS recommended)
- npm

---

## 2) Initial Setup (Supabase)

> Supabase UI labels evolve; treat the steps below as “click-by-click intent,” not exact pixel-perfect names.

### 2.1 Create a Supabase project
1. In Supabase, create a new project.
2. Save the project’s database password in a secure location.

### 2.2 Enable PostGIS
- The SQL migrations include `create extension if not exists postgis;`.
- If your Supabase plan restricts extensions, enable PostGIS from the Supabase Database extensions UI.

### 2.3 Run database migrations (required)
The application expects tables, views, functions, RLS, and storage policies from the SQL files.

Run these in order in Supabase SQL Editor:
1. `supabase/schema.sql`
2. `supabase/phase2.sql`
3. `supabase/phase3.sql`
4. `supabase/phase4.sql`

**Why order matters**
- Later phases assume earlier tables/functions exist.
- Phase 3 and Phase 4 add tables and RPC functions used by planning tools and dashboards.

### 2.4 Storage buckets and policies
The SQL migrations create the buckets and policies the app relies on.

Buckets used:
- `documents` (project documents)
- `planning_uploads` (general uploads)
- `planning_exports` (export artifacts)

**Operational note**
- Supabase Storage is controlled via policies on `storage.objects`; you should not directly alter system schemas.

---

## 3) Authentication and User Management

### 3.1 Enable Email auth
1. In Supabase Auth settings, enable the **Email** provider.
2. Decide whether to require email confirmation.
   - For internal pilots, many teams disable confirmation.
   - For production, confirmation is recommended.

### 3.2 Create users
Options:
- Self-service sign-up (users register through the app).
- Admin-invited users (depends on your Supabase Auth configuration).

### 3.3 Roles and permissions (current state)
**Current behavior**
- The app uses a user-scoped ownership model: `owner_id = auth.uid()`.
- There is no multi-role RBAC in the current UI.

**Implication**
- Users do not automatically share projects/features with each other.

**Recommended admin guidance**
- For shared demos, use a shared “team” login.
- For true collaboration, plan Phase 5 (organization + roles) changes.

---

## 4) Environment Variables

Set these environment variables in your hosting provider and in local `.env.local`.

Required:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Recommended:
- `NEXT_PUBLIC_MAP_STYLE_URL` (defaults to a public basemap style if not set)

Optional (seed script only):
- `SEED_USER_EMAIL`
- `SEED_USER_PASSWORD`

Example (see `.env.example`):
- `NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY`

---

## 5) Deployments

### 5.1 GitHub setup
1. Create a private GitHub repository.
2. Push this codebase.
3. Protect the main branch and enable PR reviews (recommended).

### 5.2 Vercel deployment (recommended)
1. In Vercel, **Add New Project**.
2. Import the GitHub repo.
3. Configure environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_MAP_STYLE_URL` (optional)
4. Build settings:
   - Build command: `npm run build`
   - Output: Next.js default
5. Deploy.

### 5.3 Non-Vercel hosting
The app is a standard Next.js App Router project.

Required commands:
- Install: `npm install`
- Build: `npm run build`
- Run: `npm run start`

---

## 6) Operations

### 6.1 Backups
**Supabase-managed backups**
- Use Supabase’s built-in backups (plan-dependent).

**External backups (recommended for production)**
- Periodically run `pg_dump` against the Supabase Postgres connection string.
- Store dumps securely (encrypted, access-controlled).

### 6.2 Restore
- Restores should be tested on a staging Supabase project first.
- Apply schema migrations after restore if needed (especially if restoring partial data).

### 6.3 Monitoring
**Vercel**
- Use deployment logs and runtime logs for Next.js errors.

**Supabase**
- Monitor Postgres health, API errors, and Auth logs.
- Check Storage errors if uploads/exports fail.

---

## 7) Module Readiness Checklist

Use this checklist when a user reports “Load failed… Did you run supabase/phaseX.sql?”

### 7.1 Phase 1 (Core Map)
- `supabase/schema.sql` executed.
- PostGIS enabled.

### 7.2 Phase 2 (Projects/CRM/Funding/Documents)
- `supabase/phase2.sql` executed.
- Storage bucket `documents` exists with policies.

### 7.3 Phase 3 (Planning Tools)
- `supabase/phase3.sql` executed.
- Storage buckets `planning_uploads` and `planning_exports` exist with policies.

### 7.4 Phase 4 (Dashboards)
- `supabase/phase4.sql` executed.
- `meeting_briefs` exists for Legislative Briefs saves.
- `export_history` exists for persisted export logging.

---

## 8) Troubleshooting Playbook

### 8.1 Supabase error: `42P13 input parameters after one with a default value must also have defaults`
**Meaning**
- In Postgres function definitions: once a parameter has a default, all parameters after it must also have defaults.

**Fix**
- Update function signatures so required parameters appear before any defaulted parameters, or ensure all trailing parameters have defaults.

### 8.2 “Imported layers failed to load… Run supabase/phase3.sql”
- Confirm `imported_layers` / `imported_geometries` tables exist.
- Confirm RPC functions exist:
  - `insert_imported_geometry`
  - `get_imported_layer_geojson`

### 8.3 Upload fails (planning uploads / exports)
- Confirm bucket exists (`planning_uploads` or `planning_exports`).
- Confirm Storage policies allow authenticated uploads.
- Confirm the user is logged in (no anonymous uploads).

### 8.4 Documents upload fails
- Confirm bucket `documents` exists.
- Confirm policies allow authenticated uploads.

### 8.5 Dashboards “Load failed… did you run phase2/phase3?”
- Executive/Investor dashboards read from:
  - `projects` (Phase 2)
  - `route_cost_estimates` (Phase 3)
- Confirm those are installed.

---

## 9) Security Guidance

### 9.1 Data isolation
- RLS policies are owner-scoped.
- Never disable RLS in production.

### 9.2 Secrets
- Do not commit `.env.local`.
- Only expose the Supabase **anon** key to the client.

### 9.3 Least privilege
- Use the anon key for client access.
- Restrict service role keys to server-only contexts (not currently required for this app’s client-driven flows).

---

## 10) Maintenance and Upgrades

### 10.1 Upgrading the app
1. Pull the latest code.
2. Run `npm install`.
3. Run `npm run build`.
4. Apply any new SQL migrations to Supabase before deploying if schema changed.

### 10.2 Upgrading schema
- Always apply schema changes additively when possible.
- Validate RLS policies after changes.

---

## 11) Seed Data (Optional)

The repo includes scripts for starter data.

### 11.1 Configure seed user
Set:
- `SEED_USER_EMAIL`
- `SEED_USER_PASSWORD`

These should match a real Supabase Auth user.

### 11.2 Run seed
- Add: `npm run seed:up`
- Remove: `npm run seed:down`

---

## 12) Admin FAQ

**Q: Why can’t users see each other’s data?**
- Owner-scoped RLS. Multi-user sharing is planned as a future phase.

**Q: Can we integrate SSO?**
- Possible via Supabase Auth providers; not required by the current app.

**Q: Where are the migrations?**
- `supabase/schema.sql`, `supabase/phase2.sql`, `supabase/phase3.sql`, `supabase/phase4.sql`.
