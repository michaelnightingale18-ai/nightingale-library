import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const GOOGLE_BOOKS_BASE = "https://www.googleapis.com/books/v1";

// ── Claude-powered series lookup ──────────────────────────────────────────────

interface ClaudeBook { position: number; title: string }

async function getSeriesFromClaude(seriesName: string, author: string): Promise<ClaudeBook[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === "sk-ant-...") return [];

  const client = new Anthropic({ apiKey });
  const authorHint = author ? ` by ${author}` : "";

  function parseBooks(text: string): ClaudeBook[] {
    const clean = text.replace(/^```[a-z]*\n?/i, "").replace(/```$/i, "").trim();
    const arrayMatch = clean.match(/\[[\s\S]*\]/);
    const parsed = JSON.parse(arrayMatch ? arrayMatch[0] : clean);
    return Array.isArray(parsed) ? parsed as ClaudeBook[] : [];
  }

  // Path A: web search (same capability as Claude Chat — finds newest books)
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tools: any[] = [{ type: "web_search_20250305", name: "web_search" }];
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      tools,
      messages: [{
        role: "user",
        content: `Search the web to find ALL currently published books in the "${seriesName}" series${authorHint} in publication order.
Only include main-series books (not box sets, companion guides, or spin-offs).
Respond ONLY with a JSON array (no markdown, no explanation):
[{"position": 1, "title": "Exact title"}, ...]`,
      }],
    });
    const textBlock = response.content.find((b) => b.type === "text");
    if (textBlock?.type === "text") {
      const books = parseBooks(textBlock.text);
      if (books.length > 0) return books;
    }
    console.error("[Claude web search] no text block or empty, stop_reason:", response.stop_reason);
  } catch (err) {
    console.error("[Claude web search failed]", err);
  }

  // Path B: training data only (reliable fallback — no web search needed)
  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      temperature: 0,
      messages: [{
        role: "user",
        content: `List all published books in the "${seriesName}" series${authorHint} in publication order.
Only include main-series books. Omit any you are not confident about.
Respond ONLY with a JSON array (no markdown):
[{"position": 1, "title": "Exact title"}, ...]`,
      }],
    });
    const text = response.content[0]?.type === "text" ? response.content[0].text : "[]";
    return parseBooks(text);
  } catch (err) {
    console.error("[Claude training data failed]", err);
    return [];
  }
}

// ── Google Books cover lookup ─────────────────────────────────────────────────

async function fetchCover(
  bookTitle: string,
  seriesName: string,
  gbKey: string
): Promise<{ coverUrl?: string; isbn?: string; googleId?: string }> {
  const keyParam = gbKey ? `&key=${gbKey}` : "";
  const bookPart = bookTitle
    .replace(new RegExp(`^${seriesName}\\s*#?\\d*\\s*:?\\s*`, "i"), "")
    .toLowerCase()
    .slice(0, 15);

  // Try Google Books first
  try {
    const q = `intitle:"${bookTitle.slice(0, 60)}"`;
    const res = await fetch(
      `${GOOGLE_BOOKS_BASE}/volumes?q=${encodeURIComponent(q)}&maxResults=5&printType=books${keyParam}`,
      { next: { revalidate: 86400 } }
    );
    if (res.ok) {
      const data = await res.json();
      for (const item of data.items || []) {
        const info = item.volumeInfo;
        if (!info?.title) continue;
        const tl = info.title.toLowerCase();
        if (
          !tl.includes(seriesName.toLowerCase().split(" ")[0].toLowerCase()) &&
          !tl.includes(bookPart)
        ) continue;
        if (info.imageLinks?.thumbnail) {
          return {
            coverUrl: info.imageLinks.thumbnail.replace("http://", "https://"),
            isbn: info.industryIdentifiers?.find(
              (id: { type: string; identifier: string }) => id.type === "ISBN_13"
            )?.identifier,
            googleId: item.id,
          };
        }
      }
    }
  } catch { /* fall through to OL */ }

  // Fallback: Open Library cover search — include series name to avoid wrong-book matches
  try {
    const q = `${seriesName} ${bookTitle}`.slice(0, 80);
    const res = await fetch(
      `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&fields=title,cover_i,isbn&limit=5`,
      { next: { revalidate: 86400 } }
    );
    if (res.ok) {
      const data = await res.json();
      // Only use a result if its title loosely matches (avoids completely wrong books)
      const seriesWord = seriesName.toLowerCase().split(" ")[0];
      const bookWord = bookPart.slice(0, 6);
      const doc = (data.docs || []).find((d: { title?: string; cover_i?: number }) => {
        const t = (d.title || "").toLowerCase();
        return d.cover_i && (t.includes(seriesWord) || t.includes(bookWord));
      });
      if (doc?.cover_i) {
        return {
          coverUrl: `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`,
          isbn: doc.isbn?.[0],
        };
      }
    }
  } catch { /* ignore */ }

  return {};
}

// ── Open Library fallback ─────────────────────────────────────────────────────

const OL_JUNK = [
  "(series)", "boxed set", "box set", "collection", "1-7", "1-6", "1-5", "1-4", "1-3", "1-2",
  "a history of magic", "wizarding almanac", "magical creatures", "schoolbooks",
  "fantastic beasts", "quidditch", "illustrated edition", "the illustrated",
  "complete set", "omnibus", "companion", "guide to", "guide for",
  "book series", "series set", "complete series", "books set",
];
const OL_JUNK_RE = /\[\d+\/\d+\]|\(\d+\s*books?\)/i;
// Non-English connector words that appear right after the series name in translations
const OL_TRANSLATION_RE = /^(y |e |et |und |og |i de |en |le |les |il |die |der |das )/;

function isLikelyTranslation(title: string, series: string): boolean {
  const tl = title.toLowerCase();
  const prefix = series.toLowerCase();
  if (!tl.startsWith(prefix)) return false;
  // Strip leading digits ("Harry Potter 1 und..." → "und...")
  const afterSeries = tl.slice(prefix.length).trim().replace(/^\d+\s*/, "");
  return OL_TRANSLATION_RE.test(afterSeries);
}

interface RawBook {
  title: string;
  author: string;
  cover_url?: string;
  isbn?: string;
  googleId?: string;
  position: number | null;
  publishedYear: number;
}

async function getSeriesFromOpenLibrary(series: string, author: string): Promise<RawBook[]> {
  try {
    const lastName = author.split(" ").slice(-1)[0];
    // Run two queries in parallel: one with author, one broader — dedupe after
    const [res1, res2] = await Promise.all([
      fetch(
        `https://openlibrary.org/search.json?q=${encodeURIComponent(`${series} ${lastName}`)}&fields=title,author_name,cover_i,first_publish_year&limit=100`,
        { next: { revalidate: 86400 } }
      ),
      fetch(
        `https://openlibrary.org/search.json?q=${encodeURIComponent(`"${series}"`)}&fields=title,author_name,cover_i,first_publish_year&limit=100`,
        { next: { revalidate: 86400 } }
      ),
    ]);

    const [d1, d2] = await Promise.all([
      res1.ok ? res1.json() : { docs: [] },
      res2.ok ? res2.json() : { docs: [] },
    ]);

    const seenTitles = new Set<string>();
    const allDocs = [...(d1.docs || []), ...(d2.docs || [])].filter((doc: { title?: string }) => {
      const key = (doc.title || "").toLowerCase().trim();
      if (seenTitles.has(key)) return false;
      seenTitles.add(key);
      return true;
    });

    const data = { docs: allDocs };
    const prefix = series.toLowerCase();
    const expectedLastName = author.split(" ").slice(-1)[0].toLowerCase();

    type OLDoc = { title?: string; author_name?: string[]; cover_i?: number; first_publish_year?: number };

    return (data.docs as OLDoc[] || [])
      .filter((doc) => {
        const tl = (doc.title || "").toLowerCase();
        if (!tl.includes(prefix.split(" ")[0])) return false;
        if (OL_JUNK.some((j) => tl.includes(j))) return false;
        if (OL_JUNK_RE.test(doc.title || "")) return false;
        // Filter non-ASCII (foreign scripts)
        if (/[^\x20-\x7E]/.test(doc.title || "")) return false;
        // Filter non-English translations (connector words right after the full series name)
        // Strip leading digits too: "Harry Potter 1 und..." → "und..."
        const afterSeries = tl.slice(prefix.length).trim().replace(/^\d+\s*/, "");
        if (OL_TRANSLATION_RE.test(afterSeries)) return false;
        // Filter if title is just the series name alone
        if (tl.trim() === prefix.trim()) return false;
        // Author must match
        if (expectedLastName) {
          const docAuthor = ((doc.author_name || [])[0] || "").toLowerCase();
          if (!docAuthor.includes(expectedLastName)) return false;
        }
        return true;
      })
      .map((doc) => ({
        title: doc.title || "",
        author: (doc.author_name || [author || "Unknown"])[0],
        cover_url: doc.cover_i
          ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
          : undefined,
        position: null,
        publishedYear: doc.first_publish_year || 9999,
      }));
  } catch {
    return [];
  }
}

// ── Google Books position-extraction fallback ─────────────────────────────────

function extractPosition(
  title: string,
  subtitle?: string,
  seriesInfo?: { bookDisplayNumber?: string },
  description?: string
): number | null {
  if (seriesInfo?.bookDisplayNumber) {
    const n = parseInt(seriesInfo.bookDisplayNumber);
    if (!isNaN(n)) return n;
  }
  const full = subtitle ? `${title} ${subtitle}` : title;
  const patterns = [
    /#(\d+)/,
    /[Bb]ook\s+(\d+)/,
    /[Vv]ol(?:ume)?\s*\.?\s*(\d+)/,
    /\(.*?#(\d+)\)/,
    /\(.*?[Bb]ook\s+(\d+)\)/,
  ];
  for (const p of patterns) {
    const m = full.match(p);
    if (m) return parseInt(m[1]);
  }
  if (description) {
    const ordinals: Record<string, number> = {
      first: 1, second: 2, third: 3, fourth: 4, fifth: 5,
      sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
    };
    const dl = description.toLowerCase();
    for (const [word, num] of Object.entries(ordinals)) {
      if (
        dl.includes(`${word} book`) ||
        dl.includes(`${word} novel`) ||
        dl.includes(`${word} installment`) ||
        dl.includes(`${word} volume`)
      )
        return num;
    }
    const m = dl.match(/book\s+(\d+)\s+(?:in|of)/);
    if (m) return parseInt(m[1]);
  }
  return null;
}

function deduplicateByTitle(books: RawBook[]): RawBook[] {
  const byTitle = new Map<string, RawBook>();
  for (const b of books) {
    const key = b.title.toLowerCase().replace(/\s+/g, " ").trim();
    const existing = byTitle.get(key);
    if (!existing || b.publishedYear < existing.publishedYear) {
      byTitle.set(key, b);
    }
  }
  return Array.from(byTitle.values());
}

async function getSeriesFromGoogleBooks(
  series: string,
  author: string,
  gbKey: string
): Promise<
  Map<
    number,
    Omit<RawBook, "position" | "publishedYear"> & {
      series_position: number;
      series_name: string;
      total_in_series?: number;
    }
  >
> {
  const keyParam = gbKey ? `&key=${gbKey}` : "";
  const lastName = author.split(" ").slice(-1)[0];
  const targeted = author ? `intitle:"${series}" inauthor:"${lastName}"` : `"${series}"`;
  // Paginate the targeted query (page 1 + page 2) so books 11-40 aren't cut off
  const queries = [
    { q: targeted, start: 0 },
    { q: targeted, start: 40 },
    { q: `"${series}" series`, start: 0 },
    { q: `"${series}" book`, start: 0 },
  ];

  const rawPool: RawBook[] = [];
  const seenIds = new Set<string>();

  for (const { q: query, start } of queries) {
    try {
      const res = await fetch(
        `${GOOGLE_BOOKS_BASE}/volumes?q=${encodeURIComponent(query)}&maxResults=40&startIndex=${start}&printType=books${keyParam}`,
        { cache: "no-store" }
      );
      if (!res.ok) { console.error(`[GB] query "${query}" start=${start} → ${res.status}`); continue; }
      const data = await res.json();

      for (const item of data.items || []) {
        if (seenIds.has(item.id)) continue;
        seenIds.add(item.id);
        const info = item.volumeInfo;
        if (!info) continue;

        const si = info.seriesInfo as
          | { shortSeriesBookTitle?: string; bookDisplayNumber?: string }
          | undefined;
        const seriesNameMatch =
          si?.shortSeriesBookTitle?.toLowerCase() === series.toLowerCase();
        const combined = `${info.title || ""} ${info.subtitle || ""}`.toLowerCase();
        const titleMatch = combined.includes(
          series.toLowerCase().split(" ")[0].toLowerCase()
        );
        if (!seriesNameMatch && !titleMatch) continue;
        if (info.title && isLikelyTranslation(info.title, series)) continue;

        const position = extractPosition(info.title, info.subtitle, si, info.description);
        const year = parseInt(info.publishedDate?.slice(0, 4) || "9999");
        // Prefer thumbnail; fall back to smallThumbnail; then construct from book ID
        const cover_url =
          info.imageLinks?.thumbnail?.replace("http://", "https://") ??
          info.imageLinks?.smallThumbnail?.replace("http://", "https://") ??
          undefined;
        const isbn = info.industryIdentifiers?.find(
          (id: { type: string; identifier: string }) => id.type === "ISBN_13"
        )?.identifier;

        rawPool.push({
          title: info.title,
          author: (info.authors || [author || "Unknown"])[0],
          cover_url,
          isbn,
          googleId: item.id,
          position,
          publishedYear: year,
        });
      }
    } catch { continue; }
  }

  // If Google Books gave nothing (quota exhausted etc.), try Open Library
  if (rawPool.length === 0) {
    const olBooks = await getSeriesFromOpenLibrary(series, author);
    rawPool.push(...olBooks);
  }

  const foundBooks = new Map<
    number,
    RawBook & { series_position: number; series_name: string; total_in_series?: number }
  >();

  // Add explicitly positioned books first
  for (const b of rawPool) {
    if (b.position != null && b.position > 0 && b.position <= 60 && !foundBooks.has(b.position)) {
      // Only strip "Series #N:" prefix patterns (requires a number)
      const stripped = b.title
        .replace(new RegExp(`^${series}\\s*#?\\d+\\s*:?\\s*`, "i"), "")
        .trim();
      const cleanTitle = stripped && stripped.length > 3 ? stripped : b.title;
      foundBooks.set(b.position, {
        ...b,
        title: cleanTitle,
        series_position: b.position,
        series_name: series,
      });
    }
  }

  // Date-order fallback for unpositioned books
  if (foundBooks.size < 3) {
    const unpositioned = deduplicateByTitle(
      rawPool.filter((b) => b.position == null && !isLikelyTranslation(b.title, series))
    );
    unpositioned.sort((a, b) => a.publishedYear - b.publishedYear);
    let nextPos = 1;
    for (const b of unpositioned) {
      while (foundBooks.has(nextPos) && nextPos <= 60) nextPos++;
      if (nextPos > 30) break;
      const stripped = b.title
        .replace(new RegExp(`^${series}\\s*#?\\d+\\s*:?\\s*`, "i"), "")
        .trim();
      const cleanTitle = stripped && stripped.length > 3 ? stripped : b.title;
      foundBooks.set(nextPos, {
        ...b,
        title: cleanTitle,
        series_position: nextPos,
        series_name: series,
      });
      nextPos++;
    }
  }

  return foundBooks;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const series = request.nextUrl.searchParams.get("series") || "";
  const author = request.nextUrl.searchParams.get("author") || "";

  if (!series) return Response.json({ books: [], total_discovered: 0 });

  const gbKey = process.env.GOOGLE_BOOKS_API_KEY || "";

  // Run Claude and Google Books in PARALLEL — merge results for best count + covers
  // Claude: authoritative titles, up-to-date count via web search
  // GB: authoritative covers + position markers (#N in titles), most complete book list
  const [claudeBooks, gbFoundBooks] = await Promise.all([
    getSeriesFromClaude(series, author),
    getSeriesFromGoogleBooks(series, author, gbKey),
  ]);
  console.log(`[expand] "${series}" — Claude: ${claudeBooks.length} books, GB: ${gbFoundBooks.size} positioned`);

  // Build merged position map — GB as the floor, Claude titles overlaid
  const merged = new Map<number, {
    title: string; author: string; cover_url?: string; isbn?: string;
  }>();

  // 1. Start with GB (positions + covers from #N markers or seriesInfo)
  for (const [pos, book] of gbFoundBooks) {
    merged.set(pos, {
      title: book.title,
      author: book.author || author || "Unknown",
      cover_url: book.cover_url,
      isbn: book.isbn,
    });
  }

  // 2. Overlay Claude titles (cleaner, no "Series #N:" prefix) where positions align
  for (const cb of claudeBooks) {
    if (cb.position > 0) {
      const existing = merged.get(cb.position);
      merged.set(cb.position, {
        title: cb.title,                          // prefer Claude's clean title
        author: existing?.author || author || "Unknown",
        cover_url: existing?.cover_url,           // keep GB's cover
        isbn: existing?.isbn,
      });
    }
  }

  // 3. If GB found nothing (series with no position markers and OL also empty),
  //    fall back to Claude titles with OL covers
  if (gbFoundBooks.size === 0 && claudeBooks.length > 0) {
    const olBooks = await getSeriesFromOpenLibrary(series, author);
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const olCoverMap = new Map<string, string>();
    for (const b of olBooks) {
      if (b.cover_url) olCoverMap.set(norm(b.title), b.cover_url);
    }
    const findOLCover = (title: string) => {
      const n = norm(title);
      if (olCoverMap.has(n)) return olCoverMap.get(n);
      for (const [key, url] of olCoverMap) {
        const s = n.length < key.length ? n : key;
        if (s.length >= 10 && (n.includes(key.slice(0, 12)) || key.includes(n.slice(0, 12)))) return url;
      }
      return undefined;
    };
    for (const cb of claudeBooks) {
      merged.set(cb.position, {
        title: cb.title,
        author: author || "Unknown",
        cover_url: findOLCover(cb.title),
      });
    }
  }

  // 4. Fill-in pass: for any position still missing a cover, do a targeted title search.
  //    Fan out in parallel so this adds minimal latency.
  if (gbKey && merged.size > 0) {
    const fills = Array.from(merged.entries())
      .filter(([, entry]) => !entry.cover_url)
      .map(async ([pos, entry]) => {
        const { coverUrl, isbn } = await fetchCover(entry.title, series, gbKey);
        if (coverUrl) {
          merged.set(pos, {
            ...entry,
            cover_url: coverUrl,
            isbn: entry.isbn || isbn,
          });
        }
      });
    await Promise.all(fills);
  }

  if (merged.size > 0) {
    const totalCount = Math.max(...merged.keys());
    const books = [];
    for (let i = 1; i <= totalCount; i++) {
      const entry = merged.get(i);
      books.push({
        title: entry?.title || `${series} #${i}`,
        author: entry?.author || author || "Unknown",
        cover_url: entry?.cover_url,
        series_name: series,
        series_position: i,
        total_in_series: totalCount,
      });
    }
    return Response.json({ books, total_discovered: totalCount });
  }

  // Last resort: nothing found from any source
  return Response.json({ books: [], total_discovered: 0 });
}
