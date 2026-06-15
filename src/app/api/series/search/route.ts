import { NextRequest } from "next/server";

const GOOGLE_BOOKS_BASE = "https://www.googleapis.com/books/v1";

interface SeriesHint { seriesName?: string; position?: number }

function fromSeriesInfo(info: Record<string, unknown>): SeriesHint {
  const si = info.seriesInfo as { shortSeriesBookTitle?: string; bookDisplayNumber?: string } | undefined;
  if (!si?.shortSeriesBookTitle || !si?.bookDisplayNumber) return {};
  const position = parseInt(si.bookDisplayNumber);
  return isNaN(position) ? {} : { seriesName: si.shortSeriesBookTitle.trim(), position };
}

function fromTitleRegex(title: string, subtitle?: string): SeriesHint {
  const full = subtitle ? `${title} ${subtitle}` : title;
  // Check parenthetical forms first — "(Series Name #N)" and "(Series Name, Book N)"
  // are the most reliable indicators of the actual series name vs. the book title.
  const parenHash = full.match(/\((.+?),?\s*#(\d+)\)/);
  if (parenHash) return { seriesName: parenHash[1].trim(), position: parseInt(parenHash[2]) };
  const parenBook = full.match(/\((.+?)\s+[Bb]ook\s+(\d+)\)/);
  if (parenBook) return { seriesName: parenBook[1].trim(), position: parseInt(parenBook[2]) };
  // Fallback: title starts directly with the series name followed by #N
  const hashMatch = full.match(/^(.+?)\s*#(\d+)/);
  if (hashMatch) return { seriesName: hashMatch[1].trim(), position: parseInt(hashMatch[2]) };
  return {};
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") || "";
  if (q.trim().length < 2) return Response.json({ series: [] });

  const apiKey = process.env.GOOGLE_BOOKS_API_KEY || "";
  const keyParam = apiKey ? `&key=${apiKey}` : "";
  const qLower = q.trim().toLowerCase();

  const seriesMap = new Map<string, { author: string; maxPosition: number; coverUrl?: string }>();

  // Track prefix-match groups (for series like Harry Potter where titles have no #N)
  const prefixGroups = new Map<string, { author: string; coverUrl?: string; count: number }>();

  try {
    const res = await fetch(
      `${GOOGLE_BOOKS_BASE}/volumes?q=${encodeURIComponent(q)}&maxResults=40&printType=books${keyParam}`
    );
    if (!res.ok) throw new Error(`GB ${res.status}`);

    const data = await res.json();
    for (const item of data.items || []) {
      const info = item.volumeInfo;
      if (!info) continue;

      const coverUrl = info.imageLinks?.thumbnail?.replace("http://", "https://");
      const author = (info.authors || ["Unknown"])[0];

      // Strategy 1: explicit series markers (#N, "Book N" in parens, seriesInfo field)
      const { seriesName, position } = { ...fromTitleRegex(info.title, info.subtitle), ...fromSeriesInfo(info) };
      if (seriesName && position) {
        const existing = seriesMap.get(seriesName);
        if (!existing || position > existing.maxPosition) {
          seriesMap.set(seriesName, {
            author,
            maxPosition: position,
            coverUrl: coverUrl || existing?.coverUrl,
          });
        }
      }

      // Strategy 2: title-prefix grouping — e.g. searching "harry potter" and all results
      // start with "Harry Potter". Group them as an implicit series named after the query.
      if (info.title?.toLowerCase().startsWith(qLower)) {
        // Use proper casing from the first matching title
        const key = info.title.slice(0, q.trim().length);
        const existing = prefixGroups.get(key);
        prefixGroups.set(key, {
          author: existing?.author || author,
          coverUrl: existing?.coverUrl || coverUrl,
          count: (existing?.count || 0) + 1,
        });
      }
    }

    // Promote prefix groups that aren't already covered by explicit series markers
    for (const [name, pg] of prefixGroups) {
      if (pg.count < 2) continue;
      // Skip if an explicit series already covers this query (case-insensitive)
      const alreadyCovered = Array.from(seriesMap.keys()).some(
        k => k.toLowerCase().includes(qLower) || qLower.includes(k.toLowerCase())
      );
      if (!alreadyCovered) {
        seriesMap.set(name, {
          author: pg.author,
          maxPosition: pg.count,
          coverUrl: pg.coverUrl,
        });
      }
    }
  } catch {
    // Google Books failed (quota, network, etc.) — fall through to Open Library
  }

  // Open Library fallback
  if (seriesMap.size === 0) {
    try {
      const res = await fetch(
        `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&fields=title,author_name,cover_i&limit=20`
      );
      if (res.ok) {
        const data = await res.json();
        const olPrefixGroups = new Map<string, { author: string; coverUrl?: string; count: number }>();

        for (const doc of data.docs || []) {
          const title = doc.title || "";
          // Explicit markers
          const { seriesName, position } = fromTitleRegex(title);
          if (seriesName && position) {
            const existing = seriesMap.get(seriesName);
            const coverUrl = doc.cover_i
              ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
              : undefined;
            if (!existing || position > existing.maxPosition) {
              seriesMap.set(seriesName, {
                author: (doc.author_name || ["Unknown"])[0],
                maxPosition: position,
                coverUrl: coverUrl || existing?.coverUrl,
              });
            }
          }
          // Prefix groups
          if (title.toLowerCase().startsWith(qLower)) {
            const key = title.slice(0, q.trim().length);
            const existing = olPrefixGroups.get(key);
            olPrefixGroups.set(key, {
              author: existing?.author || (doc.author_name || ["Unknown"])[0],
              coverUrl: existing?.coverUrl || (doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : undefined),
              count: (existing?.count || 0) + 1,
            });
          }
        }

        // Promote OL prefix groups if still nothing
        if (seriesMap.size === 0) {
          for (const [name, pg] of olPrefixGroups) {
            if (pg.count >= 2) {
              seriesMap.set(name, { author: pg.author, maxPosition: pg.count, coverUrl: pg.coverUrl });
            }
          }
        }
      }
    } catch { /* ignore */ }
  }

  const series = Array.from(seriesMap.entries())
    .map(([name, info]) => ({
      name,
      author: info.author,
      total_known: info.maxPosition,
      cover_url: info.coverUrl,
    }))
    .sort((a, b) => {
      const aMatch = a.name.toLowerCase().includes(qLower) ? 1 : 0;
      const bMatch = b.name.toLowerCase().includes(qLower) ? 1 : 0;
      return bMatch - aMatch;
    })
    .slice(0, 6);

  return Response.json({ series });
}
