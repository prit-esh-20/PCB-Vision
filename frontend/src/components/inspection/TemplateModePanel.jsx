import React, { useEffect, useState } from "react";
import { Layers, RefreshCw, AlertTriangle, CheckCircle, ChevronDown } from "lucide-react";
import apiClient from "../../services/apiClient";

export default function TemplateModePanel({
  selectedTemplate,
  onTemplateSelect,
  onNavigateToCreate,
}) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadTemplates() {
      try {
        setLoading(true);
        setError("");

        const response = await apiClient.get("/templates");
        const data = response.data;
        const list = Array.isArray(data)
          ? data
          : data.templates || [];

        if (!cancelled) {
          setTemplates(
            list.map((item) =>
              typeof item === "string"
                ? { id: item, name: item }
                : {
                    ...item,
                    id: item.id ?? item.template_id ?? item.name ?? item.template_name,
                    name: item.name ?? item.template_name ?? item.id ?? item.template_id,
                  }
            )
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err.response?.data?.detail ||
              "Could not load templates from Raspberry Pi."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadTemplates();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedId = selectedTemplate
    ? String(selectedTemplate.id ?? selectedTemplate.template_id ?? selectedTemplate.name)
    : "";

  function handleChange(event) {
    const template = templates.find(
      (item) => String(item.id) === event.target.value
    );
    onTemplateSelect(template || null);
  }

  const isDropdownDisabled = loading || !!error || templates.length === 0;

  return (
    <div className="relative overflow-hidden rounded-xl border border-accent/15 bg-[rgba(13,27,23,0.72)] p-5 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
      {/* Subtle animated top border */}
      <span className="absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-accent/40 to-transparent" />

      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-accent/20 bg-accent/8">
          <Layers className="h-4 w-4 text-accent" />
        </div>
        <div>
          <h3 className="font-display text-sm font-bold uppercase tracking-widest text-white">
            Template-Based Inspection
          </h3>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-slate-400">
            Select a saved PCB template from Raspberry Pi.
          </p>
        </div>
      </div>

      {/* Divider */}
      <div className="my-4 h-px w-full bg-accent/8" />

      {/* Select Template */}
      <div className="space-y-2">
        <label className="flex items-center gap-1.5 font-display text-[10px] font-bold uppercase tracking-widest text-slate-400">
          Select Template
        </label>

        {/* Custom select wrapper */}
        <div className="relative">
          <select
            value={selectedId}
            onChange={handleChange}
            disabled={isDropdownDisabled}
            className={[
              // Base layout
              "w-full appearance-none rounded-lg border px-3.5 py-2.5 pr-9",
              // Typography
              "font-mono text-xs",
              // Transitions
              "transition-all duration-200",
              // Background & default text
              "bg-[#050e0a] text-white",
              // Placeholder / disabled text colour handled via option
              // Border
              isDropdownDisabled
                ? "border-white/8 text-slate-500 cursor-not-allowed"
                : "border-accent/20 cursor-pointer",
              // Focus ring
              "focus:outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/20",
              // Hover (non-disabled)
              !isDropdownDisabled && "hover:border-accent/40",
            ].join(" ")}
          >
            <option value="" style={{ background: "#050e0a", color: "#94a3b8" }}>
              {loading
                ? "Loading saved templates…"
                : error
                ? "Templates unavailable"
                : templates.length
                ? "Choose a template"
                : "No saved templates found"}
            </option>

            {templates.map((template, index) => (
              <option
                key={`${template.id}-${index}`}
                value={String(template.id)}
                style={{ background: "#050e0a", color: "#f1f5f9" }}
              >
                {template.name}
              </option>
            ))}
          </select>

          {/* Custom dropdown chevron */}
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
            {loading ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-accent/50" />
            ) : (
              <ChevronDown
                className={`h-3.5 w-3.5 transition-colors ${
                  isDropdownDisabled ? "text-slate-600" : "text-accent/60"
                }`}
              />
            )}
          </span>
        </div>

        {/* Status feedback */}
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-danger/20 bg-danger/8 px-3 py-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-danger" />
            <span className="font-mono text-[10px] text-danger">{error}</span>
          </div>
        )}

        {selectedTemplate && !error && (
          <div className="flex items-center gap-2 rounded-lg border border-accent/20 bg-accent/8 px-3 py-2">
            <CheckCircle className="h-3.5 w-3.5 shrink-0 text-accent" />
            <span className="font-mono text-[10px] text-accent">
              Selected:{" "}
              <span className="font-bold text-white">{selectedTemplate.name}</span>
            </span>
          </div>
        )}

        {!loading && !error && templates.length === 0 && (
          <p className="font-mono text-[10px] text-slate-500">
            No templates found on Raspberry Pi. Create one using the button below.
          </p>
        )}
      </div>

      {/* Create / Manage Templates button */}
      <div className="mt-5">
        <button
          type="button"
          onClick={onNavigateToCreate}
          className={[
            "group inline-flex w-full items-center justify-center gap-2",
            "rounded-lg border border-accent/20 bg-white/[0.03]",
            "px-4 py-2.5",
            "font-display text-[10px] font-bold uppercase tracking-widest text-white/70",
            "backdrop-blur-sm",
            "transition-all duration-300",
            "hover:border-accent/40 hover:bg-accent/8 hover:text-white hover:shadow-[0_0_18px_rgba(50,213,131,0.1)]",
            "focus:outline-none focus:ring-2 focus:ring-accent/30",
            "active:scale-[0.98]",
          ].join(" ")}
        >
          <Layers className="h-3.5 w-3.5 text-accent transition-transform duration-300 group-hover:scale-110" />
          Create or Manage Templates
        </button>
      </div>
    </div>
  );
}
