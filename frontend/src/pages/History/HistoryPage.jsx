import { useState, useMemo } from "react";
import AppLayout from "../../components/layout/AppLayout";
import SearchBar from "../../components/common/SearchBar";
import CustomTable from "../../components/common/CustomTable";
import StatusBadge from "../../components/common/StatusBadge";
import Modal from "../../components/common/Modal";
import GlassCard from "../../components/cards/GlassCard";
import { useInspectionHistory, fetchInspectionDetails } from "../../hooks/useInspectionHistory";
import { useDebounce } from "../../hooks/useDebounce";
import { useNotifications } from "../../context/NotificationContext";
import { formatDate, formatDuration, formatConfidence } from "../../utils/formatters";
import { 
  Layers
} from "lucide-react";

export default function HistoryPage() {
  // Filter States
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [defect, setDefect] = useState("ALL");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("timestamp");
  const [order, setOrder] = useState("desc");

  // Debounce search so the API is not hit on every keystroke
  const debouncedSearch = useDebounce(search, 400);

  const filters = useMemo(
    () => ({ search: debouncedSearch, status, defect, page, sortBy, order }),
    [debouncedSearch, status, defect, page, sortBy, order],
  );

  const { records, total, pages, loading, error, refetch } = useInspectionHistory(filters);
  const { notify } = useNotifications();

  // Detail Modal State
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Reset Filters helper
  const handleReset = () => {
    setSearch("");
    setStatus("ALL");
    setDefect("ALL");
    setPage(1);
    setSortBy("timestamp");
    setOrder("desc");
  };

  const handleSort = (key) => {
    const isAsc = sortBy === key && order === "asc";
    setSortBy(key);
    setOrder(isAsc ? "desc" : "asc");
    setPage(1);
  };

  // Retrieve the complete inspection record from the API before opening it
  const viewDetails = async (record) => {
    try {
      const full = await fetchInspectionDetails(record.id);
      setSelectedRecord(full);
      setIsModalOpen(true);
    } catch {
      notify({ type: "error", title: "Load Failed", message: "Unable to load inspection details." });
    }
  };

  // Table Headers definitions
  const headers = [
    { key: "id", label: "PCB Audit ID", sortable: true },
    { 
      key: "timestamp", 
      label: "Scan Date & Time", 
      sortable: true,
      render: (row) => (
        <span className="font-mono text-slate-400">{formatDate(row.timestamp)}</span>
      )
    },
    { key: "model", label: "Target Model", sortable: true },
    { 
      key: "status", 
      label: "Status", 
      sortable: true,
      render: (row) => <StatusBadge status={row.status} />
    },
    { 
      key: "defect", 
      label: "Defect Class", 
      sortable: true,
      render: (row) => (
        <span className={`font-semibold ${row.defect !== "None" ? "text-warning" : "text-slate-400"}`}>
          {row.defect}
        </span>
      )
    },
    { 
      key: "confidence", 
      label: "YOLO Conf", 
      sortable: true,
      render: (row) => <span className="font-mono text-white font-semibold">{formatConfidence(row.confidence)}</span>
    },
    { 
      key: "cycleTime", 
      label: "Cycle Time", 
      sortable: true,
      render: (row) => <span className="font-mono text-[#00E5FF]">{formatDuration(row.cycleTime)}</span>
    },
    {
      key: "actions",
      label: "Action",
      render: (row) => (
        <button
          onClick={(e) => {
            e.stopPropagation(); // prevent row click triggers
            viewDetails(row);
          }}
          className="p-1 px-3.5 bg-accent/5 hover:bg-accent/15 border border-accent/15 hover:border-accent/40 rounded text-accent hover:text-white transition-all font-display text-[9px] uppercase tracking-wider font-bold cursor-pointer"
        >
          Details
        </button>
      )
    }
  ];

  return (
    <AppLayout>

      {/* Main Container */}
      <main className="flex-1 p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
        
        {/* Header Title */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-accent/10 pb-4">
          <div className="text-left space-y-0.5">
            <h1 className="font-display text-xl md:text-2xl font-bold text-white uppercase tracking-wider">
              Inspection History
            </h1>
            <p className="font-mono text-[10px] text-accent/70 tracking-widest uppercase">
              System Audit Trails and Component Verification Database
            </p>
          </div>
          <div className="font-mono text-[10px] text-slate-500 bg-[#050816] border border-accent/5 px-3 py-1.5 rounded">
            TOTAL RECORDS: <strong className="text-white">{total}</strong>
          </div>
        </div>

        {/* Filters Panel */}
        <SearchBar
          searchQuery={search}
          onSearchChange={setSearch}
          statusFilter={status}
          onStatusFilterChange={setStatus}
          defectFilter={defect}
          onDefectFilterChange={setDefect}
          onReset={handleReset}
        />

        {/* Data Table */}
        {loading ? (
          <div className="h-64 flex items-center justify-center font-mono text-xs text-slate-500 uppercase tracking-widest">
            Loading inspection history...
          </div>
        ) : error ? (
          <div className="h-64 flex flex-col items-center justify-center gap-3 font-mono text-xs text-slate-500 uppercase tracking-widest">
            <span className="text-danger">Unable to load inspection history.</span>
            <button
              onClick={refetch}
              className="px-3 py-1.5 bg-accent/5 hover:bg-accent/15 border border-accent/15 hover:border-accent/40 rounded-lg text-accent hover:text-white transition-all font-display text-[9px] uppercase tracking-wider font-bold cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : records.length === 0 ? (
          <div className="h-64 flex items-center justify-center font-mono text-xs text-slate-500 uppercase tracking-widest">
            No inspection records found.
          </div>
        ) : (
          <CustomTable
            headers={headers}
            data={records}
            sortBy={sortBy}
            order={order}
            onSort={handleSort}
            currentPage={page}
            totalPages={pages}
            onPageChange={setPage}
            onRowClick={viewDetails}
          />
        )}

      </main>

      {/* Detail Overlay Modal */}
      {selectedRecord && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={`Audit Record: ${selectedRecord.id}`}
        >
          <div className="space-y-6">
            
            {/* Meta statistics overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-[#050816]/60 border border-accent/5 rounded-lg text-left">
                <span className="block font-mono text-[8px] text-slate-500 uppercase">Timestamp</span>
                <span className="font-mono text-[10.5px] text-slate-300 font-semibold">{formatDate(selectedRecord.timestamp)}</span>
              </div>
              <div className="p-3 bg-[#050816]/60 border border-accent/5 rounded-lg text-left">
                <span className="block font-mono text-[8px] text-slate-500 uppercase">PCB Target model</span>
                <span className="font-sans text-xs text-white font-bold">{selectedRecord.model}</span>
              </div>
              <div className="p-3 bg-[#050816]/60 border border-accent/5 rounded-lg text-left">
                <span className="block font-mono text-[8px] text-slate-500 uppercase">Operator Node</span>
                <span className="font-mono text-xs text-slate-300">{selectedRecord.operator}</span>
              </div>
              <div className="p-3 bg-[#050816]/60 border border-accent/5 rounded-lg text-left flex items-center justify-between">
                <div>
                  <span className="block font-mono text-[8px] text-slate-500 uppercase">Verdict Status</span>
                  <StatusBadge status={selectedRecord.status} />
                </div>
              </div>
            </div>

            {/* Main Details Split */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Left Panel: Camera simulation bounding boxes or Grad-CAM */}
              <GlassCard className="flex flex-col justify-between" hoverLift={false}>
                <div className="flex items-center justify-between border-b border-accent/5 pb-2">
                  <span className="font-display text-[9px] uppercase tracking-widest text-[#9ca3af] font-bold">
                    Inference Frame Capture
                  </span>
                  <span className="font-mono text-[8.5px] text-accent font-semibold">YOLO Bounding Box</span>
                </div>

                {/* Simulated frame rendering */}
                <div className="relative h-64 bg-black/90 rounded border border-accent/5 my-3 flex items-center justify-center overflow-hidden">
                  <div className="absolute inset-0 cyber-grid opacity-25" />
                  
                  {/* Procedural vector PCB schematics */}
                  <svg className="w-4/5 h-4/5 text-accent/15" viewBox="0 0 300 200" fill="none">
                    <rect x="10" y="10" width="280" height="180" rx="5" stroke="currentColor" strokeWidth="1" />
                    <rect x="110" y="70" width="80" height="60" rx="2" stroke="currentColor" strokeWidth="1" />
                    <circle cx="150" cy="100" r="20" stroke="currentColor" strokeWidth="1" />
                  </svg>

                  {/* Draw box overlays */}
                  <div className="absolute border border-success/40 bg-success/5 rounded font-mono text-[7px] text-success/80 p-0.5" style={{ left: "37%", top: "35%", width: "27%", height: "30%" }}>
                    <span>MAIN_IC: 99.8%</span>
                  </div>

                  {selectedRecord.defectCoordinates ? (
                    <div 
                      className="absolute border-2 border-danger bg-danger/10 rounded font-mono text-[8px] text-danger font-bold p-0.5 animate-pulse"
                      style={{
                        left: `${(selectedRecord.defectCoordinates.x / 400) * 100}%`,
                        top: `${(selectedRecord.defectCoordinates.y / 300) * 100}%`,
                        width: `${(selectedRecord.defectCoordinates.radius * 2 / 400) * 100}%`,
                        height: `${(selectedRecord.defectCoordinates.radius * 2 / 300) * 100}%`,
                      }}
                    >
                      <span>{selectedRecord.defect.toUpperCase()}</span>
                    </div>
                  ) : (
                    <div className="absolute border border-success/40 bg-success/5 rounded font-mono text-[7px] text-success/80 p-0.5" style={{ left: "68%", top: "62%", width: "15%", height: "20%" }}>
                      <span>C12_CAP: 98%</span>
                    </div>
                  )}
                </div>

                <div className="p-3 bg-[#050816]/80 rounded border border-accent/5">
                  <span className="font-display text-[9px] uppercase tracking-wider text-slate-400 font-bold block mb-1">
                    Grad-CAM Activation Rationale:
                  </span>
                  <p className="font-sans text-[11px] text-slate-300 text-left leading-relaxed">
                    {selectedRecord.gradCamExplanation}
                  </p>
                </div>
              </GlassCard>

              {/* Right Panel: Custom X-MCCV checklist details */}
              <GlassCard className="space-y-4 text-left" hoverLift={false}>
                <div className="flex items-center gap-2 border-b border-accent/5 pb-2">
                  <Layers className="w-4 h-4 text-accent" />
                  <span className="font-display text-[9px] uppercase tracking-widest text-[#9ca3af] font-bold">
                    X-MCCV Checklist Verification
                  </span>
                </div>

                {/* Sub checklists */}
                <div className="space-y-3 font-mono text-[10.5px]">
                  
                  {/* Presence Check */}
                  <div className="space-y-1.5">
                    <span className="font-sans text-[9.5px] uppercase tracking-wider text-slate-400 font-bold">1. Presence verification list</span>
                    <div className="space-y-1">
                      {(selectedRecord.verificationDetails?.presence ?? []).map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center py-1 border-b border-accent/5">
                          <span className="text-slate-300">{item.component}</span>
                          <span className={item.status === "PASS" ? "text-success font-bold" : "text-danger font-bold"}>
                            {item.status} ({item.confidence.toFixed(1)}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Position Offset Check */}
                  <div className="space-y-1.5 pt-1.5">
                    <span className="font-sans text-[9.5px] uppercase tracking-wider text-slate-400 font-bold">2. Position alignment checklist</span>
                    <div className="space-y-1">
                      {(selectedRecord.verificationDetails?.position ?? []).map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center py-1 border-b border-accent/5">
                          <span className="text-slate-300">Offset {item.component}</span>
                          <span className={item.status === "PASS" ? "text-success font-bold" : "text-danger font-bold"}>
                            {item.status} ({item.offset})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Orientation rotation Check */}
                  <div className="space-y-1.5 pt-1.5">
                    <span className="font-sans text-[9.5px] uppercase tracking-wider text-slate-400 font-bold">3. Angular drift checklist</span>
                    <div className="space-y-1">
                      {(selectedRecord.verificationDetails?.orientation ?? []).map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center py-1 border-b border-accent/5">
                          <span className="text-slate-300">Drift {item.component}</span>
                          <span className={item.status === "PASS" ? "text-success font-bold" : "text-danger font-bold"}>
                            {item.status} ({item.rotation})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              </GlassCard>

            </div>

          </div>
        </Modal>
      )}

    </AppLayout>
  );
}