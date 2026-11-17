
import { useEffect, useMemo, useState } from "react";
import api from "../api/client";
import "./Dashboard.css";

type CaseRecord = {
  _id: string;
  caseNumber?: string;
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  createdAt?: string;
};

type DashboardProps = {
  onNavigate: (
    page: "cases" | "evidence" | "analysis" | "logs" | "reports"
  ) => void;
};

function Dashboard({ onNavigate }: DashboardProps) {
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const token = localStorage.getItem("forensics_token");

        const response = await api.get("/cases", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = response.data;
        const caseList: CaseRecord[] = Array.isArray(data)
          ? data
          : data.cases || data.data || [];

        setCases(caseList);
      } catch (err) {
        console.error("Dashboard loading error:", err);
        setError("Unable to load dashboard case statistics.");
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  const stats = useMemo(() => {
    return {
      total: cases.length,
      open: cases.filter(
        (item) => item.status?.toLowerCase() === "open"
      ).length,
      progress: cases.filter(
        (item) => item.status?.toLowerCase() === "in progress"
      ).length,
      resolved: cases.filter(
        (item) => item.status?.toLowerCase() === "resolved"
      ).length,
      highPriority: cases.filter((item) =>
        ["high", "critical"].includes(item.priority?.toLowerCase() || "")
      ).length,
    };
  }, [cases]);

  const recentCases = useMemo(() => {
    return [...cases]
      .sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime()
      )
      .slice(0, 5);
  }, [cases]);

  const tools = [
    {
      icon: "▤",
      title: "Evidence Files",
      description: "Upload and manage digital evidence.",
      page: "evidence" as const,
    },
    {
      icon: "⌕",
      title: "Image Analysis",
      description: "Inspect images and calculate SHA-256 hashes.",
      page: "analysis" as const,
    },
    {
      icon: "≡",
      title: "Log Explorer",
      description: "Analyse logs and detect suspicious activities.",
      page: "logs" as const,
    },
    {
      icon: "▧",
      title: "Reports",
      description: "Create and download investigation reports.",
      page: "reports" as const,
    },
  ];

  return (
    <div className="dashboard-page">
      <section className="dashboard-welcome">
        <div>
          <span className="dashboard-eyebrow">
            DIGITAL FORENSICS WORKSPACE
          </span>
          <h2>Investigation Overview</h2>
          <p>
            Monitor your investigation cases and access forensic tools
            from one place.
          </p>
        </div>

        <button
          className="new-case-button"
          onClick={() => onNavigate("cases")}
        >
          + New Investigation
        </button>
      </section>

      {error && <div className="dashboard-error">{error}</div>}

      <section className="dashboard-stats">
        <div className="dashboard-stat-card">
          <div className="stat-top">
            <span>Total Cases</span>
            <span className="stat-icon cyan">▣</span>
          </div>
          <h3>{loading ? "..." : stats.total}</h3>
          <p>All investigation cases</p>
        </div>

        <div className="dashboard-stat-card">
          <div className="stat-top">
            <span>Open Cases</span>
            <span className="stat-icon blue">◷</span>
          </div>
          <h3>{loading ? "..." : stats.open}</h3>
          <p>Awaiting investigation</p>
        </div>

        <div className="dashboard-stat-card">
          <div className="stat-top">
            <span>In Progress</span>
            <span className="stat-icon orange">↻</span>
          </div>
          <h3>{loading ? "..." : stats.progress}</h3>
          <p>Currently being investigated</p>
        </div>

        <div className="dashboard-stat-card">
          <div className="stat-top">
            <span>Resolved Cases</span>
            <span className="stat-icon green">✓</span>
          </div>
          <h3>{loading ? "..." : stats.resolved}</h3>
          <p>Successfully completed</p>
        </div>

        <div className="dashboard-stat-card">
          <div className="stat-top">
            <span>High Priority</span>
            <span className="stat-icon red">!</span>
          </div>
          <h3>{loading ? "..." : stats.highPriority}</h3>
          <p>High and critical cases</p>
        </div>
      </section>

      <section className="dashboard-main-grid">
        <div className="dashboard-panel recent-panel">
          <div className="dashboard-panel-heading">
            <div>
              <h3>Recent Investigations</h3>
              <p>Your latest investigation cases</p>
            </div>

            <button
              className="text-action"
              onClick={() => onNavigate("cases")}
            >
              View All →
            </button>
          </div>

          {loading ? (
            <div className="dashboard-empty">Loading cases...</div>
          ) : recentCases.length === 0 ? (
            <div className="dashboard-empty">
              <div className="empty-icon">▣</div>
              <h4>No investigations yet</h4>
              <p>Create your first investigation case to get started.</p>
              <button
                className="text-action"
                onClick={() => onNavigate("cases")}
              >
                Create Investigation →
              </button>
            </div>
          ) : (
            <div className="recent-case-list">
              {recentCases.map((item) => (
                <div className="recent-case-item" key={item._id}>
                  <div className="case-avatar">▣</div>

                  <div className="recent-case-info">
                    <h4>{item.title || "Untitled Investigation"}</h4>
                    <p>
                      {item.caseNumber || item._id.slice(-8)}
                      {" · "}
                      {item.createdAt
                        ? new Date(item.createdAt).toLocaleDateString()
                        : "Date unavailable"}
                    </p>
                  </div>

                  <div className="case-status-area">
                    <span
                      className={`case-status ${
                        item.status?.toLowerCase().replace(/\s+/g, "-") ||
                        "unknown"
                      }`}
                    >
                      {item.status || "Unknown"}
                    </span>
                    <span className="case-priority">
                      {item.priority || "Medium"} Priority
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="dashboard-panel status-panel">
          <div className="dashboard-panel-heading">
            <div>
              <h3>Case Status Overview</h3>
              <p>Current case distribution</p>
            </div>
          </div>

          {loading ? (
            <div className="dashboard-empty">Loading...</div>
          ) : (
            <>
              <div className="status-total">
                <h2>{stats.total}</h2>
                <p>Total Investigations</p>
              </div>

              <div className="status-bar">
                <span
                  className="status-segment open-segment"
                  style={{
                    width: `${stats.total ? (stats.open / stats.total) * 100 : 0}%`,
                  }}
                />
                <span
                  className="status-segment progress-segment"
                  style={{
                    width: `${stats.total ? (stats.progress / stats.total) * 100 : 0}%`,
                  }}
                />
                <span
                  className="status-segment resolved-segment"
                  style={{
                    width: `${stats.total ? (stats.resolved / stats.total) * 100 : 0}%`,
                  }}
                />
              </div>

              <div className="status-legend">
                <div>
                  <span className="legend-dot open-dot" />
                  <span>Open</span>
                  <strong>{stats.open}</strong>
                </div>
                <div>
                  <span className="legend-dot progress-dot" />
                  <span>In Progress</span>
                  <strong>{stats.progress}</strong>
                </div>
                <div>
                  <span className="legend-dot resolved-dot" />
                  <span>Resolved</span>
                  <strong>{stats.resolved}</strong>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="dashboard-tools-section">
        <div className="dashboard-section-heading">
          <div>
            <h3>Forensic Investigation Tools</h3>
            <p>Quick access to your investigation modules</p>
          </div>
        </div>

        <div className="dashboard-tools-grid">
          {tools.map((tool) => (
            <button
              className="dashboard-tool-card"
              key={tool.page}
              onClick={() => onNavigate(tool.page)}
            >
              <span className="tool-icon">{tool.icon}</span>
              <h4>{tool.title}</h4>
              <p>{tool.description}</p>
              <span className="tool-open">Open Module →</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

export default Dashboard;
