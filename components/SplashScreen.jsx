"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import BeeCharacter from "@/components/BeeCharacter";

// First-load splash: Buzz the bee buzzes in along a honey trail, the wordmark
// blooms, then the curtain lifts to reveal the site. Shows once per session and
// collapses to a quick fade when the visitor prefers reduced motion.
const SEEN_KEY = "buzzora-splash-seen";

export default function SplashScreen() {
  const [show, setShow] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(SEEN_KEY)) return;
    setShow(true);
    document.body.style.overflow = "hidden";
    const hold = reduce ? 900 : 2600;
    const t = setTimeout(() => {
      sessionStorage.setItem(SEEN_KEY, "1");
      setShow(false);
      document.body.style.overflow = "";
    }, hold);
    return () => {
      clearTimeout(t);
      document.body.style.overflow = "";
    };
  }, [reduce]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="splash"
          className="fixed inset-0 z-[70] flex flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-honey-200 via-honey-100 to-honey-50"
          initial={{ opacity: 1 }}
          exit={{ y: "-100%", opacity: 0.6 }}
          transition={{ duration: 0.7, ease: [0.76, 0, 0.24, 1] }}
          aria-hidden="true"
        >
          {/* soft honeycomb glow */}
          <div className="pointer-events-none absolute -top-24 h-72 w-72 rounded-full bg-honey-300/40 blur-3xl" />

          {/* flight trail + bee */}
          <div className="relative h-40 w-72">
            {!reduce && (
              <svg className="absolute inset-0 h-full w-full" viewBox="0 0 288 160" fill="none">
                <motion.path
                  d="M8 140 C 60 40, 120 40, 150 90 S 250 120, 280 30"
                  stroke="#C98A2B"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray="2 12"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 0.7 }}
                  transition={{ duration: 1.6, ease: "easeInOut" }}
                />
              </svg>
            )}
            <motion.div
              className="absolute left-1/2 top-1/2"
              initial={reduce ? { opacity: 0, scale: 0.8, x: "-50%", y: "-50%" } : { x: -150, y: 40, opacity: 0 }}
              animate={
                reduce
                  ? { opacity: 1, scale: 1, x: "-50%", y: "-50%" }
                  : { x: [-150, -40, 30, -50], y: [40, -30, 20, -50], rotate: [8, -6, 6, 0], opacity: 1 }
              }
              transition={reduce ? { duration: 0.5 } : { duration: 1.7, ease: "easeInOut" }}
              style={{ translateX: "-50%", translateY: "-50%" }}
            >
              <motion.div
                animate={reduce ? {} : { y: [0, -4, 0] }}
                transition={{ duration: 0.4, repeat: Infinity, ease: "easeInOut" }}
              >
                <BeeCharacter size={104} />
              </motion.div>
            </motion.div>
          </div>

          {/* wordmark */}
          <motion.div
            className="mt-6 text-center"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduce ? 0.2 : 1.1, duration: 0.6, ease: "easeOut" }}
          >
            <p className="font-display text-5xl tracking-tight text-charcoal sm:text-6xl">
              BUZZORA<span className="text-accent-500">.</span>
            </p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wider2 text-honey-700">
              From hive to heart
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
