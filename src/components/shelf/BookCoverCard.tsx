"use client";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Book } from "@/components/ui/Book";
import type { BookState } from "@/lib/theme";
import type { BookWithRecord } from "@/lib/types";

/**
 * BookCoverCard — shelf-layer wrapper.
 * Bridges the domain type (BookWithRecord) to the UI primitive (Book),
 * and wires it up as a draggable/sortable item.
 */
interface Props {
  book:        BookWithRecord;
  containerId: string;
  state:       BookState;
  arrangeMode: boolean;
  onClick?:    (book: BookWithRecord) => void;
}

export function BookCoverCard({ book, containerId, state, arrangeMode, onClick }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: book.id,
    data: { containerId },
    disabled: !arrangeMode,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
    touchAction: arrangeMode ? ("none" as const) : ("auto" as const),
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Book
        title={book.title}
        coverUrl={book.cover_url}
        position={book.series_position}
        state={state}
        onClick={onClick && !isDragging && !arrangeMode ? () => onClick(book) : undefined}
      />
    </div>
  );
}
