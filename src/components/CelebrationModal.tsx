"use client";
import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import Image from "next/image";
import type { Book } from "@/lib/types";

interface Props {
  book: Book | null;
  profileName: string;
  onClose: () => void;
}

export default function CelebrationModal({ book, profileName, onClose }: Props) {
  const hasRun = useRef(false);

  useEffect(() => {
    if (!book || hasRun.current) return;
    hasRun.current = true;

    const duration = 3500;
    const end = Date.now() + duration;
    const colors = ["#FF6B6B", "#FFD93D", "#6BCF7F", "#6BCFFF", "#B39DDB", "#FF9A3C"];

    const burst = () => {
      const timeLeft = end - Date.now();
      if (timeLeft <= 0) return;

      const count = 60 * (timeLeft / duration);
      confetti({
        particleCount: count,
        spread: 120,
        origin: { x: Math.random() * 0.3 + 0.1, y: -0.1 },
        colors,
        zIndex: 9999,
        startVelocity: 45,
        gravity: 0.8,
      });
      confetti({
        particleCount: count,
        spread: 120,
        origin: { x: Math.random() * 0.3 + 0.6, y: -0.1 },
        colors,
        zIndex: 9999,
        startVelocity: 45,
        gravity: 0.8,
      });

      requestAnimationFrame(burst);
    };

    // Initial big burst
    confetti({
      particleCount: 200,
      spread: 160,
      origin: { x: 0.5, y: 0.3 },
      colors,
      zIndex: 9999,
      startVelocity: 55,
    });

    const interval = setInterval(burst, 300);
    const timeout = setTimeout(() => {
      clearInterval(interval);
      hasRun.current = false;
    }, duration);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [book]);

  const seriesInfo =
    book?.series_name && book?.series_position
      ? `${book.series_name} #${book.series_position}`
      : null;

  return (
    <AnimatePresence>
      {book && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9998] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.85)" }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.3, rotate: -10, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ type: "spring", bounce: 0.5, duration: 0.6 }}
            className="flex flex-col items-center text-center px-8 max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Stars */}
            <motion.div
              animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.1, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="text-5xl mb-3"
            >
              ⭐🎉⭐
            </motion.div>

            {/* Book cover */}
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="relative mb-5"
            >
              {book.cover_url ? (
                <Image
                  src={book.cover_url}
                  alt={book.title}
                  width={160}
                  height={230}
                  className="rounded-xl shadow-2xl"
                  style={{ objectFit: "cover" }}
                  unoptimized
                />
              ) : (
                <div
                  className="w-40 h-56 rounded-xl shadow-2xl flex items-center justify-center"
                  style={{
                    background: "linear-gradient(135deg, #FFD93D, #FF6B6B)",
                  }}
                >
                  <span className="text-6xl">📖</span>
                </div>
              )}
              {/* Gold ring around cover */}
              <motion.div
                className="absolute -inset-2 rounded-2xl border-4 border-yellow-400"
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
            </motion.div>

            {/* Text */}
            <h2 className="text-4xl font-bold text-white mb-1">
              Amazing, {profileName}!
            </h2>
            <p className="text-yellow-300 font-bold text-xl mb-1">
              You finished reading
            </p>
            <p className="text-white text-2xl font-bold leading-tight mb-1">
              {book.title}
            </p>
            {seriesInfo && (
              <p className="text-yellow-200 text-lg mb-4">{seriesInfo}</p>
            )}
            <p className="text-5xl mb-6 animate-bounce">🌟</p>

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onClose}
              className="px-10 py-4 bg-yellow-400 text-gray-900 font-bold text-xl rounded-full shadow-lg"
            >
              Woohoo! Keep Reading 🚀
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
