"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, BookOpen, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/types";

const AVATARS = ["🦁", "🐼", "🦊", "🐸", "🦋", "🐳", "🦄", "🐝", "🐙", "🦕"];
const COLORS = [
  "#FF6B6B",
  "#FFD93D",
  "#6BCF7F",
  "#6BCFFF",
  "#B39DDB",
  "#F48FB1",
  "#FF9A3C",
  "#26C6DA",
];

export default function ProfilePickerPage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAvatar, setNewAvatar] = useState(AVATARS[0]);
  const [newColor, setNewColor] = useState(COLORS[0]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadProfiles();
  }, []);

  async function loadProfiles() {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at");
    setProfiles(data || []);
    setLoading(false);
  }

  async function createProfile() {
    if (!newName.trim()) return;
    setCreating(true);
    const { data, error } = await supabase
      .from("profiles")
      .insert({ name: newName.trim(), avatar: newAvatar, color: newColor })
      .select()
      .single();
    if (!error && data) {
      setProfiles((p) => [...p, data]);
      setShowCreate(false);
      setNewName("");
      router.push(`/${data.id}`);
    }
    setCreating(false);
  }

  return (
    <div className="h-full overflow-auto flex flex-col items-center justify-center bg-gradient-to-b from-amber-100 to-amber-50 px-6 py-10">
      {/* Header */}
      <motion.div
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-center mb-10"
      >
        <div className="text-7xl mb-3 animate-float inline-block">📚</div>
        <h1 className="text-5xl font-bold text-amber-900 leading-tight">
          Nightingale
        </h1>
        <h1 className="text-5xl font-bold text-amber-700 leading-tight">
          Library
        </h1>
        <p className="text-lg text-amber-600 mt-2 font-medium">
          Who&apos;s reading today?
        </p>
      </motion.div>

      {/* Profile grid */}
      {loading ? (
        <div className="flex gap-4">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="w-36 h-44 rounded-3xl shimmer"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap justify-center gap-5 max-w-2xl">
          <AnimatePresence>
            {profiles.map((profile, i) => (
              <motion.button
                key={profile.id}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: i * 0.1, type: "spring", bounce: 0.4 }}
                onClick={() => router.push(`/${profile.id}`)}
                className="profile-card flex flex-col items-center gap-3 w-36 py-6 px-4 rounded-3xl shadow-lg hover:shadow-xl cursor-pointer"
                style={{
                  backgroundColor: profile.color + "22",
                  border: `4px solid ${profile.color}`,
                }}
              >
                <span className="text-5xl">{profile.avatar}</span>
                <span
                  className="text-xl font-bold text-center leading-tight"
                  style={{ color: profile.color }}
                >
                  {profile.name}
                </span>
                <div
                  className="flex items-center gap-1 text-sm font-semibold px-3 py-1 rounded-full"
                  style={{ backgroundColor: profile.color, color: "white" }}
                >
                  <BookOpen size={14} />
                  <span>Open</span>
                </div>
              </motion.button>
            ))}
          </AnimatePresence>

          {/* Add reader */}
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: profiles.length * 0.1 + 0.1 }}
            onClick={() => setShowCreate(true)}
            className="flex flex-col items-center gap-3 w-36 py-6 px-4 rounded-3xl border-4 border-dashed border-amber-300 text-amber-400 hover:border-amber-400 hover:text-amber-500 transition-colors cursor-pointer profile-card"
          >
            <Plus size={44} strokeWidth={2.5} />
            <span className="text-lg font-bold text-center">Add Reader</span>
          </motion.button>
        </div>
      )}

      {/* Create profile modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 px-4 pb-8"
            onClick={(e) =>
              e.target === e.currentTarget && setShowCreate(false)
            }
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: "spring", bounce: 0.3 }}
              className="bg-white rounded-3xl p-7 w-full max-w-md shadow-2xl"
            >
              <div className="flex items-center gap-2 mb-5">
                <Sparkles className="text-amber-500" size={24} />
                <h2 className="text-2xl font-bold text-gray-800">
                  New Reader!
                </h2>
              </div>

              <input
                type="text"
                placeholder="What's your name?"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full text-2xl font-bold text-center rounded-2xl px-4 py-3 mb-5 outline-none"
                style={{ border: "3px solid #fcd34d" }}
                onFocus={(e) =>
                  (e.currentTarget.style.border = "3px solid #f59e0b")
                }
                onBlur={(e) =>
                  (e.currentTarget.style.border = "3px solid #fcd34d")
                }
                maxLength={20}
                autoFocus
              />

              <p className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-2">
                Pick your avatar
              </p>
              <div className="flex flex-wrap gap-2 mb-5">
                {AVATARS.map((a) => (
                  <button
                    key={a}
                    onClick={() => setNewAvatar(a)}
                    className="text-3xl w-12 h-12 rounded-2xl transition-all"
                    style={{
                      background: newAvatar === a ? "#fef3c7" : "transparent",
                      border:
                        newAvatar === a
                          ? "3px solid #f59e0b"
                          : "3px solid transparent",
                      transform: newAvatar === a ? "scale(1.15)" : "scale(1)",
                    }}
                  >
                    {a}
                  </button>
                ))}
              </div>

              <p className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-2">
                Pick your color
              </p>
              <div className="flex gap-3 mb-6">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewColor(c)}
                    className="w-9 h-9 rounded-full transition-all"
                    style={{
                      backgroundColor: c,
                      transform: newColor === c ? "scale(1.25)" : "scale(1)",
                      boxShadow:
                        newColor === c
                          ? `0 0 0 3px white, 0 0 0 5px ${c}`
                          : "none",
                    }}
                  />
                ))}
              </div>

              <div className="flex justify-center mb-6">
                <div
                  className="flex flex-col items-center gap-2 px-6 py-4 rounded-2xl"
                  style={{
                    backgroundColor: newColor + "22",
                    border: `3px solid ${newColor}`,
                  }}
                >
                  <span className="text-4xl">{newAvatar}</span>
                  <span
                    className="text-lg font-bold"
                    style={{ color: newColor }}
                  >
                    {newName || "Your name"}
                  </span>
                </div>
              </div>

              <button
                onClick={createProfile}
                disabled={!newName.trim() || creating}
                className="w-full py-4 rounded-2xl text-white text-xl font-bold disabled:opacity-50 transition-all active:scale-95"
                style={{ backgroundColor: newColor }}
              >
                {creating ? "Creating..." : "Let's Read! 🚀"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
