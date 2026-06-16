import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { levelFor } from "@/lib/theme";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!process.env.PARENT_PIN) {
    return Response.json({ error: "Parent PIN is not configured" }, { status: 500 });
  }

  const { profileId, pin } = await request.json();
  if (!profileId || !pin) {
    return Response.json({ error: "Missing profileId or pin" }, { status: 400 });
  }

  if (pin !== process.env.PARENT_PIN) {
    return Response.json({ error: "Incorrect PIN" }, { status: 401 });
  }

  const db = supabaseAdmin();

  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("id, approved_level")
    .eq("id", profileId)
    .single();
  if (profileError || !profile) {
    return Response.json({ error: "Profile not found" }, { status: 404 });
  }

  const { count } = await db
    .from("reading_records")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profileId)
    .eq("liked", true);

  const eligibleLevel = levelFor(count || 0).level;
  if (eligibleLevel <= profile.approved_level) {
    return Response.json({ error: "No level-up available yet" }, { status: 400 });
  }

  const { data: updated, error: updateError } = await db
    .from("profiles")
    .update({ approved_level: eligibleLevel })
    .eq("id", profileId)
    .select()
    .single();
  if (updateError || !updated) {
    return Response.json({ error: "Failed to approve level" }, { status: 500 });
  }

  return Response.json({ profile: updated });
}
