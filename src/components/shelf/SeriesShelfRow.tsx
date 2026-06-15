"use client";
import { useRef } from "react";
import { ChevronRight } from "lucide-react";
import { BookCoverCard } from "./BookCoverCard";
import { SeriesTitleCard } from "./SeriesTitleCard";
import type { BookState } from "@/lib/theme";
import type { SeriesGroup, BookWithRecord } from "@/lib/types";

/**
 * State derivation — business logic that belongs in this layer.
 * The first unread book in a series that already has completed books
 * is considered "reading". All others are "unread" or "completed".
 */
function stateOf(book: BookWithRecord, group: SeriesGroup): BookState {
  if (book.liked) return "completed";
  const hasCompleted = group.books.some((b) => b.liked);
  if (hasCompleted) {
    const firstUnread = [...group.books]
      .sort((a, b) => (a.series_position ?? 0) - (b.series_position ?? 0))
      .find((b) => !b.liked);
    if (firstUnread?.id === book.id) return "reading";
  }
  return "unread";
}

// Row height in px — tall enough for a reading book (138px) + stars (16px) + breathing room
const ROW_H = 164;

interface Props {
  group:       SeriesGroup;
  onBookClick: (book: BookWithRecord) => void;
}

export function SeriesShelfRow({ group, onBookClick }: Props) {
  // themeIndex removed: paletteFor() in SeriesTitleCard derives colour from the series name
  const scrollRef  = useRef<HTMLDivElement>(null);
  const isOneOff   = group.series_name === "One-offs";
  const readCount  = group.books.filter((b) => b.liked).length;

  return (
    <div className="flex flex-col">
      {/* Books + title card */}
      <div className="flex gap-3 items-end px-3">

        {isOneOff ? (
          <div className="flex-shrink-0 flex items-end pb-5 opacity-30" style={{ width: 128 }}>
            <span className="text-white text-xs font-bold uppercase tracking-wider px-1">
              📖 Standalone
            </span>
          </div>
        ) : (
          <SeriesTitleCard
            name={group.series_name}
            author={group.author}
            bookCount={group.books.length}
            readCount={readCount}
            height={ROW_H}
          />
        )}

        {/* Horizontally scrollable books */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-x-auto no-scrollbar relative"
          style={{ height: ROW_H }}
        >
          <div className="flex gap-3 items-end h-full pr-6" style={{ minWidth: "max-content" }}>
            {group.books.map((book) => (
              <BookCoverCard
                key={book.id}
                book={book}
                state={stateOf(book, group)}
                onClick={onBookClick}
              />
            ))}
          </div>

          {/* Fade + scroll hint */}
          {group.books.length > 5 && (
            <div
              className="absolute right-0 top-0 bottom-0 w-10 flex items-center justify-end pointer-events-none"
              style={{ background: "linear-gradient(to right, transparent, #120800dd)" }}
            >
              <ChevronRight size={18} className="text-white/25 mr-1 flex-shrink-0" />
            </div>
          )}
        </div>
      </div>

      {/* Dark shelf plank sits below the books */}
      <div className="mx-3 shelf-plank-dark" />
    </div>
  );
}
