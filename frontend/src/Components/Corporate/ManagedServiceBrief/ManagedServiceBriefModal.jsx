"use client";

import { useRef, useState } from "react";
import api from "../../../utils/api";
import { downloadBriefTemplate } from "./briefExcel";
import "./ManagedServiceBrief.css";
import "./ManagedServiceBriefModal.css";

/**
 * ManagedServiceBriefModal
 * ------------------------
 * Captured at "Request Quotation" time for MANAGED-service requests.
 *
 * Every customer prepares its transportation requirement in a different way, so
 * the portal does NOT enforce a fixed template. Instead of forcing the customer
 * to type work locations, shifts, routes and employee rows inline, we ask only
 * for the essentials and let the real detail live inside the uploaded
 * document(s):
 *
 *   - One or more requirement documents (Excel, PDF, Word, CSV, image, ...).
 *     The uploaded file stays attached to the request for future reference.
 *     Revised versions can be uploaded and are tracked with a version number.
 *   - Basic request details (a short summary + point of contact).
 *   - The desired service start date.
 *   - Free-form comments / special requirements.
 *
 * Documents are uploaded to Cloudinary immediately (before the quotation
 * exists) via /managed-service-brief/upload-documents, which returns descriptors
 * that travel back in the brief payload and are persisted on submit.
 *
 * Typical information contained in the uploaded documents may include: pickup &
 * drop-off locations, number of routes / trips, trip timings, passenger count
 * per trip, vehicle requirements, working days, shift timings and special
 * instructions. An optional Excel template (Routes + Employees) is offered as a
 * convenience for customers who don't already have their own format.
 */

const humanFileSize = (bytes) => {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

const ManagedServiceBriefModal = ({
  fleetOwnerName = "the partner",
  audience = "corporate",
  defaultServiceStartDate = "",
  submitting = false,
  onSubmit,
  onClose,
}) => {
  const [summary, setSummary] = useState("");
  const [comments, setComments] = useState("");
  const [serviceStartDate, setServiceStartDate] = useState(
    defaultServiceStartDate || "",
  );
  const [pointOfContact, setPointOfContact] = useState({
    name: "",
    phone: "",
    email: "",
  });
  const [documents, setDocuments] = useState([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [uploading, setUploading] = useState(false);
  const addFileRef = useRef(null);
  // Per-document "upload a revised version" hidden input is keyed by index.
  const reviseFileRef = useRef(null);
  const [revisingIndex, setRevisingIndex] = useState(null);

  const busy = submitting || uploading;

  /* ---------------------- Cloudinary document upload ---------------------- */
  const uploadFiles = async (files) => {
    const formData = new FormData();
    for (const file of files) formData.append("documents", file);
    const res = await api.post(
      "/managed-service-brief/upload-documents",
      formData,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    if (!res.data?.success) {
      throw new Error(res.data?.message || "Upload failed.");
    }
    return res.data.data.documents || [];
  };

  // Add one or more brand-new documents (each starts at version 1).
  const handleAddDocuments = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;
    try {
      setError("");
      setNotice("");
      setUploading(true);
      const uploaded = await uploadFiles(files);
      setDocuments((prev) => [...prev, ...uploaded]);
      setNotice(
        `${uploaded.length} document(s) attached. They will stay attached to this request for future reference.`,
      );
    } catch (err) {
      console.log("[v0] Brief document upload error:", err?.message);
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Could not upload the document. Allowed: Excel, CSV, Word, PDF, images (max 15MB each).",
      );
    } finally {
      setUploading(false);
    }
  };

  // Replace an existing document with a revised version (bumps the version).
  const handleReviseDocument = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    const index = revisingIndex;
    setRevisingIndex(null);
    if (!file || index == null) return;
    try {
      setError("");
      setNotice("");
      setUploading(true);
      const [uploaded] = await uploadFiles([file]);
      if (!uploaded) return;
      setDocuments((prev) => {
        const next = [...prev];
        const prevVersion = Number(next[index]?.version) || 1;
        next[index] = { ...uploaded, version: prevVersion + 1 };
        return next;
      });
      setNotice("Revised version uploaded. The previous version was replaced.");
    } catch (err) {
      console.log("[v0] Brief revision upload error:", err?.message);
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Could not upload the revised version.",
      );
    } finally {
      setUploading(false);
    }
  };

  const removeDocument = (index) =>
    setDocuments((prev) => prev.filter((_, i) => i !== index));

  const openRevisePicker = (index) => {
    setRevisingIndex(index);
    reviseFileRef.current?.click();
  };

  const handleDownloadTemplate = async () => {
    try {
      setError("");
      await downloadBriefTemplate({ audience });
    } catch (err) {
      console.log("[v0] Brief template download error:", err?.message);
      setError("Could not generate the Excel template. Please try again.");
    }
  };

  /* -------------------------------- submit --------------------------------- */
  const handleSubmit = () => {
    setError("");

    if (documents.length === 0 && !summary.trim()) {
      setError(
        "Attach at least one requirement document (Excel, PDF, Word, CSV, image) or enter a short summary so the partner knows what you need.",
      );
      return;
    }

    onSubmit({
      summary: summary.trim(),
      comments: comments.trim(),
      serviceStartDate: serviceStartDate || null,
      pointOfContact,
      documents,
    });
  };

  return (
    <div
      className="msb-modal-overlay"
      onClick={submitting ? undefined : onClose}
    >
      <div className="msb-modal" onClick={(e) => e.stopPropagation()}>
        <div className="msb-modal-header">
          <div>
            <h2>Send Requirement to {fleetOwnerName}</h2>
            <p className="msb-subtitle" style={{ margin: "6px 0 0" }}>
              Upload your transportation requirement in whatever format you
              already have &mdash; there is <strong>no fixed template</strong>.
              Add a few basic details and any special comments, and the partner
              will review it before quoting.
            </p>
          </div>
          <button
            className="msb-modal-close"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="msb-modal-body">
          {error && <p className="msb-error">{error}</p>}
          {notice && <p className="msb-import-notice">{notice}</p>}

          {/* Requirement documents (primary input) */}
          <div className="msb-section">
            <div className="msb-section-head">
              <h3>Requirement Document(s)</h3>
              <button
                type="button"
                className="msb-btn primary small"
                onClick={() => addFileRef.current?.click()}
                disabled={busy}
              >
                {uploading ? "Uploading…" : "+ Upload document"}
              </button>
            </div>
            <p className="msb-section-hint">
              Upload one or more files (Excel, PDF, Word, CSV, images). These may
              contain pickup &amp; drop-off locations, number of routes/trips,
              trip timings, passenger counts, vehicle requirements, working days,
              shift timings and special instructions. Uploaded files stay
              attached to this request for future reference.
            </p>
            <input
              ref={addFileRef}
              type="file"
              multiple
              accept=".xlsx,.xls,.csv,.pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif,.webp"
              style={{ display: "none" }}
              onChange={handleAddDocuments}
            />
            <input
              ref={reviseFileRef}
              type="file"
              accept=".xlsx,.xls,.csv,.pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif,.webp"
              style={{ display: "none" }}
              onChange={handleReviseDocument}
            />

            {documents.length === 0 ? (
              <p className="msb-empty">No documents attached yet.</p>
            ) : (
              <ul className="msb-doc-list">
                {documents.map((doc, i) => (
                  <li className="msb-doc-row" key={`${doc.publicId || doc.url}-${i}`}>
                    <div className="msb-doc-info">
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="msb-doc-name"
                      >
                        {doc.fileName || "Document"}
                      </a>
                      <span className="msb-doc-meta">
                        {humanFileSize(doc.fileSize)}
                        {doc.version > 1 ? ` · v${doc.version}` : ""}
                      </span>
                    </div>
                    <div className="msb-doc-actions">
                      <button
                        type="button"
                        className="msb-btn secondary small"
                        onClick={() => openRevisePicker(i)}
                        disabled={busy}
                      >
                        Upload new version
                      </button>
                      <button
                        type="button"
                        className="msb-btn danger small"
                        onClick={() => removeDocument(i)}
                        disabled={busy}
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="msb-import-bar" style={{ marginTop: 14 }}>
              <div className="msb-import-bar-text">
                <strong>Don&apos;t have a document ready?</strong>
                <span>
                  Download our optional school transport Excel template (Routes &amp; Students),
                  fill it in offline, and upload it above.
                </span>
              </div>
              <div className="msb-import-bar-actions">
                <button
                  type="button"
                  className="msb-btn secondary small"
                  onClick={handleDownloadTemplate}
                  disabled={busy}
                >
                  Download Excel template
                </button>
              </div>
            </div>
          </div>

          {/* Basic request details */}
          <div className="msb-section">
            <div className="msb-section-head">
              <h3>Basic Details</h3>
            </div>
            <div className="msb-field">
              <label>Summary / objectives</label>
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="e.g. Daily home-to-office pickup & drop for 40 employees across 3 shifts."
              />
            </div>
            <div className="msb-grid">
              <div className="msb-field">
                <label>Desired service start date</label>
                <input
                  type="date"
                  value={serviceStartDate}
                  onChange={(e) => setServiceStartDate(e.target.value)}
                />
              </div>
              <div className="msb-field">
                <label>Contact name</label>
                <input
                  value={pointOfContact.name}
                  onChange={(e) =>
                    setPointOfContact({
                      ...pointOfContact,
                      name: e.target.value,
                    })
                  }
                />
              </div>
              <div className="msb-field">
                <label>Contact phone</label>
                <input
                  value={pointOfContact.phone}
                  onChange={(e) =>
                    setPointOfContact({
                      ...pointOfContact,
                      phone: e.target.value,
                    })
                  }
                />
              </div>
              <div className="msb-field">
                <label>Contact email</label>
                <input
                  value={pointOfContact.email}
                  onChange={(e) =>
                    setPointOfContact({
                      ...pointOfContact,
                      email: e.target.value,
                    })
                  }
                />
              </div>
            </div>
          </div>

          {/* Comments / special requirements */}
          <div className="msb-section">
            <div className="msb-section-head">
              <h3>Comments &amp; Special Requirements</h3>
            </div>
            <div className="msb-field">
              <label>Anything else the partner should know?</label>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="e.g. Female drivers preferred on the night shift, wheelchair access required, security passes needed for the site."
              />
            </div>
          </div>
        </div>

        <div className="msb-modal-footer">
          <button
            type="button"
            className="msb-btn secondary"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="msb-btn primary"
            onClick={handleSubmit}
            disabled={busy}
          >
            {submitting ? "Sending…" : "Send request with requirement"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManagedServiceBriefModal;
