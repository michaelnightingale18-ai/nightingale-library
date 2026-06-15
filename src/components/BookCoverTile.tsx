"use client";
import Image from "next/image";
import type { BookWithRecord } from "@/lib/types";

const BOOK_COLORS = [
  ["#FF6B6B", "#c0392b"],
  ["#FFD93D", "#f39c12"],
  ["#6BCF7F", "#27ae60"],
  ["#6BCFFF", "#2980b9"],
  ["#B39DDB", "#7b1fa2"],
  ["#FF9A3C", "#e65100"],
  ["#F48FB1", "#ad1457"],
  ["#26C6DA", "#00838f"],
];

function colorForTitle(title: string) {
  let hash = 0;
  for (const ch of title) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffff;
  return BOOK_COLORS[hash % BOOK_COLORS.length];
}

interface Props {
  book: BookWithRecord;
  onClick?: (book: BookWithRecord) => void;
}

export default function BookCoverTile({ book, onClick }: Props) {
  const [bg, dark] = colorForTitle(book.title);
  const isRead = book.liked; // liked=true means read, liked=false means on shelf unread

  return (
    <button
      className="book-spine focus:outline-none relative"
      style={{
        background: bg,
        filter: isRead ? "none" : "grayscale(100%)",
        opacity: isRead ? 1 : 0.7,
        transition: "filter 0.4s ease, opacity 0.4s ease",
      }}
      onClick={() => onClick?.(book)}
      title={isRead ? book.title : `📖 ${book.title} — tap to mark as read!`}
    >
      {book.cover_url ? (
        <Image
          src={book.cover_url}
          alt={book.title}
          width={76}
          height={110}
          className="w-full h-full rounded-[3px_6px_6px_3px] object-cover"
          unoptimized
        />
      ) : (
        <div
          className="w-full h-full flex flex-col items-center justify-center px-1 gap-1 rounded-[3px_6px_6px_3px]"
          style={{ background: `linear-gradient(160deg, ${bg} 0%, ${dark} 100%)` }}
        >
          <span className="text-white text-xs font-bold leading-tight text-center px-1 line-clamp-3">
            {book.title}
          </span>
          {book.series_position && (
            <span className="text-white/80 text-xs font-semibold">
              #{book.series_position}
            </span>
          )}
        </div>
      )}

      {/* Unread indicator — small lock/star badge */}
      {!isRead && (
        <div className="absolute -top-1 -right-1 w-5 h-5 bg-amber-400 rounded-full flex items-center justify-center shadow text-xs">
          📖
        </div>
      )}
    </button>
  );
}
