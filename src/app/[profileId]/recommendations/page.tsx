"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, RefreshCw } from "lucide-react";
import { useStore } from "@/store/useStore";

interface Rec {
  book_title?: string;
  title?: string;
  book_author?: string;
  author?: string;
  reason?: string;
  series_name?: string;
}

export default function RecommendationsPage() {
  const params = useParams();
  const profileId = params.profileId as string;
  const { currentProfile } = useStore();
  const [recs, setRecs] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);

  const fetchRecs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId }),
      });
      const data = await res.json();
      if (res.ok) {
        setRecs(data.recommendations || []);
      } else {
        setError(data.error || "Something went wrong");
      }
    } catch {
      setError("Could not load recommendations");
    } finally {
      setLoading(false);
      setFetched(true);
    }
  }, [profileId]);

  useEffect(() => {
    fetchRecs();
  }, [fetchRecs]);

  const BOOK_COLORS = [
    "#FF6B6B",
    "#FFD93D",
    "#6BCF7F",
    "#6BCFFF",
    "#B39DDB",
    "#FF9A3C",
  ];

  return (
    <div className="h-full overflow-y-auto bg-amber-50 no-scrollbar">
      {/* Header */}
      <div
        className="px-5 pt-12 pb-5 flex items-start justify-between"
        style={{
          background: `linear-gradient(135deg, ${currentProfile?.color || "#FFD93D"}33, transparent)`,
        }}
      >
        <div>
          <h1
            className="text-3xl font-bold"
            style={{ color: currentProfile?.color || "#92400e" }}
          >
            For You ✨
          </h1>
          <p className="text-amber-600 font-medium mt-0.5">
            Books you might love
          </p>
        </div>
        <button
          onClick={fetchRecs}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white shadow text-sm font-bold mt-1"
          style={{ color: currentProfile?.color || "#f59e0b" }}
        >
          <RefreshCw
            size={16}
            className={loading ? "animate-spin" : ""}
          />
          Refresh
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <motion.div
            animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="text-7xl"
          >
            🔮
          </motion.div>
          <p className="text-amber-600 font-bold text-lg">
            Finding your next favorite…
          </p>
        </div>
      )}

      {/* No API key */}
      {!loading && error?.includes("not configured") && (
        <div className="px-6 py-10 text-center">
          <div className="text-6xl mb-4">🔑</div>
          <h2 className="text-xl font-bold text-gray-700 mb-2">
            AI Recommendations Coming Soon
          </h2>
          <p className="text-gray-500 text-sm">
            Add your Anthropic API key to enable personalized recommendations.
          </p>
        </div>
      )}

      {/* No books yet */}
      {!loading && !error && fetched && recs.length === 0 && (
        <div className="flex flex-col items-center justify-center px-8 py-16 text-center">
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-7xl mb-4"
          >
            📚
          </motion.div>
          <h2 className="text-xl font-bold text-amber-800 mb-2">
            Read some books first!
          </h2>
          <p className="text-amber-600">
            Add books you&apos;ve finished and we&apos;ll find great
            recommendations.
          </p>
        </div>
      )}

      {/* Recommendation cards */}
      {!loading && recs.length > 0 && (
        <div className="px-4 pb-6 space-y-4">
          <AnimatePresence>
            {recs.map((rec, i) => {
              const title = rec.book_title || rec.title || "";
              const author = rec.book_author || rec.author || "";
              const color = BOOK_COLORS[i % BOOK_COLORS.length];

              return (
                <motion.div
                  key={`${title}-${i}`}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="flex gap-4 p-4 bg-white rounded-2xl shadow-md"
                >
                  {/* Colorful book cover placeholder */}
                  <div
                    className="flex-shrink-0 w-16 h-24 rounded-xl flex items-center justify-center text-white font-bold text-xs text-center leading-tight px-1 shadow-md"
                    style={{
                      background: `linear-gradient(135deg, ${color}, ${color}aa)`,
                    }}
                  >
                    {title.slice(0, 20)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-gray-800 text-base leading-tight">
                        {title}
                      </h3>
                      <Sparkles
                        size={18}
                        className="flex-shrink-0 mt-0.5"
                        style={{ color }}
                      />
                    </div>
                    {author && (
                      <p className="text-gray-500 text-sm mb-1">{author}</p>
                    )}
                    {rec.series_name && (
                      <div
                        className="inline-block px-2 py-0.5 rounded-full text-xs font-bold text-white mb-1.5"
                        style={{ backgroundColor: color }}
                      >
                        {rec.series_name}
                      </div>
                    )}
                    {rec.reason && (
                      <p className="text-gray-600 text-sm leading-snug">
                        {rec.reason}
                      </p>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          <p className="text-center text-amber-400 text-xs mt-2">
            Powered by Claude AI · Refreshes automatically as you add books
          </p>
        </div>
      )}
    </div>
  );
}
