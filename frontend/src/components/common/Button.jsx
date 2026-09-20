import { useRef, useState } from "react";
import { motion } from "framer-motion";

export default function Button({
  children,
  onClick,
  variant = "primary",
  className = "",
  ...props
}) {
  const ref = useRef(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e) => {
    if (!ref.current || props.disabled) return;
    const { clientX, clientY } = e;
    const { left, top, width, height } = ref.current.getBoundingClientRect();
    const centerX = left + width / 2;
    const centerY = top + height / 2;
    const distanceX = clientX - centerX;
    const distanceY = clientY - centerY;

    setPosition({ x: distanceX * 0.18, y: distanceY * 0.18 });
  };

  const handleMouseLeave = () => {
    setPosition({ x: 0, y: 0 });
  };

  const baseStyles =
    "font-display text-[10px] sm:text-xs uppercase tracking-[0.24em] px-5 py-3 rounded-full transition-all duration-300 select-none outline-none focus:ring-1 focus:ring-accent/50";

  const variants = {
    primary:
      "bg-accent text-[#07110F] hover:bg-secondary-accent shadow-[0_0_18px_rgba(50,213,131,0.24)] hover:shadow-[0_0_30px_rgba(50,213,131,0.45)] font-semibold",
    secondary:
      "bg-card-bg/60 text-white border border-accent/20 hover:border-accent/60 hover:bg-card-bg shadow-inner",
    success:
      "bg-success/15 text-success border border-success/35 hover:bg-success/25 hover:border-success/80 shadow-[0_0_10px_rgba(50,213,131,0.16)] font-semibold",
    danger:
      "bg-danger/15 text-danger border border-danger/35 hover:bg-danger/25 hover:border-danger/80 shadow-[0_0_10px_rgba(255,77,109,0.15)] font-semibold",
    warning:
      "bg-warning/15 text-warning border border-warning/35 hover:bg-warning/25 hover:border-warning/80 shadow-[0_0_10px_rgba(255,200,87,0.15)] font-semibold",
  };

  return (
    <motion.button
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      animate={{ x: position.x, y: position.y, scale: 1 }}
      whileHover={
        props.disabled
          ? undefined
          : {
              y: -2,
              scale: 1.01,
              boxShadow: "0 10px 28px rgba(5, 10, 9, 0.24)",
            }
      }
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 200, damping: 18, mass: 0.08 }}
      onClick={onClick}
      className={`${baseStyles} ${
        props.disabled
          ? "cursor-not-allowed opacity-40 grayscale"
          : "cursor-pointer"
      } ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  );
}
