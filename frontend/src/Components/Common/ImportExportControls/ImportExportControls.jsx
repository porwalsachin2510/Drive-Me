"use client";

import { useRef, useState } from "react";
import {
  Download,
  Upload,
  FileSpreadsheet,
  X,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";
import importExportService from "../../../services/importExportService";
import "./importexportcontrols.css";

/**
 * Reusable Import / Export toolbar shared by every bulk-data module
 * (drivers, vehicles, routes, passengers/employees).
 *
 * Props:
 *   - entity        (string, required) backend registry key, e.g. "b2c-drivers"
 *   - entityLabel   (string) human label used in copy, e.g. "Drivers"
 *   - onImported    (fn) called after a successful import so the parent can refresh
 *   - exportParams  (object) optional query params forwarded to the export endpoint
 *   - disabled      (bool) disable the whole toolbar
 */
function ImportExportControls({
  entity,
  entityLabel = "Records",
  onImported,
  exportParams = {},
  disabled = false,
}) {
  const fileInputRef = useRef(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [report, setReport] = useState(null);

  const resetModalState = () => {
    setSelectedFile(null);
    setReport(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const openModal = () => {
    resetModalState();
    setShowModal(true);
  };

  const closeModal = () => {
    if (importing) return;
    setShowModal(false);
    resetModalState();
  };

  const handleDownloadTemplate = async () => {
    try {
      setDownloadingTemplate(true);
      await importExportService.downloadTemplate(entity);
      toast.success("Template downloaded. Fill it in and upload it back.");
    } catch (error) {
      console.error("[v0] template download failed:", error);
      toast.error(
        error.response?.data?.message || "Could not download the template.",
      );
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      await importExportService.exportRecords(entity, exportParams);
      toast.success(`${entityLabel} exported successfully.`);
    } catch (error) {
      console.error("[v0] export failed:", error);
      // Blob error responses need to be read as text to surface the message.
      let message = `Could not export ${entityLabel.toLowerCase()}.`;
      if (error.response?.data instanceof Blob) {
        try {
          const text = await error.response.data.text();
          message = JSON.parse(text).message || message;
        } catch (_) {
          /* keep default */
        }
      } else if (error.response?.data?.message) {
        message = error.response.data.message;
      }
      toast.error(message);
    } finally {
      setExporting(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    setReport(null);
    if (!file) {
      setSelectedFile(null);
      return;
    }
    const name = file.name.toLowerCase();
    if (
      !name.endsWith(".xlsx") &&
      !name.endsWith(".xls") &&
      !name.endsWith(".csv")
    ) {
      toast.error("Please select a .xlsx or .csv file.");
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setSelectedFile(file);
  };

  const handleImport = async () => {
    if (!selectedFile) {
      toast.error("Please choose a file first.");
      return;
    }
    try {
      setImporting(true);
      setReport(null);
      const result = await importExportService.importRecords(
        entity,
        selectedFile,
      );
      setReport(result.report);

      const imported = result.report?.imported || 0;
      if (imported > 0) {
        toast.success(
          result.message ||
            `${imported} ${entityLabel.toLowerCase()} imported.`,
        );
        if (typeof onImported === "function") onImported();
      } else {
        toast.error(
          "No records were imported. Please review the errors below.",
        );
      }
    } catch (error) {
      console.error("[v0] import failed:", error);
      toast.error(
        error.response?.data?.message ||
          "Import failed. Please check your file and try again.",
      );
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="ie-controls">
      <button
        type="button"
        className="ie-btn ie-btn-secondary"
        onClick={handleExport}
        disabled={disabled || exporting}
      >
        {exporting ? (
          <Loader2 size={16} className="ie-spin" />
        ) : (
          <Download size={16} />
        )}
        <span>Export</span>
      </button>
      <button
        type="button"
        className="ie-btn ie-btn-primary"
        onClick={openModal}
        disabled={disabled}
      >
        <Upload size={16} />
        <span>Import</span>
      </button>

      {showModal && (
        <div
          className="ie-modal-overlay"
          onClick={closeModal}
          role="presentation"
        >
          <div
            className="ie-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ie-modal-title"
          >
            <div className="ie-modal-header">
              <h3 id="ie-modal-title">Import {entityLabel}</h3>
              <button
                type="button"
                className="ie-close-btn"
                onClick={closeModal}
                disabled={importing}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="ie-modal-body">
              {/* Step 1: template */}
              <div className="ie-step">
                <div className="ie-step-num">1</div>
                <div className="ie-step-content">
                  <h4>Download the template</h4>
                  <p>
                    Use our formatted template so your data lines up with the
                    required columns. The file includes an example row and an
                    &quot;Instructions&quot; sheet that explains every field.
                  </p>
                  <button
                    type="button"
                    className="ie-btn ie-btn-outline"
                    onClick={handleDownloadTemplate}
                    disabled={downloadingTemplate}
                  >
                    {downloadingTemplate ? (
                      <Loader2 size={16} className="ie-spin" />
                    ) : (
                      <FileSpreadsheet size={16} />
                    )}
                    <span>Download {entityLabel} template</span>
                  </button>
                </div>
              </div>

              {/* Step 2: upload */}
              <div className="ie-step">
                <div className="ie-step-num">2</div>
                <div className="ie-step-content">
                  <h4>Upload your filled file</h4>
                  <p>
                    Accepted formats: .xlsx or .csv. Keep the header row exactly
                    as in the template.
                  </p>

                  <label className="ie-dropzone">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileChange}
                      disabled={importing}
                    />
                    <FileSpreadsheet size={22} />
                    <span className="ie-dropzone-text">
                      {selectedFile
                        ? selectedFile.name
                        : "Click to choose a file"}
                    </span>
                  </label>

                  <button
                    type="button"
                    className="ie-btn ie-btn-primary ie-import-submit"
                    onClick={handleImport}
                    disabled={!selectedFile || importing}
                  >
                    {importing ? (
                      <Loader2 size={16} className="ie-spin" />
                    ) : (
                      <Upload size={16} />
                    )}
                    <span>{importing ? "Importing..." : "Start Import"}</span>
                  </button>
                </div>
              </div>

              {/* Result report */}
              {report && (
                <div className="ie-report">
                  <div className="ie-report-summary">
                    <div className="ie-summary-chip ie-chip-success">
                      <CheckCircle2 size={16} />
                      <span>{report.imported} imported</span>
                    </div>
                    {report.skipped > 0 && (
                      <div className="ie-summary-chip ie-chip-warn">
                        <AlertTriangle size={16} />
                        <span>{report.skipped} skipped</span>
                      </div>
                    )}
                    {report.failed > 0 && (
                      <div className="ie-summary-chip ie-chip-error">
                        <AlertTriangle size={16} />
                        <span>{report.failed} failed</span>
                      </div>
                    )}
                    <div className="ie-summary-chip ie-chip-total">
                      <span>{report.total} total rows</span>
                    </div>
                  </div>

                  {report.errors && report.errors.length > 0 && (
                    <div className="ie-error-list">
                      <h5>Rows that need attention</h5>
                      <p className="ie-error-help">
                        Fix these rows in your file and upload again.
                        Successfully imported rows will be skipped automatically
                        as duplicates.
                      </p>
                      <ul>
                        {report.errors.map((err, idx) => (
                          <li
                            key={idx}
                            className={`ie-error-item ie-level-${err.level}`}
                          >
                            <span className="ie-row-badge">Row {err.row}</span>
                            <span className="ie-row-msgs">
                              {err.messages.join(" ")}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ImportExportControls;
