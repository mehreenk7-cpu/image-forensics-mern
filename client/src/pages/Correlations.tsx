
import { useEffect, useState } from "react";
import api from "../api/client";
import "./Correlations.css";

type CaseRecord = {
  _id: string;
  caseNumber?: string;
  title?: string;
};

type RelatedRecord = {
  _id?: string;
  originalName?: string;
  message?: string;
  level?: string;
  timestamp?: string;
};

type CorrelationRecord = {
  _id: string;
  correlationType?: string;
  confidence: number;
  reason: string;
  status: string;
  evidenceId?: RelatedRecord | string;
  logEventId?: RelatedRecord | string;
  createdAt?: string;
};

function getArray(data: any, key: string): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.[key])) return data[key];
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.[key])) return data.data[key];
  return [];
}

function Correlations() {
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [selectedCase, setSelectedCase] = useState("");
  const [correlations, setCorrelations] = useState<CorrelationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const token = localStorage.getItem("forensics_token");

  const authHeaders = {
    Authorization: `Bearer ${token}`,
  };

  useEffect(() => {
    loadCases();
  }, []);

  useEffect(() => {
    if (selectedCase) {
      loadCorrelations(selectedCase);
    } else {
      setCorrelations([]);
    }
  }, [selectedCase]);

  const loadCases = async () => {
    try {
      const response = await api.get("/cases", {
        headers: authHeaders,
      });

      const caseList = getArray(response.data, "cases");
      setCases(caseList);

      if (caseList.length > 0) {
        setSelectedCase(caseList[0]._id);
      }
    } catch (error) {
      console.error("Failed to load cases:", error);
      setMessage("Unable to load investigation cases.");
      setMessageType("error");
    }
  };

  const loadCorrelations = async (caseId: string) => {
    try {
      setLoading(true);

      const response = await api.get(
        `/correlations/cases/${caseId}`,
        { headers: authHeaders }
      );

      setCorrelations(
        getArray(response.data, "correlations")
      );
    } catch (error) {
      console.error("Failed to load correlations:", error);
      setMessage("Unable to load correlation results.");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  const runCorrelation = async () => {
    if (!selectedCase) {
      setMessage("Please select an investigation case.");
      setMessageType("error");
      return;
    }

    try {
      setRunning(true);
      setMessage("");

      const response = await api.post(
        `/correlations/cases/${selectedCase}/run`,
        {},
        { headers: authHeaders }
      );

      await loadCorrelations(selectedCase);

      const count =
        response.data?.count ??
        response.data?.correlations?.length;

      setMessage(
        count !== undefined
          ? `Correlation analysis completed. ${count} potential correlations found.`
          : "Correlation analysis completed successfully."
      );

      setMessageType("success");
    } catch (error: any) {
      console.error("Correlation error:", error);

      setMessage(
        error.response?.data?.message ||
        "Correlation analysis failed. Please try again."
      );

      setMessageType("error");
    } finally {
      setRunning(false);
    }
  };

  const getRelatedName = (
    record?: RelatedRecord | string,
    type: "evidence" | "log" = "evidence"
  ) => {
    if (!record) return "Not available";
    if (typeof record === "string") return record;

    if (type === "evidence") {
      return record.originalName || record._id || "Evidence";
    }

    return record.message || record._id || "Log event";
  };

  const getConfidenceClass = (confidence: number) => {
    if (confidence >= 80) return "high";
    if (confidence >= 50) return "medium";
    return "low";
  };

  return (
    <div className="correlations-page">
      <div className="correlations-header">
        <div>
          <h1>Correlation Analysis</h1>
          <p>
            Identify potential relationships between digital
            evidence and suspicious log events.
          </p>
        </div>
      </div>

      <div className="correlation-control-card">
        <h2>Run Investigation Correlation</h2>

        <label htmlFor="correlation-case">
          Select Investigation Case
        </label>

        <select
          id="correlation-case"
          value={selectedCase}
          onChange={(e) => setSelectedCase(e.target.value)}
        >
          <option value="">Select a case</option>

          {cases.map((item) => (
            <option key={item._id} value={item._id}>
              {item.caseNumber || item._id} - {item.title || "Untitled Case"}
            </option>
          ))}
        </select>

        <button
          onClick={runCorrelation}
          disabled={!selectedCase || running}
        >
          {running ? "Analysing..." : "Run Correlation Analysis"}
        </button>

        {message && (
          <div className={`correlation-message ${messageType}`}>
            {message}
          </div>
        )}
      </div>

      <div className="correlation-summary">
        <div className="correlation-stat-card">
          <span>Total Correlations</span>
          <strong>{correlations.length}</strong>
        </div>

        <div className="correlation-stat-card">
          <span>High Confidence</span>
          <strong>
            {correlations.filter((item) => item.confidence >= 80).length}
          </strong>
        </div>

        <div className="correlation-stat-card">
          <span>Pending Review</span>
          <strong>
            {correlations.filter((item) => item.status === "New").length}
          </strong>
        </div>
      </div>

      <div className="correlation-results-card">
        <h2>Correlation Results</h2>

        {loading ? (
          <p className="correlation-empty">Loading results...</p>
        ) : correlations.length === 0 ? (
          <p className="correlation-empty">
            No correlations found. Upload evidence and log files
            for this case, then run the analysis.
          </p>
        ) : (
          <div className="correlation-table-wrapper">
            <table className="correlation-table">
              <thead>
                <tr>
                  <th>Evidence</th>
                  <th>Log Event</th>
                  <th>Confidence</th>
                  <th>Reason</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {correlations.map((item) => (
                  <tr key={item._id}>
                    <td>
                      {getRelatedName(item.evidenceId, "evidence")}
                    </td>

                    <td>
                      {getRelatedName(item.logEventId, "log")}
                    </td>

                    <td>
                      <span
                        className={`confidence-badge ${getConfidenceClass(
                          item.confidence
                        )}`}
                      >
                        {item.confidence}%
                      </span>
                    </td>

                    <td>{item.reason}</td>

                    <td>
                      <span className="correlation-status">
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="correlation-disclaimer">
        <strong>Forensic note:</strong> These results are potential
        time-based relationships between evidence and log events.
        They are investigative leads, not proof of causation.
      </div>
    </div>
  );
}

export default Correlations;
