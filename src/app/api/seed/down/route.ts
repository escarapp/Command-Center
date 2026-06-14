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
    const { error } = await supabase.rpc("delete_gis_feature", {
      p_external_id: feature.external_id,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, count: SEED_FEATURES.length });
}
