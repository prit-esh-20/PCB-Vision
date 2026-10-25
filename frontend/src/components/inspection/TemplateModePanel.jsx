import React, { useEffect, useState } from "react";
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

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900">
        Template-Based Inspection
      </h3>

      <p className="mt-2 text-sm text-gray-600">
        Select a saved PCB template from Raspberry Pi.
      </p>

      <div className="mt-4">
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Select Template
        </label>

        <select
          value={selectedId}
          onChange={handleChange}
          disabled={loading || templates.length === 0}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-gray-900 focus:border-emerald-500 focus:outline-none"
        >
          <option value="">
            {loading
              ? "Loading saved templates..."
              : templates.length
                ? "Choose a template"
                : "No saved templates found"}
          </option>

          {templates.map((template, index) => (
            <option key={`${template.id}-${index}`} value={String(template.id)}>
              {template.name}
            </option>
          ))}
        </select>

        {selectedTemplate && (
          <p className="mt-2 text-sm text-emerald-700">
            Selected: {selectedTemplate.name}
          </p>
        )}

        {error && (
          <p className="mt-2 text-sm text-red-600">{error}</p>
        )}
      </div>

      <button
        type="button"
        onClick={onNavigateToCreate}
        className="mt-4 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        Create or Manage Templates
      </button>
    </div>
  );
}

