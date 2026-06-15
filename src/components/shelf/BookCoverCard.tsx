"use client";
import { Book } from "@/components/ui/Book";
import type { BookState } from "@/lib/theme";
import type { BookWithRecord } from "@/lib/types";

/**
 * BookCoverCard — shelf-layer wrapper.
 * Bridges the domain type (BookWithRecord) to the UI primitive (Book).
 * All visual decisions live in Book + theme.ts, not here.
 */
interface Props {
  book:    BookWithRecord;
  state:   BookState;
  onClick?: (book: BookWithRecord) => void;
}

export function BookCoverCard({ book, state, onClick }: Props) {
  return (
    <Book
      title={book.title}
      coverUrl={book.cover_url}
      position={book.series_position}
      state={state}
      onClick={onClick ? () => onClick(book) : undefined}
    />
  );
}
