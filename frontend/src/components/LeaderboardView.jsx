import React, { useState, useEffect } from "react";
import { getLeaderboard } from "../api";
import { Trophy, Medal, Award, TrendingUp, AlertCircle } from "lucide-react";

export default function LeaderboardView() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadLeaderboard();
  }, []);

  async function loadLeaderboard() {
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
  }

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

      {/* Complete Leaderboard Table */}
      <div className="card">
        <h2 className="card-title">Full Club Rankings</h2>
        {leaderboard.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px 0", color: "var(--text-dim)" }}>
            No leaderboard records found.
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 60 }}>Rank</th>
                  <th>Player Name</th>
                  <th>Category</th>
                  <th>Elo Ranking Points</th>
                  <th>Matches Played</th>
                  <th>Won</th>
                  <th>Lost</th>
                  <th>Win Rate %</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((row, idx) => {
                  const rank = row.rank_position || idx + 1;
                  const total = Number(row.matches_played || 0);
                  const won = Number(row.matches_won || 0);
                  const rate = total > 0 ? ((won / total) * 100).toFixed(1) : "0.0";

                  return (
                    <tr key={row.user_id || idx}>
                      <td>
                        <span style={{
                          fontWeight: 800,
                          fontSize: 15,
                          color: rank === 1 ? "#fbbf24" : rank === 2 ? "#cbd5e1" : rank === 3 ? "#d97706" : "var(--text-muted)"
                        }}>
                          #{rank}
                        </span>
                      </td>
                      <td>
                        <strong>{row.name}</strong>
                        <span style={{ display: "block", fontSize: 11, color: "var(--text-dim)" }}>ID #{row.user_id}</span>
                      </td>
                      <td>
                        <span className={`badge ${row.user_type === "Member" ? "badge-ongoing" : "badge-registration"}`}>
                          {row.user_type}
                        </span>
                      </td>
                      <td>
                        <strong style={{ fontSize: 15, color: "var(--accent-green)" }}>
                          {row.ranking_points}
                        </strong>
                      </td>
                      <td>{total}</td>
                      <td><span style={{ color: "var(--accent-green)", fontWeight: 600 }}>{won}</span></td>
                      <td><span style={{ color: "#f87171" }}>{Number(row.matches_lost || 0)}</span></td>
                      <td><strong>{rate}%</strong></td>
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
