import React, { useState, useEffect, useCallback } from "react";
import { getTableUtilisation, getWinStreaks, getHeadToHead, getAdminDiagnostics, deactivateUser, getToken } from "../api";
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

  const loadAnalytics = useCallback(async () => {
    if (!getToken()) {
      setUtilisation([]);
      setStreaks([]);
      setHeadToHead([]);
      setDiagnostics([]);
      setLoading(false);
      return;
    }
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
  }, [isAdmin]);

  useEffect(() => {
    let ignore = false;
    async function init() {
      if (!getToken()) {
        setUtilisation([]);
        setStreaks([]);
        setHeadToHead([]);
        setDiagnostics([]);
        setLoading(false);
        return;
      }
      try {
        const [uList, sList, hList] = await Promise.all([
          getTableUtilisation(),
          getWinStreaks(),
          getHeadToHead()
        ]);
        if (!ignore) {
          setUtilisation(uList);
          setStreaks(sList);
          setHeadToHead(hList);
          if (isAdmin) {
            const diag = await getAdminDiagnostics().catch(() => []);
            setDiagnostics(diag);
          }
        }
      } catch (err) {
        if (!ignore) {
          setError(err.message || "Failed to load analytics");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }
    init();
    return () => {
      ignore = true;
    };
  }, [isAdmin, currentUser]);

  async function handleDeactivate(e) {
    e.preventDefault();
    if (!deactivateId) return;
    if (!window.confirm(`Are you sure you want to deactivate User #${deactivateId}? In compliance with Rule R9, all past match and ledger records will be preserved.`)) return;

    setError(null);
    try {
      await deactivateUser(Number(deactivateId));
      setSuccess(`User #${deactivateId} deactivated successfully (Rule R9 active)!`);
      setTimeout(() => setSuccess(null), 3000);
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
          <h1 className="page-title">Executive Analytics & Audit Reports</h1>
          <p className="page-description">Database analytical views, table utilisation metrics, player rivalries, and diagnostic integrity audits.</p>
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

      {/* Admin Quick Action: Rule R9 Soft-Deactivation */}
      {isAdmin && (
        <div className="card" style={{ marginBottom: 24, padding: "16px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 className="card-title" style={{ fontSize: 15, margin: 0 }}>
                Rule R9 Compliance: Deactivate User
              </h3>
              <p style={{ fontSize: 12, color: "var(--text-dim)", margin: "4px 0 0" }}>
                Revokes active status and auth tokens while strictly safeguarding historical match and ledger records.
              </p>
            </div>
            <form onSubmit={handleDeactivate} style={{ display: "flex", gap: 10 }}>
              <input
                type="number"
                className="form-input"
                style={{ width: 140 }}
                placeholder="User ID"
                value={deactivateId}
                onChange={(e) => setDeactivateId(e.target.value)}
                required
              />
              <button type="submit" className="btn btn-danger btn-sm">
                <UserMinus size={14} /> Deactivate
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Diagnostic Anomalies Alert for Admin */}
      {isAdmin && diagnostics.length > 0 && (
        <div className="card" style={{ borderLeft: "4px solid #f87171", marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <ShieldAlert size={18} color="#f87171" />
            <h3 className="card-title" style={{ margin: 0, color: "#f87171" }}>
              Diagnostic Specialization Integrity Alerts (v_specialization_anomalies)
            </h3>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Name</th>
                  <th>Registered Type</th>
                  <th>Anomaly Detail</th>
                </tr>
              </thead>
              <tbody>
                {diagnostics.map((d, i) => (
                  <tr key={i}>
                    <td>#{d.user_id}</td>
                    <td><strong>{d.name}</strong></td>
                    <td>{d.user_type}</td>
                    <td style={{ color: "#f87171" }}>{d.anomaly_type || d.notes || "Disjoint/Totality check flag"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Table Utilisation Report */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h2 className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <BarChart3 size={18} color="var(--accent-green)" />
          Table Utilisation & Revenue Performance (v_table_utilisation)
        </h2>
        {utilisation.length === 0 ? (
          <div style={{ textAlign: "center", padding: "20px 0", color: "var(--text-dim)" }}>
            {loading ? "Loading table utilisation..." : "No table utilisation data recorded yet."}
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Table</th>
                  <th>Game Type</th>
                  <th>Total Reservations</th>
                  <th>Utilisation Rate</th>
                  <th>Total Revenue</th>
                </tr>
              </thead>
              <tbody>
                {utilisation.map((u) => (
                  <tr key={u.table_id}>
                    <td><strong>{u.table_name || `Table ${u.table_number}`}</strong></td>
                    <td>{u.game_type}</td>
                    <td>{u.total_reservations || 0}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, background: "var(--bg-secondary)", borderRadius: 4, height: 8, overflow: "hidden", maxWidth: 120 }}>
                          <div
                            style={{
                              width: `${Math.min(100, Number(u.utilisation_percentage || 0))}%`,
                              background: "var(--accent-green)",
                              height: "100%"
                            }}
                          />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{Number(u.utilisation_percentage || 0).toFixed(1)}%</span>
                      </div>
                    </td>
                    <td style={{ fontWeight: 700, color: "var(--accent-green)" }}>
                      ₹{Number(u.total_revenue || 0).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid-2">
        {/* Win Streaks Report */}
        <div className="card">
          <h2 className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Flame size={18} color="#fbbf24" />
            Active Win Streaks (v_win_streaks)
          </h2>
          {streaks.length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px 0", color: "var(--text-dim)" }}>
              {loading ? "Loading streaks..." : "No active winning streaks recorded."}
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Current Streak</th>
                  </tr>
                </thead>
                <tbody>
                  {streaks.map((s, idx) => (
                    <tr key={idx}>
                      <td><strong>{s.player_name}</strong></td>
                      <td>
                        <span style={{ fontWeight: 700, color: "#fbbf24", display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <Flame size={14} /> {s.current_win_streak} consecutive wins
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Head to Head Rivalries Report */}
        <div className="card">
          <h2 className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Users2 size={18} color="#60a5fa" />
            Head-to-Head Rivalries (v_head_to_head)
          </h2>
          {headToHead.length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px 0", color: "var(--text-dim)" }}>
              {loading ? "Loading head-to-head records..." : "No head-to-head records recorded yet."}
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Matchup</th>
                    <th>Record</th>
                  </tr>
                </thead>
                <tbody>
                  {headToHead.map((h, idx) => (
                    <tr key={idx}>
                      <td>
                        <strong>{h.player1_name}</strong> vs <strong>{h.player2_name}</strong>
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        {h.player1_wins} - {h.player2_wins}
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
