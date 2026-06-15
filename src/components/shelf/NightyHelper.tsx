"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const MESSAGES = [
  "Keep reading! Adventure awaits. ⭐",
  "Every book makes you smarter! 🧠",
  "What will you read next? 📖",
  "You're doing amazing! 🎉",
  "Books are magic portals! ✨",
];

export function NightyHelper() {
  const [msgIdx] = useState(() => Math.floor(Math.random() * MESSAGES.length));
  const [visible, setVisible] = useState(true);

  return (
    <div className="absolute bottom-20 right-4 flex flex-col items-end gap-2 z-20 pointer-events-none select-none">
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85 }}
            className="relative px-3 py-2 rounded-2xl rounded-br-sm max-w-[160px] pointer-events-auto cursor-pointer"
            style={{
              background: "rgba(20,10,2,0.95)",
              border: "1px solid rgba(255,215,0,0.2)",
              boxShadow: "0 4px 20px rgba(0,0,0,0.6)",
            }}
            onClick={() => setVisible(false)}
          >
            <p className="text-white/80 text-[11px] font-medium leading-snug">
              {MESSAGES[msgIdx]}
            </p>
            {/* Tail */}
            <div
              className="absolute -bottom-2 right-4 w-4 h-2 overflow-hidden"
            >
              <div
                className="w-4 h-4 rotate-45 origin-top-right"
                style={{
                  background: "rgba(20,10,2,0.95)",
                  border: "1px solid rgba(255,215,0,0.2)",
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Nighty bird */}
      <motion.button
        className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl pointer-events-auto shadow-2xl"
        style={{
          background: "linear-gradient(135deg, #1E1008, #2A1A08)",
          border: "1.5px solid rgba(255,215,0,0.2)",
        }}
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        onClick={() => setVisible((v) => !v)}
        title="Nighty says hi!"
      >
        🦜
      </motion.button>
    </div>
  );
}
