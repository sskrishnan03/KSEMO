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

/**
 * "Thinking" indicator shown while the assistant prepares an answer: a small,
 * fast swirling dot ring followed by the word "Thinking". No background, single
 * row, matched to the chat's text size.
 */
export function ThinkingIndicator() {
  return (
    <div
      className="flex w-fit items-center gap-2 whitespace-nowrap"
      role="status"
      aria-label="Thinking"
    >
      <MorphDotRing />
      <span className="flex items-center text-[15px] font-medium leading-none text-zinc-900 dark:text-white">
        <span>Thinking</span>
        <span className="flex w-5 pl-0.5">
          <motion.span
            animate={{ opacity: [0, 1, 1, 0] }}
            transition={{ duration: 2, repeat: Infinity, times: [0, 0.2, 0.8, 1] }}
          >
            .
          </motion.span>
          <motion.span
            animate={{ opacity: [0, 0, 1, 0] }}
            transition={{ duration: 2, repeat: Infinity, times: [0, 0.4, 0.8, 1] }}
          >
            .
          </motion.span>
          <motion.span
            animate={{ opacity: [0, 0, 1, 0] }}
            transition={{ duration: 2, repeat: Infinity, times: [0, 0.6, 0.8, 1] }}
          >
            .
          </motion.span>
        </span>
      </span>
    </div>
  );
}

export default ThinkingIndicator;