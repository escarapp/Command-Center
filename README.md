# RGV Water GIS Command Center (Private v1)

Private Next.js + Supabase GIS dashboard for South Texas (RGV) route planning and infrastructure collaboration.

## Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS 4
- Supabase (Auth + Postgres)
- Supabase PostGIS for geometry storage
- MapLibre GL JS for interactive map
- Mapbox Draw for add/move/edit/delete map features
- Turf.js for route distance in miles
- GeoJSON + CSV export

## Implemented v1 Features

1. Login page with Supabase Auth (email/password signup + login)
2. Protected dashboard with full-screen RGV interactive map
3. Left sidebar layer controls
4. Dynamic layers (create/rename/recolor/delete in UI; stored in `gis_layers`)
5. Add, move, edit, delete points/lines on map
6. Draw pipeline routes as lines
7. Measure route distance in miles (for selected line)
8. Save all features to Supabase
9. Per-feature metadata:
	 - Notes
	 - Priority level
	 - Contact name
	 - Phone
	 - Email
	 - Source URL
10. Export data as GeoJSON and CSV
11. Clean architecture for future georeferencing/PDF/image upload/investor export phases

## Project Structure (Exactly Where Files Go)

```text
rgv-water-gis-command-center/
	.env.example
	README.md
	supabase/
		schema.sql
	src/
		middleware.ts
		app/
			globals.css
			layout.tsx
			page.tsx
			login/
				page.tsx
			dashboard/
				page.tsx
		components/
			dashboard-shell.tsx
			rgv-map.tsx
		lib/
			gis.ts
			gis-api.ts
			supabase/
				client.ts
				middleware.ts
				server.ts
		types/
			gis.ts
```

## Supabase Setup (Minimal Click Workflow)

You only need to perform these web steps once:

1. Create a Supabase project.
2. In Supabase SQL Editor, paste all SQL from `supabase/schema.sql` and run it.
3. In Authentication settings:
	 - Enable Email provider
	 - Optional: disable email confirmation if you want immediate login for testing
4. In Project Settings > API, copy:
	 - Project URL
	 - Anon public key

## Environment Variables

Copy `.env.example` to `.env.local` and fill values:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
NEXT_PUBLIC_MAP_STYLE_URL=https://basemaps.cartocdn.com/gl/positron-gl-style/style.json
# Optional (terminal seed script only):
SEED_USER_EMAIL=you@example.com
SEED_USER_PASSWORD=your-password
```

## Local Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## One-Click Starter Data (And Easy Removal)

In-app method (recommended):

1. Login to the dashboard.
2. Click `Load Starter Data` in the left sidebar.
3. When ready to remove sample data, click `Remove Starter Data`.

This requires no terminal and no extra credentials.

After you create your Supabase user account, put that same email/password in:

- `SEED_USER_EMAIL`
- `SEED_USER_PASSWORD`

Terminal method (optional): run one command to load starter data:

```bash
npm run seed:up
```

Then remove starter data with:

```bash
npm run seed:down
```

How cleanup works safely:

- Seed records use fixed internal IDs.
- `seed:down` deletes only those seed IDs for your account.
- Your non-seed records are not touched.

## How Data Is Saved

- Frontend calls RPC function `upsert_gis_feature(...)` for create/update.
- Frontend calls RPC function `delete_gis_feature(...)` for deletes.
- Frontend reads from view `gis_features_geojson`.
- Geometry is stored in PostGIS as `geometry(Geometry, 4326)`.

## Security Model (v1)

- Table uses Row Level Security (RLS).
- Users only see/edit/delete their own features (`owner_id = auth.uid()`).

## Future-Phase Ready Architecture

The code is separated so future phases can add:

- PDF/image upload + georeferencing pipeline
- Raster overlays and map calibration UX
- Investor/export bundles and static render pipelines
- Multi-role access and organization-level projects
- Additional geometry types (polygons, multipolygons)

Recommended future folders:

- `src/features/georeference/*`
- `src/features/uploads/*`
- `src/features/export/*`
- `src/features/projects/*`

## Notes

- This repo is configured as `"private": true` in `package.json`.
- Base map URL can be swapped with MapTiler or another style provider via `NEXT_PUBLIC_MAP_STYLE_URL`.
