import React, { useState, useEffect, useCallback } from "react";
import { getCoachingHistory, getPlayerWeaknesses, recordAssessment, getToken } from "../api";
import { AlertTriangle, Plus, Check, AlertCircle } from "lucide-react";

const VALID_SKILL_AREAS = [
  "Long potting",
  "Safety play",
  "Break building",
  "Positional play",
  "Cue ball control",
  "Pressure handling"
];

export default function CoachingView({ currentUser }) {
  const canCoach = currentUser?.app_role === "Admin" || currentUser?.app_role === "Staff";
  const isMember = currentUser?.app_role === "Member";

  const [history, setHistory] = useState([]);
  const [weaknesses, setWeaknesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Assessment Form Modal
  const [assessModal, setAssessModal] = useState(false);
  const [playerId, setPlayerId] = useState("3");
  const [skillArea, setSkillArea] = useState(VALID_SKILL_AREAS[0]);
  const [rating, setRating] = useState("7");
  const [notes, setNotes] = useState("");

  const loadCoachingData = useCallback(async () => {
    if (!getToken()) {
      setHistory([]);
      setWeaknesses([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const pId = isMember ? currentUser?.user_id : null;
      const [hist, weak] = await Promise.all([
        getCoachingHistory(pId),
        getPlayerWeaknesses(pId)
      ]);
      setHistory(hist);
      setWeaknesses(weak);
    } catch (err) {
      setError(err.message || "Failed to load coaching data");
    } finally {
      setLoading(false);
    }
  }, [currentUser, isMember]);

  useEffect(() => {
    let ignore = false;
    async function init() {
      if (!getToken()) {
        setHistory([]);
        setWeaknesses([]);
        setLoading(false);
        return;
      }
      try {
        const pId = isMember ? currentUser?.user_id : null;
        const [hist, weak] = await Promise.all([
          getCoachingHistory(pId),
          getPlayerWeaknesses(pId)
        ]);
        if (!ignore) {
          setHistory(hist);
          setWeaknesses(weak);
        }
      } catch (err) {
        if (!ignore) {
          setError(err.message || "Failed to load coaching data");
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
  }, [currentUser, isMember]);

  async function handleRecordAssessment(e) {
    e.preventDefault();
    setError(null);

    if (!currentUser?.user_id) {
      setError("You must be logged in as coach or staff to record an assessment.");
      return;
    }

    try {
      await recordAssessment({
        playerId: Number(playerId),
        assessedBy: Number(currentUser.user_id),
        skillArea,
        rating: Number(rating),
        notes: notes.trim() || null
      });
      setSuccess("Coaching assessment recorded successfully!");
      setTimeout(() => setSuccess(null), 3000);
      setAssessModal(false);
      setNotes("");
      loadCoachingData();
    } catch (err) {
      setError(err.message || "Failed to record assessment");
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Coaching Academy & Player Progress</h1>
          <p className="page-description">Skill diagnostics, technique evaluations, and aggregated weakness metrics for targeted training.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={loadCoachingData} disabled={loading}>
            Refresh
          </button>
          {canCoach && (
            <button className="btn btn-primary btn-sm" onClick={() => setAssessModal(true)}>
              <Plus size={16} /> Record Assessment
            </button>
          )}
        </div>
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

      {/* Weakness Analysis Highlights */}
      {weaknesses.length > 0 && (
        <div className="card" style={{ borderLeft: "4px solid var(--accent-purple)" }}>
          <h3 className="card-title" style={{ fontSize: 16 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <AlertTriangle size={18} color="var(--accent-purple)" />
              Priority Training Areas (Weakness Diagnostics)
            </span>
          </h3>
          <div className="grid-3">
            {weaknesses.map((w, idx) => {
              const skillTitle = w.skill_area || w.focus_area || "Skill Area";
              const rawRating = w.rating !== undefined ? w.rating : w.avg_rating;
              const ratingNum = rawRating !== undefined && rawRating !== null ? Number(rawRating) : null;
              const rankInfo = w.weakness_rank ? `Priority #${w.weakness_rank}` : (w.assessments_count ? `${w.assessments_count} drills` : "");
              return (
                <div key={idx} style={{ padding: 14, background: "var(--bg-secondary)", borderRadius: 8, border: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{skillTitle}</span>
                    {w.name && <span style={{ fontSize: 11, color: "var(--text-dim)" }}>{w.name}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                    Rating: <strong style={{ color: ratingNum !== null && ratingNum < 6 ? "#f87171" : "var(--accent-green)" }}>
                      {ratingNum !== null && !isNaN(ratingNum) ? `${ratingNum.toFixed(1)}/10` : "—"}
                    </strong> {rankInfo && <span style={{ marginLeft: 6, fontSize: 11, color: "var(--accent-purple)" }}>({rankInfo})</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Assessment History Table */}
      <div className="card">
        <h2 className="card-title">Skill Assessment Log</h2>
        {history.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px 0", color: "var(--text-dim)" }}>
            {loading ? "Loading assessments..." : "No coaching assessments recorded yet."}
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Player</th>
                  <th>Coach</th>
                  <th>Skill Area</th>
                  <th>Rating</th>
                  <th>Coach Remarks</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, idx) => {
                  const rawDate = h.assessed_on || h.assessment_date || h.created_at;
                  let dateStr = "—";
                  if (rawDate) {
                    const parsed = new Date(rawDate);
                    dateStr = isNaN(parsed.getTime()) ? String(rawDate).split("T")[0] : parsed.toLocaleDateString();
                  }

                  return (
                    <tr key={h.assessment_id || idx}>
                      <td>{dateStr}</td>
                      <td>
                        <strong>{h.player_name || `Player #${h.player_id}`}</strong>
                      </td>
                      <td>{h.coach_name || `Coach #${h.assessed_by}`}</td>
                      <td>
                        <span className="badge badge-ongoing">{h.skill_area || h.focus_area}</span>
                      </td>
                      <td>
                        <strong style={{ fontSize: 15, color: Number(h.rating) >= 7 ? "var(--accent-green)" : Number(h.rating) >= 5 ? "#fbbf24" : "#f87171" }}>
                          {h.rating} / 10
                        </strong>
                      </td>
                      <td>{h.notes || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Assessment Modal */}
      {assessModal && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 className="modal-title">Record Skill Assessment</h3>
            </div>
            <form onSubmit={handleRecordAssessment}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Player User ID</label>
                  <input
                    type="number"
                    className="form-input"
                    value={playerId}
                    onChange={(e) => setPlayerId(e.target.value)}
                    required
                  />
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Skill Area</label>
                    <select className="form-select" value={skillArea} onChange={(e) => setSkillArea(e.target.value)}>
                      {VALID_SKILL_AREAS.map((area) => (
                        <option key={area} value={area}>{area}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Skill Rating (1 - 10)</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      className="form-input"
                      value={rating}
                      onChange={(e) => setRating(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Coach Notes / Technical Drills</label>
                  <textarea
                    rows="3"
                    className="form-textarea"
                    placeholder="Specific advice on cue delivery, follow-through, or prescribed practice drills..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setAssessModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Assessment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
