import { useState, useRef } from "react";
import { motion } from "framer-motion";

export default function GlassCard({
  children,
  className = "",
  contentClassName = "",
  hoverLift = true,
  ...props
}) {
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = useRef(null);

  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const { clientX, clientY } = e;
    const { left, top } = cardRef.current.getBoundingClientRect();
    setCoords({ x: clientX - left, y: clientY - top });
  };

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={
        hoverLift
          ? { y: -8, scale: 1.02, boxShadow: "0 24px 60px rgba(0, 0, 0, 0.35)" }
          : undefined
      }
      transition={{ type: "spring", stiffness: 200, damping: 16, mass: 0.06 }}
      className={`group relative overflow-hidden rounded-[1.5rem] border border-accent/10 bg-[rgba(13,27,23,0.66)] p-5 backdrop-blur-xl transition-all duration-300 ${
        hoverLift ? "hover:border-accent/25" : ""
      } ${className}`}
      {...props}
    >
      {/* Glow effect following cursor */}
      {isHovered && (
        <div
          className="pointer-events-none absolute h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/8 blur-[60px] transition-opacity duration-300"
          style={{ left: coords.x, top: coords.y }}
        />
      )}

      {/* Border animation - top */}
      <span className="absolute left-0 top-0 h-px w-0 bg-gradient-to-r from-transparent via-accent/70 to-transparent transition-all duration-500 group-hover:w-full" />
      {/* Border animation - bottom */}
      <span className="absolute right-0 bottom-0 h-px w-0 bg-gradient-to-l from-transparent via-accent/70 to-transparent transition-all duration-500 group-hover:w-full" />
      {/* Border animation - left */}
      <span className="absolute left-0 top-0 w-px h-0 bg-gradient-to-b from-transparent via-accent/70 to-transparent transition-all duration-500 group-hover:h-full" />
      {/* Border animation - right */}
      <span className="absolute right-0 top-0 w-px h-0 bg-gradient-to-t from-transparent via-accent/70 to-transparent transition-all duration-500 group-hover:h-full delay-75" />

      <div className={`relative z-10 ${contentClassName}`}>{children}</div>
    </motion.div>
  );
}
