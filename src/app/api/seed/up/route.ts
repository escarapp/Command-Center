import { NextResponse } from "next/server";
import { SEED_FEATURES } from "@/lib/seed-features";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, count: SEED_FEATURES.length });
}
