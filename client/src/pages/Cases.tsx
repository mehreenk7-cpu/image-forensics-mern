
import { useEffect, useState } from "react";
import api from "../api/client";
import "./Cases.css";

type InvestigationCase = {
  _id: string;
  caseNumber: string;
  title: string;
  description: string;
  priority: "Low" | "Medium" | "High" | "Critical";
  status: "Open" | "In Progress" | "Resolved";
  createdAt: string;
};

function Cases() {
  const [cases, setCases] = useState<InvestigationCase[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] =
    useState<InvestigationCase["priority"]>("Medium");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState("");
  const [message, setMessage] = useState("");

  const loadCases = async () => {
    try {
      const response = await api.get("/cases");
      setCases(response.data.cases);
    } catch (error: any) {
      setMessage(
        error.response?.data?.message ||
          "Could not load cases. Please log in again."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("forensics_token");

    if (token) {
      api.defaults.headers.common.Authorization = `Bearer ${token}`;
      void loadCases();
    } else {
      setMessage("Please log in to view investigation cases.");
      setLoading(false);
    }
  }, []);

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    setSaving(true);

    try {
      const response = await api.post("/cases", {
        title,
        description,
        priority,
      });

      setCases((previous) => [response.data.case, ...previous]);
      setTitle("");
      setDescription("");
      setPriority("Medium");
      setMessage("Investigation case created successfully.");
    } catch (error: any) {
      setMessage(
        error.response?.data?.message || "Could not create the case."
      );
    } finally {
      setSaving(false);
    }
  };

  // UPDATE CASE STATUS
  const handleStatusChange = async (
    caseId: string,
    newStatus: InvestigationCase["status"]
  ) => {
    setMessage("");
    setUpdatingId(caseId);

    try {
      const response = await api.patch(`/cases/${caseId}/status`, {
        status: newStatus,
      });

      setCases((previous) =>
        previous.map((item) =>
          item._id === caseId ? response.data.case : item
        )
      );

      setMessage(`Case status updated to ${newStatus}.`);
    } catch (error: any) {
      setMessage(
        error.response?.data?.message || "Could not update case status."
      );
    } finally {
      setUpdatingId("");
    }
  };

  return (
    <div className="cases-page">
      <header className="cases-header">
        <div>
          <p className="cases-eyebrow">INVESTIGATION WORKSPACE</p>
          <h1>Investigation Cases</h1>
          <p>Create and manage your forensic investigation records.</p>
        </div>
        <span className="cases-count">{cases.length} Cases</span>
      </header>

      {message && <div className="cases-message">{message}</div>}

      <section className="cases-panel">
        <h2>Create New Case</h2>

        <form onSubmit={handleCreate}>
          <label>
            Case title
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Suspicious Image Investigation"
              maxLength={150}
              required
            />
          </label>

          <label>
            Description
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Describe the investigation..."
              maxLength={3000}
              rows={4}
              required
            />
          </label>

          <label>
            Priority
            <select
              value={priority}
              onChange={(event) =>
                setPriority(event.target.value as InvestigationCase["priority"])
              }
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Critical">Critical</option>
            </select>
          </label>

          <button className="create-case-button" disabled={saving}>
            {saving ? "Creating..." : "+ Create Case"}
          </button>
        </form>
      </section>

      <section className="cases-panel">
        <h2>Saved Investigation Cases</h2>

        {loading ? (
          <p>Loading cases...</p>
        ) : cases.length === 0 ? (
          <p className="empty-cases">
            No cases found. Create your first case above.
          </p>
        ) : (
          <div className="cases-list">
            {cases.map((item) => (
              <article className="case-item" key={item._id}>
                <div className="case-item-top">
                  <span className="case-number">{item.caseNumber}</span>
                  <span className={`priority priority-${item.priority.toLowerCase()}`}>
                    {item.priority}
                  </span>
                </div>

                <h3>{item.title}</h3>
                <p>{item.description}</p>

                <div className="case-item-footer">
                  <div className="case-status-control">
                    <label htmlFor={`status-${item._id}`}>
                      Update Status:
                    </label>

                    <select
                      id={`status-${item._id}`}
                      value={item.status}
                      disabled={updatingId === item._id}
                      onChange={(event) =>
                        handleStatusChange(
                          item._id,
                          event.target.value as InvestigationCase["status"]
                        )
                      }
                    >
                      <option value="Open">Open</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Resolved">Resolved</option>
                    </select>

                    {updatingId === item._id && <span>Updating...</span>}
                  </div>

                  <span>
                    {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default Cases;
