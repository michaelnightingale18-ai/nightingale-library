"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import { Bell } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useStore } from "@/store/useStore";
import { groupBySeries } from "@/lib/books";
import type { SeriesGroup, ReleaseAlert } from "@/lib/types";

export default function SeriesPage() {
  const params = useParams();
  const profileId = params.profileId as string;
  const { currentProfile } = useStore();
  const [groups, setGroups] = useState<SeriesGroup[]>([]);
  const [alerts, setAlerts] = useState<ReleaseAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const [recordsRes, alertsRes] = await Promise.all([
      supabase
        .from("reading_records")
        .select("id, book_id, liked, read_at, currently_reading, book:books(*)")
        .eq("profile_id", profileId)
        .order("read_at", { ascending: false }),
      supabase
        .from("release_alerts")
        .select("*")
        .eq("seen", false)
        .order("created_at", { ascending: false }),
    ]);

    if (recordsRes.data) {
      const records = (recordsRes.data as unknown) as Parameters<typeof groupBySeries>[0];
      const g = groupBySeries(records).filter(
        (g) => g.series_name !== "One-offs"
      );
      setGroups(g);
    }
    setAlerts(alertsRes.data || []);
    setLoading(false);
  }, [profileId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function dismissAlert(id: string) {
    await supabase.from("release_alerts").update({ seen: true }).eq("id", id);
    setAlerts((a) => a.filter((x) => x.id !== id));
  }

  const seriesGroups = groups;

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-amber-50">
        <motion.div
          animate={{ y: [0, -12, 0] }}
          transition={{ duration: 1.2, repeat: Infinity }}
          className="text-6xl"
        >
          📊
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-amber-50 no-scrollbar">
      {/* Header */}
      <div
        className="px-5 pt-12 pb-5"
        style={{
          background: `linear-gradient(135deg, ${currentProfile?.color || "#FFD93D"}33, transparent)`,
        }}
      >
        <h1
          className="text-3xl font-bold"
          style={{ color: currentProfile?.color || "#92400e" }}
        >
          Series Tracker 📊
        </h1>
        <p className="text-amber-600 font-medium mt-0.5">
          {seriesGroups.length === 0
            ? "No series yet"
            : `${seriesGroups.length} series in progress`}
        </p>
      </div>

      {/* New release alerts */}
      {alerts.length > 0 && (
        <div className="px-4 mb-4 space-y-2">
          {alerts.map((alert) => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-start gap-3 p-4 rounded-2xl shadow-md"
              style={{
                backgroundColor: (currentProfile?.color || "#FFD93D") + "22",
                border: `2px solid ${currentProfile?.color || "#FFD93D"}`,
              }}
            >
              <Bell
                size={22}
                className="flex-shrink-0 mt-0.5"
                style={{ color: currentProfile?.color }}
              />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-800 text-sm">
                  New in {alert.series_name}!
                </p>
                <p className="text-gray-600 text-sm">{alert.book_title}</p>
                {alert.release_info && (
                  <p className="text-gray-400 text-xs mt-0.5">
                    {alert.release_info}
                  </p>
                )}
              </div>
              <button
                onClick={() => dismissAlert(alert.id)}
                className="text-gray-400 text-lg leading-none flex-shrink-0"
              >
                ×
              </button>
            </motion.div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {seriesGroups.length === 0 && (
        <div className="flex flex-col items-center justify-center px-8 py-16 text-center">
          <motion.div
            animate={{ rotate: [-5, 5, -5] }}
            transition={{ duration: 3, repeat: Infinity }}
            className="text-8xl mb-5"
          >
            📚
          </motion.div>
          <h2 className="text-2xl font-bold text-amber-800 mb-2">
            No series yet!
          </h2>
          <p className="text-amber-600 mb-6 text-lg">
            Add books that are part of a series
          </p>
          <Link
            href={`/${profileId}/add`}
            className="px-6 py-3 rounded-2xl text-white font-bold text-lg"
            style={{ backgroundColor: currentProfile?.color || "#f59e0b" }}
          >
            Add a Series Book
          </Link>
        </div>
      )}

      {/* Series cards */}
      <div className="px-4 pb-6 space-y-5">
        {seriesGroups.map((group, i) => {
          const pct =
            group.total_known > 0
              ? Math.round((group.books.length / group.total_known) * 100)
              : null;
          const maxPos = group.max_position || group.books.length;
          const next = maxPos + 1;
          const hasMoreKnown =
            group.total_known > 0 && group.books.length < group.total_known;

          return (
            <motion.div
              key={group.series_name}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="bg-white rounded-3xl shadow-md p-5"
            >
              {/* Series title */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0 pr-2">
                  <h2 className="text-xl font-bold text-gray-800 leading-tight">
                    {group.series_name}
                  </h2>
                  <p className="text-gray-500 text-sm">{group.author}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <span
                    className="text-3xl font-bold"
                    style={{ color: currentProfile?.color }}
                  >
                    {group.books.length}
                  </span>
                  {group.total_known > 0 && (
                    <span className="text-gray-400 text-xl">
                      /{group.total_known}
                    </span>
                  )}
                  <p className="text-gray-400 text-xs">books read</p>
                </div>
              </div>

              {/* Progress bar */}
              {pct !== null && (
                <div className="mb-4">
                  <div className="flex justify-between text-xs font-bold text-gray-400 mb-1">
                    <span>Progress</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="h-4 bg-amber-50 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ delay: i * 0.08 + 0.3, duration: 0.9 }}
                      className="h-full rounded-full"
                      style={{
                        background: `linear-gradient(90deg, ${currentProfile?.color || "#f59e0b"}, ${currentProfile?.color || "#f59e0b"}bb)`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Status chips */}
              <div className="flex flex-wrap gap-2">
                <div className="px-3 py-1.5 bg-amber-50 rounded-full">
                  <span className="text-sm font-bold text-amber-700">
                    📖 On book {maxPos}
                  </span>
                </div>
                {hasMoreKnown && (
                  <div
                    className="px-3 py-1.5 rounded-full"
                    style={{
                      backgroundColor:
                        (currentProfile?.color || "#f59e0b") + "22",
                    }}
                  >
                    <span
                      className="text-sm font-bold"
                      style={{ color: currentProfile?.color }}
                    >
                      ➡️ Next: Book {next}
                    </span>
                  </div>
                )}
                {pct === 100 && (
                  <div className="px-3 py-1.5 bg-green-50 rounded-full">
                    <span className="text-sm font-bold text-green-600">
                      ✅ Series Complete!
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
