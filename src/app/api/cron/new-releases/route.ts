import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { checkForNewRelease } from "@/lib/claude";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Validate cron secret (Vercel sends this automatically)
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ skipped: "No API key" });
  }

  const db = supabaseAdmin();

  // Get all unique series being tracked
  const { data: series } = await db
    .from("books")
    .select("series_name, author, total_in_series")
    .not("series_name", "is", null)
    .order("series_name");

  if (!series || series.length === 0) {
    return Response.json({ checked: 0 });
  }

  // Deduplicate by series name
  const uniqueSeries = new Map<
    string,
    { series_name: string; author: string; max_books: number }
  >();
  for (const row of series) {
    const existing = uniqueSeries.get(row.series_name);
    if (!existing || (row.total_in_series || 0) > existing.max_books) {
      uniqueSeries.set(row.series_name, {
        series_name: row.series_name,
        author: row.author,
        max_books: row.total_in_series || 0,
      });
    }
  }

  let checked = 0;
  let alertsCreated = 0;

  for (const { series_name, author, max_books } of uniqueSeries.values()) {
    try {
      const result = await checkForNewRelease({
        seriesName: series_name,
        author,
        currentBookCount: max_books,
      });

      if (result?.has_more && result?.next_book) {
        // Check if alert already exists
        const { data: existing } = await db
          .from("release_alerts")
          .select("id")
          .eq("series_name", series_name)
          .eq("book_title", result.next_book.title || "Unknown")
          .single();

        if (!existing) {
          await db.from("release_alerts").insert({
            series_name,
            book_title: result.next_book.title || "New Book",
            author,
            release_info: result.next_book.release_info || null,
            seen: false,
          });
          alertsCreated++;
        }

        // Update total_in_series if we learned more
        if (result.total_known && result.total_known > max_books) {
          await db
            .from("books")
            .update({ total_in_series: result.total_known })
            .eq("series_name", series_name);
        }
      }

      checked++;
      // Small delay between Claude calls to avoid rate limits
      await new Promise((r) => setTimeout(r, 500));
    } catch {
      // Continue on error for individual series
    }
  }

  return Response.json({ checked, alertsCreated });
}
