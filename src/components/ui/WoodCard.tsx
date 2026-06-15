"use client";
import { wood } from "@/lib/theme";

/**
 * WoodCard — the base dark ambient card used throughout the library UI.
 *
 * Pass `accent` to tint the border and emit a soft glow.
 * Children are laid out in a flex column by default; override with `className`.
 */
interface Props {
  accent?: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
  onClick?: () => void;
}

export function WoodCard({ accent, className = "", style, children, onClick }: Props) {
  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      onClick={onClick}
      className={`relative overflow-hidden flex flex-col ${className}`}
      style={{
        background: `linear-gradient(145deg, ${wood.elevated} 0%, ${wood.mid} 100%)`,
        border: `1.5px solid ${accent ? `${accent}44` : "rgba(255,255,255,0.06)"}`,
        boxShadow: accent
          ? `0 0 28px ${accent}18, 0 6px 24px rgba(0,0,0,0.55)`
          : "0 4px 20px rgba(0,0,0,0.5)",
        borderRadius: 16,
        ...style,
      }}
    >
      {/* Ambient corner highlight */}
      {accent && (
        <div
          aria-hidden
          className="absolute -top-6 -right-6 w-20 h-20 rounded-full blur-xl pointer-events-none opacity-20"
          style={{ background: accent }}
        />
      )}
      {children}
    </Tag>
  );
}
