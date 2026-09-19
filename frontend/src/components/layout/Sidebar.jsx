// no useState import needed
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Camera,
  History,
  FileText,
  LineChart,
  Settings,
  Activity,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const navItems = [
  { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard, badge: null },
  { name: "Live Inspection", path: "/inspection", icon: Camera, badge: null },
  { name: "History Logs", path: "/history", icon: History, badge: 12 },
  { name: "Quality Reports", path: "/reports", icon: FileText, badge: 3 },
  { name: "Analytics", path: "/analytics", icon: LineChart, badge: "NEW" },
  { name: "System Settings", path: "/settings", icon: Settings, badge: null },
];

export default function Sidebar({ collapsed, setCollapsed }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
  };

  return (
    <aside
      className={`fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-accent/10 bg-secondary-bg/80 backdrop-blur-md transition-all duration-300 ${
        collapsed ? "w-16" : "w-56"
      }`}
    >
      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 z-50 flex h-6 w-6 items-center justify-center rounded-full border border-accent/20 bg-card-bg text-slate-400 transition-colors hover:bg-accent hover:text-primary-bg"
      >
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </button>

      {/* User Avatar */}
      {user && (
        <div className={`flex items-center border-b border-accent/10 px-4 py-3.5 ${collapsed ? "justify-center" : "gap-2.5"}`}>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-primary-bg shadow-[0_0_14px_rgba(50,213,131,0.25)] ring-2 ring-accent/20">
            {user.name.charAt(0).toUpperCase()}
          </span>
          {!collapsed && (
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium leading-tight text-white">{user.name}</span>
              <span className="flex items-center gap-1 text-[10px] leading-tight text-success">
                <span className="h-1.5 w-1.5 rounded-full bg-success led-fast" />
                Online
              </span>
            </div>
          )}
        </div>
      )}

      {/* Header Info */}
      {!collapsed && (
        <div className="border-b border-accent/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-accent animate-pulse" />
            <h2 className="font-display text-[10px] font-bold tracking-widest text-white">PI-AOI CORE</h2>
          </div>
          <div className="mt-2 rounded border border-accent/5 bg-[#050816] px-2.5 py-1.5">
            <span className="font-mono text-[8px] uppercase tracking-wider text-accent">YOLO Engine</span>
            <div className="flex items-center justify-between">
              <span className="font-mono text-[9px] text-slate-300">v8.0.3-xai</span>
              <span className="flex items-center gap-1.5 font-mono text-[8px] text-success">
                <span className="h-1.5 w-1.5 rounded-full bg-success led-fast" />
                ONLINE
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Nav List */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `group relative flex items-center rounded-lg border px-3 py-2 text-[11px] font-semibold uppercase tracking-widest transition-all duration-200 ${
                  collapsed ? "justify-center" : "gap-2.5"
                } ${
                  isActive
                    ? "border-accent/40 bg-accent/10 text-accent shadow-[0_0_15px_rgba(50,213,131,0.08)]"
                    : "border-transparent text-slate-400 hover:border-accent/10 hover:bg-white/5 hover:text-white"
                }`
              }
            >
              <Icon className="h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-hover:scale-110" />
              {!collapsed && (
                <>
                  <span className="flex-1">{item.name}</span>
                  {item.badge && (
                    <span
                      className={`flex h-4.5 items-center justify-center rounded-full px-1.5 text-[8px] font-bold ${
                        item.badge === "NEW"
                          ? "bg-accent/15 text-accent"
                          : "bg-danger/15 text-danger"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Logout */}
      {!collapsed && (
        <div className="px-4 py-3">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[11px] text-slate-500 transition-colors hover:bg-white/5 hover:text-danger"
          >
            <LogOut className="h-3.5 w-3.5" />
            Logout
          </button>
        </div>
      )}
    </aside>
  );
}
