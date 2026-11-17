
import { useEffect, useState } from "react";
import api from "../api/client";
import "./Findings.css";

type CaseRecord = {
  _id: string;
  caseNumber?: string;
  title?: string;
};

type FindingRecord = {
  _id: string;
  title: string;
  description: string;
  category: string;
  severity: string;
  status: string;
  createdAt?: string;
};

const categories = [
  "Suspicious Login",
  "Unauthorized Access",
  "Malware Activity",
  "Data Integrity",
  "Network Activity",
  "Other",
];

const severities = ["Low", "Medium", "High", "Critical"];

const statuses = ["Open", "Under Review", "Resolved"];

function getArray(data: any, key: string): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.[key])) return data[key];
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.[key])) return data.data[key];
  return [];
}

function Findings() {
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [selectedCase, setSelectedCase] = useState("");
  const [findings, setFindings] = useState<FindingRecord[]>([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Suspicious Login");
  const [severity, setSeverity] = useState("Medium");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
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
      loadFindings(selectedCase);
    } else {
      setFindings([]);
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
      showMessage("Unable to load investigation cases.", "error");
    }
  };

  const loadFindings = async (caseId: string) => {
    try {
      setLoading(true);

      const response = await api.get(
        `/findings/cases/${caseId}`,
        { headers: authHeaders }
      );

      setFindings(getArray(response.data, "findings"));
    } catch (error) {
      console.error("Failed to load findings:", error);
      showMessage("Unable to load findings.", "error");
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (text: string, type: string) => {
    setMessage(text);
    setMessageType(type);
  };

  const createFinding = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedCase) {
      showMessage("Please select an investigation case.", "error");
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      await api.post(
        "/findings",
        {
          caseId: selectedCase,
          title: title.trim(),
          description: description.trim(),
          category,
          severity,
          relatedEvidence: [],
          relatedLogEvents: [],
        },
        { headers: authHeaders }
      );

      setTitle("");
      setDescription("");
      setCategory("Suspicious Login");
      setSeverity("Medium");

      await loadFindings(selectedCase);
      showMessage("Finding created successfully.", "success");
    } catch (error: any) {
      console.error("Create finding error:", error);

      showMessage(
        error.response?.data?.message || "Unable to create finding.",
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (findingId: string, status: string) => {
    try {
      await api.patch(
        `/findings/${findingId}/status`,
        { status },
        { headers: authHeaders }
      );

      await loadFindings(selectedCase);
      showMessage("Finding status updated successfully.", "success");
    } catch (error: any) {
      console.error("Update finding error:", error);

      showMessage(
        error.response?.data?.message || "Unable to update finding status.",
        "error"
      );
    }
  };

  return (
    <div className="findings-page">
      <div className="findings-header">
        <h1>Findings Management</h1>
        <p>
          Record, review and manage findings discovered during
          digital investigations.
        </p>
      </div>

      <div className="finding-form-card">
        <h2>Create New Finding</h2>

        <form onSubmit={createFinding}>
          <label htmlFor="finding-case">Investigation Case</label>
          <select
            id="finding-case"
            value={selectedCase}
            onChange={(event) => setSelectedCase(event.target.value)}
            required
          >
            <option value="">Select a case</option>

            {cases.map((item) => (
              <option key={item._id} value={item._id}>
                {item.caseNumber || item._id} - {item.title || "Untitled Case"}
              </option>
            ))}
          </select>

          <label htmlFor="finding-title">Finding Title</label>
          <input
            id="finding-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. Suspicious Login Activity"
            maxLength={200}
            required
          />

          <label htmlFor="finding-description">Description</label>
          <textarea
            id="finding-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Describe the finding and supporting observations..."
            maxLength={5000}
            rows={4}
            required
          />

          <div className="finding-form-row">
            <div>
              <label htmlFor="finding-category">Category</label>
              <select
                id="finding-category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                {categories.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="finding-severity">Severity</label>
              <select
                id="finding-severity"
                value={severity}
                onChange={(event) => setSeverity(event.target.value)}
              >
                {severities.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>
          </div>

          <button type="submit" disabled={saving || !selectedCase}>
            {saving ? "Saving..." : "Create Finding"}
          </button>
        </form>

        {message && (
          <div className={`finding-message ${messageType}`}>
            {message}
          </div>
        )}
      </div>

      <div className="findings-summary">
        <div className="finding-stat">
          <span>Total Findings</span>
          <strong>{findings.length}</strong>
        </div>

        <div className="finding-stat">
          <span>High / Critical</span>
          <strong>
            {findings.filter(
              (item) => ["High", "Critical"].includes(item.severity)
            ).length}
          </strong>
        </div>

        <div className="finding-stat">
          <span>Resolved</span>
          <strong>
            {findings.filter((item) => item.status === "Resolved").length}
          </strong>
        </div>
      </div>

      <div className="findings-list-card">
        <h2>Investigation Findings</h2>

        {loading ? (
          <p className="finding-empty">Loading findings...</p>
        ) : findings.length === 0 ? (
          <p className="finding-empty">
            No findings recorded for this case yet.
          </p>
        ) : (
          <div className="findings-table-wrapper">
            <table className="findings-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Update Status</th>
                </tr>
              </thead>

              <tbody>
                {findings.map((item) => (
                  <tr key={item._id}>
                    <td>
                      <strong>{item.title}</strong>
                      <p className="finding-description">
                        {item.description}
                      </p>
                    </td>

                    <td>{item.category}</td>

                    <td>
                      <span className={`severity-badge ${item.severity.toLowerCase()}`}>
                        {item.severity}
                      </span>
                    </td>

                    <td>{item.status}</td>

                    <td>
                      <select
                        value={item.status}
                        onChange={(event) =>
                          updateStatus(item._id, event.target.value)
                        }
                      >
                        {statuses.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default Findings;
