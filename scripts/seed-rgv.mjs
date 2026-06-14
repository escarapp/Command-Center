import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

const mode = process.argv[2];

if (!mode || !["up", "down"].includes(mode)) {
  console.error("Usage: node scripts/seed-rgv.mjs <up|down>");
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const seedEmail = process.env.SEED_USER_EMAIL;
const seedPassword = process.env.SEED_USER_PASSWORD;

const missing = [
  ["NEXT_PUBLIC_SUPABASE_URL", supabaseUrl],
  ["NEXT_PUBLIC_SUPABASE_ANON_KEY", supabaseAnonKey],
  ["SEED_USER_EMAIL", seedEmail],
  ["SEED_USER_PASSWORD", seedPassword],
].filter(([, value]) => !value).map(([key]) => key);

if (missing.length > 0) {
  console.error(`Missing env vars: ${missing.join(", ")}`);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const SEED_FEATURES = [
  {
    external_id: "95b43d5a-0fb5-4581-ae3a-6a85ec9ce101",
    layer_key: "desal_plant",
    title: "RGV Desal Plant Candidate",
    notes: "Seed data for initial planning. Replace with confirmed project site.",
    priority: "high",
    contact_name: "Planning Office",
    contact_phone: "956-555-0101",
    contact_email: "planning@rgvwater.local",
    source_url: "https://seed.rgv.local/desal-plant",
    geometry: {
      type: "Point",
      coordinates: [-97.4705, 25.9575],
    },
  },
  {
    external_id: "95b43d5a-0fb5-4581-ae3a-6a85ec9ce102",
    layer_key: "intake_outfall",
    title: "Intake/Outfall Reference",
    notes: "Seed intake/outfall location near ship channel.",
    priority: "medium",
    contact_name: "Marine Ops",
    contact_phone: "956-555-0102",
    contact_email: "marine@rgvwater.local",
    source_url: "https://seed.rgv.local/intake-outfall",
    geometry: {
      type: "Point",
      coordinates: [-97.4013, 25.9609],
    },
  },
  {
    external_id: "95b43d5a-0fb5-4581-ae3a-6a85ec9ce103",
    layer_key: "proposed_pipeline",
    title: "Concept Pipeline A",
    notes: "Seed alignment for early-distance testing.",
    priority: "high",
    contact_name: "Pipeline Team",
    contact_phone: "956-555-0103",
    contact_email: "pipeline@rgvwater.local",
    source_url: "https://seed.rgv.local/proposed-pipeline",
    geometry: {
      type: "LineString",
      coordinates: [
        [-97.4705, 25.9575],
        [-97.3747, 26.0715],
        [-97.2672, 26.2062],
      ],
    },
  },
  {
    external_id: "95b43d5a-0fb5-4581-ae3a-6a85ec9ce104",
    layer_key: "utilities",
    title: "Utility Corridor Segment",
    notes: "Seed utility crossing corridor.",
    priority: "medium",
    contact_name: "Utilities Desk",
    contact_phone: "956-555-0104",
    contact_email: "utilities@rgvwater.local",
    source_url: "https://seed.rgv.local/utilities",
    geometry: {
      type: "LineString",
      coordinates: [
        [-97.5291, 26.1302],
        [-97.4011, 26.1888],
      ],
    },
  },
  {
    external_id: "95b43d5a-0fb5-4581-ae3a-6a85ec9ce105",
    layer_key: "water_supply_corp",
    title: "Water Supply Corp - North Sector",
    notes: "Seed WSC reference point.",
    priority: "medium",
    contact_name: "WSC Liaison",
    contact_phone: "956-555-0105",
    contact_email: "wsc@rgvwater.local",
    source_url: "https://seed.rgv.local/water-supply-corp",
    geometry: {
      type: "Point",
      coordinates: [-97.6872, 26.195],
    },
  },
  {
    external_id: "95b43d5a-0fb5-4581-ae3a-6a85ec9ce106",
    layer_key: "irrigation_district",
    title: "Irrigation District Reference",
    notes: "Seed irrigation district contact location.",
    priority: "low",
    contact_name: "Irrigation Ops",
    contact_phone: "956-555-0106",
    contact_email: "irrigation@rgvwater.local",
    source_url: "https://seed.rgv.local/irrigation-district",
    geometry: {
      type: "Point",
      coordinates: [-98.2358, 26.2016],
    },
  },
  {
    external_id: "95b43d5a-0fb5-4581-ae3a-6a85ec9ce107",
    layer_key: "drainage_district",
    title: "Drainage District Reference",
    notes: "Seed drainage district map point.",
    priority: "low",
    contact_name: "Drainage Office",
    contact_phone: "956-555-0107",
    contact_email: "drainage@rgvwater.local",
    source_url: "https://seed.rgv.local/drainage-district",
    geometry: {
      type: "Point",
      coordinates: [-97.9518, 26.1948],
    },
  },
  {
    external_id: "95b43d5a-0fb5-4581-ae3a-6a85ec9ce108",
    layer_key: "treatment_plant",
    title: "Treatment Plant Candidate",
    notes: "Seed treatment plant marker.",
    priority: "high",
    contact_name: "Treatment Ops",
    contact_phone: "956-555-0108",
    contact_email: "treatment@rgvwater.local",
    source_url: "https://seed.rgv.local/treatment-plant",
    geometry: {
      type: "Point",
      coordinates: [-98.2974, 26.1476],
    },
  },
  {
    external_id: "95b43d5a-0fb5-4581-ae3a-6a85ec9ce109",
    layer_key: "reservoir",
    title: "Reservoir Anchor",
    notes: "Seed reservoir reference for network planning.",
    priority: "medium",
    contact_name: "Reservoir Team",
    contact_phone: "956-555-0109",
    contact_email: "reservoir@rgvwater.local",
    source_url: "https://seed.rgv.local/reservoir",
    geometry: {
      type: "Point",
      coordinates: [-99.1394, 26.5625],
    },
  },
  {
    external_id: "95b43d5a-0fb5-4581-ae3a-6a85ec9ce110",
    layer_key: "connection_point",
    title: "Potential Connection Point Alpha",
    notes: "Seed interconnect concept point.",
    priority: "critical",
    contact_name: "Interconnect Lead",
    contact_phone: "956-555-0110",
    contact_email: "connections@rgvwater.local",
    source_url: "https://seed.rgv.local/connection-point",
    geometry: {
      type: "Point",
      coordinates: [-97.5045, 26.0864],
    },
  },
];

async function authenticate() {
  const { error } = await supabase.auth.signInWithPassword({
    email: seedEmail,
    password: seedPassword,
  });

  if (error) {
    throw new Error(`Auth failed: ${error.message}`);
  }
}

async function seedUp() {
  for (const feature of SEED_FEATURES) {
    const { error } = await supabase.rpc("upsert_gis_feature", {
      p_external_id: feature.external_id,
      p_layer_key: feature.layer_key,
      p_geometry: feature.geometry,
      p_title: feature.title,
      p_notes: feature.notes,
      p_priority: feature.priority,
      p_contact_name: feature.contact_name,
      p_contact_phone: feature.contact_phone,
      p_contact_email: feature.contact_email,
      p_source_url: feature.source_url,
    });

    if (error) {
      throw new Error(`Seed up failed for ${feature.title}: ${error.message}`);
    }
  }

  console.log(`Seed complete: ${SEED_FEATURES.length} feature(s) upserted.`);
}

async function seedDown() {
  for (const feature of SEED_FEATURES) {
    const { error } = await supabase.rpc("delete_gis_feature", {
      p_external_id: feature.external_id,
    });

    if (error) {
      throw new Error(`Seed down failed for ${feature.external_id}: ${error.message}`);
    }
  }

  console.log(`Seed removed: ${SEED_FEATURES.length} feature(s) deleted.`);
}

async function main() {
  await authenticate();

  if (mode === "up") {
    await seedUp();
  } else {
    await seedDown();
  }

  await supabase.auth.signOut();
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
