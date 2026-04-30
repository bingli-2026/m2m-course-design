import { useState } from "react";
import type { NavKey } from "./types";
import SideNav from "./components/Layout/SideNav";
import TopBar from "./components/Layout/TopBar";
import DashboardPage from "./pages/DashboardPage";
import ControlPage from "./pages/ControlPage";
import EventsPage from "./pages/EventsPage";
import DemoPage from "./pages/DemoPage";

export default function App() {
  const [activeNav, setActiveNav] = useState<NavKey>("dashboard");

  return (
    <div className="flex h-screen overflow-hidden bg-background text-on-surface">
      <SideNav active={activeNav} onChange={setActiveNav} />
      <div className="flex flex-1 flex-col ml-64 min-w-0">
        <TopBar />
        <div className="flex-1 overflow-y-auto p-margin">
          {activeNav === "dashboard" && <DashboardPage />}
          {activeNav === "control" && <ControlPage />}
          {activeNav === "events" && <EventsPage />}
          {activeNav === "demo" && (
            <div className="flex h-full flex-col">
              <DemoPage />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
