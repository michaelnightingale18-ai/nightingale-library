"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { Search, CheckCircle, Book, BookOpen, Layers, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useStore } from "@/store/useStore";
import type { BookSearchResult } from "@/lib/types";

type Mode = "book" | "series";

interface SeriesBook {
  title: string; author: string; cover_url?: string; isbn?: string;
  series_name: string; series_position: number; total_in_series?: number; google_books_id?: string;
}

interface SeriesSuggestion {
  name: string; author: string; total_known: number; cover_url?: string;
}

async function upsertBook(b: Omit<BookSearchResult, "description" | "open_library_id"> & { series_name?: string; series_position?: number; total_in_series?: number }) {
  if (b.isbn) {
    const { data } = await supabase.from("books").select("*").eq("isbn", b.isbn).single();
    if (data) {
      const needsUpdate =
        (!data.cover_url && b.cover_url) ||
        (!data.series_position && b.series_position) ||
        (!data.total_in_series && b.total_in_series);
      if (needsUpdate) {
        const { data: updated } = await supabase.from("books")
          .update({
            cover_url: b.cover_url || data.cover_url,
            series_position: b.series_position || data.series_position,
            total_in_series: b.total_in_series || data.total_in_series,
          })
          .eq("id", data.id)
          .select()
          .single();
        return updated || data;
      }
      return data;
    }
  }
  const { data } = await supabase.from("books").insert({
    title: b.title, author: b.author, cover_url: b.cover_url || null,
    isbn: b.isbn || null, series_name: b.series_name || null,
    series_position: b.series_position || null, total_in_series: b.total_in_series || null,
    google_books_id: b.google_books_id || null,
  }).select().single();
  return data;
}

export default function AddBookPage() {
  const params = useParams();
  const router = useRouter();
  const profileId = params.profileId as string;
  const { currentProfile } = useStore();
  const color = currentProfile?.color || "#f59e0b";
  const [mode, setMode] = useState<Mode>("series");

  // ── Single book ──
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BookSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<BookSearchResult | null>(null);
  // "idle" → tap Add → "choosing" (Read / Unread) → "saving" → "done"
  const [addStep, setAddStep] = useState<"idle" | "choosing" | "saving" | "done">("idle");
  const [addingFullSeries, setAddingFullSeries] = useState(false);
  const [fullSeriesDone, setFullSeriesDone] = useState(false);
  const bookDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Series ──
  const [seriesQuery, setSeriesQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SeriesSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [chosenSeries, setChosenSeries] = useState<SeriesSuggestion | null>(null);
  const [seriesBooks, setSeriesBooks] = useState<SeriesBook[]>([]);
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [seriesSaving, setSeriesSaving] = useState(false);
  const [seriesDone, setSeriesDone] = useState(false);
  const [seriesError, setSeriesError] = useState(false);
  const seriesDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Book search ──
  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`/api/books/search?q=${encodeURIComponent(q.trim())}`);
      setResults((await res.json()).results || []);
    } finally { setSearching(false); }
  }, []);

  function handleQueryChange(val: string) {
    setQuery(val); setSelected(null); setAddStep("idle"); setFullSeriesDone(false);
    if (bookDebounce.current) clearTimeout(bookDebounce.current);
    bookDebounce.current = setTimeout(() => doSearch(val), 500);
  }

  async function addBook(liked: boolean) {
    if (!selected) return;
    setAddStep("saving");
    const book = await upsertBook(selected as BookSearchResult & { series_name?: string; series_position?: number });
    if (!book) { setAddStep("choosing"); return; }
    await supabase.from("reading_records").upsert(
      { profile_id: profileId, book_id: book.id, liked, read_at: new Date().toISOString() },
      { onConflict: "profile_id,book_id" }
    );
    setAddStep("done");
    setTimeout(() => router.push(`/${profileId}`), 900);
  }

  async function addFullSeriesFromBook() {
    if (!selected?.series_name) return;
    setAddingFullSeries(true);
    const res = await fetch(
      `/api/series/expand?series=${encodeURIComponent(selected.series_name)}&author=${encodeURIComponent(selected.author)}`
    );
    const { books } = await res.json();
    for (const b of books as SeriesBook[]) {
      const book = await upsertBook(b);
      if (!book) continue;
      await supabase.from("reading_records").upsert(
        { profile_id: profileId, book_id: book.id, liked: false, read_at: new Date().toISOString() },
        { onConflict: "profile_id,book_id" }
      );
    }
    setAddingFullSeries(false);
    setFullSeriesDone(true);
    setTimeout(() => router.push(`/${profileId}`), 1200);
  }

  // ── Series search as you type ──
  useEffect(() => {
    if (seriesDebounce.current) clearTimeout(seriesDebounce.current);
    if (seriesQuery.trim().length < 2) { setSuggestions([]); return; }
    seriesDebounce.current = setTimeout(async () => {
      setSuggestionsLoading(true);
      try {
        const res = await fetch(`/api/series/search?q=${encodeURIComponent(seriesQuery.trim())}`);
        setSuggestions((await res.json()).series || []);
      } finally { setSuggestionsLoading(false); }
    }, 400);
  }, [seriesQuery]);

  async function selectSeries(s: SeriesSuggestion) {
    setChosenSeries(s);
    setSuggestions([]);
    setSeriesLoading(true);
    setSeriesError(false);
    try {
      const res = await fetch(
        `/api/series/expand?series=${encodeURIComponent(s.name)}&author=${encodeURIComponent(s.author)}&count=${s.total_known}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const books = data.books || [];
      if (books.length === 0) setSeriesError(true);
      setSeriesBooks(books);
    } catch {
      setSeriesError(true);
    } finally {
      setSeriesLoading(false);
    }
  }

  async function addWholeSeries() {
    if (!seriesBooks.length || !chosenSeries) return;
    setSeriesSaving(true);
    for (const b of seriesBooks) {
      const book = await upsertBook(b);
      if (!book) continue;
      // liked=false = on shelf but not yet read (greyscale)
      await supabase.from("reading_records").upsert(
        { profile_id: profileId, book_id: book.id, liked: false, read_at: new Date().toISOString() },
        { onConflict: "profile_id,book_id" }
      );
    }
    setSeriesSaving(false);
    setSeriesDone(true);
    setTimeout(() => router.push(`/${profileId}`), 1500);
  }

  return (
    <div className="h-full flex flex-col wood-bg overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-12 pb-3 flex-shrink-0"
        style={{ background: `linear-gradient(135deg, ${color}33, transparent)` }}>
        <h1 className="text-3xl font-bold text-white/90">Add Books 📖</h1>
        <p className="text-amber-400/60 font-medium mt-0.5">What have you been reading?</p>
      </div>

      {/* Mode toggle */}
      <div className="px-4 pt-2 pb-3 flex-shrink-0">
        <div className="flex rounded-2xl p-1 gap-1" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
          {([["series", "Full Series", Layers], ["book", "One Book", BookOpen]] as const).map(([m, label, Icon]) => (
            <button key={m} onClick={() => setMode(m)}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all"
              style={{ backgroundColor: mode === m ? color : "transparent", color: mode === m ? "white" : "rgba(255,255,255,0.3)" }}>
              <Icon size={18} />{label}
            </button>
          ))}
        </div>
      </div>

      {/* ──────────────── SERIES MODE ──────────────── */}
      {mode === "series" && (
        <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-4">

          {/* Series search input */}
          {!chosenSeries && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-400" size={22} />
                <input type="text" placeholder="Search for a series… e.g. Dragon Masters"
                  value={seriesQuery} onChange={(e) => setSeriesQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 rounded-2xl text-white/90 placeholder:text-white/25 text-lg font-medium outline-none"
                  style={{ background: "rgba(255,255,255,0.07)", border: `2px solid ${seriesQuery ? color : "rgba(255,255,255,0.08)"}` }}
                  autoFocus />
                {suggestionsLoading && (
                  <motion.span animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-2xl">⏳</motion.span>
                )}
              </div>

              {/* Suggestions */}
              <AnimatePresence>
                {suggestions.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }} className="space-y-2">
                    {suggestions.map((s, i) => (
                      <motion.button key={s.name}
                        initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        onClick={() => selectSeries(s)}
                        className="w-full flex items-center gap-4 p-4 rounded-2xl text-left active:scale-[0.98] transition-all"
                        style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${color}33` }}>
                        {s.cover_url ? (
                          <Image src={s.cover_url} alt={s.name} width={44} height={64}
                            className="rounded-lg shadow flex-shrink-0 object-cover" unoptimized />
                        ) : (
                          <div className="w-11 h-16 rounded-lg flex-shrink-0 flex items-center justify-center text-white"
                            style={{ backgroundColor: color }}><Book size={20} /></div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-white/90 text-base truncate">{s.name}</p>
                          <p className="text-white/45 text-sm truncate">{s.author}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <div className="px-2 py-0.5 rounded-full text-xs font-bold text-white"
                              style={{ backgroundColor: color }}>
                              {s.total_known} books found
                            </div>
                          </div>
                        </div>
                        <ChevronRight size={20} className="text-white/25 flex-shrink-0" />
                      </motion.button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Empty hint */}
              {seriesQuery.length < 2 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 2, repeat: Infinity }} className="text-6xl mb-4">📚</motion.div>
                  <p className="text-amber-400/70 font-medium text-lg">Type a series name to search</p>
                  <p className="text-white/30 text-sm mt-1">We&apos;ll find all the books and add them to your shelf</p>
                </div>
              )}
            </div>
          )}

          {/* Loading series books */}
          {chosenSeries && seriesLoading && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 1, repeat: Infinity }} className="text-6xl">📚</motion.div>
              <p className="text-amber-400/70 font-bold text-lg">Finding all {chosenSeries.name} books…</p>
              <p className="text-white/30 text-sm">This can take up to 30 seconds</p>
            </div>
          )}

          {/* Error / empty state */}
          {chosenSeries && !seriesLoading && seriesError && (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
              <div className="text-6xl">😕</div>
              <p className="text-amber-400/80 font-bold text-lg">Couldn&apos;t load {chosenSeries.name}</p>
              <p className="text-white/40 text-sm px-4">The search timed out or returned no results. Please try again.</p>
              <div className="flex gap-3 mt-2">
                <button
                  onClick={() => selectSeries(chosenSeries)}
                  className="px-6 py-3 rounded-2xl text-white font-bold text-sm transition-all active:scale-95"
                  style={{ backgroundColor: color }}>
                  Try Again
                </button>
                <button
                  onClick={() => { setChosenSeries(null); setSeriesBooks([]); setSeriesError(false); }}
                  className="px-6 py-3 rounded-2xl font-bold text-sm text-white/50 transition-all active:scale-95"
                  style={{ background: "rgba(255,255,255,0.08)" }}>
                  Back
                </button>
              </div>
            </div>
          )}

          {/* Series preview */}
          {chosenSeries && !seriesLoading && seriesBooks.length > 0 && !seriesDone && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <button onClick={() => { setChosenSeries(null); setSeriesBooks([]); setSeriesError(false); }}
                  className="text-amber-400 font-bold text-sm">← Back</button>
                <h2 className="text-xl font-bold text-white/90 truncate">{chosenSeries.name}</h2>
              </div>

              <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <p className="font-bold text-white/70 mb-1">
                  {seriesBooks.length} books · {chosenSeries.author}
                </p>
                <p className="text-amber-400/60 text-sm mb-4">
                  All books added in greyscale. Tap each one on your shelf when you finish reading it — you&apos;ll get a celebration! 🎉
                </p>

                {/* Horizontal scroll preview */}
                <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                  {seriesBooks.map((book) => (
                    <div key={book.series_position} className="flex-shrink-0 flex flex-col items-center gap-1.5 w-16">
                      {book.cover_url ? (
                        <Image src={book.cover_url} alt={book.title} width={64} height={92}
                          className="rounded-lg shadow object-cover" unoptimized
                          style={{ filter: "grayscale(100%)", opacity: 0.7 }} />
                      ) : (
                        <div className="rounded-lg flex items-center justify-center text-white text-xs font-bold text-center p-1 shadow"
                          style={{ width: 64, height: 92, backgroundColor: color, filter: "grayscale(100%)", opacity: 0.7 }}>
                          #{book.series_position}
                        </div>
                      )}
                      <span className="text-xs text-amber-400/60 font-bold">#{book.series_position}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button onClick={addWholeSeries} disabled={seriesSaving}
                className="w-full py-5 rounded-2xl text-white text-xl font-bold shadow-lg transition-all active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2"
                style={{ backgroundColor: color }}>
                {seriesSaving ? (
                  <><motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>⏳</motion.span>
                    Adding to shelf…</>
                ) : (
                  <><Layers size={22} />Add All {seriesBooks.length} Books to Shelf</>
                )}
              </button>
            </div>
          )}

          {/* Done */}
          {seriesDone && (
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col items-center justify-center py-16 text-center">
              <div className="text-7xl mb-4">🎉</div>
              <h2 className="text-2xl font-bold" style={{ color }}>Added to your shelf!</h2>
              <p className="text-amber-400/60 mt-2">Tap the books you&apos;ve read to celebrate!</p>
            </motion.div>
          )}
        </div>
      )}

      {/* ──────────────── SINGLE BOOK MODE ──────────────── */}
      {mode === "book" && (
        <>
          <div className="px-4 pb-3 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-400" size={22} />
              <input type="text" placeholder="Search by book title…"
                value={query} onChange={(e) => handleQueryChange(e.target.value)}
                className="w-full pl-12 pr-4 py-4 rounded-2xl text-white/90 placeholder:text-white/25 text-lg font-medium outline-none"
                style={{ background: "rgba(255,255,255,0.07)", border: `2px solid ${searching ? color : "rgba(255,255,255,0.08)"}` }}
                autoFocus />
              {searching && (
                <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-xl">⏳</motion.span>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-4">
            {query.length < 2 && (
              <div className="flex flex-col items-center justify-center h-full text-center py-8">
                <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 2, repeat: Infinity }} className="text-7xl mb-4">🔍</motion.div>
                <p className="text-amber-400/70 text-lg font-medium">Search for a single book</p>
                <p className="text-white/30 text-sm mt-1">Use Full Series mode to add a whole series at once</p>
              </div>
            )}
            {results.length === 0 && query.length >= 2 && !searching && (
              <div className="flex flex-col items-center py-8 text-center">
                <div className="text-5xl mb-3">🤔</div>
                <p className="text-amber-400/60 font-bold">No results found</p>
              </div>
            )}
            <div className="space-y-3">
              {results.map((book, i) => {
                const isSel = selected === book;
                return (
                  <motion.button key={`${book.title}-${i}`}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => { setSelected(isSel ? null : book); setAddStep("idle"); }}
                    className="w-full flex gap-4 p-4 rounded-2xl text-left transition-all active:scale-[0.98]"
                    style={{ background: "rgba(255,255,255,0.06)", border: `2px solid ${isSel ? color : "rgba(255,255,255,0.07)"}` }}>
                    <div className="flex-shrink-0">
                      {book.cover_url
                        ? <Image src={book.cover_url} alt={book.title} width={52} height={75} className="rounded-lg shadow object-cover" unoptimized />
                        : <div className="rounded-lg flex items-center justify-center text-white shadow" style={{ width: 52, height: 75, backgroundColor: color }}><Book size={22} /></div>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-white/90 leading-tight mb-0.5">{book.title}</h3>
                      <p className="text-white/45 text-sm truncate">{book.author}</p>
                      {book.series_name && (
                        <div className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ backgroundColor: color }}>
                          {book.series_name}{book.series_position ? ` #${book.series_position}` : ""}
                        </div>
                      )}
                    </div>
                    {isSel && <CheckCircle size={24} className="flex-shrink-0 mt-1" style={{ color }} />}
                  </motion.button>
                );
              })}
            </div>
          </div>

          <AnimatePresence>
            {selected && (
              <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                exit={{ y: 80, opacity: 0 }} transition={{ type: "spring", bounce: 0.4 }}
                className="flex-shrink-0 px-4 pb-4 space-y-2">

                {/* ── Step 1: Add to Bookshelf pill ── */}
                {addStep === "idle" && (
                  <button onClick={() => setAddStep("choosing")}
                    className="w-full py-4 rounded-2xl text-white text-lg font-bold shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                    style={{ backgroundColor: color }}>
                    <BookOpen size={20} /> Add to Bookshelf
                  </button>
                )}

                {/* ── Step 2: Read or Unread choice ── */}
                {addStep === "choosing" && (
                  <div className="flex gap-2">
                    <button onClick={() => addBook(true)}
                      className="flex-1 py-4 rounded-2xl text-white font-bold text-base transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg"
                      style={{ backgroundColor: color }}>
                      <CheckCircle size={18} /> Read ✓
                    </button>
                    <button onClick={() => addBook(false)}
                      className="flex-1 py-4 rounded-2xl text-white/80 font-bold text-base transition-all active:scale-95 flex items-center justify-center gap-2"
                      style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)" }}>
                      <BookOpen size={18} /> Want to Read
                    </button>
                  </div>
                )}

                {/* ── Saving / Done ── */}
                {(addStep === "saving" || addStep === "done") && (
                  <div className="w-full py-4 rounded-2xl text-white/60 text-base font-bold flex items-center justify-center gap-2"
                    style={{ background: "rgba(255,255,255,0.05)" }}>
                    {addStep === "saving" ? "Adding…" : <><CheckCircle size={20} /> Added to your shelf!</>}
                  </div>
                )}

                {/* ── Add full series (appears in all steps until done) ── */}
                {selected.series_name && addStep !== "saving" && addStep !== "done" && (
                  <button onClick={addFullSeriesFromBook} disabled={addingFullSeries || fullSeriesDone}
                    className="w-full py-3 rounded-2xl text-white/60 text-sm font-bold transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    {fullSeriesDone
                      ? <><CheckCircle size={16} /> Series added!</>
                      : addingFullSeries
                      ? "Adding series…"
                      : <><Layers size={15} /> Add full &ldquo;{selected.series_name}&rdquo; series instead</>}
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
