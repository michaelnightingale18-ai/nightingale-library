"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { Plus, SlidersHorizontal, X, Star, Undo2, Sparkles, BookOpen, Lock, Trophy, Move } from "lucide-react";
import {
  DndContext, DragOverlay, closestCenter,
  PointerSensor, useSensor, useSensors,
  type DragStartEvent, type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { supabase } from "@/lib/supabase";
import { useStore } from "@/store/useStore";
import { groupBySeries } from "@/lib/books";
import { levelFor, BOOKS_PER_LEVEL } from "@/lib/theme";
import { Book } from "@/components/ui/Book";
import { SeriesShelfRow, stateOf } from "@/components/shelf/SeriesShelfRow";
import { TreehouseProgressCard } from "@/components/shelf/TreehouseProgressCard";
import { NightyHelper } from "@/components/shelf/NightyHelper";
import type { BookWithRecord, SeriesGroup, ReleaseAlert } from "@/lib/types";

export default function BookshelfPage() {
  const params = useParams();
  const profileId = params.profileId as string;
  const { currentProfile, setCurrentProfile, showCelebration } = useStore();
  const color = currentProfile?.color || "#f59e0b";

  const [groups, setGroups] = useState<SeriesGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBook, setSelectedBook] = useState<BookWithRecord | null>(null);
  const [markingRead, setMarkingRead] = useState(false);
  const [newBookAlert, setNewBookAlert] = useState<ReleaseAlert | null>(null);

  // Drag-and-drop state
  const [arrangeMode, setArrangeMode] = useState(false);
  const [activeBook, setActiveBook] = useState<BookWithRecord | null>(null);
  const [renameModal, setRenameModal] = useState<{ seriesName: string; value: string } | null>(null);
  const [newSeriesModal, setNewSeriesModal] = useState<{ bookIdA: string; bookIdB: string; value: string } | null>(null);
  const [undoToast, setUndoToast] = useState<{ message: string; revert: () => Promise<void> } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Level-up approval state
  const [showLevelUpModal, setShowLevelUpModal] = useState(false);
  const [levelUpPin, setLevelUpPin] = useState("");
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [justApprovedLevel, setJustApprovedLevel] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const loadBooks = useCallback(async () => {
    const { data } = await supabase
      .from("reading_records")
      .select("id, book_id, liked, read_at, currently_reading, book:books(*)")
      .eq("profile_id", profileId)
      .order("read_at", { ascending: true });

    if (data) {
      const records = (data as unknown) as {
        id: string; book_id: string; liked: boolean;
        read_at: string; currently_reading?: boolean;
        book: import("@/lib/types").Book;
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
      .update({ liked: true, read_at: new Date().toISOString(), currently_reading: false })
      .eq("profile_id", profileId)
      .eq("book_id", book.id);

    setGroups((prev) =>
      prev.map((g) => ({
        ...g,
        books: g.books.map((b) =>
          b.id === book.id
            ? { ...b, liked: true, read_at: new Date().toISOString(), currently_reading: false }
            : b
        ),
      }))
    );
    setSelectedBook(null);
    setMarkingRead(false);
    showCelebration({ ...book, liked: true } as import("@/lib/types").Book);
  }

  async function toggleCurrentlyReading(book: BookWithRecord) {
    const next = !book.currently_reading;
    await supabase
      .from("reading_records")
      .update({ currently_reading: next })
      .eq("profile_id", profileId)
      .eq("book_id", book.id);

    setGroups((prev) =>
      prev.map((g) => ({
        ...g,
        books: g.books.map((b) => (b.id === book.id ? { ...b, currently_reading: next } : b)),
      }))
    );
    setSelectedBook((prev) => (prev && prev.id === book.id ? { ...prev, currently_reading: next } : prev));
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

  function showUndo(message: string, revert: () => Promise<void>) {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoToast({ message, revert });
    undoTimerRef.current = setTimeout(() => setUndoToast(null), 5000);
  }

  async function handleUndo() {
    if (!undoToast) return;
    const { revert } = undoToast;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoToast(null);
    await revert();
  }

  function findBookAndGroup(bookId: string) {
    for (const g of groups) {
      const book = g.books.find((b) => b.id === bookId);
      if (book) return { book, group: g };
    }
    return null;
  }

  function handleDragStart(event: DragStartEvent) {
    const found = findBookAndGroup(event.active.id as string);
    setActiveBook(found?.book ?? null);
  }

  async function reorderWithinGroup(group: SeriesGroup, activeId: string, overId: string) {
    const oldIndex = group.books.findIndex((b) => b.id === activeId);
    const newIndex = group.books.findIndex((b) => b.id === overId);
    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

    const snapshot = group.books.map((b) => ({ id: b.id, series_position: b.series_position }));
    const reordered = arrayMove(group.books, oldIndex, newIndex).map((b, i) => ({
      ...b, series_position: i + 1,
    }));

    setGroups((prev) =>
      prev.map((g) => (g.series_name === group.series_name ? { ...g, books: reordered } : g))
    );

    await Promise.all(
      reordered.map((b, i) => supabase.from("books").update({ series_position: i + 1 }).eq("id", b.id))
    );

    showUndo(`Reordered ${group.series_name}`, async () => {
      await Promise.all(
        snapshot.map((s) => supabase.from("books").update({ series_position: s.series_position }).eq("id", s.id))
      );
      await loadBooks();
    });
  }

  async function moveBookToGroup(bookId: string, destGroup: SeriesGroup) {
    const found = findBookAndGroup(bookId);
    if (!found) return;
    const { book, group: sourceGroup } = found;
    if (sourceGroup.series_name === destGroup.series_name) return;

    const isDestOneOff = destGroup.series_name === "One-offs";
    const newSeriesName = isDestOneOff ? null : destGroup.series_name;
    const newPosition = isDestOneOff ? null : destGroup.books.length + 1;
    const snapshot = { series_name: book.series_name, series_position: book.series_position };

    setGroups((prev) => {
      const updatedBook: BookWithRecord = { ...book, series_name: newSeriesName, series_position: newPosition };
      let next = prev
        .map((g) => (g.series_name === sourceGroup.series_name
          ? { ...g, books: g.books.filter((b) => b.id !== bookId) }
          : g))
        .filter((g) => g.books.length > 0 || g.series_name === destGroup.series_name);

      const destIdx = next.findIndex((g) => g.series_name === destGroup.series_name);
      if (destIdx >= 0) {
        next = next.map((g, i) => (i === destIdx ? { ...g, books: [...g.books, updatedBook] } : g));
      } else {
        next = [...next, { ...destGroup, books: [updatedBook] }];
      }
      return next;
    });

    await supabase
      .from("books")
      .update({ series_name: newSeriesName, series_position: newPosition })
      .eq("id", bookId);

    showUndo(`Moved "${book.title}" to ${destGroup.series_name}`, async () => {
      await supabase
        .from("books")
        .update({ series_name: snapshot.series_name, series_position: snapshot.series_position })
        .eq("id", bookId);
      await loadBooks();
    });
  }

  function openMergePrompt(bookIdA: string, bookIdB: string) {
    setNewSeriesModal({ bookIdA, bookIdB, value: "" });
  }

  async function confirmNewSeries() {
    if (!newSeriesModal) return;
    const { bookIdA, bookIdB, value } = newSeriesModal;
    const name = value.trim();
    if (!name) return;

    const oneOffs = groups.find((g) => g.series_name === "One-offs");
    const bookA = oneOffs?.books.find((b) => b.id === bookIdA);
    const bookB = oneOffs?.books.find((b) => b.id === bookIdB);
    if (!bookA || !bookB) { setNewSeriesModal(null); return; }

    setGroups((prev) => {
      const newGroup: SeriesGroup = {
        series_name: name,
        author: bookA.author,
        books: [
          { ...bookA, series_name: name, series_position: 1 },
          { ...bookB, series_name: name, series_position: 2 },
        ],
        max_position: 2,
        total_known: 2,
      };
      const next = prev
        .map((g) => (g.series_name === "One-offs"
          ? { ...g, books: g.books.filter((b) => b.id !== bookIdA && b.id !== bookIdB) }
          : g))
        .filter((g) => g.series_name !== "One-offs" || g.books.length > 0);
      return [...next, newGroup];
    });

    await supabase.from("books").update({ series_name: name, series_position: 1 }).eq("id", bookIdA);
    await supabase.from("books").update({ series_name: name, series_position: 2 }).eq("id", bookIdB);

    setNewSeriesModal(null);
    showUndo(`Created series "${name}"`, async () => {
      await supabase.from("books").update({ series_name: null, series_position: null }).eq("id", bookIdA);
      await supabase.from("books").update({ series_name: null, series_position: null }).eq("id", bookIdB);
      await loadBooks();
    });
  }

  function openRename(group: SeriesGroup) {
    setRenameModal({ seriesName: group.series_name, value: group.series_name });
  }

  async function confirmRename() {
    if (!renameModal) return;
    const { seriesName, value } = renameModal;
    const newName = value.trim();
    if (!newName || newName === seriesName) { setRenameModal(null); return; }

    const group = groups.find((g) => g.series_name === seriesName);
    if (!group) { setRenameModal(null); return; }

    setGroups((prev) =>
      prev.map((g) => (g.series_name === seriesName ? { ...g, series_name: newName } : g))
    );

    await Promise.all(
      group.books.map((b) => supabase.from("books").update({ series_name: newName }).eq("id", b.id))
    );

    setRenameModal(null);
    showUndo(`Renamed to "${newName}"`, async () => {
      await Promise.all(
        group.books.map((b) => supabase.from("books").update({ series_name: seriesName }).eq("id", b.id))
      );
      await loadBooks();
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveBook(null);
    const { active, over } = event;
    if (!over) return;
    const activeId = active.id as string;
    const overId = over.id as string;
    if (activeId === overId) return;

    const activeContainerId = (active.data.current as { containerId?: string } | undefined)?.containerId;
    const overData = over.data.current as { containerId?: string; isContainer?: boolean } | undefined;
    const overContainerId = overData?.containerId;
    const overIsContainer = !!overData?.isContainer;
    if (!activeContainerId || !overContainerId) return;

    const sourceGroup = groups.find((g) => g.series_name === activeContainerId);
    const destGroup = groups.find((g) => g.series_name === overContainerId);
    if (!sourceGroup || !destGroup) return;

    if (activeContainerId === overContainerId) {
      if (overIsContainer) return;
      if (activeContainerId === "One-offs") {
        openMergePrompt(activeId, overId);
      } else {
        reorderWithinGroup(sourceGroup, activeId, overId);
      }
      return;
    }

    moveBookToGroup(activeId, destGroup);
  }

  const totalRead = groups.reduce((s, g) => s + g.books.filter((b) => b.liked).length, 0);
  const totalBooks = groups.reduce((s, g) => s + g.books.length, 0);

  const approvedLevel = currentProfile?.approved_level ?? 1;
  const eligibleLevel = levelFor(totalRead).level;
  const levelUpPending = eligibleLevel > approvedLevel;
  const qualifyingBooks = groups
    .flatMap((g) => g.books)
    .filter((b) => b.liked)
    .sort((a, b) => new Date(b.read_at).getTime() - new Date(a.read_at).getTime())
    .slice(0, Math.max(1, (eligibleLevel - approvedLevel) * BOOKS_PER_LEVEL));

  async function approveLevel() {
    if (!currentProfile) return;
    setApproving(true);
    setApproveError(null);
    try {
      const res = await fetch("/api/profile/approve-level", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: currentProfile.id, pin: levelUpPin }),
      });
      const json = await res.json();
      if (!res.ok) {
        setApproveError(json.error || "Something went wrong");
        return;
      }
      setCurrentProfile({ ...currentProfile, approved_level: json.profile.approved_level });
      setJustApprovedLevel(json.profile.approved_level);
      setShowLevelUpModal(false);
      setLevelUpPin("");
    } catch {
      setApproveError("Couldn't reach the server");
    } finally {
      setApproving(false);
    }
  }

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
        <TreehouseProgressCard
          totalRead={totalRead}
          approvedLevel={approvedLevel}
          color={color}
          onLevelUpClick={() => setShowLevelUpModal(true)}
        />
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
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <AnimatePresence>
            {arrangeMode && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex-shrink-0 px-5 overflow-hidden"
              >
                <div
                  className="flex items-center gap-2 px-3 py-2 mb-2 rounded-xl text-xs font-bold"
                  style={{
                    background: "rgba(255,200,0,0.10)",
                    border: "1px solid rgba(255,200,0,0.3)",
                    color: "#FFD700",
                  }}
                >
                  <Move size={13} className="flex-shrink-0" />
                  Drag books to rearrange them — tap &quot;Lock Shelves&quot; when you&apos;re done.
                </div>
              </motion.div>
            )}
          </AnimatePresence>

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
                  arrangeMode={arrangeMode}
                  onBookClick={(book) => setSelectedBook(book)}
                  onTitleClick={openRename}
                />
              </motion.div>
            ))}
            {/* Bottom breathing room */}
            <div className="h-4" />
          </div>

          <DragOverlay>
            {activeBook && (
              <div style={{ touchAction: "none" }}>
                <Book
                  title={activeBook.title}
                  coverUrl={activeBook.cover_url}
                  position={activeBook.series_position}
                  state={stateOf(activeBook)}
                />
              </div>
            )}
          </DragOverlay>
        </DndContext>
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
          onClick={() => setArrangeMode((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-2.5 rounded-full text-xs font-bold transition-all active:scale-95 whitespace-nowrap"
          style={
            arrangeMode
              ? {
                  background: "linear-gradient(135deg, #FFD700 0%, #FFA500 100%)",
                  border: "1.5px solid rgba(255,200,0,0.6)",
                  color: "#1a0f00",
                }
              : {
                  background: "rgba(243,199,91,0.07)",
                  border: "1.5px solid rgba(243,199,91,0.28)",
                  color: "#F3C75B",
                }
          }
        >
          {arrangeMode ? <Lock size={13} /> : <Move size={13} />}
          {arrangeMode ? "Lock Shelves" : "Rearrange"}
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
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {!selectedBook.liked && (
                      <button
                        onClick={() => toggleCurrentlyReading(selectedBook)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full transition-all active:scale-95"
                        style={{
                          background: selectedBook.currently_reading ? "rgba(255,200,0,0.18)" : "rgba(255,255,255,0.06)",
                          border: `1px solid ${selectedBook.currently_reading ? "rgba(255,200,0,0.5)" : "rgba(255,255,255,0.15)"}`,
                          color: selectedBook.currently_reading ? "#FFD700" : "rgba(255,255,255,0.5)",
                        }}
                      >
                        <BookOpen size={12} />
                        {selectedBook.currently_reading ? "Currently Reading" : "Mark as Currently Reading"}
                      </button>
                    )}
                    <Link
                      href={`/${profileId}/add?author=${encodeURIComponent(selectedBook.author)}`}
                      className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full transition-all active:scale-95"
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

      {/* ── Rename series modal ── */}
      <AnimatePresence>
        {renameModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-6"
            style={{ background: "rgba(0,0,0,0.75)" }}
            onClick={(e) => e.target === e.currentTarget && setRenameModal(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", bounce: 0.28 }}
              className="w-full max-w-sm rounded-3xl p-5"
              style={{
                background: "linear-gradient(145deg, #1E1008 0%, #150C04 100%)",
                border: "1px solid rgba(255,215,0,0.12)",
                boxShadow: "0 20px 60px rgba(0,0,0,0.8)",
              }}
            >
              <p className="text-xs font-black tracking-widest uppercase mb-2" style={{ color: "#F3C75B" }}>
                Rename Series
              </p>
              <input
                autoFocus
                value={renameModal.value}
                onChange={(e) => setRenameModal({ ...renameModal, value: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && confirmRename()}
                className="w-full px-4 py-3 rounded-xl text-white font-bold text-base mb-4 outline-none"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)" }}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setRenameModal(null)}
                  className="flex-1 py-3 rounded-xl font-bold text-sm text-white/50"
                  style={{ background: "rgba(255,255,255,0.06)" }}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmRename}
                  className="flex-1 py-3 rounded-xl font-black text-sm text-white"
                  style={{ background: "linear-gradient(135deg, #1e3a8a, #2563eb)" }}
                >
                  Save
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── New series naming modal (merging two one-offs) ── */}
      <AnimatePresence>
        {newSeriesModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-6"
            style={{ background: "rgba(0,0,0,0.75)" }}
            onClick={(e) => e.target === e.currentTarget && setNewSeriesModal(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", bounce: 0.28 }}
              className="w-full max-w-sm rounded-3xl p-5"
              style={{
                background: "linear-gradient(145deg, #1E1008 0%, #150C04 100%)",
                border: "1px solid rgba(255,215,0,0.12)",
                boxShadow: "0 20px 60px rgba(0,0,0,0.8)",
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={14} color="#F3C75B" />
                <p className="text-xs font-black tracking-widest uppercase" style={{ color: "#F3C75B" }}>
                  Start a New Series
                </p>
              </div>
              <p className="text-white/40 text-xs mb-3">
                What should we call this series?
              </p>
              <input
                autoFocus
                placeholder="Series name…"
                value={newSeriesModal.value}
                onChange={(e) => setNewSeriesModal({ ...newSeriesModal, value: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && confirmNewSeries()}
                className="w-full px-4 py-3 rounded-xl text-white font-bold text-base mb-4 outline-none"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)" }}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setNewSeriesModal(null)}
                  className="flex-1 py-3 rounded-xl font-bold text-sm text-white/50"
                  style={{ background: "rgba(255,255,255,0.06)" }}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmNewSeries}
                  className="flex-1 py-3 rounded-xl font-black text-sm text-white"
                  style={{ background: "linear-gradient(135deg, #1e3a8a, #2563eb)" }}
                >
                  Create
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Undo toast ── */}
      <AnimatePresence>
        {undoToast && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl"
            style={{
              background: "rgba(20,12,4,0.95)",
              border: "1px solid rgba(243,199,91,0.25)",
              boxShadow: "0 8px 30px rgba(0,0,0,0.6)",
            }}
          >
            <p className="text-white/80 text-xs font-semibold whitespace-nowrap">{undoToast.message}</p>
            <button
              onClick={handleUndo}
              className="flex items-center gap-1 text-xs font-black px-2 py-1 rounded-full"
              style={{ color: "#F3C75B" }}
            >
              <Undo2 size={12} /> Undo
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Level-up parent approval modal ── */}
      <AnimatePresence>
        {showLevelUpModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-4"
            style={{ background: "rgba(0,0,0,0.8)" }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowLevelUpModal(false);
                setLevelUpPin("");
                setApproveError(null);
              }
            }}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: "spring", bounce: 0.28 }}
              className="w-full max-w-sm rounded-3xl overflow-hidden"
              style={{
                background: "linear-gradient(145deg, #1E1008 0%, #150C04 100%)",
                border: "1px solid rgba(255,215,0,0.2)",
                boxShadow: "0 20px 60px rgba(0,0,0,0.8)",
              }}
            >
              <div
                className="px-6 pt-6 pb-4 text-center"
                style={{
                  background: "linear-gradient(180deg, rgba(255,200,0,0.12) 0%, transparent 100%)",
                  borderBottom: "1px solid rgba(255,200,0,0.15)",
                }}
              >
                <Lock size={28} color="#FFD700" className="mx-auto mb-2" />
                <p className="text-xs font-black tracking-widest uppercase mb-1" style={{ color: "rgba(255,200,0,0.7)" }}>
                  Ask a Grown-Up
                </p>
                <h2 className="text-xl font-black text-white leading-tight">
                  {currentProfile?.name} is ready for Level {eligibleLevel}!
                </h2>
              </div>

              <div className="px-6 py-5">
                <p className="text-white/40 text-xs font-bold uppercase tracking-wide mb-2">
                  Books read to get here
                </p>
                <div className="flex gap-2 overflow-x-auto no-scrollbar mb-5 pb-1">
                  {qualifyingBooks.map((b) => (
                    <div key={b.id} className="flex-shrink-0 w-14 text-center">
                      <div
                        className="w-14 h-20 rounded-lg overflow-hidden mb-1 bg-amber-900/40 flex items-center justify-center text-xl"
                        style={{ border: "1px solid rgba(255,215,0,0.15)" }}
                      >
                        {b.cover_url ? (
                          <Image src={b.cover_url} alt={b.title} width={56} height={80} className="object-cover w-full h-full" unoptimized />
                        ) : "📖"}
                      </div>
                      <p className="text-[8px] text-white/40 font-semibold line-clamp-2 leading-tight">{b.title}</p>
                    </div>
                  ))}
                </div>

                <p className="text-white/40 text-xs font-bold uppercase tracking-wide mb-2">
                  Parent PIN
                </p>
                <input
                  type="password"
                  inputMode="numeric"
                  autoFocus
                  value={levelUpPin}
                  onChange={(e) => { setLevelUpPin(e.target.value); setApproveError(null); }}
                  onKeyDown={(e) => e.key === "Enter" && approveLevel()}
                  className="w-full px-4 py-3 rounded-xl text-white font-bold text-base mb-2 outline-none tracking-widest"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)" }}
                  placeholder="••••"
                />
                {approveError && (
                  <p className="text-xs font-bold mb-3" style={{ color: "#FF6B6B" }}>{approveError}</p>
                )}

                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => { setShowLevelUpModal(false); setLevelUpPin(""); setApproveError(null); }}
                    className="flex-1 py-3 rounded-xl font-bold text-sm text-white/50"
                    style={{ background: "rgba(255,255,255,0.06)" }}
                  >
                    Not yet
                  </button>
                  <button
                    onClick={approveLevel}
                    disabled={approving || !levelUpPin}
                    className="flex-1 py-3 rounded-xl font-black text-sm text-black disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg, #FFD700 0%, #FFA500 100%)" }}
                  >
                    {approving ? "Checking…" : "Approve"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Level approved celebration ── */}
      <AnimatePresence>
        {justApprovedLevel != null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-6"
            style={{ background: "rgba(0,0,0,0.85)" }}
          >
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
                  className="mb-3 flex justify-center"
                >
                  <Trophy size={48} color="#FFD700" />
                </motion.div>
                <p className="text-xs font-black tracking-widest uppercase mb-1" style={{ color: "rgba(255,200,0,0.6)" }}>
                  Level Up!
                </p>
                <h2 className="text-2xl font-black text-white leading-tight">
                  Level {justApprovedLevel} Unlocked
                </h2>
              </div>

              <div className="px-6 py-5">
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setJustApprovedLevel(null)}
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
    </div>
  );
}
