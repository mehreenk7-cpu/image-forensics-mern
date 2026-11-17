
import { useEffect, useRef, useState } from "react";
import api from "../api/client";
import "./ImageAnalysis.css";

type CaseRecord = {
  _id: string;
  title?: string;
  caseTitle?: string;
  name?: string;
};

type ImageDetails = {
  name: string;
  type: string;
  size: string;
  width: number;
  height: number;
  sha256: string;
  lastModified: string;
};

type AdvancedAnalysis = {
  success: boolean;
  originalName: string;
  sha256: string;
  isIntact: boolean;
  analysedAt: string;
  analysis: {
    metadata: {
      format: string;
      width: number;
      height: number;
      colorSpace: string;
      channels: number;
      hasAlpha: boolean;
      orientation: number | null;
    };
    elaAvailable: boolean;
    elaImage: string | null;
    elaMessage: string;
  };
};

export default function ImageAnalysis() {
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [caseId, setCaseId] = useState("");

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [details, setDetails] = useState<ImageDetails | null>(null);

  const [advancedAnalysis, setAdvancedAnalysis] =
    useState<AdvancedAnalysis | null>(null);

  const [savedEvidenceId, setSavedEvidenceId] = useState("");

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [analysing, setAnalysing] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef("");

  const getAuthHeaders = () => ({
    Authorization: `Bearer ${
      localStorage.getItem("forensics_token") || ""
    }`,
  });

  // LOAD INVESTIGATION CASES
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
      } catch (err: any) {
        console.error(err.response?.data || err.message);
        setError("Could not load investigation cases.");
      }
    };

    loadCases();
  }, []);

  // RELEASE IMAGE PREVIEW
  const releasePreview = () => {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
      previewRef.current = "";
    }
  };

  // HANDLE IMAGE UPLOAD
  const handleFile = async (file?: File) => {
    setError("");
    setMessage("");
    setDetails(null);
    setAdvancedAnalysis(null);
    setSavedEvidenceId("");
    setSelectedFile(null);

    releasePreview();
    setPreview("");

    if (!file) return;

    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setError("Please select a JPG or PNG image.");

      if (inputRef.current) {
        inputRef.current.value = "";
      }

      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("Image size must be 10 MB or less.");

      if (inputRef.current) {
        inputRef.current.value = "";
      }

      return;
    }

    setLoading(true);

    const objectUrl = URL.createObjectURL(file);
    previewRef.current = objectUrl;

    try {
      const image = new Image();

      const dimensions = await new Promise<{
        width: number;
        height: number;
      }>((resolve, reject) => {
        image.onload = () =>
          resolve({
            width: image.naturalWidth,
            height: image.naturalHeight,
          });

        image.onerror = () =>
          reject(new Error("Could not open this image."));

        image.src = objectUrl;
      });

      if (!crypto.subtle) {
        throw new Error("SHA-256 requires localhost or HTTPS.");
      }

      const buffer = await file.arrayBuffer();
      const digest = await crypto.subtle.digest("SHA-256", buffer);

      const hash = Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");

      setSelectedFile(file);
      setPreview(objectUrl);

      setDetails({
        name: file.name,
        type: file.type,
        size:
          file.size >= 1024 * 1024
            ? `${(file.size / (1024 * 1024)).toFixed(2)} MB`
            : `${(file.size / 1024).toFixed(2)} KB`,
        width: dimensions.width,
        height: dimensions.height,
        sha256: hash,
        lastModified: new Date(file.lastModified).toLocaleString(),
      });

      setMessage("Image information extracted successfully.");
    } catch (err: any) {
      releasePreview();
      setPreview("");
      setError(err.message || "Image analysis failed.");
    } finally {
      setLoading(false);
    }
  };

  // ADVANCED BACKEND ANALYSIS
  const runAdvancedAnalysis = async (evidenceId: string) => {
    if (!caseId || !evidenceId) return;

    try {
      setAnalysing(true);
      setError("");

      const response = await api.get(
        `/cases/${caseId}/evidence/${evidenceId}/analyze`,
        {
          headers: getAuthHeaders(),
        }
      );

      setAdvancedAnalysis(response.data);

      setMessage(
        "Advanced image forensic analysis completed successfully."
      );
    } catch (err: any) {
      console.error(
        "Advanced analysis error:",
        err.response?.data || err.message
      );

      setError(
        err.response?.data?.message ||
          "Advanced image analysis failed."
      );
    } finally {
      setAnalysing(false);
    }
  };

  // SAVE EVIDENCE AND RUN ANALYSIS
  const saveAsEvidence = async () => {
    if (!caseId) {
      setError("Please select an investigation case.");
      return;
    }

    if (!selectedFile || !details) {
      setError("Please select an image first.");
      return;
    }

    const token = localStorage.getItem("forensics_token");

    if (!token) {
      setError("Please log in again.");
      return;
    }

    const formData = new FormData();
    formData.append("evidence", selectedFile);

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const response = await api.post(
        `/cases/${caseId}/evidence`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const evidenceId =
        response.data?.evidence?.id ||
        response.data?.evidence?._id;

      if (!evidenceId) {
        setMessage(
          "Evidence saved, but the evidence ID was not returned."
        );
        return;
      }

      setSavedEvidenceId(evidenceId);

      setMessage(
        "Evidence uploaded successfully. Starting advanced analysis..."
      );

      await runAdvancedAnalysis(evidenceId);
    } catch (err: any) {
      console.error(err.response?.data || err.message);

      setError(
        err.response?.data?.message ||
          "Could not save image as evidence."
      );
    } finally {
      setSaving(false);
    }
  };

  // CLEAR IMAGE
  const clearImage = () => {
    releasePreview();

    setPreview("");
    setSelectedFile(null);
    setDetails(null);
    setAdvancedAnalysis(null);
    setSavedEvidenceId("");
    setError("");
    setMessage("");

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  // COPY HASH
  const copyHash = async () => {
    if (!details) return;

    try {
      await navigator.clipboard.writeText(details.sha256);
      setMessage("SHA-256 hash copied.");
    } catch {
      setError("Could not copy hash.");
    }
  };

  const getCaseTitle = (item: CaseRecord) =>
    item.title || item.caseTitle || item.name || "Untitled case";

  return (
    <div className="page-container advanced-image-page">

      {/* PAGE HEADER */}
      <div className="page-heading">
        <span className="eyebrow">FORENSIC WORKSPACE</span>

        <h2>Advanced Image Forensics</h2>

        <p>
          Analyse image properties, verify integrity and inspect
          possible image manipulation using ELA.
        </p>
      </div>

      {/* CASE AND IMAGE UPLOAD */}
      <section className="card">
        <h3>Select Investigation Case</h3>

        <select
          value={caseId}
          onChange={(event) => {
            setCaseId(event.target.value);
            setError("");
            setMessage("");
            setAdvancedAnalysis(null);
            setSavedEvidenceId("");
          }}
        >
          <option value="">Select a case</option>

          {cases.map((item) => (
            <option key={item._id} value={item._id}>
              {getCaseTitle(item)}
            </option>
          ))}
        </select>

        {cases.length === 0 && (
          <p className="analysis-note">
            No investigation cases available.
          </p>
        )}

        <h3>Choose Image</h3>

        <input
          ref={inputRef}
          type="file"
          accept=".jpg,.jpeg,.png,image/jpeg,image/png"
          onChange={(event) =>
            handleFile(event.target.files?.[0])
          }
        />

        <p>Supported formats: JPG and PNG. Maximum size: 10 MB.</p>

        {loading && <p>Reading image information...</p>}

        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}

        {message && (
          <p className="analysis-note" role="status">
            {message}
          </p>
        )}

        {/* IMAGE PREVIEW */}
        {preview && (
          <div className="image-preview">
            <h3>Original Image</h3>
            <img src={preview} alt="Original image preview" />
          </div>
        )}

        {/* BASIC IMAGE DETAILS */}
        {details && (
          <div className="image-results">
            <h3>Basic Image Details</h3>

            <div className="metadata-grid">
              <div className="metadata-box">
                <span>File Name</span>
                <strong>{details.name}</strong>
              </div>

              <div className="metadata-box">
                <span>File Format</span>
                <strong>{details.type}</strong>
              </div>

              <div className="metadata-box">
                <span>File Size</span>
                <strong>{details.size}</strong>
              </div>

              <div className="metadata-box">
                <span>Image Dimensions</span>
                <strong>
                  {details.width} × {details.height} px
                </strong>
              </div>

              <div className="metadata-box">
                <span>Last Modified (File System)</span>
                <strong>{details.lastModified}</strong>
              </div>
            </div>

            <h3>SHA-256 Hash</h3>

            <code className="hash-value">
              {details.sha256}
            </code>

            <div className="analysis-buttons">
              <button
                type="button"
                className="primary-button"
                onClick={copyHash}
              >
                Copy Hash
              </button>

              <button
                type="button"
                className="primary-button"
                onClick={saveAsEvidence}
              >
                {saving
                  ? "Saving..."
                  : "Save & Run Forensic Analysis"}
              </button>

              <button
                type="button"
                className="secondary-button"
                onClick={clearImage}
              >
                Clear Image
              </button>
            </div>
          </div>
        )}
      </section>

      {/* BACKEND ANALYSIS LOADING */}
      {analysing && (
        <section className="card">
          <h3>Advanced Forensic Analysis</h3>
          <p>Generating Error Level Analysis (ELA)...</p>
        </section>
      )}

      {/* BACKEND FORENSIC RESULTS */}
      {advancedAnalysis && (
        <section className="card advanced-results">
          <h2>Advanced Forensic Results</h2>

          <div className="integrity-result">
            <strong>Evidence Integrity:</strong>

            <span
              className={
                advancedAnalysis.isIntact
                  ? "integrity-safe"
                  : "integrity-warning"
              }
            >
              {advancedAnalysis.isIntact
                ? "SHA-256 Verified"
                : "Integrity Warning"}
            </span>
          </div>

          <h3>Image Properties</h3>

          <div className="metadata-grid">
            <div className="metadata-box">
              <span>Format</span>
              <strong>
                {advancedAnalysis.analysis.metadata.format}
              </strong>
            </div>

            <div className="metadata-box">
              <span>Width</span>
              <strong>
                {advancedAnalysis.analysis.metadata.width}px
              </strong>
            </div>

            <div className="metadata-box">
              <span>Height</span>
              <strong>
                {advancedAnalysis.analysis.metadata.height}px
              </strong>
            </div>

            <div className="metadata-box">
              <span>Color Space</span>
              <strong>
                {advancedAnalysis.analysis.metadata.colorSpace}
              </strong>
            </div>

            <div className="metadata-box">
              <span>Channels</span>
              <strong>
                {advancedAnalysis.analysis.metadata.channels}
              </strong>
            </div>

            <div className="metadata-box">
              <span>Alpha Channel</span>
              <strong>
                {advancedAnalysis.analysis.metadata.hasAlpha
                  ? "Yes"
                  : "No"}
              </strong>
            </div>

            <div className="metadata-box">
              <span>Orientation</span>
              <strong>
                {advancedAnalysis.analysis.metadata.orientation ??
                  "Not available"}
              </strong>
            </div>
          </div>

          {/* ERROR LEVEL ANALYSIS */}
          <h3>Error Level Analysis (ELA)</h3>

          {advancedAnalysis.analysis.elaAvailable &&
          advancedAnalysis.analysis.elaImage ? (
            <div className="ela-result">
              <img
                src={`data:image/jpeg;base64,${advancedAnalysis.analysis.elaImage}`}
                alt="Error Level Analysis result"
              />

              <p>
                Brighter differences may indicate areas requiring
                further investigation.
              </p>
            </div>
          ) : (
            <p className="analysis-note">
              {advancedAnalysis.analysis.elaMessage}
            </p>
          )}

          <p className="analysis-note">
            ELA is an investigative aid. Differences can also result
            from normal compression, image processing and editing.
            It does not independently prove image tampering.
          </p>

          <p>
            <strong>Analysed at:</strong>{" "}
            {new Date(advancedAnalysis.analysedAt).toLocaleString()}
          </p>

          {savedEvidenceId && (
            <button
              type="button"
              className="primary-button"
              onClick={() => runAdvancedAnalysis(savedEvidenceId)}
              disabled={analysing}
            >
              {analysing ? "Analysing..." : "Run Analysis Again"}
            </button>
          )}
        </section>
      )}
    </div>
  );
}
