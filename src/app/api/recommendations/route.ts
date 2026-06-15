import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { getBookRecommendations } from "@/lib/claude";

export async function POST(request: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 503 }
    );
  }

  const { profileId } = await request.json();
  if (!profileId) {
    return Response.json({ error: "profileId required" }, { status: 400 });
  }

  // Get profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", profileId)
    .single();
  if (!profile) {
    return Response.json({ error: "Profile not found" }, { status: 404 });
  }

  // Check for fresh cached recommendations (< 7 days)
  const { data: cached } = await supabase
    .from("recommendations")
    .select("*")
    .eq("profile_id", profileId)
    .eq("dismissed", false)
    .gt(
      "created_at",
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    )
    .order("created_at", { ascending: false })
    .limit(6);

  if (cached && cached.length >= 4) {
    return Response.json({ recommendations: cached, cached: true });
  }

  // Fetch liked books
  const { data: records } = await supabase
    .from("reading_records")
    .select("liked, book:books(title, author, series_name)")
    .eq("profile_id", profileId)
    .eq("liked", true)
    .order("read_at", { ascending: false })
    .limit(20);

  if (!records || records.length === 0) {
    return Response.json({ recommendations: [], cached: false });
  }

  const likedBooks = (records as unknown as { liked: boolean; book: { title: string; author: string; series_name?: string | null } }[]).map((r) => {
    return { title: r.book.title, author: r.book.author, series: r.book.series_name };
  });

  try {
    const recs = await getBookRecommendations({
      profileName: profile.name,
      likedBooks,
    });

    // Save to cache
    if (recs.length > 0) {
      // Clear old recs first
      await supabase
        .from("recommendations")
        .delete()
        .eq("profile_id", profileId);

      const toInsert = recs.map(
        (r: {
          title: string;
          author?: string;
          series_name?: string;
          reason?: string;
        }) => ({
          profile_id: profileId,
          book_title: r.title,
          book_author: r.author || null,
          reason: r.reason || null,
          based_on_titles: likedBooks.slice(0, 5).map((b) => b.title),
          dismissed: false,
        })
      );

      await supabase.from("recommendations").insert(toInsert);
    }

    return Response.json({ recommendations: recs, cached: false });
  } catch {
    return Response.json(
      { error: "Could not generate recommendations" },
      { status: 500 }
    );
  }
}
