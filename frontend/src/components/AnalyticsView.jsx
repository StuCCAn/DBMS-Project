import React, { useState, useEffect } from "react";
import { getTableUtilisation, getWinStreaks, getHeadToHead, getAdminDiagnostics, deactivateUser } from "../api";
import { BarChart3, Flame, Users2, ShieldAlert, AlertCircle, Check, UserMinus } from "lucide-react";

export default function AnalyticsView({ currentUser }) {
  const isAdmin = currentUser?.app_role === "Admin";

  const [utilisation, setUtilisation] = useState([]);
  const [streaks, setStreaks] = useState([]);
  const [headToHead, setHeadToHead] = useState([]);
  const [diagnostics, setDiagnostics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Deactivation Input
  const [deactivateId, setDeactivateId] = useState("");

  useEffect(() => {
    loadAnalytics();
  }, []);

  async function loadAnalytics() {
    setLoading(true);
    setError(null);
    try {
      const [uList, sList, hList] = await Promise.all([
        getTableUtilisation(),
        getWinStreaks(),
        getHeadToHead()
      ]);
      setUtilisation(uList);
      setStreaks(sList);
      setHeadToHead(hList);

      if (isAdmin) {
        const diag = await getAdminDiagnostics().catch(() => []);
        setDiagnostics(diag);
      }
    } catch (err) {
      setError(err.message || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeactivate(e) {
    e.preventDefault();
    if (!deactivateId) return;
    if (!window.confirm(`Are you sure you want to deactivate User #${deactivateId}? In compliance with Rule R9, all past match and ledger records will be preserved.`)) return;

    setError(null);
    try {
      await deactivateUser(Number(deactivateId));
      setSuccess(`User #${deactivateId} deactivated successfully (Rule R9 active)!`);
      setDeactivateId("");
      loadAnalytics();
    } catch (err) {
      setError(err.message || "Failed to deactivate user");
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Executive Analytics & System Diagnostics</h1>
          <p className="page-description">Revenue utilization, win streaks, head-to-head records, and EER specialization integrity audits.</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={loadAnalytics} disabled={loading}>
          Refresh
        </button>
      </div>

      {error && (
        <div className="alert alert-error">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="alert alert-success">
          <Check size={16} />
          <span>{success}</span>
        </div>
      )}

      {/* Admin EER Diagnostics Card */}
      {isAdmin && (
        <div className="card" style={{ borderLeft: "4px solid var(--accent-gold)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div>
              <h2 className="card-title" style={{ marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
                <ShieldAlert size={18} color="var(--accent-gold)" />
                Database Diagnostics: EER Specialization Audit (`v_specialization_anomalies`)
              </h2>
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                Audits total/disjoint Level 1 specialization and overlapping/partial Level 2 subtype flags.
              </span>
            </div>
          </div>

          {diagnostics.length === 0 ? (
            <div style={{ padding: "14px 18px", background: "rgba(16, 185, 129, 0.1)", borderRadius: 8, border: "1px solid rgba(16, 185, 129, 0.2)", color: "var(--accent-green)", fontSize: 13, fontWeight: 600 }}>
              ✓ Clean Database Audit: 0 specialization anomalies found. All user subtype invariants hold!
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>User ID</th>
                    <th>Name</th>
                    <th>User Type</th>
                    <th>Anomaly Code</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {diagnostics.map((d, i) => (
                    <tr key={i}>
                      <td>#{d.user_id}</td>
                      <td>{d.name}</td>
                      <td>{d.user_type}</td>
                      <td><span className="badge badge-cancelled">{d.anomaly_type}</span></td>
                      <td>{d.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* User Deactivation Form */}
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
            <h4 style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 8 }}>Deactivate User Account (Rule R9)</h4>
            <form onSubmit={handleDeactivate} style={{ display: "flex", gap: 10, maxWidth: 400 }}>
              <input
                type="number"
                className="form-input"
                placeholder="User ID (e.g. 5)"
                value={deactivateId}
                onChange={(e) => setDeactivateId(e.target.value)}
                required
              />
              <button type="submit" className="btn btn-danger btn-sm" style={{ whiteSpace: "nowrap" }}>
                <UserMinus size={14} /> Deactivate User
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Table Utilisation Analytics */}
      <div className="card">
        <h2 className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <BarChart3 size={18} color="var(--accent-green)" />
          Table Utilisation & Revenue Breakdown (`v_table_utilisation`)
        </h2>
        {utilisation.length === 0 ? (
          <div style={{ textAlign: "center", padding: "20px 0", color: "var(--text-dim)" }}>No utilization data recorded yet.</div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Table</th>
                  <th>Game Type</th>
                  <th>Total Reservations</th>
                  <th>Booked Hours</th>
                  <th>Utilisation Rate %</th>
                  <th>Gross Revenue Generated</th>
                </tr>
              </thead>
              <tbody>
                {utilisation.map((u) => (
                  <tr key={u.table_id}>
                    <td><strong>{u.table_name || `Table ${u.table_number}`}</strong></td>
                    <td><span className="badge badge-available">{u.game_type}</span></td>
                    <td>{u.total_bookings}</td>
                    <td>{Number(u.booked_hours || 0).toFixed(1)} hrs</td>
                    <td><strong>{Number(u.utilisation_pct || 0).toFixed(1)}%</strong></td>
                    <td><strong style={{ color: "var(--accent-green)" }}>₹{Number(u.gross_revenue || 0).toFixed(2)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid-2">
        {/* Consecutive Win Streaks */}
        <div className="card">
          <h2 className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Flame size={18} color="#f59e0b" />
            Top Consecutive Win Streaks (`v_win_streaks`)
          </h2>
          {streaks.length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px 0", color: "var(--text-dim)" }}>No active win streaks.</div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Current Streak</th>
                    <th>Max Streak</th>
                  </tr>
                </thead>
                <tbody>
                  {streaks.map((s, idx) => (
                    <tr key={idx}>
                      <td><strong>{s.player_name || s.name}</strong></td>
                      <td>
                        <span style={{ color: "#fbbf24", fontWeight: 700 }}>
                          🔥 {s.current_streak || s.streak_length} Matches
                        </span>
                      </td>
                      <td>{s.longest_streak || s.streak_length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Head-to-Head Player Records */}
        <div className="card">
          <h2 className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Users2 size={18} color="var(--accent-blue)" />
            Head-to-Head Records (`v_head_to_head`)
          </h2>
          {headToHead.length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px 0", color: "var(--text-dim)" }}>No direct rivalries recorded yet.</div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Player A</th>
                    <th>Player B</th>
                    <th>Scoreline</th>
                  </tr>
                </thead>
                <tbody>
                  {headToHead.map((h, idx) => (
                    <tr key={idx}>
                      <td><strong>{h.player1_name}</strong></td>
                      <td><strong>{h.player2_name}</strong></td>
                      <td>
                        <strong style={{ color: "var(--accent-green)" }}>
                          {h.player1_wins} — {h.player2_wins}
                        </strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
