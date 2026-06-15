import { NextRequest } from "next/server";
import { searchBooks } from "@/lib/books";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") || "";
  if (q.trim().length < 2) {
    return Response.json({ results: [] });
  }

  try {
    const results = await searchBooks(q.trim());
    return Response.json({ results });
  } catch {
    return Response.json({ results: [], error: "Search failed" }, { status: 500 });
  }
}
