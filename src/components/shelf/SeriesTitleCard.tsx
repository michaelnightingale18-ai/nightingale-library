"use client";
import { Pencil } from "lucide-react";
import { paletteFor, gold } from "@/lib/theme";

interface Props {
  name:       string;
  author:     string;
  bookCount:  number;
  readCount:  number;
  height?:    number;
}

export function SeriesTitleCard({ name, bookCount, readCount, height = 140 }: Props) {
  const p = paletteFor(name);
  const allRead = readCount === bookCount && bookCount > 0;

  return (
    <div
      className="relative overflow-hidden flex-shrink-0 flex flex-col justify-between p-3 select-none"
      style={{
        width: 132,
        height,
        borderRadius: 10,
        background: `linear-gradient(165deg, ${p.bg} 0%, rgba(0,0,0,0.92) 100%)`,
        border: `1.5px solid ${allRead ? gold.bright : p.border}`,
        boxShadow: allRead
          ? `0 0 18px ${gold.glow}, 0 10px 32px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,220,80,0.15)`
          : `0 0 0 0.5px ${p.border}33, 0 10px 32px rgba(0,0,0,0.9), inset 0 1px 0 ${p.border}22`,
      }}
    >
      {/* Top-left corner bracket */}
      <div
        aria-hidden
        className="absolute top-0 left-0 pointer-events-none"
        style={{
          width: 14, height: 14,
          borderTop: `2px solid ${allRead ? gold.bright : p.accent}88`,
          borderLeft: `2px solid ${allRead ? gold.bright : p.accent}88`,
          borderRadius: "10px 0 0 0",
        }}
      />
      {/* Top-right corner bracket */}
      <div
        aria-hidden
        className="absolute top-0 right-0 pointer-events-none"
        style={{
          width: 14, height: 14,
          borderTop: `2px solid ${allRead ? gold.bright : p.accent}88`,
          borderRight: `2px solid ${allRead ? gold.bright : p.accent}88`,
          borderRadius: "0 10px 0 0",
        }}
      />
      {/* Bottom-left corner bracket */}
      <div
        aria-hidden
        className="absolute bottom-0 left-0 pointer-events-none"
        style={{
          width: 14, height: 14,
          borderBottom: `2px solid ${allRead ? gold.bright : p.accent}88`,
          borderLeft: `2px solid ${allRead ? gold.bright : p.accent}88`,
          borderRadius: "0 0 0 10px",
        }}
      />
      {/* Bottom-right corner bracket */}
      <div
        aria-hidden
        className="absolute bottom-0 right-0 pointer-events-none"
        style={{
          width: 14, height: 14,
          borderBottom: `2px solid ${allRead ? gold.bright : p.accent}88`,
          borderRight: `2px solid ${allRead ? gold.bright : p.accent}88`,
          borderRadius: "0 0 10px 0",
        }}
      />

      {/* Corner glow */}
      <div
        aria-hidden
        className="absolute -top-6 -right-6 w-20 h-20 rounded-full blur-2xl pointer-events-none"
        style={{ background: `${p.accent}28` }}
      />

      {/* Rename hint */}
      <div
        aria-hidden
        className="absolute top-2 right-2 z-10 opacity-50"
      >
        <Pencil size={10} color={p.accent} />
      </div>

      {/* Subtle top shimmer line */}
      <div
        aria-hidden
        className="absolute top-0 left-0 right-0 h-px pointer-events-none"
        style={{ background: `linear-gradient(90deg, transparent, ${allRead ? gold.bright : p.accent}55, transparent)` }}
      />

      <p
        className="relative z-10 text-[14px] font-black leading-tight tracking-tight text-white/95 line-clamp-4"
        style={{ textShadow: `0 2px 20px ${p.accent}66` }}
      >
        {name.toUpperCase()}
      </p>

      <div className="relative z-10 flex flex-col gap-0.5">
        {readCount > 0 && (
          <span
            className="text-[7px] font-black tracking-widest uppercase"
            style={{ color: allRead ? gold.bright : `${gold.bright}88` }}
          >
            {readCount}/{bookCount} READ
          </span>
        )}
        <span
          className="text-[8px] font-black tracking-widest uppercase"
          style={{ color: p.accent }}
        >
          {bookCount} BOOKS
        </span>
      </div>
    </div>
  );
}
