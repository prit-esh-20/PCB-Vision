import { useState } from "react";
import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";

// Animations & Canvas Backgrounds
import LoadingScreen from "./components/animations/LoadingScreen";
import PCBBackground from "./components/animations/PCBBackground";

// Page Components
import LandingPage from "./pages/Landing/LandingPage";
import DashboardPage from "./pages/Dashboard/DashboardPage";
import LiveInspectionPage from "./pages/LiveInspection/LiveInspectionPage";
import HistoryPage from "./pages/History/HistoryPage";
import ReportsPage from "./pages/Reports/ReportsPage";
import AnalyticsPage from "./pages/Analytics/AnalyticsPage";
import SettingsPage from "./pages/Settings/SettingsPage";
import LoginPage from "./pages/Login/LoginPage";

// Auth
import { AuthProvider, useAuth } from "./context/AuthContext";

// Notifications
import { NotificationProvider } from "./context/NotificationContext";

// Hooks
import useSmoothScroll from "./hooks/useSmoothScroll";

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

// Inner shell — only mounts once isLoaded=true, so Lenis
// initializes when there is actual scrollable content in the DOM.
function AppShell() {
  const location = useLocation();
  useSmoothScroll();

  return (
    <div className="relative min-h-screen w-full text-slate-100 font-sans select-none antialiased">
      {/* Single persistent electronics background behind every route */}
      <PCBBackground />

      <AnimatePresence mode="wait" initial={false}>
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/inspection" element={<ProtectedRoute><LiveInspectionPage /></ProtectedRoute>} />
          <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
          <Route path="/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        </Routes>
      </AnimatePresence>
    </div>
  );
}

function AppShellWithAuth() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <AppShell />
      </NotificationProvider>
    </AuthProvider>
  );
}

export default function App() {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <>
      {/* Industrial Boot Scan Preloader */}
      <LoadingScreen onFinish={() => setIsLoaded(true)} />

      {/* Main app shell — mounts once loader signals completion */}
      {isLoaded && <AppShellWithAuth />}
    </>
  );
}
