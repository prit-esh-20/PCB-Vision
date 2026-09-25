"use client";

import { useRef, useState, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Play, ArrowRight, ChevronDown } from "lucide-react";
import { scrollToSection } from "../../hooks/useSmoothScroll";
import { useAuth } from "../../context/AuthContext";
import PCBScene from "../three/PCBScene";

const techPills = [
  "Raspberry Pi",
  "YOLOv8",
  "Grad-CAM",
  "X-MCCV",
  "OpenCV",
  "FastAPI",
];

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] },
  }),
};

export default function HeroPanel() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [cueDimmed, setCueDimmed] = useState(false);
  const cueIntroDelay = useRef(1.4);

  const handleDashboardClick = () => {
    navigate(isAuthenticated ? "/dashboard" : "/login");
  };

  const handleAnchor = (event, selector) => {
    event.preventDefault();
    window.history.replaceState(null, "", selector);
    scrollToSection(selector);
  };

  const handleScrollCue = (event) => {
    event.preventDefault();
    window.history.replaceState(null, "", "#about");
    setCueDimmed(true);
    scrollToSection("#about", { onComplete: () => setCueDimmed(false) });
  };

  return (
<section
        id="home"
        className="relative mx-auto flex min-h-[calc(75vh-6rem)] w-full max-w-7xl flex-col items-center justify-center px-4 pb-16 pt-10 md:px-8 lg:px-10"
      >
      {/* Soft radial spotlight */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[135%] w-full -translate-x-1/2 -translate-y-1/2"
        style={{
          background:
            "radial-gradient(ellipse 52% 54% at center, rgba(7,17,15,0.75) 0%, rgba(7,17,15,0.4) 46%, rgba(7,17,15,0) 72%), radial-gradient(ellipse 28% 30% at center, rgba(50,213,131,0.05) 0%, rgba(50,213,131,0) 70%)",
        }}
      />

      <div className="grid w-full flex-1 gap-8 lg:grid-cols-2 lg:items-center">
        {/* LEFT: Content */}
        <div className="flex flex-col items-start text-left">

          {/* Badge */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={0}
            className="mb-8 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/5 px-4 py-1.5 text-[11px] uppercase tracking-[0.28em] text-accent"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_#32d583]" />
            Explainable AI · Automated Optical Inspection
          </motion.div>

          {/* Title */}
          <motion.h1
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={0.1}
            className="font-display font-bold leading-none tracking-tight text-white text-[clamp(3rem,8vw,5rem)]"
          >
            <span className="text-accent">PCB</span>Vision
          </motion.h1>

          {/* Subtitle */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={0.2}
            className="mt-6 space-y-1.5"
          >
            <div className="font-display text-2xl font-semibold text-white sm:text-3xl lg:text-4xl">
              <span className="bg-gradient-to-r from-accent via-[#7ce7ac] to-accent bg-clip-text text-transparent">
                Intelligent PCB Inspection
              </span>
            </div>
            <div className="text-base font-medium uppercase tracking-[0.3em] text-slate-400 sm:text-lg">
              Powered by Explainable AI
            </div>
          </motion.div>

          {/* Description */}
          <motion.p
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={0.3}
            className="mt-8 max-w-[560px] text-base leading-[1.6] text-slate-400 sm:text-lg"
          >
            A next-generation Automated Optical Inspection platform that combines
            Computer Vision, YOLO, Explainable AI, and X-MCCV verification to
            deliver fast, accurate, and transparent PCB quality inspection.
          </motion.p>

          {/* CTAs */}
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <motion.button
              onClick={handleDashboardClick}
              initial={{ opacity: 0, x: -32 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="group inline-flex h-12 items-center justify-center gap-2.5 rounded-xl bg-accent px-8 text-xs font-semibold uppercase tracking-[0.2em] text-primary-bg transition-shadow duration-300 hover:shadow-[0_0_30px_rgba(50,213,131,0.35)] cursor-pointer"
            >
              <Play className="h-4 w-4 fill-current" />
              Launch Dashboard
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </motion.button>
            <motion.a
              href="#technology"
              onClick={(event) => handleAnchor(event, "#technology")}
              initial={{ opacity: 0, x: 32 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="inline-flex h-12 items-center justify-center gap-2.5 rounded-xl border border-white/15 px-7 text-[11px] font-semibold uppercase tracking-[0.2em] text-white transition-colors duration-300 hover:border-white/30 hover:bg-white/5"
            >
              Explore Technology
              <ArrowRight className="h-4 w-4" />
            </motion.a>
          </div>

          {/* Tech pills */}
          <div className="mt-8 flex max-w-[560px] flex-wrap items-center gap-3">
            {techPills.map((pill, i) => (
              <motion.span
                key={pill}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.7 + i * 0.09, ease: [0.16, 1, 0.3, 1] }}
                className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs font-medium text-slate-300 backdrop-blur-md"
              >
                {pill}
              </motion.span>
            ))}
          </div>
        </div>

        {/* RIGHT: 3D PCB Model */}
        <div className="relative hidden h-full min-h-[400px] items-center justify-center lg:flex">
          <Suspense fallback={null}>
            <PCBScene />
          </Suspense>
        </div>
      </div>

      {/* Scroll indicator */}
      <motion.a
        href="#about"
        onClick={handleScrollCue}
        initial={{ opacity: 0 }}
        animate={{ opacity: cueDimmed ? 0 : 1 }}
        transition={{
          duration: cueDimmed ? 0.35 : 0.8,
          delay: cueDimmed ? 0 : cueIntroDelay.current,
          ease: "easeOut",
        }}
        onAnimationComplete={() => { cueIntroDelay.current = 0; }}
        className="absolute bottom-6 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 text-slate-500 transition-colors duration-300 hover:text-accent"
      >
        <span className="text-[10px] font-medium uppercase tracking-[0.3em]">Scroll to Explore</span>
        <motion.span animate={{ y: [0, 7, 0] }} transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}>
          <ChevronDown className="h-4 w-4" />
        </motion.span>
      </motion.a>
    </section>
  );
}
