"use client";

import { motion } from "framer-motion";

const TERMINAL_LINES = [
  "-- CDN_SS loader attached",
  "require(cdn_ss_module).ehhsdiweew",
  "-- spawned: 8f3a91b2c4d5 (ServerScriptService)",
  "-- context: server-side [OK]",
  "-- executing payload …",
  "-- executed in 38ms",
];

export function HeroTerminal() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, rotateX: 8 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="card anim-glow relative overflow-hidden border-[#2a1010] p-4 font-mono text-[12px] leading-relaxed shadow-2xl"
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff2d2d]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#5a1414]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#2a2a33]" />
        <span className="ml-2 text-[11px] tracking-widest text-zinc-500">cdn_ss / executor</span>
      </div>
      <div className="space-y-1.5">
        {TERMINAL_LINES.map((line, index) => (
          <motion.p
            key={line}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.35 + index * 0.22, duration: 0.4 }}
            className={line.startsWith("--") ? "text-zinc-500" : "text-[#ff6b6b]"}
          >
            {line}
          </motion.p>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span className="text-[#ff2d2d]">›</span>
        <motion.span
          animate={{ opacity: [1, 0, 1] }}
          transition={{ repeat: Infinity, duration: 1.1 }}
          className="inline-block h-3.5 w-2 bg-[#ff2d2d]"
        />
      </div>
    </motion.div>
  );
}
