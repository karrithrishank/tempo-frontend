import { useState, useEffect } from "react";
import Dashboard from "./pages/Dashboard";
import MLLab    from "./pages/MLLab";
import "./App.css";

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const pad = n => String(n).padStart(2, "0");
  const clock = `${pad(time.getHours())}:${pad(time.getMinutes())}:${pad(time.getSeconds())}`;
  const dateStr = time.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

  return (
    <div className="app z1">
      <nav className="navbar">
        <div className="nav-left">
          <div className="brand">
            <div className="brand-mark">
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <path d="M11 2L13.5 8H20L14.5 12L16.5 18L11 14L5.5 18L7.5 12L2 8H8.5L11 2Z"
                  fill="var(--gold)" opacity="0.9"/>
              </svg>
            </div>
            <div className="brand-text">
              <span className="brand-name">TEMPO</span>
              <span className="brand-tagline">Weather Intelligence</span>
            </div>
          </div>

          <div className="nav-links">
            <button className={`nav-link ${page === "dashboard" ? "active" : ""}`}
              onClick={() => setPage("dashboard")}>
              <span className="nav-link-icon">◎</span> Dashboard
            </button>
            <button className={`nav-link ${page === "mllab" ? "active" : ""}`}
              onClick={() => setPage("mllab")}>
              <span className="nav-link-icon">⬡</span> ML Lab
            </button>
          </div>
        </div>

        <div className="nav-right">
          <div className="nav-location">
            <span className="location-dot">◉</span>
            <span>ANITS, AP</span>
          </div>
          <div className="nav-clock">
            <span className="clock-time">{clock}</span>
            <span className="clock-date">{dateStr}</span>
          </div>
          <div className="status-pill">
            <span className="status-live"></span>
            <span>LIVE</span>
          </div>
        </div>
      </nav>

      <main className="main-content">
        {page === "dashboard" ? <Dashboard /> : <MLLab />}
      </main>
    </div>
  );
}
