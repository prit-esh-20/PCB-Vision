import { motion } from "framer-motion";
import {
  Cpu,
  ShieldCheck,
  ScanSearch,
  CircuitBoard,
  Sparkles,
  Gauge,
  Code2,
  Camera,
  Database,
  Layers,
  Box,
  Lightbulb,
  Microchip,
  CheckCircle2,
  Image,
  Zap,
  MessageSquare,
  Mail,
  MapPin,
  Building2,
} from "lucide-react";
import HeroPanel from "../../components/hero/HeroPanel";
import Navbar from "../../components/layout/Navbar";
import PageWrapper from "../../components/layout/PageWrapper";
import Footer from "../../components/layout/Footer";
import GlassMetricCards from "../../components/hero/GlassMetricCards";
import InquiryForm from "../../components/contact/InquiryForm";

const showcaseCards = [
  {
    title: "Real-Time PCB Inspection",
    copy: "Boards are captured and analyzed the moment they enter the station — live video in, defect verdicts out, right on the production line.",
    icon: ScanSearch,
    points: [
      { label: "Live Camera Feed", icon: Camera },
      { label: "YOLO Detection", icon: ScanSearch },
      { label: "Fast Inference", icon: Zap },
    ],
  },
  {
    title: "Explainable AI",
    copy: "Every verdict ships with visual evidence and confidence, so engineers can trust — and audit — each decision.",
    icon: Sparkles,
    points: [
      { label: "Grad-CAM", icon: Lightbulb },
      { label: "Confidence Scores", icon: Gauge },
      { label: "Decision Transparency", icon: ShieldCheck },
    ],
  },
  {
    title: "Embedded Deployment",
    copy: "The full pipeline runs on low-cost edge hardware — on the line, next to the camera, even without a network.",
    icon: Microchip,
    points: [
      { label: "Raspberry Pi", icon: Cpu },
      { label: "Edge AI", icon: CircuitBoard },
      { label: "Offline Processing", icon: Database },
    ],
  },
];

const techStack = [
  { name: "Python", icon: Code2, role: "Core Language", features: ["AI Inference", "Backend Logic"], version: "v3.12", status: "Production Ready" },
  { name: "YOLO", icon: Camera, role: "Object Detection", features: ["Real-Time Inference"], version: "v8.2", status: "Latest" },
  { name: "OpenCV", icon: ScanSearch, role: "Computer Vision", features: ["Image Processing", "Camera I/O"], version: "v4.10", status: "Stable" },
  { name: "PyTorch", icon: Layers, role: "Deep Learning", features: ["Neural Networks", "GPU Training"], version: "v2.x", status: "Stable" },
  { name: "FastAPI", icon: Zap, role: "REST API", features: ["Backend Services", "WebSocket Stream"], version: "v0.115", status: "Production Ready" },
  { name: "React", icon: Box, role: "Frontend Framework", features: ["Interactive Dashboard"], version: "v19", status: "Open Source" },
  { name: "SQLite", icon: Database, role: "Inspection Database", features: ["Result Logging", "Local Storage"], version: "v3", status: "Embedded" },
  { name: "Raspberry Pi", icon: Microchip, role: "Edge Deployment", features: ["Embedded Computing", "GPIO Control"], version: "Pi 5", status: "Edge Optimized" },
];

const workflowSteps = [
  { step: "PCB Image", icon: Image },
  { step: "Camera Capture", icon: Camera },
  { step: "YOLO Detection", icon: ScanSearch },
  { step: "X-MCCV Verification", icon: CheckCircle2 },
  { step: "Grad-CAM", icon: Lightbulb },
  { step: "Inspection Report", icon: MessageSquare },
  { step: "PASS / FAIL", icon: Cpu },
];


function SectionLabel({ children }) {
  return (
    <div className="text-[10px] uppercase tracking-[0.28em] text-accent font-medium">
      {children}
    </div>
  );
}

function SectionTitle({ children, className = "" }) {
  return (
    <h2 className={`font-display text-4xl font-semibold text-white sm:text-5xl ${className}`}>
      {children}
    </h2>
  );
}

function CardCircuit({ className = "" }) {
  return (
    <svg
      viewBox="0 0 220 140"
      fill="none"
      aria-hidden="true"
      className={`pointer-events-none absolute text-accent ${className}`}
    >
      <path d="M6 96h44l18-18h52V48h38" stroke="currentColor" strokeOpacity="0.14" strokeWidth="1" />
      <path d="M0 118h72l14 14h60" stroke="currentColor" strokeOpacity="0.1" strokeWidth="1" />
      <path d="M160 132V96l22-22h32" stroke="currentColor" strokeOpacity="0.12" strokeWidth="1" />
      <circle cx="50" cy="96" r="2.4" fill="currentColor" fillOpacity="0.22" />
      <circle cx="120" cy="48" r="2.4" fill="currentColor" fillOpacity="0.18" />
      <circle cx="182" cy="74" r="2.2" fill="currentColor" fillOpacity="0.2" />
      <circle cx="146" cy="132" r="1.8" fill="currentColor" fillOpacity="0.25" />
      <rect x="152" y="42" width="12" height="12" rx="2" stroke="currentColor" strokeOpacity="0.16" />
    </svg>
  );
}

export default function LandingPage() {
  return (
    <PageWrapper className="relative min-h-screen overflow-x-hidden pt-24">
      <Navbar />

      <HeroPanel />

      {/* KPI SECTION */}
      <section className="mx-auto max-w-7xl px-4 py-10 md:px-8 lg:px-10">
        <GlassMetricCards />
      </section>

      {/* ABOUT SECTION */}
      <section
        id="about"
        className="mx-auto max-w-7xl px-4 py-10 md:px-8 lg:px-10"
      >
        <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-center">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-5"
          >
            <SectionLabel>About</SectionLabel>
            <SectionTitle>
              Bridging industrial inspection with explainable AI.
            </SectionTitle>
            <p className="max-w-xl text-lg leading-relaxed text-slate-400">
              The platform turns electromechanical quality inspection into a
              transparent, scalable process for modern PCB manufacturing. By
              combining vision models, deterministic verification, and embedded
              deployment, teams can identify defects quickly and understand why
              each decision was made.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="rounded-2xl border border-accent/10 bg-[rgba(13,27,23,0.72)] p-6 shadow-[0_18px_70px_rgba(0,0,0,0.25)] backdrop-blur-xl space-y-5">
              <div>
                <h3 className="font-display text-sm uppercase tracking-[0.25em] text-white mb-2">
                  What it solves
                </h3>
                <p className="text-base leading-relaxed text-slate-400">
                  High-volume PCB validation with fewer false passes and faster review cycles.
                </p>
              </div>
              <div className="w-full h-px bg-gradient-to-r from-accent/20 via-accent/40 to-transparent" />
              <div>
                <h3 className="font-display text-sm uppercase tracking-[0.25em] text-white mb-2">
                  Why it matters
                </h3>
                <p className="text-base leading-relaxed text-slate-400">
                  Explainable outputs build trust for engineering, operations, and quality teams.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* FEATURES SECTION — premium product showcase */}
      <section
        id="features"
        className="mx-auto max-w-7xl px-4 py-10 md:px-8 lg:px-10"
      >
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto mb-8 max-w-6xl text-center"
        >
          <SectionLabel>Why PCBVision?</SectionLabel>
          <h2 className="mt-3 font-display text-2xl font-semibold leading-tight text-white sm:text-3xl lg:text-[1.75rem] xl:text-4xl">
            Intelligent Inspection.{" "}
            <span className="bg-gradient-to-r from-accent via-[#7ce7ac] to-accent bg-clip-text text-transparent">
              Explainable Decisions.
            </span>{" "}
            Industrial Reliability.
          </h2>
          <p className="mx-auto mt-3 max-w-[560px] text-base leading-[1.6] text-slate-400 sm:text-lg">
            One platform that captures, detects, explains, and verifies every
            board on the line.
          </p>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-3">
          {showcaseCards.map((card, index) => {
            const Icon = card.icon;
            return (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 24, scale: 0.95 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.65, delay: 0.1 * index, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ y: -8 }}
                className="group relative overflow-hidden rounded-[1.75rem] border border-accent/10 bg-gradient-to-br from-[rgba(13,27,23,0.88)] via-[rgba(13,27,23,0.75)] to-[rgba(50,213,131,0.06)] p-7 backdrop-blur-xl transition-[border-color,box-shadow] duration-500 hover:border-accent/35 hover:shadow-[0_20px_60px_rgba(50,213,131,0.12)] lg:p-8"
              >
                <CardCircuit className="-bottom-2 -right-6 w-52" />

                <div className="relative flex h-full flex-col items-start">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-accent/20 bg-accent/10 text-accent shadow-[0_0_30px_rgba(50,213,131,0.1)] transition-transform duration-500 group-hover:rotate-3 group-hover:scale-110">
                    <Icon className="h-7 w-7" />
                  </div>
                  <h3 className="mt-4 font-display text-xl font-semibold text-white">
                    {card.title}
                  </h3>
                  <p className="mt-2.5 text-sm leading-[1.6] text-slate-400">
                    {card.copy}
                  </p>
                  <ul className="mt-auto w-full space-y-2.5 border-t border-accent/10 pt-5">
                    {card.points.map((point) => {
                      const PointIcon = point.icon;
                      return (
                        <li
                          key={point.label}
                          className="flex items-center gap-2.5 text-xs font-medium uppercase tracking-[0.14em] text-slate-300"
                        >
                          <span className="flex h-6 w-6 items-center justify-center rounded-md border border-accent/10 bg-accent/5">
                            <PointIcon className="h-3.5 w-3.5 text-accent" />
                          </span>
                          {point.label}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* TECHNOLOGY SECTION */}
      <section
        id="technology"
        className="mx-auto max-w-7xl px-4 py-10 md:px-8 lg:px-10"
      >
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mb-6"
        >
          <SectionLabel>Technology</SectionLabel>
          <SectionTitle className="mt-2">Technology Stack</SectionTitle>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-500">
            Professional tools powering Explainable AI inspection.
          </p>
        </motion.div>

        {/* Section stats bar */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mb-5 flex flex-wrap items-center gap-4 rounded-xl border border-accent/10 bg-[rgba(13,27,23,0.6)] px-4 py-2.5 backdrop-blur-md"
        >
          {[
            { icon: Layers, label: "8 Technologies" },
            { icon: ShieldCheck, label: "100% Open Source" },
            { icon: Cpu, label: "Edge Optimized" },
            { icon: CheckCircle2, label: "Production Ready" },
          ].map((stat, _i) => {
            const StatIcon = stat.icon;
            return (
              <div key={stat.label} className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.22em] text-slate-400">
                <StatIcon className="h-3.5 w-3.5 text-accent" />
                {stat.label}
              </div>
            );
          })}
        </motion.div>

        {/* PCB background detail */}
        <div className="relative">
          <svg
            className="pointer-events-none absolute inset-0 w-full h-full text-accent opacity-[0.04]"
            viewBox="0 0 800 600"
            fill="none"
            aria-hidden="true"
            preserveAspectRatio="xMidYMid slice"
          >
            <path d="M50 50h100l20-20h120V80h80" stroke="currentColor" strokeWidth="0.8" />
            <path d="M600 80h60l30-30h80" stroke="currentColor" strokeWidth="0.8" />
            <path d="M100 300h80l30-30h100v40h60" stroke="currentColor" strokeWidth="0.8" />
            <path d="M550 250h60l20-20h60" stroke="currentColor" strokeWidth="0.8" />
            <path d="M200 450h120l30-30h80" stroke="currentColor" strokeWidth="0.8" />
            <path d="M600 400h40l20-20h70" stroke="currentColor" strokeWidth="0.8" />
            <circle cx="170" cy="50" r="3" fill="currentColor" />
            <circle cx="290" cy="80" r="3" fill="currentColor" />
            <circle cx="690" cy="50" r="3" fill="currentColor" />
            <circle cx="210" cy="300" r="3" fill="currentColor" />
            <circle cx="330" cy="310" r="3" fill="currentColor" />
            <circle cx="630" cy="230" r="3" fill="currentColor" />
            <circle cx="350" cy="450" r="3" fill="currentColor" />
            <circle cx="660" cy="380" r="3" fill="currentColor" />
            <rect x="50" y="530" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="0.6" />
            <rect x="700" y="530" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="0.6" />
            <circle cx="100" cy="560" r="4" stroke="currentColor" strokeWidth="0.6" />
            <circle cx="680" cy="560" r="4" stroke="currentColor" strokeWidth="0.6" />
          </svg>

          <div className="relative z-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {techStack.map((tech, index) => {
              const Icon = tech.icon;
              return (
                <motion.div
                  key={tech.name}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.45, delay: index * 0.04, ease: [0.16, 1, 0.3, 1] }}
                  whileHover={{ y: -4, boxShadow: "0 0 30px rgba(50,213,131,0.12)" }}
                  className="group relative flex flex-col rounded-xl border border-accent/10 bg-[rgba(13,27,23,0.72)] p-4 backdrop-blur-xl transition-all duration-250 hover:border-accent/30"
                >
                  {/* Status badge */}
                  <div className="absolute right-3 top-3 rounded-full border border-accent/12 bg-accent/8 px-2 py-0.5 text-[7px] font-semibold uppercase tracking-[0.18em] text-accent/70 transition-all duration-250 group-hover:bg-accent/15 group-hover:text-accent/90" style={{ backgroundColor: "rgba(50,213,131,0.08)" }}>
                    {tech.status}
                  </div>

                  {/* Icon row */}
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-accent/15 bg-accent/5 text-accent shadow-[0_0_18px_rgba(50,213,131,0.08)] transition-all duration-250 group-hover:bg-accent/10 group-hover:shadow-[0_0_24px_rgba(50,213,131,0.2)]">
                    <Icon className="h-6 w-6 transition-all duration-250 group-hover:brightness-125" />
                  </div>

                  {/* Name + Role */}
                  <div className="font-display text-sm font-semibold tracking-wide text-white">
                    {tech.name}
                  </div>
                  <div className="text-[10px] text-slate-500 tracking-wide mt-0.5">
                    {tech.role}
                  </div>

                  {/* Features list */}
                  <div className="mt-2.5 space-y-1">
                    {tech.features.map((f) => (
                      <div key={f} className="flex items-center gap-1.5 text-[10px] text-slate-400">
                        <span className="text-accent/60">&#10003;</span>
                        {f}
                      </div>
                    ))}
                  </div>

                  {/* Bottom version row */}
                  <div className="mt-auto pt-2.5 border-t border-accent/8 text-[9px] font-mono text-slate-600 tracking-wide">
                    {tech.version}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* WORKFLOW SECTION */}
      <section
        id="workflow"
        className="mx-auto max-w-7xl px-4 py-10 md:px-8 lg:px-10"
      >
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-[1.75rem] border border-accent/10 bg-[rgba(13,27,23,0.8)] px-6 py-10 shadow-[0_18px_70px_rgba(0,0,0,0.25)] backdrop-blur-xl md:px-10 lg:py-12"
        >
          <div className="mb-10 text-center">
            <SectionLabel>Workflow</SectionLabel>
            <SectionTitle className="mt-2">A disciplined path from capture to decision.</SectionTitle>
          </div>
          <div className="relative z-10 grid gap-6 lg:grid-cols-7">
            {workflowSteps.map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.step}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.5, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
                  className="relative flex flex-col items-center gap-4"
                >
                  {/* Step icon circle */}
                  <motion.div
                    whileHover={{ scale: 1.1, boxShadow: "0 0 30px rgba(50,213,131,0.25)" }}
                    className="flex h-16 w-16 items-center justify-center rounded-full border border-accent/20 bg-[rgba(13,27,23,0.85)] shadow-[0_0_25px_rgba(50,213,131,0.08)]"
                  >
                    <Icon className="h-7 w-7 text-accent" />
                  </motion.div>

                  {/* Connector line between circles */}
                  {index < workflowSteps.length - 1 && (
                    <div className="hidden lg:block absolute left-[calc(50%+2.5rem)] top-8 w-[calc(100%-3.5rem)] h-px">
                      <motion.div
                        className="h-full bg-gradient-to-r from-accent/50 via-accent/25 to-transparent"
                        initial={{ scaleX: 0, transformOrigin: "left" }}
                        whileInView={{ scaleX: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.3 + index * 0.08 }}
                      />
                    </div>
                  )}

                  {/* Step number badge */}
                  <div className="rounded-full border border-accent/10 bg-accent/5 px-2.5 py-0.5">
                    <span className="text-[10px] font-mono font-medium text-accent">0{index + 1}</span>
                  </div>

                  {/* Step name */}
                  <span className="text-sm font-medium uppercase tracking-[0.2em] text-white text-center leading-relaxed">
                    {item.step}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </section>

      {/* CONTACT SECTION — Enterprise Inquiry */}
      <section
        id="contact"
        className="mx-auto max-w-7xl px-4 py-10 md:px-8 lg:px-10"
      >
        <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr] lg:items-start">
          {/* LEFT COLUMN — Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col space-y-5"
          >
            <div>
              <SectionLabel>Get In Touch</SectionLabel>
              <SectionTitle className="mt-3 leading-tight">
                Let's Build Smarter PCB Inspection Together
              </SectionTitle>
              <p className="mt-4 max-w-lg text-base leading-relaxed text-slate-400">
                Interested in Explainable AI for PCB inspection? Contact our research team to discuss the project, implementation, technical details, or collaboration opportunities.
              </p>
            </div>

            {/* Info Cards */}
            <div className="space-y-3">
              {[
                { icon: Mail, label: "Email", value: "team.pcbvision@gmail.com", href: "mailto:team.pcbvision@gmail.com" },
                { icon: Building2, label: "Institution", value: "SIES Graduate School of Technology" },
                { icon: MapPin, label: "Location", value: "Mumbai, Maharashtra, India" },
                { icon: Lightbulb, label: "Research Area", value: "Embedded AI · Computer Vision · Explainable AI" },
              ].map((item, i) => {
                const ItemIcon = item.icon;
                return (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: 0.1 + i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                    whileHover={{ y: -2, boxShadow: "0 0 24px rgba(50,213,131,0.12)" }}
                    className="flex items-center gap-3.5 rounded-xl border border-accent/10 bg-[rgba(13,27,23,0.6)] px-4 py-3.5 backdrop-blur-md transition-all duration-250 hover:border-accent/30"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-accent/15 bg-accent/8 text-accent">
                      <ItemIcon className="h-4.5 w-4.5" style={{ width: "1.125rem", height: "1.125rem" }} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[9px] font-semibold uppercase tracking-[0.28em] text-slate-500">{item.label}</div>
                      {item.href ? (
                        <a href={item.href} className="mt-0.5 block text-sm text-white transition-colors hover:text-accent">{item.value}</a>
                      ) : (
                        <div className="mt-0.5 text-sm text-white">{item.value}</div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {/* RIGHT COLUMN — Inquiry Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          >
            <InquiryForm />
          </motion.div>
        </div>
      </section>

      {/* TRUST INDICATOR BADGES */}
      <section className="mx-auto max-w-7xl px-4 py-8 md:px-8 lg:px-10">
        {/* Subtle separator */}
        <div className="w-full h-px mb-5 bg-gradient-to-r from-transparent via-accent/8 to-transparent" />

        {/* Badges row */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-wrap justify-center gap-4"
        >
          {[
            { icon: Sparkles, label: "Explainable AI" },
            { icon: Cpu, label: "Industry 4.0" },
            { icon: Microchip, label: "Embedded Edge Computing" },
            { icon: ScanSearch, label: "Real-Time PCB Inspection" },
          ].map((badge, i) => {
            const BadgeIcon = badge.icon;
            return (
              <motion.div
                key={badge.label}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{
                  scale: 1.03,
                  boxShadow: "0 0 22px rgba(50,213,131,0.2), 0 0 50px rgba(50,213,131,0.06)",
                  borderColor: "rgba(50,213,131,0.45)",
                }}
                className="flex items-center gap-2.5 rounded-full border border-accent/12 bg-[rgba(13,27,23,0.55)] px-5 py-2.5 backdrop-blur-md transition-all duration-300 cursor-default opacity-80 hover:opacity-100"
              >
                <BadgeIcon className="h-4 w-4 text-accent transition-all duration-300" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                  {badge.label}
                </span>
              </motion.div>
            );
          })}
        </motion.div>
      </section>

      {/* PREMIUM FOOTER */}
      <Footer />
    </PageWrapper>
  );
}