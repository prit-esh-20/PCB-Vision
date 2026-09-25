import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { scrollToSection } from "../../hooks/useSmoothScroll";

const footerLinks = [
  { name: "About", id: "about" },
  { name: "GitHub", href: "https://github.com/prit-esh-20/Inspect-IQ", external: true },
  { name: "Contact", id: "contact" },
  { name: "Privacy", href: null },
  { name: "License", href: null },
];

export default function Footer() {
  const handleAnchor = (e, id) => {
    e.preventDefault();
    window.history.replaceState(null, "", `#${id}`);
    scrollToSection(`#${id}`);
  };

  return (
    <footer className="relative border-t border-accent/[0.06] bg-[rgba(5,12,10,0.92)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 py-8 md:flex-row md:px-8 lg:px-10">
        {/* Left — Brand */}
        <div className="flex flex-col items-center gap-2 md:items-start text-center md:text-left">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full border border-accent/25 bg-gradient-to-br from-[#00ff88] to-[#00e573]">
              <Search className="h-3.5 w-3.5 text-[#07110F]" />
            </div>
            <span className="font-display text-sm font-bold tracking-wide text-white">
              <span className="text-accent">PCB</span>Vision
              <sup className="ml-0.5 text-[8px] text-slate-500">™</sup>
            </span>
          </Link>
          <span className="text-[10px] text-slate-500 tracking-wide">
            Explainable PCB Inspection Platform
          </span>
          <div className="flex flex-wrap items-center justify-center gap-3 text-[9px] text-slate-600 mt-2 md:justify-start">
            <span>&copy; 2026 PCBVision</span>
            <span className="mx-1">•</span>
            <span>Built using React · FastAPI · YOLOv8 · Raspberry Pi</span>
          </div>
        </div>

        {/* Right — Nav */}
        <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6">
          {footerLinks.map((link) => {
            if (link.external) {
              return (
                <a
                  key={link.name}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="group relative text-[11px] font-medium uppercase tracking-[0.22em] text-slate-400 transition-colors duration-250 hover:text-white"
                >
                  {link.name}
                  <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-accent/60 transition-all duration-250 group-hover:w-full" />
                </a>
              );
            }
            if (link.id) {
              return (
                <a
                  key={link.name}
                  href={`#${link.id}`}
                  onClick={(e) => handleAnchor(e, link.id)}
                  className="group relative text-[11px] font-medium uppercase tracking-[0.22em] text-slate-400 transition-colors duration-250 hover:text-white"
                >
                  {link.name}
                  <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-accent/60 transition-all duration-250 group-hover:w-full" />
                </a>
              );
            }
            return (
              <span
                key={link.name}
                className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500"
              >
                {link.name}
              </span>
            );
          })}
        </div>
      </div>
    </footer>
  );
}
