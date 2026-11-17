
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import api from "../api/client";
import "./Evidence.css";

type CaseRecord = {
  _id: string;
  title?: string;
  caseTitle?: string;
  name?: string;
};

type EvidenceRecord = {
  _id: string;
  caseId: string | { _id: string };
  originalName: string;
  mimeType: string;
  size: number;
  sha256: string;
  backupAvailable?: boolean;
  createdAt?: string;
  uploadedAt?: string;
};

type ComparisonResult = {
  success: boolean;
  message: string;
  comparisonFileName: string;
  originalHash: string;
  uploadedHash: string;
  matchesOriginal: boolean;
  matchesBackup: boolean;
};

type VerificationResult = {
  message: string;
  originalHash: string;
  currentHash: string | null;
  isIntact: boolean;
  tampered: boolean;
  originalFileAvailable: boolean;
  backupAvailable: boolean;
  backupHash: string | null;
  backupExpectedHash: string | null;
  backupIntegrity: boolean;
  canDownloadBackup: boolean;
};

function Evidence() {
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [caseId, setCaseId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [records, setRecords] = useState<EvidenceRecord[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [verification, setVerification] =
    useState<VerificationResult | null>(null);

  const [comparison, setComparison] =
    useState<ComparisonResult | null>(null);

  const getAuthHeaders = () => ({
    Authorization: `Bearer ${
      localStorage.getItem("forensics_token") || ""
    }`,
  });

  // LOAD CASES
  useEffect(() => {
    const loadCases = async () => {
      try {
        const response = await api.get("/cases", {
          headers: getAuthHeaders(),
        });

        const data = response.data;

        const list: CaseRecord[] = Array.isArray(data)
          ? data
          : Array.isArray(data.cases)
            ? data.cases
            : Array.isArray(data.data)
              ? data.data
              : [];

        setCases(list);
      } catch (error) {
        console.error("Could not load cases:", error);
        setMessage("Could not load investigation cases.");
      }
    };

    loadCases();
  }, []);

  // LOAD EVIDENCE
  const loadEvidence = async (id = caseId.trim()) => {
    if (!id) {
      setMessage("Select a case or enter a Case ID first.");
      return;
    }

    setLoading(true);
    setMessage("");
    setVerification(null);
    setComparison(null);

    try {
      const response = await api.get(
        `/cases/${id}/evidence`,
        { headers: getAuthHeaders() }
      );

      const data = response.data;

      const list = Array.isArray(data.evidence)
        ? data.evidence
        : Array.isArray(data)
          ? data
          : [];

      setRecords(list);
      setMessage(`Loaded ${list.length} evidence file(s).`);
    } catch (error: any) {
      setRecords([]);
      setMessage(
        error.response?.data?.message ||
          "Unable to load evidence."
      );
    } finally {
      setLoading(false);
    }
  };

  // UPLOAD EVIDENCE
  const uploadEvidence = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!caseId.trim() || !file) {
      setMessage("Select a case and choose a file.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setMessage("File size must not exceed 10 MB.");
      return;
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "application/pdf",
    ];

    if (!allowedTypes.includes(file.type)) {
      setMessage("Only JPG, PNG, and PDF files are allowed.");
      return;
    }

    const formData = new FormData();
    formData.append("evidence", file);

    setLoading(true);
    setMessage("");
    setVerification(null);
    setComparison(null);

    try {
      const response = await api.post(
        `/cases/${caseId.trim()}/evidence`,
        formData,
        {
          headers: getAuthHeaders(),
        }
      );

      setMessage(
        response.data.message ||
          "Evidence uploaded and backup created successfully."
      );

      setFile(null);

      const input = document.getElementById(
        "evidence-file"
      ) as HTMLInputElement | null;

      if (input) input.value = "";

      await loadEvidence(caseId.trim());

    } catch (error: any) {
      setMessage(
        error.response?.data?.message ||
          "Unable to upload evidence."
      );
    } finally {
      setLoading(false);
    }
  };

  // VERIFY ORIGINAL AND BACKUP
  const verifyEvidence = async (evidenceId: string) => {
    if (!caseId.trim()) {
      setMessage("Select a case before verifying evidence.");
      return;
    }

    setLoading(true);
    setMessage("");
    setVerification(null);
    setComparison(null);

    try {
      const response = await api.get(
        `/cases/${caseId.trim()}/evidence/${evidenceId}/verify`,
        { headers: getAuthHeaders() }
      );

      setVerification(response.data);
      setMessage(response.data.message);

    } catch (error: any) {
      setMessage(
        error.response?.data?.message ||
          "Unable to verify evidence integrity."
      );
    } finally {
      setLoading(false);
    }
  };

  // COMPARE EXTERNAL FILE WITH ORIGINAL EVIDENCE
  const compareExternalFile = async (
    evidenceId: string,
    selectedFile: File | null
  ) => {
    if (!selectedFile || !caseId.trim()) {
      setMessage("Select a case and comparison file.");
      return;
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "application/pdf",
    ];

    if (!allowedTypes.includes(selectedFile.type)) {
      setMessage("Only JPG, PNG, and PDF files are allowed.");
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setMessage("File size must not exceed 10 MB.");
      return;
    }

    const formData = new FormData();
    formData.append("comparisonFile", selectedFile);

    setLoading(true);
    setMessage("");
    setComparison(null);
    setVerification(null);

    try {
      const response = await api.post(
        `/cases/${caseId.trim()}/evidence/${evidenceId}/compare`,
        formData,
        {
          headers: getAuthHeaders(),
        }
      );

      setComparison(response.data);
      setMessage(response.data.message);

    } catch (error: any) {
      setMessage(
        error.response?.data?.message ||
          "Unable to compare external file."
      );
    } finally {
      setLoading(false);
    }
  };

  // DOWNLOAD VERIFIED ORIGINAL BACKUP
  const downloadBackup = async (evidenceId: string) => {
    if (!caseId.trim()) {
      setMessage("Select a case first.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await api.get(
        `/cases/${caseId.trim()}/evidence/${evidenceId}/backup`,
        {
          headers: getAuthHeaders(),
          responseType: "blob",
        }
      );

      const blob = new Blob([response.data]);

      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;

      const record = records.find(
        (item) => item._id === evidenceId
      );

      link.download =
        record?.originalName || "evidence-backup";

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(url);

      setMessage("Verified backup downloaded successfully.");

    } catch (error: any) {
      setMessage(
        "Unable to download backup. Please verify its availability."
      );
    } finally {
      setLoading(false);
    }
  };

  // FORMAT FILE SIZE
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getCaseTitle = (item: CaseRecord) =>
    item.title ||
    item.caseTitle ||
    item.name ||
    "Untitled case";

  return (
    <section className="evidence-page">

      {/* PAGE HEADER */}

      <header className="evidence-heading">
        <div>
          <p className="evidence-eyebrow">
            INVESTIGATION WORKSPACE
          </p>

          <h2>Evidence Files</h2>

          <p>
            Upload, review, protect and verify digital evidence.
          </p>
        </div>

        <span className="evidence-count">
          {records.length} Files
        </span>
      </header>

      {/* CASE SELECTION */}

      <div className="evidence-card">
        <h3>Select Investigation Case</h3>

        <label htmlFor="case-select">
          Your cases
        </label>

        <select
          id="case-select"
          value={caseId}
          onChange={(event) => {
            setCaseId(event.target.value);
            setRecords([]);
            setVerification(null);
            setComparison(null);
            setMessage("");
          }}
        >
          <option value="">
            Select an investigation case
          </option>

          {cases.map((item) => (
            <option key={item._id} value={item._id}>
              {getCaseTitle(item)} — {item._id}
            </option>
          ))}
        </select>

        <label htmlFor="case-id">
          Or enter Case ID manually
        </label>

        <input
          id="case-id"
          value={caseId}
          onChange={(event) => {
            setCaseId(event.target.value);
            setRecords([]);
            setVerification(null);
            setComparison(null);
            setMessage("");
          }}
          placeholder="Paste your MongoDB case ID"
        />

        <button
          type="button"
          className="evidence-secondary-button"
          onClick={() => loadEvidence()}
          disabled={loading || !caseId.trim()}
        >
          Load Evidence
        </button>
      </div>

      {/* UPLOAD EVIDENCE */}

      <form
        className="evidence-card"
        onSubmit={uploadEvidence}
      >
        <h3>Upload New Evidence</h3>

        <label htmlFor="evidence-file">
          Choose JPG, PNG, or PDF (maximum 10 MB)
        </label>

        <input
          id="evidence-file"
          type="file"
          accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
          onChange={(event) =>
            setFile(event.target.files?.[0] || null)
          }
          required
        />

        {file && (
          <p className="evidence-muted">
            Selected: {file.name} ({formatSize(file.size)})
          </p>
        )}

        <p className="evidence-muted">
          🛡️ A protected backup will be created automatically.
        </p>

        <button
          type="submit"
          className="evidence-primary-button"
          disabled={loading || !caseId.trim() || !file}
        >
          {loading ? "Please wait..." : "Upload Evidence"}
        </button>
      </form>

      {/* STATUS MESSAGE */}

      {message && (
        <div className="evidence-message" role="status">
          {message}
        </div>
      )}

      {/* ORIGINAL AND BACKUP VERIFICATION RESULT */}

      {verification && (
        <div
          className={`verification-card ${
            verification.isIntact && verification.backupIntegrity
              ? "verified"
              : "mismatch"
          }`}
        >
          <h3>
            {verification.isIntact && verification.backupIntegrity
              ? "Integrity Verified"
              : "Evidence Tampering / Integrity Warning"}
          </h3>

          <p>{verification.message}</p>

          <label>Original SHA-256</label>
          <code>{verification.originalHash}</code>

          <label>Current SHA-256</label>
          <code>
            {verification.currentHash ||
              "Original file missing"}
          </code>

          <label>Backup SHA-256</label>
          <code>
            {verification.backupHash ||
              "Backup unavailable"}
          </code>

          <div className="backup-status">
            <p>
              Original Evidence:{" "}
              {verification.isIntact
                ? "✓ Intact"
                : "✗ Tampered / Missing"}
            </p>

            <p>
              Backup Available:{" "}
              {verification.backupAvailable
                ? "✓ Yes"
                : "✗ No"}
            </p>

            <p>
              Backup Integrity:{" "}
              {verification.backupIntegrity
                ? "✓ Verified"
                : "✗ Failed"}
            </p>
          </div>
        </div>
      )}

      {/* SAVED EVIDENCE */}

      <div className="evidence-card">
        <h3>Saved Evidence</h3>

        {records.length === 0 ? (
          <p className="evidence-muted">
            No evidence loaded. Select a case and click Load Evidence.
          </p>
        ) : (
          <div className="evidence-list">

            {records.map((record) => (
              <article
                className="evidence-item"
                key={record._id}
              >
                <div className="evidence-file-icon">
                  FILE
                </div>

                <div className="evidence-file-info">
                  <h4>{record.originalName}</h4>

                  <p>
                    {record.mimeType} · {formatSize(record.size)}
                  </p>

                  <p>
                    Uploaded:{" "}
                    {record.uploadedAt || record.createdAt
                      ? new Date(
                          record.uploadedAt || record.createdAt!
                        ).toLocaleString()
                      : "Date unavailable"}
                  </p>

                  <span className="evidence-hash">
                    SHA-256: {record.sha256}
                  </span>

                  <div className="backup-status">
                    {record.backupAvailable ? (
                      <span className="backup-available">
                        ✓ Protected Backup Available
                      </span>
                    ) : (
                      <span className="backup-missing">
                        ⚠ No Backup Available
                      </span>
                    )}
                  </div>
                </div>

                {/* EVIDENCE ACTIONS */}

                <div className="evidence-actions">

                  <button
                    type="button"
                    className="evidence-verify-button"
                    onClick={() => verifyEvidence(record._id)}
                    disabled={loading}
                  >
                    Verify Integrity
                  </button>

                  {/* NEW: EXTERNAL FILE COMPARISON */}

                  <label
                    className="evidence-compare-button"
                    title="Select another file to compare its SHA-256 hash"
                  >
                    Verify External File

                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                      hidden
                      disabled={loading}
                      onChange={(event) => {
                        const selectedFile =
                          event.target.files?.[0] || null;

                        if (selectedFile) {
                          compareExternalFile(
                            record._id,
                            selectedFile
                          );
                        }

                        event.target.value = "";
                      }}
                    />
                  </label>

                  {record.backupAvailable && (
                    <button
                      type="button"
                      className="evidence-backup-button"
                      onClick={() =>
                        downloadBackup(record._id)
                      }
                      disabled={loading}
                    >
                      Download Backup
                    </button>
                  )}

                </div>
              </article>
            ))}

          </div>
        )}

        {/* EXTERNAL FILE COMPARISON RESULT */}

        {comparison && (
          <div
            className={`verification-card ${
              comparison.matchesOriginal
                ? "verified"
                : "mismatch"
            }`}
          >
            <h3>
              {comparison.matchesOriginal
                ? "External File Matched"
                : "Hash Mismatch Detected"}
            </h3>

            <p>{comparison.message}</p>

            <p>
              <strong>Selected File:</strong>{" "}
              {comparison.comparisonFileName}
            </p>

            <label>Original SHA-256</label>
            <code>{comparison.originalHash}</code>

            <label>Selected File SHA-256</label>
            <code>{comparison.uploadedHash}</code>

            <div className="backup-status">
              <p>
                Original Hash Match:{" "}
                {comparison.matchesOriginal
                  ? "✓ Yes"
                  : "✗ No"}
              </p>

              <p>
                Backup Hash Match:{" "}
                {comparison.matchesBackup
                  ? "✓ Yes"
                  : "✗ No"}
              </p>
            </div>

            <p className="evidence-muted">
              Comparison completed using SHA-256.
              A mismatch means the selected file differs
              from the recorded original.
            </p>
          </div>
        )}

      </div>

    </section>
  );
}

export default Evidence;
