import { useEffect, useState } from "react";
import AppLayout from "../../components/layout/AppLayout";
import GlassCard from "../../components/cards/GlassCard";
import Button from "../../components/common/Button";
import { DEFAULT_PCB_TYPE_ID, fetchPcbTypes } from "../../config/pcbTypes";
import { useReports } from "../../hooks/useReports";
import { useNotifications } from "../../context/NotificationContext";
import { reportsApi } from "../../services/api/reportsApi";
import {
  FileText,
  Download,
  Eye,
  Calendar,
  ArrowRight,
} from "lucide-react";

const triggerDownload = (url, filename) => {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
};

export default function ReportsPage() {
  const [pcbTypes, setPcbTypes] = useState([]);
  const [form, setForm] = useState({
    reportScope: "SUMMARY", // "SUMMARY" | "FULL" | "X-MCCV"
    pcbTypeId: DEFAULT_PCB_TYPE_ID,
    startDate: "2026-07-01",
    endDate: "2026-07-24",
    embedGradCam: true,
    includeOpenCvCoordinates: true,
  });
  const { reports, loading, error, refresh } = useReports();
  const { notify } = useNotifications();

  useEffect(() => {
    let isActive = true;
    fetchPcbTypes().then((types) => {
      if (isActive) setPcbTypes(types);
    });
    return () => {
      isActive = false;
    };
  }, []);

  const updateForm = (field) => (event) => {
    const value =
      event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreateReport = async () => {
    try {
      const report = await reportsApi.createReport({ ...form });
      if (report?.downloadUrl) {
        triggerDownload(report.downloadUrl, report.filename || `${report.reportId || "report"}.pdf`);
      }
      await refresh();
      notify({ type: "success", title: "Report Compiled", message: "New PDF report compiled successfully." });
    } catch {
      notify({ type: "error", title: "Compilation Failed", message: "Unable to compile the report. Please try again." });
    }
  };

  const handleViewReport = async (reportId) => {
    try {
      const report = await reportsApi.getReport(reportId);
      if (report?.downloadUrl) {
        window.open(report.downloadUrl, "_blank");
      } else {
        notify({ type: "error", title: "View Failed", message: "This report has no downloadable file yet." });
      }
    } catch {
      notify({ type: "error", title: "View Failed", message: "Unable to open the report. Please try again." });
    }
  };

  const handleDownloadReport = async (reportId) => {
    try {
      const report = await reportsApi.downloadReport(reportId);
      triggerDownload(report.downloadUrl, report.filename || `${reportId}.pdf`);
      notify({ type: "success", title: "Report Downloaded", message: `${report.filename || reportId}.pdf downloaded.` });
    } catch {
      notify({ type: "error", title: "Download Failed", message: "Unable to download the report. Please try again." });
    }
  };

  return (
    <AppLayout>

      {/* Main Container */}
      <main className="flex-1 p-6 md:p-8 space-y-4 max-w-[92%] mx-auto w-full">

        {/* Title */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-accent/10 pb-2">
          <div className="text-left space-y-0.5">
            <h1 className="font-display text-xl md:text-2xl font-bold text-white uppercase tracking-wider">
              Quality Audit Reports
            </h1>
            <p className="font-mono text-[10px] text-accent/70 tracking-widest uppercase">
              Compliance Export Management & Diagnostics Data
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-7 items-start">

          {/* LEFT COLUMN: Report Generator Form */}
          <div className="text-left">
            <GlassCard className="!p-6" hoverLift={false}>
              <div className="space-y-6">

                <div className="flex items-center gap-2 border-b border-accent/5 pb-2.5">
                  <FileText className="w-4 h-4 text-accent" />
                  <span className="font-display text-[10px] tracking-widest text-[#9ca3af] uppercase font-bold">
                    Compile New PDF Report
                  </span>
                </div>

                {/* Form Controls */}
                <div className="space-y-6">

                  {/* Report Type */}
                  <div className="space-y-2.5">
                    <label className="font-mono text-[9px] text-slate-400 uppercase tracking-wider block font-bold">
                      Report details scope
                    </label>
                    <div className="grid grid-cols-3 gap-2.5">
                      {[
                        { id: "SUMMARY", label: "Overview" },
                        { id: "FULL", label: "Full Details" },
                        { id: "X-MCCV", label: "X-MCCV" }
                      ].map((type) => (
                        <button
                          key={type.id}
                          onClick={() => setForm((prev) => ({ ...prev, reportScope: type.id }))}
                          className={`py-2 text-[9px] font-display uppercase tracking-widest font-extrabold rounded-lg border transition-all cursor-pointer whitespace-nowrap ${
                            form.reportScope === type.id
                              ? "bg-accent/10 border-accent text-accent shadow-[0_0_10px_rgba(0,229,255,0.15)]"
                              : "bg-secondary-bg border-accent/10 text-slate-400 hover:border-accent/30"
                          }`}
                        >
                          {type.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* PCB Type Selection */}
                  <div className="space-y-2.5">
                    <label className="font-mono text-[9px] text-slate-400 uppercase tracking-wider block font-bold">
                      Select PCB Type
                    </label>
                    <select
                      value={form.pcbTypeId}
                      onChange={updateForm("pcbTypeId")}
                      className="w-full bg-[#050816]/60 border border-accent/15 rounded-lg px-3 py-2 font-sans text-xs text-white placeholder-slate-500 focus:outline-none focus:border-accent transition-all cursor-pointer"
                    >
                      {pcbTypes.map((pcbType) => (
                        <option key={pcbType.id} value={pcbType.id} className="bg-[#111827]">
                          {pcbType.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Scope Selection */}
                  <div className="space-y-2.5">
                    <label className="font-mono text-[9px] text-slate-400 uppercase tracking-wider block font-bold">
                      Select Date Scope
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="date"
                        value={form.startDate}
                        onChange={updateForm("startDate")}
                        className="w-full min-w-0 bg-[#050816]/60 border border-accent/15 rounded-lg px-3 py-2 text-xs text-slate-300 font-mono focus:outline-none focus:border-accent"
                      />
                      <input
                        type="date"
                        value={form.endDate}
                        onChange={updateForm("endDate")}
                        className="w-full min-w-0 bg-[#050816]/60 border border-accent/15 rounded-lg px-3 py-2 text-xs text-slate-300 font-mono focus:outline-none focus:border-accent"
                      />
                    </div>
                  </div>

                  {/* Rules Toggles */}
                  <div className="p-3 bg-[#050816]/60 border border-accent/5 rounded-lg">
                    <div className="flex items-center justify-between gap-3 py-1 font-mono text-[9px] text-slate-400">
                      <span className="leading-none">Embed Grad-CAM heatmaps:</span>
                      <input
                        type="checkbox"
                        checked={form.embedGradCam}
                        onChange={updateForm("embedGradCam")}
                        className="accent-accent w-3.5 h-3.5 shrink-0 cursor-pointer"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3 py-1 font-mono text-[9px] text-slate-400">
                      <span className="leading-none">Include raw OpenCV coordinates:</span>
                      <input
                        type="checkbox"
                        checked={form.includeOpenCvCoordinates}
                        onChange={updateForm("includeOpenCvCoordinates")}
                        className="accent-accent w-3.5 h-3.5 shrink-0 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                {/* Create Trigger */}
                <Button variant="primary" className="!mt-5 !h-[50px] w-full flex items-center justify-center gap-2" onClick={handleCreateReport}>
                  Compile Audit Log File
                  <ArrowRight className="w-4 h-4" />
                </Button>

              </div>
            </GlassCard>
          </div>

          {/* RIGHT COLUMN: Available Reports List */}
          <div className="space-y-4">

            {loading ? (
              <div className="h-64 flex items-center justify-center font-mono text-xs text-slate-500 uppercase tracking-widest">
                Loading reports...
              </div>
            ) : error ? (
              <div className="h-64 flex flex-col items-center justify-center gap-2 font-mono text-xs text-slate-500 uppercase tracking-widest">
                <span className="text-danger">Unable to retrieve reports.</span>
                <span className="text-slate-600 normal-case">Please try again.</span>
              </div>
            ) : reports.length === 0 ? (
              <div className="h-64 flex items-center justify-center font-mono text-xs text-slate-500 uppercase tracking-widest">
                No reports available yet.
              </div>
            ) : (
              reports.map((batch) => (
              <GlassCard key={batch.id} className="!p-4 text-left" hoverLift={true} data-report-id={batch.id}>

                {/* Report ID + Type */}
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-[9px] bg-accent/10 border border-accent/20 px-2 py-0.5 rounded text-accent font-semibold">
                    {batch.id}
                  </span>
                  <span className="font-mono text-[8px] text-slate-500 uppercase tracking-widest">{batch.type}</span>
                </div>

                {/* Report Title */}
                <h3 className="mt-2.5 font-display text-xs uppercase tracking-wider text-white font-bold">{batch.title}</h3>

                {/* Date + PCB + File Size */}
                <div className="mt-2.5 flex items-center justify-between gap-3 text-[9px] font-mono text-slate-500">
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3 text-slate-500" /> {batch.date}</span>
                  <span>{batch.pcbId ? <span className="text-slate-400">PCB: <strong>{batch.pcbId}</strong></span> : null}</span>
                  <span>Size: <strong className="text-slate-400">{batch.size}</strong></span>
                </div>

                {/* Status + Actions */}
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-accent/5 pt-2.5">
                  <span className={`flex items-center gap-1 font-mono text-[8px] tracking-wider px-2 py-1 border rounded uppercase font-bold ${
                    batch.status === "COMPILED"
                      ? "border-success/30 bg-success/5 text-success"
                      : "border-slate-800 bg-slate-900/60 text-slate-500"
                  }`}>
                    {batch.status}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleViewReport(batch.id)}
                      className="p-2 bg-accent/5 hover:bg-accent/15 border border-accent/15 hover:border-accent/40 rounded-lg text-accent hover:text-white transition-all flex items-center justify-center shrink-0 cursor-pointer"
                      title="View Report PDF"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDownloadReport(batch.id)}
                      className="p-2 bg-accent/5 hover:bg-accent/15 border border-accent/15 hover:border-accent/40 rounded-lg text-accent hover:text-white transition-all flex items-center justify-center shrink-0 cursor-pointer"
                      title="Download Report File"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

              </GlassCard>
            )))}

          </div>

        </div>

      </main>
    </AppLayout>
  );
}
