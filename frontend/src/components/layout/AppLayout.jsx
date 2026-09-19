import { useState } from "react";

import PageWrapper from "./PageWrapper";
import Sidebar from "./Sidebar";

/**
 * Shared application layout for sidebar pages.
 *
 * The sidebar is position:fixed and spans the full viewport height;
 * only the main content area scrolls vertically.
 */
export default function AppLayout({ children }) {
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem("pcbvision_sidebar_collapsed") === "true";
  });

  const handleSidebarToggle = (value) => {
    setCollapsed(value);
    localStorage.setItem(
      "pcbvision_sidebar_collapsed",
      String(value)
    );
  };

  return (
    <PageWrapper className="flex h-screen overflow-hidden">
      <Sidebar
        collapsed={collapsed}
        setCollapsed={handleSidebarToggle}
      />

      <div
        className={`h-screen overflow-y-auto overflow-x-hidden transition-all duration-300 ${
          collapsed ? "ml-16 w-[calc(100%-4rem)]" : "ml-56 w-[calc(100%-14rem)]"
        }`}
        data-lenis-prevent
      >
        {children}
      </div>
    </PageWrapper>
  );
}