import { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";
import {
  FiDollarSign,
  FiCheckCircle,
  FiClock,
  FiXCircle,
  FiUsers,
  FiRefreshCw,
} from "react-icons/fi";
import StaffShell from "./StaffShell";
import StaffWallet from "./StaffWallet";
import {
  getFinanceCommissions,
  updateFinanceCommissionStatus,
  getFinanceExpenses,
  updateFinanceExpenseApproval,
  updateFinanceExpensePayment,
  getFinancePayoutSummary,
} from "../../services/demandPortalAPI";
import "./StaffPortal.css";

const inr = (n) => `AED ${Number(n || 0).toLocaleString()}`;
const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

const TABS = [
  { key: "commissions", label: "Commissions" },
  { key: "expenses", label: "Expenses" },
  { key: "payouts", label: "Payout Summary" },
  { key: "wallet", label: "My Wallet" },
];

export default function FinancePortal() {
  const [tab, setTab] = useState("commissions");

  return (
    <StaffShell subtitle="Finance workspace">
      <div className="sp-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={tab === t.key ? "active" : ""}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "commissions" && <CommissionsTab />}
      {tab === "expenses" && <ExpensesTab />}
      {tab === "payouts" && <PayoutsTab />}
      {tab === "wallet" && <StaffWallet />}
    </StaffShell>
  );
}

/* ------------------------------ Commissions ------------------------------ */
function CommissionsTab() {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({ pending: 0, approved: 0, paid: 0 });
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getFinanceCommissions(
        statusFilter ? { status: statusFilter } : {},
      );
      setRows(res.data || []);
      setSummary(res.summary || { pending: 0, approved: 0, paid: 0 });
    } catch {
      toast.error("Failed to load commissions");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (id, status) => {
    try {
      setBusyId(id);
      await updateFinanceCommissionStatus(id, status);
      toast.success(`Commission marked ${status.toLowerCase()}`);
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Update failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <div className="sp-stat-row">
        <StatCard
          icon={<FiClock />}
          tone="amber"
          label="Pending"
          value={inr(summary.pending)}
        />
        <StatCard
          icon={<FiCheckCircle />}
          tone="blue"
          label="Approved (unpaid)"
          value={inr(summary.approved)}
        />
        <StatCard
          icon={<FiDollarSign />}
          tone="green"
          label="Paid"
          value={inr(summary.paid)}
        />
      </div>

      <div className="sp-toolbar">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="PAID">Paid</option>
        </select>
        <button className="sp-btn sp-btn-ghost" onClick={load}>
          <FiRefreshCw /> Refresh
        </button>
      </div>

      <div className="sp-card sp-table-card">
        {loading ? (
          <div className="sp-empty">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="sp-empty">No commissions found.</div>
        ) : (
          <table className="sp-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Lead</th>
                <th>Rule</th>
                <th>Amount</th>
                <th>Status</th>
                <th className="sp-ta-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c._id}>
                  <td>
                    <div className="sp-strong">
                      {c.employee?.fullName || "—"}
                    </div>
                    <div className="sp-code">{c.employee?.employeeCode}</div>
                  </td>
                  <td>
                    <div>{c.lead?.name || "—"}</div>
                    <div className="sp-code">{c.lead?.leadCode}</div>
                  </td>
                  <td>{c.rule?.name || c.type || "—"}</td>
                  <td className="sp-strong">{inr(c.amount)}</td>
                  <td>
                    <StatusPill status={c.status} />
                  </td>
                  <td className="sp-ta-right">
                    <div className="sp-actions">
                      {c.status === "PENDING" && (
                        <button
                          className="sp-btn sp-btn-sm"
                          disabled={busyId === c._id}
                          onClick={() => setStatus(c._id, "APPROVED")}
                        >
                          Approve
                        </button>
                      )}
                      {c.status !== "PAID" && (
                        <button
                          className="sp-btn sp-btn-sm sp-btn-primary"
                          disabled={busyId === c._id}
                          onClick={() => setStatus(c._id, "PAID")}
                        >
                          Mark Paid
                        </button>
                      )}
                      {c.status === "PAID" && (
                        <span className="sp-muted">
                          Paid {fmtDate(c.paidAt)}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

/* ------------------------------- Expenses -------------------------------- */
function ExpensesTab() {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({
    approvedUnpaid: 0,
    paid: 0,
    pendingApproval: 0,
  });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getFinanceExpenses();
      setRows(res.data || []);
      setSummary(
        res.summary || { approvedUnpaid: 0, paid: 0, pendingApproval: 0 },
      );
    } catch {
      toast.error("Failed to load expenses");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const approve = async (id, status) => {
    try {
      setBusyId(id);
      let reason = "";
      if (status === "REJECTED") {
        reason = window.prompt("Reason for rejection (optional):") || "";
      }
      await updateFinanceExpenseApproval(id, status, reason);
      toast.success(`Expense ${status.toLowerCase()}`);
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Update failed");
    } finally {
      setBusyId(null);
    }
  };

  const pay = async (id) => {
    try {
      setBusyId(id);
      await updateFinanceExpensePayment(id, "PAID");
      toast.success("Expense paid");
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Payment failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <div className="sp-stat-row">
        <StatCard
          icon={<FiClock />}
          tone="amber"
          label="Pending approval"
          value={inr(summary.pendingApproval)}
        />
        <StatCard
          icon={<FiCheckCircle />}
          tone="blue"
          label="Approved (unpaid)"
          value={inr(summary.approvedUnpaid)}
        />
        <StatCard
          icon={<FiDollarSign />}
          tone="green"
          label="Paid"
          value={inr(summary.paid)}
        />
      </div>

      <div className="sp-toolbar">
        <button className="sp-btn sp-btn-ghost" onClick={load}>
          <FiRefreshCw /> Refresh
        </button>
      </div>

      <div className="sp-card sp-table-card">
        {loading ? (
          <div className="sp-empty">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="sp-empty">No expenses found.</div>
        ) : (
          <table className="sp-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Category</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Approval</th>
                <th>Payment</th>
                <th className="sp-ta-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e._id}>
                  <td>
                    <div className="sp-strong">
                      {e.employee?.fullName || "—"}
                    </div>
                    <div className="sp-code">{e.employee?.employeeCode}</div>
                  </td>
                  <td>{e.category}</td>
                  <td>{fmtDate(e.date)}</td>
                  <td className="sp-strong">{inr(e.amount)}</td>
                  <td>
                    <StatusPill status={e.approvalStatus} />
                  </td>
                  <td>
                    <StatusPill status={e.paymentStatus} />
                  </td>
                  <td className="sp-ta-right">
                    <div className="sp-actions">
                      {e.approvalStatus === "PENDING" && (
                        <>
                          <button
                            className="sp-btn sp-btn-sm"
                            disabled={busyId === e._id}
                            onClick={() => approve(e._id, "APPROVED")}
                          >
                            Approve
                          </button>
                          <button
                            className="sp-btn sp-btn-sm sp-btn-danger"
                            disabled={busyId === e._id}
                            onClick={() => approve(e._id, "REJECTED")}
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {e.approvalStatus === "APPROVED" &&
                        e.paymentStatus === "UNPAID" && (
                          <button
                            className="sp-btn sp-btn-sm sp-btn-primary"
                            disabled={busyId === e._id}
                            onClick={() => pay(e._id)}
                          >
                            Pay
                          </button>
                        )}
                      {e.paymentStatus === "PAID" && (
                        <span className="sp-muted">
                          Paid {fmtDate(e.paidAt)}
                        </span>
                      )}
                      {e.approvalStatus === "REJECTED" && (
                        <span className="sp-muted">Rejected</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

/* ------------------------------- Payouts --------------------------------- */
function PayoutsTab() {
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState({
    commissionsDue: 0,
    expensesDue: 0,
    totalDue: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await getFinancePayoutSummary();
        setRows(res.data || []);
        setTotals(
          res.totals || { commissionsDue: 0, expensesDue: 0, totalDue: 0 },
        );
      } catch {
        toast.error("Failed to load payout summary");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <>
      <div className="sp-stat-row">
        <StatCard
          icon={<FiDollarSign />}
          tone="amber"
          label="Commissions due"
          value={inr(totals.commissionsDue)}
        />
        <StatCard
          icon={<FiDollarSign />}
          tone="blue"
          label="Expenses due"
          value={inr(totals.expensesDue)}
        />
        <StatCard
          icon={<FiUsers />}
          tone="green"
          label="Total outstanding"
          value={inr(totals.totalDue)}
        />
      </div>

      <div className="sp-card sp-table-card">
        {loading ? (
          <div className="sp-empty">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="sp-empty">No active employees.</div>
        ) : (
          <table className="sp-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Comm. pending</th>
                <th>Comm. approved</th>
                <th>Comm. paid</th>
                <th>Expenses due</th>
                <th>Total due</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r._id}>
                  <td>
                    <div className="sp-strong">{r.fullName}</div>
                    <div className="sp-code">{r.employeeCode}</div>
                  </td>
                  <td>{inr(r.commissionsPending)}</td>
                  <td>{inr(r.commissionsApproved)}</td>
                  <td>{inr(r.commissionsPaid)}</td>
                  <td>{inr(r.expensesDue)}</td>
                  <td className="sp-strong">{inr(r.totalDue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

/* ------------------------------ Shared bits ------------------------------ */
function StatCard({ icon, label, value, tone }) {
  return (
    <div className={`sp-stat sp-stat-${tone}`}>
      <div className="sp-stat-icon">{icon}</div>
      <div>
        <div className="sp-stat-value">{value}</div>
        <div className="sp-stat-label">{label}</div>
      </div>
    </div>
  );
}

function StatusPill({ status }) {
  const map = {
    PENDING: { cls: "amber", icon: <FiClock /> },
    APPROVED: { cls: "blue", icon: <FiCheckCircle /> },
    PAID: { cls: "green", icon: <FiDollarSign /> },
    UNPAID: { cls: "gray", icon: <FiClock /> },
    REJECTED: { cls: "red", icon: <FiXCircle /> },
  };
  const m = map[status] || { cls: "gray", icon: null };
  return (
    <span className={`sp-pill sp-pill-${m.cls}`}>
      {m.icon} {status}
    </span>
  );
}
