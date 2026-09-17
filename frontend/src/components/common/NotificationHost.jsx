import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle, XCircle, Info, X } from "lucide-react";
import { useNotifications } from "../../context/NotificationContext";

const STYLES = {
  success: { icon: CheckCircle, border: "border-success/30", text: "text-success" },
  error: { icon: XCircle, border: "border-danger/30", text: "text-danger" },
  info: { icon: Info, border: "border-accent/30", text: "text-accent" },
};

// Renders notifications that were triggered explicitly. Mounted once at the
// app root (see App.jsx).
export default function NotificationHost() {

  const { items } = useNotifications();

  const [closedIds, setClosedIds] = useState(new Set());

  return (
    <div className="fixed right-4 top-4 z-[9998] flex w-80 flex-col gap-2">
      <AnimatePresence>
        {items.filter((item) => !closedIds.has(item.id)).map((item) => {
          const { icon: Icon, border, text } = STYLES[item.type] || STYLES.info;
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: 32, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 32, scale: 0.96 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className={`flex items-start gap-2.5 rounded-xl border ${border} bg-[#111827]/95 px-3.5 py-3 shadow-2xl backdrop-blur-xl`}
            >
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${text}`} />
              <div className="min-w-0 flex-1 text-left">
                {item.title && (
                  <p className={`font-mono text-[10px] font-bold uppercase tracking-wider ${text}`}>{item.title}</p>
                )}
                {item.message && <p className="mt-0.5 text-xs text-slate-300">{item.message}</p>}
              </div>
              <button
                onClick={() => {
                  setClosedIds((prev) => {
                    const next = new Set(prev);
                    next.add(item.id);
                    return next;
                  });
                }}
                className="text-slate-500 transition-colors hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}