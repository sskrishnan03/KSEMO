import { motion } from "framer-motion";

function MorphDotRing() {
  return (
    <motion.div
      className="grid h-3.5 w-3.5 shrink-0 grid-cols-2 gap-0.5"
      animate={{ rotate: 180, gap: ["4px", "0px", "4px"] }}
      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      aria-hidden="true"
    >
      {[0, 1, 2, 3].map(i => (
        <div
          key={i}
          className="size-full rounded-full bg-zinc-800 dark:bg-white"
        />
      ))}
    </motion.div>
  );
}

export function ThinkingIndicator() {
  return (
    <div
      className="flex w-fit items-center"
      role="status"
      aria-label="Thinking"
    >
      <MorphDotRing />
    </div>
  );
}

export default ThinkingIndicator;