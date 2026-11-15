import React, { useState } from "react";
import { completeMatch } from "../api";
import { Swords, Plus, Trash2, CheckCircle, AlertCircle, X } from "lucide-react";

export default function MatchScorer({ match, onClose, onCompleteSuccess }) {
  const [frames, setFrames] = useState([
    { p1: 65, p2: 42, break: 45 },
    { p1: 72, p2: 28, break: 55 }
  ]);
  const [winPoints, setWinPoints] = useState(25);
  const [lossPoints, setLossPoints] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!match) return null;

  function handleAddFrame() {
    setFrames([...frames, { p1: 0, p2: 0, break: 0 }]);
  }

  function handleRemoveFrame(idx) {
    if (frames.length === 1) return;
    setFrames(frames.filter((_, i) => i !== idx));
  }

  function handleFrameChange(idx, field, val) {
    const next = [...frames];
    next[idx][field] = Number(val);
    setFrames(next);
  }

  // Calculate live frame wins
  let p1Frames = 0;
  let p2Frames = 0;
  frames.forEach((f) => {
    if (f.p1 > f.p2) p1Frames++;
    else if (f.p2 > f.p1) p2Frames++;
  });

  async function handleSubmit(e) {
    e.preventDefault();
    if (p1Frames === p2Frames) {
      setError("Match cannot end in a draw in knockout format. Please record a deciding frame.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await completeMatch(match.match_id, frames, Number(winPoints), Number(lossPoints));
      if (onCompleteSuccess) onCompleteSuccess();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to record match completion");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-dialog" style={{ maxWidth: 640 }}>
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Swords size={20} color="var(--accent-green)" />
            <h3 className="modal-title">Live Match Scorer — Match #{match.match_id}</h3>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div className="alert alert-error">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            {/* Match Header with Live Frame Count */}
            <div style={{ padding: "16px 20px", background: "var(--bg-secondary)", borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ textAlign: "center", flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>
                  {match.player1_name || `Player #${match.player1_id}`}
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: p1Frames > p2Frames ? "var(--accent-green)" : "#fff" }}>
                  {p1Frames}
                </div>
              </div>

              <div style={{ padding: "0 16px", color: "var(--text-dim)", fontWeight: 700, fontSize: 14 }}>
                VS
              </div>

              <div style={{ textAlign: "center", flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>
                  {match.player2_name || `Player #${match.player2_id}`}
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: p2Frames > p1Frames ? "var(--accent-green)" : "#fff" }}>
                  {p2Frames}
                </div>
              </div>
            </div>

            {/* Frame Score Inputs */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span className="form-label" style={{ margin: 0 }}>Frame-by-Frame Scores</span>
                <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddFrame}>
                  <Plus size={14} /> Add Frame
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {frames.map((frame, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", background: "rgba(0,0,0,0.2)", borderRadius: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", width: 60 }}>Frame {idx + 1}</span>
                    <input
                      type="number"
                      min="0"
                      className="form-input"
                      style={{ flex: 1 }}
                      placeholder="Player 1 Pts"
                      value={frame.p1}
                      onChange={(e) => handleFrameChange(idx, "p1", e.target.value)}
                      required
                    />
                    <span style={{ color: "var(--text-dim)" }}>:</span>
                    <input
                      type="number"
                      min="0"
                      className="form-input"
                      style={{ flex: 1 }}
                      placeholder="Player 2 Pts"
                      value={frame.p2}
                      onChange={(e) => handleFrameChange(idx, "p2", e.target.value)}
                      required
                    />
                    <input
                      type="number"
                      min="0"
                      className="form-input"
                      style={{ width: 100 }}
                      placeholder="Highest Break"
                      value={frame.break}
                      onChange={(e) => handleFrameChange(idx, "break", e.target.value)}
                    />
                    {frames.length > 1 && (
                      <button type="button" onClick={() => handleRemoveFrame(idx)} style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer" }}>
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Ranking Points */}
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Winner Points Award</label>
                <input
                  type="number"
                  min="0"
                  className="form-input"
                  value={winPoints}
                  onChange={(e) => setWinPoints(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Loser Points Award</label>
                <input
                  type="number"
                  min="0"
                  className="form-input"
                  value={lossPoints}
                  onChange={(e) => setLossPoints(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Recording Match..." : "Finalize & Advance Winner"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
