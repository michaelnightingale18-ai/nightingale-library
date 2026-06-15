"use client";
import { motion } from "framer-motion";
import { WoodCard } from "@/components/ui/WoodCard";
import { Progress } from "@/components/ui/Progress";
import { gold, levelFor } from "@/lib/theme";

/**
 * TreehouseProgressCard — gamification widget, top-right of bookshelf.
 * Level calculation comes from theme.levelFor() — change the formula there.
 */
interface Props {
  totalRead: number;
  color:     string;
}

export function TreehouseProgressCard({ totalRead, color }: Props) {
  const { level, progress, toNext, fraction } = levelFor(totalRead);

  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
      <WoodCard
        accent={gold.warm}
        style={{ width: 210 }}
        className="p-3 gap-0"
      >
        {/* Shimmer sweep (decorative, no state) */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none treehouse-card-shimmer opacity-40 rounded-2xl"
        />

        <div className="relative z-10 space-y-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                style={{
                  background: `linear-gradient(135deg, ${gold.subtle}, rgba(255,215,0,0.14))`,
                  border: `1px solid ${gold.dimBorder}`,
                  boxShadow: `0 0 12px rgba(255,215,0,0.18)`,
                }}
              >
                ⭐
              </div>
              <div>
                <p className="text-[9px] text-amber-400/60 font-bold uppercase tracking-widest leading-none mb-0.5">
                  Treehouse
                </p>
                <p className="text-base font-black text-amber-100 leading-none">Level {level}</p>
              </div>
            </div>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{
                background: `linear-gradient(135deg, ${gold.subtle}, rgba(255,215,0,0.14))`,
                border: `1px solid ${gold.dimBorder}`,
              }}
            >
              <span className="text-amber-300 text-sm font-black">{level}</span>
            </div>
          </div>

          <Progress value={fraction} color={color} delay={0.3} />

          <div className="flex justify-between items-baseline">
            <p className="text-[9px] text-white/35 font-medium">
              {toNext} more until Level {level + 1}!
            </p>
            <p className="text-[9px] font-bold text-amber-400/60">
              {progress}/{5}
            </p>
          </div>
        </div>
      </WoodCard>
    </motion.div>
  );
}
