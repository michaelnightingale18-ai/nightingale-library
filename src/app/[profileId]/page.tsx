"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { Plus, SlidersHorizontal, X, Star } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useStore } from "@/store/useStore";
import { groupBySeries } from "@/lib/books";
import { SeriesShelfRow } from "@/components/shelf/SeriesShelfRow";
import { TreehouseProgressCard } from "@/components/shelf/TreehouseProgressCard";
import { NightyHelper } from "@/components/shelf/NightyHelper";
import type { BookWithRecord, SeriesGroup, ReleaseAlert } from "@/lib/types";

export default function BookshelfPage() {
  const params = useParams();
  const profileId = params.profileId as string;
  const { currentProfile, showCelebration } = useStore();
  const color = currentProfile?.color || "#f59e0b";

  const [groups, setGroups] = useState<SeriesGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBook, setSelectedBook] = useState<BookWithRecord | null>(null);
  const [markingRead, setMarkingRead] = useState(false);
  const [newBookAlert, setNewBookAlert] = useState<ReleaseAlert | null>(null);

  const loadBooks = useCallback(async () => {
    const { data } = await supabase
      .from("reading_records")
      .select("id, book_id, liked, read_at, book:books(*)")
      .eq("profile_id", profileId)
      .order("read_at", { ascending: true });

    if (data) {
      const records = (data as unknown) as {
        id: string; book_id: string; liked: boolean;
        read_at: string; book: import("@/lib/types").Book;
      }[];
      setGroups(groupBySeries(records));
    }
    setLoading(false);

    // Check for new-book alerts (show most recent unseen one)
    const { data: alerts } = await supabase
      .from("release_alerts")
      .select("*")
      .eq("seen", false)
      .order("created_at", { ascending: false })
      .limit(1);
    if (alerts && alerts.length > 0) {
      setTimeout(() => setNewBookAlert(alerts[0] as ReleaseAlert), 800);
    }
  }, [profileId]);

  useEffect(() => { loadBooks(); }, [loadBooks]);

  async function dismissAlert(alert: ReleaseAlert) {
    await supabase.from("release_alerts").update({ seen: true }).eq("id", alert.id);
    setNewBookAlert(null);
  }

  async function markBookRead(book: BookWithRecord) {
    setMarkingRead(true);
    await supabase
      .from("reading_records")
      .update({ liked: true, read_at: new Date().toISOString() })
      .eq("profile_id", profileId)
      .eq("book_id", book.id);

    setGroups((prev) =>
      prev.map((g) => ({
        ...g,
        books: g.books.map((b) =>
          b.id === book.id ? { ...b, liked: true, read_at: new Date().toISOString() } : b
        ),
      }))
    );
    setSelectedBook(null);
    setMarkingRead(false);
    showCelebration({ ...book, liked: true } as import("@/lib/types").Book);
  }

  async function removeSeries(seriesName: string) {
    setMarkingRead(true);
    const group = groups.find((g) => g.series_name === seriesName);
    if (group) {
      const bookIds = group.books.map((b) => b.id);
      await supabase
        .from("reading_records")
        .delete()
        .eq("profile_id", profileId)
        .in("book_id", bookIds);
      setGroups((prev) => prev.filter((g) => g.series_name !== seriesName));
    }
    setSelectedBook(null);
    setMarkingRead(false);
  }

  async function removeBook(book: BookWithRecord) {
    setMarkingRead(true);
    await supabase
      .from("reading_records")
      .delete()
      .eq("profile_id", profileId)
      .eq("book_id", book.id);

    setGroups((prev) =>
      prev
        .map((g) => ({ ...g, books: g.books.filter((b) => b.id !== book.id) }))
        .filter((g) => g.books.length > 0)
    );
    setSelectedBook(null);
    setMarkingRead(false);
  }

  async function markBookUnread(book: BookWithRecord) {
    setMarkingRead(true);
    await supabase
      .from("reading_records")
      .update({ liked: false })
      .eq("profile_id", profileId)
      .eq("book_id", book.id);

    setGroups((prev) =>
      prev.map((g) => ({
        ...g,
        books: g.books.map((b) =>
          b.id === book.id ? { ...b, liked: false } : b
        ),
      }))
    );
    setSelectedBook(null);
    setMarkingRead(false);
  }

  const totalRead = groups.reduce((s, g) => s + g.books.filter((b) => b.liked).length, 0);
  const totalBooks = groups.reduce((s, g) => s + g.books.length, 0);

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4">
        <motion.div animate={{ y: [0, -12, 0] }} transition={{ duration: 1.2, repeat: Infinity }}>
          <span className="text-7xl">📚</span>
        </motion.div>
        <p className="text-amber-400/60 font-bold text-lg">Loading your library…</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden relative">
      {/* ── Header ── */}
      <div className="flex-shrink-0 flex items-start justify-between px-5 pt-8 pb-4">
        <div>
          <h1
            className="text-4xl font-black leading-tight"
            style={{
              color: "#F3C75B",
              textShadow: "0 0 32px rgba(255,216,107,0.35), 0 2px 8px rgba(0,0,0,0.8)",
              letterSpacing: "-0.5px",
            }}
          >
            My Library
          </h1>
          <p className="text-sm font-semibold mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>
            {totalBooks === 0
              ? "Add your first book to get started"
              : <>Every book you read{" "}<span style={{ color: "#FFD86B", fontWeight: 700 }}>builds your world.</span></>}
          </p>
          {totalBooks > 0 && (
            <p className="text-white/25 text-xs mt-0.5 font-medium">
              {totalRead} of {totalBooks} books read
            </p>
          )}
        </div>
        <TreehouseProgressCard totalRead={totalRead} color={color} />
      </div>

      {/* ── Empty state ── */}
      {groups.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-8 pb-24">
          <motion.div
            animate={{ rotate: [-4, 4, -4] }}
            transition={{ duration: 4, repeat: Infinity }}
            className="text-8xl mb-6"
          >
            📖
          </motion.div>
          <h2 className="text-2xl font-black text-white/70 mb-2">Your shelf is empty!</h2>
          <p className="text-white/35 text-base mb-8">
            Add a series or a book to begin your adventure
          </p>
          <Link
            href={`/${profileId}/add`}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-lg text-white shadow-lg"
            style={{ backgroundColor: color, boxShadow: `0 0 20px ${color}44` }}
          >
            <Plus size={22} /> Add Your First Book
          </Link>
        </div>
      )}

      {/* ── Series shelf rows ── */}
      {groups.length > 0 && (
        <div className="flex-1 overflow-y-auto no-scrollbar pb-4 space-y-5 pt-1">
          {groups.map((group, idx) => (
            <motion.div
              key={group.series_name}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.07, duration: 0.4 }}
            >
              <SeriesShelfRow
                group={group}
                onBookClick={(book) => setSelectedBook(book)}
              />
            </motion.div>
          ))}
          {/* Bottom breathing room */}
          <div className="h-4" />
        </div>
      )}

      {/* ── Bottom action bar ── */}
      <div
        className="flex-shrink-0 flex items-center gap-2 px-4 py-3"
        style={{
          background: "linear-gradient(to top, #0A0500 0%, rgba(10,5,0,0.85) 100%)",
          borderTop: "1px solid rgba(243,199,91,0.12)",
        }}
      >
        <button
          className="flex items-center gap-1.5 px-3 py-2.5 rounded-full text-xs font-bold transition-all active:scale-95 whitespace-nowrap"
          style={{
            background: "rgba(243,199,91,0.07)",
            border: "1.5px solid rgba(243,199,91,0.28)",
            color: "#F3C75B",
          }}
        >
          <SlidersHorizontal size={13} />
          Collection
        </button>

        <Link
          href={`/${profileId}/add`}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full text-sm font-black text-white transition-all active:scale-95"
          style={{
            background: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)",
            boxShadow: "0 0 24px rgba(37,99,235,0.40), 0 4px 16px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1)",
            border: "1px solid rgba(243,199,91,0.22)",
          }}
        >
          <Plus size={17} /> Add a Book or Series
        </Link>

        <button
          className="flex items-center gap-1.5 px-3 py-2.5 rounded-full text-xs font-bold transition-all active:scale-95"
          style={{
            background: "rgba(243,199,91,0.07)",
            border: "1.5px solid rgba(243,199,91,0.28)",
            color: "#F3C75B",
          }}
        >
          <SlidersHorizontal size={13} />
          Filter
        </button>
      </div>

      {/* ── Nighty helper ── */}
      {groups.length > 0 && <NightyHelper />}

      {/* ── New book alert popup ── */}
      <AnimatePresence>
        {newBookAlert && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-6"
            style={{ background: "rgba(0,0,0,0.85)" }}
          >
            {/* Confetti stars */}
            {["⭐", "🌟", "✨", "⭐", "🌟"].map((star, i) => (
              <motion.span
                key={i}
                className="fixed text-2xl pointer-events-none"
                initial={{ opacity: 0, y: 0, x: 0, scale: 0 }}
                animate={{
                  opacity: [0, 1, 1, 0],
                  y: -120 - i * 30,
                  x: (i - 2) * 60,
                  scale: [0, 1.4, 1, 0],
                }}
                transition={{ delay: 0.3 + i * 0.1, duration: 1.4 }}
                style={{ left: "50%", bottom: "45%" }}
              >
                {star}
              </motion.span>
            ))}

            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ type: "spring", bounce: 0.35, delay: 0.1 }}
              className="w-full max-w-sm rounded-3xl overflow-hidden"
              style={{
                background: "linear-gradient(145deg, #0a0500 0%, #1a0c00 50%, #0a0500 100%)",
                border: "2px solid rgba(255,210,0,0.4)",
                boxShadow: "0 0 60px rgba(255,200,0,0.25), 0 30px 80px rgba(0,0,0,0.9)",
              }}
            >
              {/* Gold glow header */}
              <div
                className="px-6 pt-7 pb-4 text-center"
                style={{
                  background: "linear-gradient(180deg, rgba(255,200,0,0.12) 0%, transparent 100%)",
                  borderBottom: "1px solid rgba(255,200,0,0.15)",
                }}
              >
                <motion.div
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="text-5xl mb-3"
                >
                  🎉
                </motion.div>
                <p className="text-xs font-black tracking-widest uppercase mb-1" style={{ color: "rgba(255,200,0,0.6)" }}>
                  New Book Alert
                </p>
                <h2 className="text-2xl font-black text-white leading-tight">
                  {newBookAlert.series_name}
                </h2>
                <p className="text-sm font-bold mt-0.5" style={{ color: "rgba(255,200,0,0.7)" }}>
                  has a new book!
                </p>
              </div>

              {/* Book info */}
              <div className="px-6 py-5">
                <div
                  className="rounded-2xl p-4 mb-5"
                  style={{ background: "rgba(255,200,0,0.06)", border: "1px solid rgba(255,200,0,0.15)" }}
                >
                  <p className="text-white font-black text-lg leading-snug mb-1">
                    {newBookAlert.book_title}
                  </p>
                  {newBookAlert.author && (
                    <p className="text-white/45 text-sm">by {newBookAlert.author}</p>
                  )}
                  {newBookAlert.release_info && (
                    <p className="text-xs font-bold mt-2" style={{ color: "rgba(255,200,0,0.6)" }}>
                      {newBookAlert.release_info}
                    </p>
                  )}
                </div>

                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => dismissAlert(newBookAlert)}
                  className="w-full py-4 rounded-2xl font-black text-lg text-black"
                  style={{
                    background: "linear-gradient(135deg, #FFD700 0%, #FFA500 100%)",
                    boxShadow: "0 0 30px rgba(255,200,0,0.5), 0 8px 24px rgba(0,0,0,0.4)",
                  }}
                >
                  Amazing! 🚀
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Book detail modal ── */}
      <AnimatePresence>
        {selectedBook && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-4"
            style={{ background: "rgba(0,0,0,0.75)" }}
            onClick={(e) => e.target === e.currentTarget && setSelectedBook(null)}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: "spring", bounce: 0.28 }}
              className="w-full max-w-sm rounded-3xl overflow-hidden relative"
              style={{
                background: "linear-gradient(145deg, #1E1008 0%, #150C04 100%)",
                border: "1px solid rgba(255,215,0,0.12)",
                boxShadow: "0 20px 60px rgba(0,0,0,0.8)",
              }}
            >
              {/* Close */}
              <button
                onClick={() => setSelectedBook(null)}
                className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.08)" }}
              >
                <X size={15} className="text-white/60" />
              </button>

              <div className="p-5 flex gap-4">
                {/* Cover */}
                <div
                  className="flex-shrink-0 relative rounded-xl overflow-hidden shadow-2xl"
                  style={{
                    width: 80, height: 116,
                    filter: selectedBook.liked ? "none" : "grayscale(80%) brightness(0.7)",
                    outline: selectedBook.liked ? "2px solid rgba(255,215,0,0.3)" : undefined,
                    boxShadow: selectedBook.liked
                      ? "0 0 16px rgba(255,215,0,0.2), 0 6px 20px rgba(0,0,0,0.7)"
                      : "0 6px 20px rgba(0,0,0,0.7)",
                  }}
                >
                  {selectedBook.cover_url ? (
                    <Image
                      src={selectedBook.cover_url}
                      alt={selectedBook.title}
                      fill className="object-cover" unoptimized
                    />
                  ) : (
                    <div className="w-full h-full bg-amber-900/50 flex items-center justify-center text-3xl">
                      📖
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 pt-1">
                  <h3 className="text-base font-black text-white/90 leading-tight mb-1">
                    {selectedBook.title}
                  </h3>
                  <p className="text-white/45 text-sm mb-1">{selectedBook.author}</p>
                  {selectedBook.series_name && (
                    <p className="text-xs font-bold mb-2" style={{ color }}>
                      {selectedBook.series_name}
                      {selectedBook.series_position ? ` · Book #${selectedBook.series_position}` : ""}
                    </p>
                  )}
                  <p className="text-white/30 text-xs font-medium mt-2">
                    {selectedBook.liked ? "✓ Read" : "Not read yet"}
                  </p>
                  <Link
                    href={`/${profileId}/add?author=${encodeURIComponent(selectedBook.author)}`}
                    className="inline-flex items-center gap-1 mt-3 text-xs font-bold px-3 py-1.5 rounded-full transition-all active:scale-95"
                    style={{
                      background: "rgba(243,199,91,0.10)",
                      border: "1px solid rgba(243,199,91,0.30)",
                      color: "#F3C75B",
                    }}
                    onClick={() => setSelectedBook(null)}
                  >
                    More by {selectedBook.author} →
                  </Link>
                </div>
              </div>

              {/* Toggle actions — always visible */}
              <div className="px-5 pb-5 space-y-2">
                {!selectedBook.liked ? (
                  /* Unread → mark as read */
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => markBookRead(selectedBook)}
                    disabled={markingRead}
                    className="w-full py-4 rounded-2xl font-black text-lg text-white flex items-center justify-center gap-2 disabled:opacity-60"
                    style={{
                      background: `linear-gradient(135deg, ${color}cc, ${color})`,
                      boxShadow: `0 0 20px ${color}55, 0 6px 20px rgba(0,0,0,0.5)`,
                    }}
                  >
                    <Star size={20} fill="white" />
                    {markingRead ? "Saving…" : "I Finished This Book! 🎉"}
                  </motion.button>
                ) : (
                  /* Read → mark as unread */
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => markBookUnread(selectedBook)}
                    disabled={markingRead}
                    className="w-full py-3 rounded-2xl font-bold text-sm text-white/50 flex items-center justify-center gap-2 disabled:opacity-40 transition-all"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                  >
                    {markingRead ? "Saving…" : "↩ Mark as Unread"}
                  </motion.button>
                )}

                {/* Remove buttons — small, tucked away */}
                <div className="flex gap-2">
                  <button
                    onClick={() => removeBook(selectedBook)}
                    disabled={markingRead}
                    className="flex-1 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-30"
                    style={{ color: "rgba(255,80,80,0.4)", background: "transparent" }}
                  >
                    Remove book
                  </button>
                  {selectedBook.series_name && (
                    <button
                      onClick={() => removeSeries(selectedBook.series_name!)}
                      disabled={markingRead}
                      className="flex-1 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-30"
                      style={{ color: "rgba(255,80,80,0.7)", background: "rgba(255,80,80,0.08)" }}
                    >
                      Remove series
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
