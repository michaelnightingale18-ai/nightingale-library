"use client";
import { motion } from "framer-motion";

/**
 * Progress — animated bar that fills to `value` (0–1).
 * `color` defaults to amber-400; pass your series accent for themed bars.
 */
interface Props {
  value: number;          // 0–1
  color?: string;
  delay?: number;
  className?: string;
}

export function Progress({ value, color = "#fbbf24", delay = 0, className = "" }: Props) {
  const pct = Math.min(1, Math.max(0, value)) * 100;

  return (
    <div
      className={`h-1.5 rounded-full overflow-hidden ${className}`}
      style={{ background: "rgba(0,0,0,0.4)" }}
    >
      <motion.div
        className="h-full rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, delay, ease: "easeOut" }}
        style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}66` }}
      />
    </div>
  );
}
