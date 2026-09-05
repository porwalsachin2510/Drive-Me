"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { X, Loader2, Upload, FileSpreadsheet, RefreshCw } from "lucide-react";
import {
  fetchImportCandidates,
  fetchImportableContracts,
  importEmployees,
} from "../../../services/briefImportService";
import { isSchoolRole } from "../../../utils/roleFamilies";
import { notify } from "../../../utils/toast";
import "./briefimport.css";

/**
 * Import people (employees / students) straight out of a managed-service brief.
 *
 * Same reasoning as the route importer: the customer hands over a document with
 * the whole roster, so nobody should retype it row by row. Candidates are merged
 * from the structured brief roster AND the attached requirement document, and
 * rows sourced from the brief auto-fulfil their roster item on creation.
 *
 * The Employee Management screen is company-wide and has no contract of its own,
 * so when `contractId` is not supplied the user first picks which managed
 * contract to import from. Works for customers (own contracts) and partners
 * (contracts they operate).
 *
 * Props:
 *   contractId  (string) optional — skips the contract picker when known
 *   onClose     (fn)
 *   onImported  (fn) called after at least one person was created
 */
export default function BriefEmployeeImportModal({
  contractId: fixedContractId = null,
  onClose,
  onImported,
}) {
  const role = useSelector((state) => state.auth.user?.role);
  const school = isSchoolRole(role);
  const peopleNoun = school ? "students" : "employees";
  const PeopleNoun = school ? "Students" : "Employees";

  const [contracts, setContracts] = useState([]);
  const [contractsLoading, setContractsLoading] = useState(!fixedContractId);
  const [contractId, setContractId] = useState(fixedContractId || "");

  const [loading, setLoading] = useState(Boolean(fixedContractId));
  const [importing, setImporting] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [counts, setCounts] = useState(null);
  const [selected, setSelected] = useState({});
  const [failedRows, setFailedRows] = useState([]);

  // Contract picker (only when the host screen has no contract of its own).
  useEffect(() => {
    if (fixedContractId) return;
    let cancelled = false;
    (async () => {
      try {
        setContractsLoading(true);
        const list = await fetchImportableContracts();
        if (cancelled) return;
        setContracts(list);
        // Nothing to choose from with a single managed contract.
        if (list.length === 1) setContractId(list[0].contractId);
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error.response?.data?.message ||
              "Could not list the contracts you can import a brief from.",
          );
        }
      } finally {
        if (!cancelled) setContractsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fixedContractId]);

  const load = useCallback(async () => {
    if (!contractId) return;
    try {
      setLoading(true);
      setLoadError(null);
      setFailedRows([]);
      const data = await fetchImportCandidates(contractId);
      const rows = data?.employees || [];
      setCandidates(rows);
      setWarnings(data?.warnings || []);
      setCounts(data?.counts || null);

      const initial = {};
      rows.forEach((row) => {
        // A login is created per person, so a row without an email can't be
        // imported. Those rows (and rows that already exist) start deselected.
        initial[row.sourceKey] = Boolean(row.email) && !row.alreadyExists;
      });
      setSelected(initial);
    } catch (error) {
      setLoadError(
        error.response?.data?.message ||
          `Could not read the brief's importable ${peopleNoun}.`,
      );
    } finally {
      setLoading(false);
    }
  }, [contractId, peopleNoun]);

  useEffect(() => {
    load();
  }, [load]);

  const importableKeys = useMemo(
    () => candidates.filter((row) => row.email).map((row) => row.sourceKey),
    [candidates],
  );

  const selectedKeys = useMemo(
    () => Object.keys(selected).filter((key) => selected[key]),
    [selected],
  );

  const toggleRow = (sourceKey) => {
    setSelected((prev) => ({ ...prev, [sourceKey]: !prev[sourceKey] }));
  };

  const selectAll = (onlyNew) => {
    setSelected(() => {
      const next = {};
      candidates.forEach((row) => {
        next[row.sourceKey] =
          Boolean(row.email) && (onlyNew ? !row.alreadyExists : true);
      });
      return next;
    });
  };

  const clearAll = () => setSelected({});

  const handleImport = async () => {
    if (selectedKeys.length === 0) {
      notify(`Select at least one person to import.`);
      return;
    }

    const byKey = new Map(candidates.map((row) => [row.sourceKey, row]));
    const rows = selectedKeys.map((key) => byKey.get(key)).filter(Boolean);

    try {
      setImporting(true);
      setFailedRows([]);
      const res = await importEmployees({
        candidates: rows,
        briefContractId: contractId,
      });
      const summary = res?.data?.summary || {};
      const results = res?.data?.results || {};

      if (summary.successful > 0) {
        notify(
          `Imported ${summary.successful} ${peopleNoun}${
            summary.duplicates ? `, ${summary.duplicates} already existed` : ""
          }${summary.errors ? `, ${summary.errors} failed` : ""}. Assign routes and send invitations when you are ready.`,
        );
        if (typeof onImported === "function") await onImported();
      }

      const errors = (results.errors || []).map((entry) => ({
        label: entry.employee?.fullName || entry.employee?.email || "row",
        error: entry.error,
      }));
      setFailedRows(errors);

      if (summary.successful > 0 && errors.length === 0) {
        onClose?.();
      } else if (summary.successful === 0 && errors.length === 0) {
        notify(
          summary.duplicates > 0
            ? `Those ${peopleNoun} already exist.`
            : `No ${peopleNoun} could be imported.`,
        );
        await load();
      } else {
        await load();
      }
    } catch (error) {
      notify(error, `Failed to import ${peopleNoun} from the brief.`);
    } finally {
      setImporting(false);
    }
  };

  const showContractPicker = !fixedContractId;

  return (
    <div className="bimp-overlay" role="presentation" onClick={onClose}>
      <div
        className="bimp-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bimp-people-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bimp-header">
          <div>
            <h3 id="bimp-people-title">
              Import {peopleNoun} from the service brief
            </h3>
            <p>
              These are the people listed in the brief and in the requirement
              document attached to it. Nothing is emailed automatically — the
              roster is created first, then you assign routes and send
              invitations from the {PeopleNoun} list.
            </p>
          </div>
          <button
            type="button"
            className="bimp-close"
            onClick={onClose}
            disabled={importing}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="bimp-body">
          {showContractPicker && (
            <div className="bimp-toolbar">
              <span className="bimp-toolbar-label">Import from contract</span>
              {contractsLoading ? (
                <span className="bimp-footer-note">Loading contracts…</span>
              ) : contracts.length === 0 ? (
                <span className="bimp-footer-note">
                  You have no managed-service contract with an importable brief
                  yet.
                </span>
              ) : (
                <select
                  className="bimp-contract-select"
                  value={contractId}
                  onChange={(e) => setContractId(e.target.value)}
                >
                  <option value="">Choose a contract…</option>
                  {contracts.map((contract) => (
                    <option key={contract.contractId} value={contract.contractId}>
                      {contract.contractNumber} — {contract.counterpartName} (
                      {contract.rosterCount} listed, {contract.documentCount}{" "}
                      document(s))
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {!contractId ? (
            !showContractPicker || contractsLoading ? null : (
              <div className="bimp-state">
                <span>
                  Pick the contract whose brief you want to import from.
                </span>
              </div>
            )
          ) : loading ? (
            <div className="bimp-state">
              <Loader2 size={24} className="bimp-spin" />
              <span>Reading the brief and its attached document…</span>
            </div>
          ) : loadError ? (
            <div className="bimp-state">
              <span>{loadError}</span>
              <button
                type="button"
                className="bimp-btn bimp-btn-ghost"
                onClick={load}
              >
                <RefreshCw size={16} />
                <span>Try again</span>
              </button>
            </div>
          ) : (
            <>
              {counts && (
                <div className="bimp-chips">
                  <span className="bimp-chip brief">
                    {counts.employeesFromBrief} from the brief
                  </span>
                  <span className="bimp-chip document">
                    <FileSpreadsheet size={13} />
                    {counts.employeesFromDocuments} from the document
                  </span>
                  <span className="bimp-chip">
                    {selectedKeys.length} selected
                  </span>
                  {candidates.length - importableKeys.length > 0 && (
                    <span className="bimp-chip warn">
                      {candidates.length - importableKeys.length} without an
                      email
                    </span>
                  )}
                </div>
              )}

              {warnings.length > 0 && (
                <div className="bimp-warnings">
                  <h5>Some attachments could not be read fully</h5>
                  <ul>
                    {warnings.map((warning, idx) => (
                      <li key={idx}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}

              {candidates.length === 0 ? (
                <div className="bimp-state">
                  <span>
                    This brief lists no people and its attachments had no
                    readable roster. Add roster rows to the brief, or attach the
                    filled-in Excel template, then try again.
                  </span>
                </div>
              ) : (
                <>
                  <div className="bimp-toolbar">
                    <button
                      type="button"
                      className="bimp-btn-link"
                      onClick={() => selectAll(true)}
                    >
                      Select new only
                    </button>
                    <button
                      type="button"
                      className="bimp-btn-link"
                      onClick={() => selectAll(false)}
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      className="bimp-btn-link"
                      onClick={clearAll}
                    >
                      Clear
                    </button>
                  </div>

                  <div className="bimp-table-wrap">
                    <table className="bimp-table">
                      <thead>
                        <tr>
                          <th style={{ width: "36px" }} aria-label="Select" />
                          <th>Name</th>
                          <th>Source</th>
                          <th>Contact</th>
                          <th>{school ? "Grade / class" : "Department"}</th>
                          <th>Pickup</th>
                          <th>Preferred route</th>
                          <th>Pass</th>
                        </tr>
                      </thead>
                      <tbody>
                        {candidates.map((row) => {
                          const noEmail = !row.email;
                          return (
                            <tr
                              key={row.sourceKey}
                              className={
                                row.alreadyExists || noEmail
                                  ? "exists"
                                  : selected[row.sourceKey]
                                    ? "selected"
                                    : ""
                              }
                            >
                              <td>
                                <input
                                  type="checkbox"
                                  checked={Boolean(selected[row.sourceKey])}
                                  disabled={noEmail}
                                  onChange={() => toggleRow(row.sourceKey)}
                                  aria-label={`Import ${row.name || "row"}`}
                                />
                              </td>
                              <td>
                                <span className="bimp-row-title">
                                  {row.name || "Unnamed"}
                                </span>
                                {row.employeeCode && (
                                  <span className="bimp-row-sub">
                                    {row.employeeCode}
                                  </span>
                                )}
                                {row.alreadyExists && (
                                  <span className="bimp-row-sub">
                                    <span className="bimp-flag">
                                      already added
                                    </span>
                                  </span>
                                )}
                                {noEmail && (
                                  <span className="bimp-row-sub">
                                    <span className="bimp-flag">
                                      email required
                                    </span>
                                  </span>
                                )}
                              </td>
                              <td>
                                <span
                                  className={`bimp-source ${
                                    row.source === "BRIEF"
                                      ? "brief"
                                      : "document"
                                  }`}
                                >
                                  {row.source === "BRIEF" ? "BRIEF" : "DOCUMENT"}
                                </span>
                                {row.source === "DOCUMENT" && (
                                  <span className="bimp-row-sub">
                                    {row.documentName || "attachment"}
                                    {row.sourceRow
                                      ? ` · row ${row.sourceRow}`
                                      : ""}
                                  </span>
                                )}
                              </td>
                              <td>
                                <span>{row.email || "—"}</span>
                                <span className="bimp-row-sub">
                                  {row.phone || "no phone"}
                                </span>
                              </td>
                              <td>{row.department || "—"}</td>
                              <td>
                                <span>
                                  {row.pickupArea || row.homeAddress || "—"}
                                </span>
                                {row.workLocation && (
                                  <span className="bimp-row-sub">
                                    to {row.workLocation}
                                  </span>
                                )}
                              </td>
                              <td>{row.preferredRouteLabel || "—"}</td>
                              <td>{row.passMonths || 1} month(s)</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {failedRows.length > 0 && (
                <div className="bimp-results">
                  <h5>{failedRows.length} row(s) could not be created</h5>
                  <ul>
                    {failedRows.map((row, idx) => (
                      <li key={idx}>
                        {row.label}: {row.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        <div className="bimp-footer">
          <span className="bimp-footer-note">
            Invitations are not sent automatically — send them from the{" "}
            {PeopleNoun} list once routes are assigned.
          </span>
          <div className="bimp-footer-actions">
            <button
              type="button"
              className="bimp-btn bimp-btn-ghost"
              onClick={onClose}
              disabled={importing}
            >
              Cancel
            </button>
            <button
              type="button"
              className="bimp-btn bimp-btn-primary"
              onClick={handleImport}
              disabled={importing || loading || selectedKeys.length === 0}
            >
              {importing ? (
                <Loader2 size={16} className="bimp-spin" />
              ) : (
                <Upload size={16} />
              )}
              <span>
                {importing
                  ? "Importing…"
                  : `Import ${selectedKeys.length || ""} ${peopleNoun}`.trim()}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
