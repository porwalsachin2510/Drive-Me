import React, { useState, useEffect, useCallback } from "react";
import { FiRefreshCw, FiDownload } from "react-icons/fi";
import { toast } from "react-hot-toast";
import { useSelector } from "react-redux";
import * as demandAPI from "../../../services/demandAPI";

// Money-valued report columns that must render in the selected display currency.
const MONEY_COLUMNS = [
  "amount",
  "budget",
  "estimatedValue",
  "monthlySalary",
  "allowances",
  "total",
  "commission",
  "commissions",
  "expenses",
];

const REPORT_TYPES = [
  { value: "employee", label: "By Employee" },
  { value: "team", label: "By Team" },
  { value: "region", label: "By Region" },
  { value: "campaign", label: "By Campaign" },
  { value: "customer", label: "Customers" },
  { value: "partner", label: "Partners (B2B/B2C)" },
  { value: "expenses", label: "Expenses" },
  { value: "salaries", label: "Salaries" },
  { value: "commissions", label: "Commissions" },
  { value: "targets", label: "Targets vs Achievement" },
  { value: "monthly", label: "Monthly Summary" },
  { value: "yearly", label: "Yearly Summary" },
];

const COLUMN_LABELS = {
  employeeCode: "Code",
  conversionRate: "Conv. %",
  estimatedValue: "Est. Value",
  monthlySalary: "Monthly Salary",
  approvalStatus: "Approval",
  paymentStatus: "Payment",
  assignedTo: "Assigned To",
  partnerType: "Partner Type",
  createdAt: "Created",
  achievement: "Achievement %",
};

const label = (col) =>
  COLUMN_LABELS[col] ||
  col.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

const DGReports = () => {
  const activeCurrency = useSelector((s) => s.locale?.currency) || "AED";

  // Format a single cell. Money columns render in the admin's selected display
  // currency (the backend already converts the underlying value to it).
  const formatCell = (col, val) => {
    if (val === null || val === undefined || val === "") return "-";
    if (col === "createdAt" || col === "date")
      return new Date(val).toLocaleDateString();
    if (MONEY_COLUMNS.includes(col)) {
      const decimals = ["KWD", "BHD", "OMR"].includes(activeCurrency) ? 3 : 2;
      return `${activeCurrency} ${Number(val).toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}`;
    }
    if (col === "conversionRate" || col === "achievement") return `${val}%`;
    return String(val);
  };

  const [type, setType] = useState("monthly");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [report, setReport] = useState({ columns: [], rows: [] });
  const [loading, setLoading] = useState(false);

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      const res = await demandAPI.getReport({ type, from, to });
      setReport(res.data || { columns: [], rows: [] });
    } catch (e) {
      toast.error("Failed to generate report");
    } finally {
      setLoading(false);
    }
  }, [type, from, to, activeCurrency]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const exportCsv = () => {
    if (!report.rows.length) {
      toast.error("Nothing to export");
      return;
    }
    const header = report.columns.map(label).join(",");
    const lines = report.rows.map((row) =>
      report.columns
        .map((c) => {
          const v = row[c];
          const cell =
            v === null || v === undefined ? "" : String(v).replace(/"/g, '""');
          return `"${cell}"`;
        })
        .join(","),
    );
    const csv = [header, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `demand-report-${type}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="dg-section-head">
        <div>
          <h2>Reports</h2>
          <p>
            Generate and export reports across employees, teams, regions,
            campaigns and finance.
          </p>
        </div>
        <button className="dg-btn dg-btn-primary" onClick={exportCsv}>
          <FiDownload /> Export CSV
        </button>
      </div>

      <div className="dg-filters">
        <select
          className="dg-select"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          {REPORT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <input
          type="date"
          className="dg-select"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <input
          type="date"
          className="dg-select"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
        <button className="dg-btn" onClick={fetchReport}>
          <FiRefreshCw /> Generate
        </button>
      </div>

      <div className="dg-table-wrap">
        {loading ? (
          <div className="dg-loading">
            <div className="dg-spinner" />
            <p>Generating report...</p>
          </div>
        ) : !report.rows.length ? (
          <div className="dg-empty">
            <h3>No data</h3>
            <p>No records for the selected report and date range.</p>
          </div>
        ) : (
          <table className="dg-table">
            <thead>
              <tr>
                {report.columns.map((c) => (
                  <th key={c}>{label(c)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row, i) => (
                <tr key={i}>
                  {report.columns.map((c) => (
                    <td key={c}>{formatCell(c, row[c])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default DGReports;
