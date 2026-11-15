import React, { useState, useEffect, useCallback } from "react";
import { getLeaderboard, getToken } from "../api";
import { Trophy, Medal, Award, AlertCircle } from "lucide-react";

export default function LeaderboardView() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadLeaderboard = useCallback(async () => {
    if (!getToken()) {
      setLeaderboard([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getLeaderboard();
      setLeaderboard(data);
    } catch (err) {
      setError(err.message || "Failed to load leaderboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function init() {
      if (!getToken()) {
        setLeaderboard([]);
        setLoading(false);
        return;
      }
      try {
        const data = await getLeaderboard();
        if (!ignore) {
          setLeaderboard(data);
        }
      } catch (err) {
        if (!ignore) {
          setError(err.message || "Failed to load leaderboard");
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
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Club Championship Leaderboard</h1>
          <p className="page-description">Official club rankings, Elo points, and match performance records calculated via window functions.</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={loadLeaderboard} disabled={loading}>
          Refresh
        </button>
      </div>

      {error && (
        <div className="alert alert-error">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Top 3 Podium Highlights */}
      {leaderboard.length >= 3 && (
        <div className="grid-3" style={{ marginBottom: 30 }}>
          {/* Rank 2 */}
          <div className="stat-card" style={{ borderTop: "3px solid #94a3b8" }}>
            <div className="stat-icon" style={{ background: "rgba(148, 163, 184, 0.15)", color: "#cbd5e1" }}>
              <Medal size={28} />
            </div>
            <div>
              <div className="stat-label">Rank #2 — Silver</div>
              <div className="stat-value" style={{ fontSize: 20 }}>{leaderboard[1]?.name}</div>
              <div style={{ fontSize: 12, color: "var(--accent-green)", fontWeight: 600 }}>
                {leaderboard[1]?.ranking_points} Points ({leaderboard[1]?.matches_won || 0} Wins)
              </div>
            </div>
          </div>

          {/* Rank 1 */}
          <div className="stat-card" style={{ borderTop: "3px solid #f59e0b", background: "rgba(245, 158, 11, 0.05)" }}>
            <div className="stat-icon" style={{ background: "rgba(245, 158, 11, 0.2)", color: "#fbbf24" }}>
              <Trophy size={32} />
            </div>
            <div>
              <div className="stat-label" style={{ color: "#fbbf24", fontWeight: 700 }}>Rank #1 — Gold Champion</div>
              <div className="stat-value" style={{ fontSize: 22 }}>{leaderboard[0]?.name}</div>
              <div style={{ fontSize: 13, color: "var(--accent-green)", fontWeight: 700 }}>
                {leaderboard[0]?.ranking_points} Points ({leaderboard[0]?.matches_won || 0} Wins)
              </div>
            </div>
          </div>

          {/* Rank 3 */}
          <div className="stat-card" style={{ borderTop: "3px solid #b45309" }}>
            <div className="stat-icon" style={{ background: "rgba(180, 83, 9, 0.15)", color: "#d97706" }}>
              <Award size={28} />
            </div>
            <div>
              <div className="stat-label">Rank #3 — Bronze</div>
              <div className="stat-value" style={{ fontSize: 20 }}>{leaderboard[2]?.name}</div>
              <div style={{ fontSize: 12, color: "var(--accent-green)", fontWeight: 600 }}>
                {leaderboard[2]?.ranking_points} Points ({leaderboard[2]?.matches_won || 0} Wins)
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard Table */}
      <div className="card">
        <h2 className="card-title">Ranking Standings</h2>
        {leaderboard.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px 0", color: "var(--text-dim)" }}>
            {loading ? "Loading leaderboard..." : "No player rankings available."}
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Player Name</th>
                  <th>Player Type</th>
                  <th>Ranking Points</th>
                  <th>Matches Played</th>
                  <th>Won</th>
                  <th>Lost</th>
                  <th>Win Rate</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((p, idx) => {
                  const played = Number(p.matches_played || 0);
                  const won = Number(p.matches_won || 0);
                  const rate = played > 0 ? ((won / played) * 100).toFixed(1) : "0.0";
                  return (
                    <tr key={p.user_id}>
                      <td style={{ fontWeight: 700, color: idx < 3 ? "var(--accent-green)" : "inherit" }}>
                        #{idx + 1}
                      </td>
                      <td>
                        <strong>{p.name}</strong>
                      </td>
                      <td>
                        <span className={`user-role-pill role-${(p.user_type || "member").toLowerCase()}`}>
                          {p.user_type}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700, color: "#fff" }}>{p.ranking_points} pts</td>
                      <td>{played}</td>
                      <td style={{ color: "var(--accent-green)", fontWeight: 600 }}>{won}</td>
                      <td style={{ color: "#f87171" }}>{p.matches_lost || 0}</td>
                      <td>{rate}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
