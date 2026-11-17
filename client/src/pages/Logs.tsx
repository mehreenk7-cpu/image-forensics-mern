
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import api from "../api/client";
import "./Logs.css";

type CaseRecord = {
  _id: string;
  title?: string;
  caseNumber?: string;
};

type LogEvent = {
  _id: string;
  caseId: string;
  source?: string;
  originalFileName?: string;
  lineNumber: number;
  timestamp?: string;
  level: string;
  eventType: string;
  message: string;
  ipAddress?: string;
  rawLog?: string;
  suspicious: boolean;
};

type LogResponse = {
  success?: boolean;
  totalEvents?: number;
  events?: LogEvent[];
  message?: string;
  summary?: {
    fileName: string;
    totalEvents: number;
    suspiciousEvents: number;
    criticalEvents?: number;
    errorEvents?: number;
  };
};

function getToken() {
  return localStorage.getItem("forensics_token");
}

function Logs() {
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [caseId, setCaseId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [events, setEvents] = useState<LogEvent[]>([]);

  const [loadingCases, setLoadingCases] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  // Load investigation cases
  const loadCases = async () => {
    setLoadingCases(true);
    setError("");

    try {
      const response = await api.get("/cases", {
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });

      const data = response.data;

      const caseList: CaseRecord[] = Array.isArray(data)
        ? data
        : data.cases ?? data.data ?? [];

      setCases(caseList);

      if (caseList.length > 0) {
        setCaseId((current) => current || caseList[0]._id);
      }
    } catch (err: any) {
      console.error("Failed to load cases:", err);

      setError(
        err.response?.data?.message ||
          "Could not load investigation cases."
      );
    } finally {
      setLoadingCases(false);
    }
  };

  // Load logs for selected case
  const loadLogs = async (selectedCaseId: string) => {
    if (!selectedCaseId) {
      setEvents([]);
      return;
    }

    setLoadingLogs(true);
    setError("");

    try {
      const response = await api.get<LogResponse>(
        `/logs/cases/${selectedCaseId}`,
        {
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        }
      );

      setEvents(response.data.events ?? []);
    } catch (err: any) {
      console.error("Failed to load logs:", err);

      setEvents([]);

      setError(
        err.response?.data?.message ||
          "Could not load logs for this case."
      );
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    void loadCases();
  }, []);

  useEffect(() => {
    if (caseId) {
      void loadLogs(caseId);
    } else {
      setEvents([]);
    }
  }, [caseId]);

  // Upload and analyze log file
  const handleUpload = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setMessage("");
    setError("");

    if (!caseId) {
      setError("Please select an investigation case.");
      return;
    }

    if (!file) {
      setError("Please select a .log or .txt file.");
      return;
    }

    const extension = file.name.split(".").pop()?.toLowerCase();

    if (extension !== "log" && extension !== "txt") {
      setError("Only .log and .txt files are supported.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("File size must be 5 MB or smaller.");
      return;
    }

    const formData = new FormData();
    formData.append("logFile", file);

    setUploading(true);

    try {
      const response = await api.post<LogResponse>(
        `/logs/cases/${caseId}/upload`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        }
      );

      const summary = response.data.summary;

      setMessage(
        summary
          ? `${summary.fileName}: ${summary.totalEvents} events found, ${summary.suspiciousEvents} suspicious.`
          : response.data.message || "Log uploaded successfully."
      );

      setFile(null);

      const input = document.getElementById(
        "log-file-input"
      ) as HTMLInputElement | null;

      if (input) input.value = "";

      await loadLogs(caseId);
    } catch (err: any) {
      console.error("Log upload failed:", err);

      setError(
        err.response?.data?.message ||
          "Log upload failed. Please check the backend."
      );
    } finally {
      setUploading(false);
    }
  };

  // Search and filter events
  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const matchesSearch =
        event.message.toLowerCase().includes(search.toLowerCase()) ||
        (event.ipAddress || "")
          .toLowerCase()
          .includes(search.toLowerCase()) ||
        event.eventType.toLowerCase().includes(search.toLowerCase());

      const matchesFilter =
        filter === "ALL" ||
        (filter === "SUSPICIOUS" && event.suspicious) ||
        event.level === filter;

      return matchesSearch && matchesFilter;
    });
  }, [events, search, filter]);

  // Dashboard statistics
  const suspiciousCount = events.filter(
    (event) => event.suspicious
  ).length;

  const criticalCount = events.filter(
    (event) => event.level === "CRITICAL"
  ).length;

  const errorCount = events.filter(
    (event) => event.level === "ERROR"
  ).length;

  const warningCount = events.filter(
    (event) => event.level === "WARNING"
  ).length;

  return (
    <div className="logs-page">

      {/* Header */}
      <div className="logs-header">
        <div>
          <p className="logs-eyebrow">DIGITAL FORENSICS</p>
          <h1>Log Explorer</h1>
          <p className="logs-subtitle">
            Upload, analyze and investigate system log activities.
          </p>
        </div>

        <button
          type="button"
          className="logs-refresh-btn"
          onClick={() => void loadLogs(caseId)}
          disabled={!caseId || loadingLogs}
        >
          {loadingLogs ? "Refreshing..." : "↻ Refresh Logs"}
        </button>
      </div>

      {/* Upload Section */}
      <section className="logs-panel">
        <div className="logs-section-heading">
          <div>
            <h2>Upload Log File</h2>
            <p>Upload system logs for automated security analysis.</p>
          </div>
          <span className="logs-tag">MAX 5 MB</span>
        </div>

        <form onSubmit={handleUpload} className="logs-upload-form">

          <div className="logs-form-group">
            <label htmlFor="log-case-select">
              Investigation Case
            </label>

            <select
              id="log-case-select"
              value={caseId}
              onChange={(event) => {
                setCaseId(event.target.value);
                setMessage("");
                setError("");
              }}
              disabled={loadingCases || cases.length === 0}
            >
              <option value="">
                {loadingCases
                  ? "Loading cases..."
                  : "Select an investigation case"}
              </option>

              {cases.map((item) => (
                <option key={item._id} value={item._id}>
                  {item.caseNumber
                    ? `${item.caseNumber} — `
                    : ""}
                  {item.title || item._id}
                </option>
              ))}
            </select>
          </div>

          <div className="logs-form-group">
            <label htmlFor="log-file-input">
              Select Log File
            </label>

            <input
              id="log-file-input"
              type="file"
              accept=".log,.txt,text/plain"
              onChange={(event) =>
                setFile(event.target.files?.[0] ?? null)
              }
            />

            {file && (
              <p className="logs-file-info">
                Selected: {file.name} ·{" "}
                {(file.size / 1024).toFixed(1)} KB
              </p>
            )}
          </div>

          <button
            type="submit"
            className="logs-upload-btn"
            disabled={uploading || !caseId || !file}
          >
            {uploading ? "Analyzing Logs..." : "Upload & Analyze"}
          </button>
        </form>

        {message && (
          <div className="logs-success">{message}</div>
        )}

        {error && (
          <div className="logs-error">{error}</div>
        )}
      </section>

      {/* Statistics */}
      <section className="logs-stats">

        <div className="logs-stat-card">
          <span>Total Events</span>
          <strong>{events.length}</strong>
          <small>All parsed events</small>
        </div>

        <div className="logs-stat-card">
          <span>Suspicious Events</span>
          <strong className="stat-warning">
            {suspiciousCount}
          </strong>
          <small>Flagged activities</small>
        </div>

        <div className="logs-stat-card">
          <span>Critical Events</span>
          <strong className="stat-critical">
            {criticalCount}
          </strong>
          <small>Critical severity</small>
        </div>

        <div className="logs-stat-card">
          <span>Error Events</span>
          <strong className="stat-error">
            {errorCount}
          </strong>
          <small>Failed activities</small>
        </div>

        <div className="logs-stat-card">
          <span>Warning Events</span>
          <strong className="stat-warning">
            {warningCount}
          </strong>
          <small>Warning severity</small>
        </div>

      </section>

      {/* Parsed Events */}
      <section className="logs-panel">

        <div className="logs-table-header">
          <div>
            <h2>Parsed Log Events</h2>
            <p>
              Showing {filteredEvents.length} of {events.length} events
            </p>
          </div>
        </div>

        {/* Search and filters */}
        <div className="logs-controls">

          <input
            type="text"
            placeholder="Search message, IP address or event..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <select
            aria-label="Filter log events"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option value="ALL">All Events</option>
            <option value="SUSPICIOUS">Suspicious Only</option>
            <option value="CRITICAL">Critical</option>
            <option value="ERROR">Error</option>
            <option value="WARNING">Warning</option>
            <option value="INFO">Info</option>
            <option value="UNKNOWN">Unknown</option>
          </select>

        </div>

        {loadingLogs ? (
          <p className="logs-empty">Loading log events...</p>
        ) : filteredEvents.length === 0 ? (
          <p className="logs-empty">
            No log events found. Select a case and upload a log file.
          </p>
        ) : (
          <div className="logs-table-wrapper">
            <table className="logs-table">

              <thead>
                <tr>
                  <th>Line</th>
                  <th>Timestamp</th>
                  <th>Level</th>
                  <th>Event Type</th>
                  <th>IP Address</th>
                  <th>Suspicious</th>
                  <th>Message</th>
                </tr>
              </thead>

              <tbody>
                {filteredEvents.map((event) => (
                  <tr key={event._id}>
                    <td>{event.lineNumber}</td>

                    <td>
                      {event.timestamp
                        ? new Date(event.timestamp).toLocaleString()
                        : "Not detected"}
                    </td>

                    <td>
                      <span
                        className={`logs-severity severity-${event.level.toLowerCase()}`}
                      >
                        {event.level}
                      </span>
                    </td>

                    <td>{event.eventType}</td>

                    <td>{event.ipAddress || "Unknown"}</td>

                    <td>
                      <span
                        className={
                          event.suspicious
                            ? "logs-flag logs-flag-yes"
                            : "logs-flag logs-flag-no"
                        }
                      >
                        {event.suspicious ? "Yes" : "No"}
                      </span>
                    </td>

                    <td
                      className="logs-message-cell"
                      title={event.rawLog || event.message}
                    >
                      {event.message}
                    </td>
                  </tr>
                ))}
              </tbody>

            </table>
          </div>
        )}

      </section>
    </div>
  );
}

export default Logs;
