"use client";
import { useRef } from "react";
import { ChevronRight } from "lucide-react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { BookCoverCard } from "./BookCoverCard";
import { SeriesTitleCard } from "./SeriesTitleCard";
import type { BookState } from "@/lib/theme";
import type { SeriesGroup, BookWithRecord } from "@/lib/types";

export function stateOf(book: BookWithRecord): BookState {
  if (book.liked) return "completed";
  if (book.currently_reading) return "reading";
  return "unread";
}

// Row height in px — tall enough for a reading book (138px) + stars (16px) + breathing room
const ROW_H = 164;

export function containerIdFor(seriesName: string) {
  return `container::${seriesName}`;
}

interface Props {
  group:       SeriesGroup;
  arrangeMode: boolean;
  onBookClick: (book: BookWithRecord) => void;
  onTitleClick: (group: SeriesGroup) => void;
}

export function SeriesShelfRow({ group, arrangeMode, onBookClick, onTitleClick }: Props) {
  const scrollRef  = useRef<HTMLDivElement>(null);
  const isOneOff   = group.series_name === "One-offs";
  const readCount  = group.books.filter((b) => b.liked).length;

  const { setNodeRef, isOver } = useDroppable({
    id: containerIdFor(group.series_name),
    data: { containerId: group.series_name, isContainer: true },
    disabled: !arrangeMode,
  });

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
          <button onClick={() => onTitleClick(group)} className="text-left">
            <SeriesTitleCard
              name={group.series_name}
              author={group.author}
              bookCount={group.books.length}
              readCount={readCount}
              height={ROW_H}
            />
          </button>
        )}

        {/* Horizontally scrollable + droppable books row */}
        <div
          ref={(el) => { scrollRef.current = el; setNodeRef(el); }}
          className="flex-1 overflow-x-auto no-scrollbar relative transition-all duration-150 rounded-xl"
          style={{
            height: ROW_H,
            background: isOver ? "rgba(243,199,91,0.08)" : "transparent",
            outline: isOver ? "2px dashed rgba(243,199,91,0.4)" : "none",
          }}
        >
          <SortableContext
            items={group.books.map((b) => b.id)}
            strategy={horizontalListSortingStrategy}
          >
            <div className="flex gap-3 items-end h-full pr-6" style={{ minWidth: "max-content" }}>
              {group.books.map((book) => (
                <BookCoverCard
                  key={book.id}
                  book={book}
                  containerId={group.series_name}
                  state={stateOf(book)}
                  arrangeMode={arrangeMode}
                  onClick={onBookClick}
                />
              ))}
            </div>
          </SortableContext>

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
