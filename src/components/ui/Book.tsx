"use client";
import Image from "next/image";
import { motion } from "framer-motion";
import { bookStates, coverColorFor, type BookState } from "@/lib/theme";

interface Props {
  title: string;
  coverUrl?: string | null;
  position?: number | null;
  state: BookState;
  onClick?: () => void;
}

export function Book({ title, coverUrl, position, state, onClick }: Props) {
  const s = bookStates[state];
  const fallbackBg = coverColorFor(title);

  return (
    <motion.div
      className="flex flex-col items-center gap-1 flex-shrink-0 cursor-pointer select-none"
      style={{ width: s.width }}
      initial={{ y: s.lift }}
      animate={{ y: s.lift }}
      whileHover={{ y: s.lift + (state === "unread" ? -2 : -6) }}
      transition={{ duration: 0.15 }}
      onClick={onClick}
    >
      {/* Outer: overflow visible so the bookmark ribbon can poke above the top edge */}
      <div
        className={`relative transition-all duration-300${state === "reading" ? " book-reading-glow" : ""}`}
        style={{
          width:        s.width,
          height:       s.height,
          filter:       s.filter,
          boxShadow:    s.shadow,
          borderRadius: "3px 7px 7px 3px",
          outline:      s.outline ? `1.5px solid ${s.outline}` : undefined,
          overflow:     "visible",
        }}
      >
        {/* Inner: clips the cover image to the book shape */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ borderRadius: "3px 7px 7px 3px" }}
        >
          {coverUrl ? (
            <Image src={coverUrl} alt={title} fill className="object-cover" unoptimized />
          ) : (
            <Fallback title={title} position={position} bg={fallbackBg} />
          )}
          {state === "completed" && <GoldShimmer />}
          {state === "unread" && position != null && <UnreadNumber n={position} />}
        </div>

        {/* Bookmark ribbon: sits above the book cover top edge */}
        {state === "reading" && <BookmarkRibbon />}
      </div>

      {/* Below-cover label */}
      <BelowLabel state={state} position={position} />
    </motion.div>
  );
}

// ── Sub-renderers ──────────────────────────────────────────────────────────

function BookmarkRibbon() {
  return (
    <div
      className="absolute z-20 pointer-events-none"
      style={{
        top:        -16,
        right:      11,
        width:      11,
        height:     26,
        background: "linear-gradient(180deg, #E8543A 0%, #C0392B 60%, #992B22 100%)",
        clipPath:   "polygon(0 0, 100% 0, 100% 76%, 50% 100%, 0 76%)",
        boxShadow:  "1px 1px 5px rgba(0,0,0,0.5), 0 3px 8px rgba(0,0,0,0.35)",
      }}
    />
  );
}

function Fallback({ title, position, bg }: { title: string; position?: number | null; bg: string }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-1 px-1"
      style={{ background: `linear-gradient(160deg, ${bg}ee 0%, ${bg}88 100%)` }}>
      {position != null && (
        <span className="text-white/50 text-[9px] font-black">#{position}</span>
      )}
      <span className="text-white/80 text-[8px] font-bold leading-tight text-center line-clamp-5 px-0.5">
        {title}
      </span>
    </div>
  );
}

function GoldShimmer() {
  return (
    <div
      aria-hidden
      className="absolute inset-0 pointer-events-none book-gold-shimmer"
      style={{ borderRadius: "3px 7px 7px 3px" }}
    />
  );
}

function UnreadNumber({ n }: { n: number }) {
  return (
    <div
      className="absolute top-1 left-1 w-[18px] h-[18px] rounded flex items-center justify-center pointer-events-none"
      style={{ background: "rgba(0,0,0,0.5)", border: "0.5px solid rgba(255,255,255,0.14)" }}
    >
      <span className="text-white/55 text-[7px] font-black leading-none">{n}</span>
    </div>
  );
}

function BelowLabel({ state, position }: { state: BookState; position?: number | null }) {
  return (
    <div className="h-4 flex items-center justify-center">
      {state === "completed" && (
        <div className="flex gap-0.5">
          {["★", "★", "★"].map((star, i) => (
            <span
              key={i}
              className="text-[14px] leading-none"
              style={{ color: "#F3C75B", textShadow: "0 0 10px rgba(255,200,50,0.8), 0 0 20px rgba(255,180,0,0.4)" }}
            >
              {star}
            </span>
          ))}
        </div>
      )}
      {state === "reading" && (
        <span
          className="text-[8px] font-black tracking-widest uppercase"
          style={{ color: "#FFD700", textShadow: "0 0 8px rgba(255,200,50,0.6)" }}
        >
          READING
        </span>
      )}
      {state === "unread" && position != null && (
        <span className="text-white/18 text-[9px] font-bold">{position}</span>
      )}
    </div>
  );
}
