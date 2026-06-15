import type { BookSearchResult } from "./types";

const GOOGLE_BOOKS_BASE = "https://www.googleapis.com/books/v1";
const OPEN_LIBRARY_BASE = "https://openlibrary.org";

function extractSeriesInfo(title: string): {
  cleanTitle: string;
  seriesName?: string;
  position?: number;
} {
  // "Dragon Masters #1: Rise of the Earth Dragon"
  const hashPattern = /^(.+?)\s*#(\d+)(?::\s*(.+))?$/;
  const hashMatch = title.match(hashPattern);
  if (hashMatch) {
    return {
      cleanTitle: (hashMatch[3] || hashMatch[1]).trim(),
      seriesName: hashMatch[1].trim(),
      position: parseInt(hashMatch[2]),
    };
  }

  // "Title (Series Name, #3)"
  const parenPattern = /^(.+?)\s*\((.+?),?\s*#(\d+)\)$/;
  const parenMatch = title.match(parenPattern);
  if (parenMatch) {
    return {
      cleanTitle: parenMatch[1].trim(),
      seriesName: parenMatch[2].trim(),
      position: parseInt(parenMatch[3]),
    };
  }

  return { cleanTitle: title };
}

export async function searchBooks(query: string): Promise<BookSearchResult[]> {
  const results: BookSearchResult[] = [];

  try {
    const apiKey = process.env.GOOGLE_BOOKS_API_KEY || "";
    const keyParam = apiKey ? `&key=${apiKey}` : "";
    const res = await fetch(
      `${GOOGLE_BOOKS_BASE}/volumes?q=${encodeURIComponent(query)}&maxResults=15&printType=books${keyParam}`,
      { next: { revalidate: 3600 } }
    );

    if (res.ok) {
      const data = await res.json();
      for (const item of data.items || []) {
        const info = item.volumeInfo;
        if (!info) continue;

        const { cleanTitle, seriesName: regexSeries, position: regexPos } = extractSeriesInfo(
          info.title || ""
        );
        // Prefer Google Books' first-class seriesInfo over title regex
        const si = info.seriesInfo as { shortSeriesBookTitle?: string; bookDisplayNumber?: string } | undefined;
        const seriesName  = si?.shortSeriesBookTitle?.trim() || regexSeries;
        const position    = (si?.bookDisplayNumber ? parseInt(si.bookDisplayNumber) : undefined) ?? regexPos;

        const coverUrl = info.imageLinks?.thumbnail?.replace("http://", "https://");

        results.push({
          title: cleanTitle,
          author: (info.authors || ["Unknown"]).join(", "),
          cover_url: coverUrl,
          isbn:
            info.industryIdentifiers?.find(
              (id: { type: string; identifier: string }) =>
                id.type === "ISBN_13"
            )?.identifier ||
            info.industryIdentifiers?.find(
              (id: { type: string; identifier: string }) =>
                id.type === "ISBN_10"
            )?.identifier,
          series_name: seriesName,
          series_position: position,
          description: info.description?.slice(0, 500),
          google_books_id: item.id,
        });
      }
    }
  } catch {
    // fall through to Open Library
  }

  if (results.length >= 5) return results.slice(0, 15);

  try {
    const res = await fetch(
      `${OPEN_LIBRARY_BASE}/search.json?q=${encodeURIComponent(query)}&fields=key,title,author_name,cover_i,isbn&limit=10`,
      { next: { revalidate: 3600 } }
    );
    if (res.ok) {
      const data = await res.json();
      for (const doc of data.docs || []) {
        const { cleanTitle, seriesName, position } = extractSeriesInfo(
          doc.title || ""
        );
        results.push({
          title: cleanTitle,
          author: (doc.author_name || ["Unknown"]).join(", "),
          cover_url: doc.cover_i
            ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
            : undefined,
          isbn: doc.isbn?.[0],
          series_name: seriesName,
          series_position: position,
          open_library_id: doc.key,
        });
      }
    }
  } catch {
    // ignore
  }

  return results.slice(0, 15);
}

export function groupBySeries(
  records: {
    id: string;
    book_id: string;
    liked: boolean;
    read_at: string;
    book: import("./types").Book;
  }[]
) {
  const seriesMap = new Map<
    string,
    {
      series_name: string;
      author: string;
      books: (import("./types").Book & {
        liked: boolean;
        read_at: string;
        record_id: string;
      })[];
      max_position: number;
      total_known: number;
    }
  >();

  for (const record of records) {
    const book = record.book;
    const key = book.series_name || "__standalone__";

    if (!seriesMap.has(key)) {
      seriesMap.set(key, {
        series_name: key === "__standalone__" ? "One-offs" : key,
        author: book.author,
        books: [],
        max_position: 0,
        total_known: book.total_in_series || 0,
      });
    }

    const group = seriesMap.get(key)!;
    group.books.push({
      ...book,
      liked: record.liked,
      read_at: record.read_at,
      record_id: record.id,
    });

    if (book.series_position && book.series_position > group.max_position) {
      group.max_position = book.series_position;
    }
    if (book.total_in_series && book.total_in_series > group.total_known) {
      group.total_known = book.total_in_series;
    }
  }

  for (const group of seriesMap.values()) {
    group.books.sort(
      (a, b) => (a.series_position || 0) - (b.series_position || 0)
    );
  }

  return Array.from(seriesMap.values()).sort((a, b) => {
    if (a.series_name === "One-offs") return 1;
    if (b.series_name === "One-offs") return -1;
    return b.books.length - a.books.length;
  });
}
