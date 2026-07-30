import React, { useState, useEffect, useCallback } from "react";
import { FiRefreshCw } from "react-icons/fi";
import { toast } from "react-hot-toast";
import { useSelector } from "react-redux";
import * as demandAPI from "../../../services/demandAPI";

const pct = (n) => `${Number(n || 0)}%`;
const roiClass = (n) => (Number(n) >= 0 ? "dg-badge-green" : "dg-badge-red");

const DGFinancial = () => {
  const activeCurrency = useSelector((s) => s.locale?.currency) || "AED";
  const money = (n) => {
    const decimals = ["KWD", "BHD", "OMR"].includes(activeCurrency) ? 3 : 2;
    return `${activeCurrency} ${Number(n || 0).toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}`;
  };
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await demandAPI.getFinancialDashboard({ from, to });
      setData(res.data);
    } catch (e) {
      toast.error("Failed to load financial dashboard");
    } finally {
      setLoading(false);
    }
  }, [from, to, activeCurrency]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading || !data) {
    return (
      <div className="dg-loading">
        <div className="dg-spinner" />
        <p>Loading financials...</p>
      </div>
    );
  }

  const s = data.summary;

  return (
    <div>
      <div className="dg-section-head">
        <div>
          <h2>Financial Dashboard</h2>
          <p>
            Salary, commission and expense cost, cost-per-acquisition and
            employee earnings.
          </p>
        </div>
        <div className="dg-filters" style={{ margin: 0 }}>
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
          <button className="dg-btn" onClick={fetchData}>
            <FiRefreshCw /> Apply
          </button>
        </div>
      </div>

      <div className="dg-stats">
        <div className="dg-stat dg-stat-accent-blue">
          <div className="dg-stat-label">Total Salary Cost</div>
          <div className="dg-stat-value">{money(s.totalSalaryCost)}</div>
          <div className="dg-stat-sub">Active employees / month</div>
        </div>
        <div className="dg-stat dg-stat-accent-amber">
          <div className="dg-stat-label">Total Commissions</div>
          <div className="dg-stat-value">{money(s.totalCommissions)}</div>
        </div>
        <div className="dg-stat dg-stat-accent-red">
          <div className="dg-stat-label">Total Expenses</div>
          <div className="dg-stat-value">{money(s.totalExpenses)}</div>
          <div className="dg-stat-sub">Approved only</div>
        </div>
        <div className="dg-stat dg-stat-accent-green">
          <div className="dg-stat-label">Total Cost</div>
          <div className="dg-stat-value">{money(s.totalCost)}</div>
        </div>
        <div className="dg-stat dg-stat-accent-green">
          <div className="dg-stat-label">Total Revenue</div>
          <div className="dg-stat-value">{money(s.totalRevenue)}</div>
          <div className="dg-stat-sub">Onboarded lead value</div>
        </div>
        <div
          className={`dg-stat ${Number(s.netProfit) >= 0 ? "dg-stat-accent-green" : "dg-stat-accent-red"}`}
        >
          <div className="dg-stat-label">Net Profit</div>
          <div className="dg-stat-value">{money(s.netProfit)}</div>
          <div className="dg-stat-sub">Overall ROI {pct(s.overallRoi)}</div>
        </div>
        <div className="dg-stat dg-stat-accent-blue">
          <div className="dg-stat-label">Cost / Customer</div>
          <div className="dg-stat-value">{money(s.costPerCustomer)}</div>
          <div className="dg-stat-sub">{s.customerOnboarded} onboarded</div>
        </div>
        <div className="dg-stat dg-stat-accent-blue">
          <div className="dg-stat-label">Cost / Partner</div>
          <div className="dg-stat-value">{money(s.costPerPartner)}</div>
          <div className="dg-stat-sub">{s.partnerOnboarded} onboarded</div>
        </div>
      </div>

      {/* Budget vs Actual */}
      <div className="dg-card" style={{ marginTop: 20 }}>
        <h3>Budget vs Actual Costs</h3>
        <table className="dg-table">
          <tbody>
            <tr>
              <td className="dg-cell-strong">Total Campaign Budget</td>
              <td style={{ textAlign: "right" }}>{money(s.totalBudget)}</td>
            </tr>
            <tr>
              <td className="dg-cell-strong">
                Actual Cost (Salary + Commission + Expenses)
              </td>
              <td style={{ textAlign: "right" }}>{money(s.totalCost)}</td>
            </tr>
            <tr>
              <td className="dg-cell-strong">Variance</td>
              <td
                style={{
                  textAlign: "right",
                  color:
                    Number(s.budgetVariance) >= 0
                      ? "var(--dg-green, #16a34a)"
                      : "var(--dg-red, #dc2626)",
                }}
              >
                {money(s.budgetVariance)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="dg-grid-2">
        {/* Commissions by status */}
        <div className="dg-card">
          <h3>Commissions by Status</h3>
          <table className="dg-table">
            <tbody>
              {["PENDING", "APPROVED", "PAID"].map((st) => (
                <tr key={st}>
                  <td className="dg-cell-strong">{st}</td>
                  <td style={{ textAlign: "right" }}>
                    {money(data.commissionsByStatus?.[st] || 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Expenses by category */}
        <div className="dg-card">
          <h3>Expenses by Category (Approved)</h3>
          {Object.keys(data.expensesByCategory || {}).length ? (
            <table className="dg-table">
              <tbody>
                {Object.entries(data.expensesByCategory).map(([cat, amt]) => (
                  <tr key={cat}>
                    <td className="dg-cell-strong">
                      {cat.charAt(0) + cat.slice(1).toLowerCase()}
                    </td>
                    <td style={{ textAlign: "right" }}>{money(amt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="dg-cell-muted">No approved expenses.</p>
          )}
        </div>
      </div>

      {/* Employee earnings */}
      <div className="dg-card" style={{ marginTop: 20 }}>
        <h3>Employee-wise Earnings (Salary + Commission + Expenses)</h3>
        {data.employeeEarnings?.length ? (
          <table className="dg-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Salary</th>
                <th>Commission</th>
                <th>Expenses</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {data.employeeEarnings.map((e) => (
                <tr key={e._id}>
                  <td>
                    <div className="dg-cell-strong">{e.name}</div>
                    <div className="dg-code">{e.employeeCode}</div>
                  </td>
                  <td>{money(e.salary)}</td>
                  <td>{money(e.commission)}</td>
                  <td>{money(e.expenses)}</td>
                  <td className="dg-cell-strong">{money(e.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="dg-cell-muted">No employees.</p>
        )}
      </div>

      {/* ROI by campaign & region */}
      <div className="dg-grid-2" style={{ marginTop: 20 }}>
        <div className="dg-card">
          <h3>ROI by Campaign</h3>
          {data.roiByCampaign?.length ? (
            <table className="dg-table">
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Budget</th>
                  <th>Revenue</th>
                  <th>Cost</th>
                  <th>ROI</th>
                </tr>
              </thead>
              <tbody>
                {data.roiByCampaign.map((c) => (
                  <tr key={c._id}>
                    <td className="dg-cell-strong">{c.name}</td>
                    <td>{money(c.budget)}</td>
                    <td>{money(c.revenue)}</td>
                    <td>{money(c.cost)}</td>
                    <td>
                      <span className={`dg-badge ${roiClass(c.roi)}`}>
                        {pct(c.roi)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="dg-cell-muted">No campaigns.</p>
          )}
        </div>

        <div className="dg-card">
          <h3>ROI by Region</h3>
          {data.roiByRegion?.length ? (
            <table className="dg-table">
              <thead>
                <tr>
                  <th>Region</th>
                  <th>Revenue</th>
                  <th>Cost</th>
                  <th>ROI</th>
                </tr>
              </thead>
              <tbody>
                {data.roiByRegion.map((r) => (
                  <tr key={r.region}>
                    <td className="dg-cell-strong">{r.region}</td>
                    <td>{money(r.revenue)}</td>
                    <td>{money(r.cost)}</td>
                    <td>
                      <span className={`dg-badge ${roiClass(r.roi)}`}>
                        {pct(r.roi)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="dg-cell-muted">No regional data.</p>
          )}
        </div>
      </div>

      {/* ROI by employee */}
      <div className="dg-card" style={{ marginTop: 20 }}>
        <h3>ROI by Employee</h3>
        {data.roiByEmployee?.length ? (
          <table className="dg-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Revenue</th>
                <th>Cost</th>
                <th>ROI</th>
              </tr>
            </thead>
            <tbody>
              {data.roiByEmployee.map((e) => (
                <tr key={e._id}>
                  <td>
                    <div className="dg-cell-strong">{e.name}</div>
                    <div className="dg-code">{e.employeeCode}</div>
                  </td>
                  <td>{money(e.revenue)}</td>
                  <td>{money(e.total)}</td>
                  <td>
                    <span className={`dg-badge ${roiClass(e.roi)}`}>
                      {pct(e.roi)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="dg-cell-muted">No employees.</p>
        )}
      </div>
    </div>
  );
};

export default DGFinancial;
