import React, { useState, useEffect, useCallback } from "react";
import {
  getTournaments,
  createTournament,
  setTournamentStatus,
  registerTournamentPlayer,
  getTournamentRegistrations,
  getBracketTree,
  createMatch,
  getToken
} from "../api";
import { Plus, Users, GitBranch, AlertCircle, Check, Swords, CalendarPlus } from "lucide-react";

export default function TournamentsView({ currentUser, onOpenScorer }) {
  const canManage = currentUser?.app_role === "Admin" || currentUser?.app_role === "Staff";

  const [tournaments, setTournaments] = useState([]);
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [bracket, setBracket] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Tournament Create Modal
  const [createModal, setCreateModal] = useState(false);
  const [title, setTitle] = useState("");
  const [gameType, setGameType] = useState("Snooker");
  const [format, setFormat] = useState("Knockout");
  const [startDate, setStartDate] = useState("2026-12-01");
  const [entryFee, setEntryFee] = useState("200.00");

  // Player Registration Modal
  const [regModal, setRegModal] = useState(false);
  const [regUserId, setRegUserId] = useState(currentUser?.user_id || 1);
  const [regSeed, setRegSeed] = useState("1");
  const [regFeePaid, setRegFeePaid] = useState(true);

  // Match Creation Modal
  const [matchModal, setMatchModal] = useState(false);
  const [matchRound, setMatchRound] = useState("1");
  const [matchP1, setMatchP1] = useState("");
  const [matchP2, setMatchP2] = useState("");
  const [matchNextId, setMatchNextId] = useState("");
  const [matchTableId, setMatchTableId] = useState("");
  const [matchScheduled, setMatchScheduled] = useState("");

  const selectTournament = useCallback(async (tourn) => {
    setSelectedTournament(tourn);
    setError(null);
    try {
      const [regs, brk] = await Promise.all([
        getTournamentRegistrations(tourn.tournament_id),
        getBracketTree(tourn.tournament_id).catch(() => [])
      ]);
      setRegistrations(regs);
      setBracket(brk);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const loadTournaments = useCallback(async () => {
    if (!getToken()) {
      setTournaments([]);
      setSelectedTournament(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await getTournaments();
      setTournaments(list);
      if (list.length > 0) {
        // Retain or select first
        setSelectedTournament((prev) => {
          if (prev) {
            const found = list.find((t) => t.tournament_id === prev.tournament_id);
            if (found) return found;
          }
          selectTournament(list[0]);
          return list[0];
        });
      }
    } catch (err) {
      setError(err.message || "Failed to load tournaments");
    } finally {
      setLoading(false);
    }
  }, [selectTournament]);

  useEffect(() => {
    let ignore = false;
    async function init() {
      if (!getToken()) {
        setTournaments([]);
        setLoading(false);
        return;
      }
      try {
        const list = await getTournaments();
        if (!ignore) {
          setTournaments(list);
          if (list.length > 0) {
            selectTournament(list[0]);
          }
        }
      } catch (err) {
        if (!ignore) {
          setError(err.message || "Failed to load tournaments");
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
  }, [currentUser, selectTournament]);

  async function handleCreateTournament(e) {
    e.preventDefault();
    setError(null);
    try {
      await createTournament({
        title,
        game: gameType,
        format,
        start: startDate,
        fee: Number(entryFee)
      });
      setSuccess(`Tournament "${title}" created in Draft state!`);
      setTimeout(() => setSuccess(null), 3000);
      setCreateModal(false);
      loadTournaments();
    } catch (err) {
      setError(err.message || "Failed to create tournament");
    }
  }

  async function handleStatusChange(tournId, newStatus) {
    setError(null);
    try {
      await setTournamentStatus(tournId, newStatus);
      setSuccess(`Tournament status updated to ${newStatus}!`);
      setTimeout(() => setSuccess(null), 3000);
      loadTournaments();
      if (selectedTournament?.tournament_id === tournId) {
        setSelectedTournament({ ...selectedTournament, status: newStatus });
      }
    } catch (err) {
      setError(err.message || "Failed to transition tournament status");
    }
  }

  async function handleRegisterPlayer(e) {
    e.preventDefault();
    setError(null);
    try {
      await registerTournamentPlayer(
        selectedTournament.tournament_id,
        Number(regUserId),
        Number(regSeed),
        regFeePaid
      );
      setSuccess(`Player #${regUserId} registered for ${selectedTournament.title}!`);
      setTimeout(() => setSuccess(null), 3000);
      setRegModal(false);
      selectTournament(selectedTournament);
    } catch (err) {
      setError(err.message || "Player registration failed");
    }
  }

  async function handleCreateMatch(e) {
    e.preventDefault();
    setError(null);
    try {
      const formatSql = (isoStr) => (isoStr ? isoStr.replace("T", " ") + ":00" : null);
      await createMatch(selectedTournament.tournament_id, {
        roundNumber: Number(matchRound),
        player1Id: matchP1 ? Number(matchP1) : null,
        player2Id: matchP2 ? Number(matchP2) : null,
        nextMatchId: matchNextId ? Number(matchNextId) : null,
        tableId: matchTableId ? Number(matchTableId) : null,
        scheduledTime: formatSql(matchScheduled)
      });
      setSuccess(`Match created for Round ${matchRound}!`);
      setTimeout(() => setSuccess(null), 3000);
      setMatchModal(false);
      // Reset match form fields
      setMatchP1("");
      setMatchP2("");
      setMatchNextId("");
      setMatchTableId("");
      setMatchScheduled("");
      selectTournament(selectedTournament);
    } catch (err) {
      setError(err.message || "Failed to create match");
    }
  }

  // Group bracket matches by round_number
  const roundsMap = {};
  bracket.forEach((node) => {
    const round = node.round_number || 1;
    if (!roundsMap[round]) roundsMap[round] = [];
    roundsMap[round].push(node);
  });
  const roundKeys = Object.keys(roundsMap).sort((a, b) => Number(a) - Number(b));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Tournaments & Bracket Trees</h1>
          <p className="page-description">Championship events, player seedings, and real-time hierarchical bracket progression.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={loadTournaments} disabled={loading}>
            Refresh
          </button>
          {canManage && (
            <button className="btn btn-primary btn-sm" onClick={() => setCreateModal(true)}>
              <Plus size={16} />
              Create Tournament
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

      {/* Tournament Cards Carousel / Grid */}
      <div className="grid-3" style={{ marginBottom: 30 }}>
        {tournaments.map((t) => {
          const isSelected = selectedTournament?.tournament_id === t.tournament_id;
          return (
            <div
              key={t.tournament_id}
              className="card"
              onClick={() => selectTournament(t)}
              style={{
                cursor: "pointer",
                borderColor: isSelected ? "var(--accent-green)" : "var(--border)",
                background: isSelected ? "rgba(16, 185, 129, 0.05)" : "var(--bg-card)",
                transition: "all 0.15s ease"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <span className={`badge badge-${(t.status || "draft").toLowerCase()}`}>
                  {t.status}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-green)" }}>
                  {t.game_type}
                </span>
              </div>

              <h3 style={{ fontSize: 17, fontWeight: 700, color: "#fff", marginBottom: 6 }}>
                {t.title}
              </h3>
              <div style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", gap: 14 }}>
                <span>Format: <strong>{t.format}</strong></span>
                <span>Fee: <strong>₹{t.entry_fee}</strong></span>
              </div>

              {canManage && (
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)", display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {t.status === "Draft" && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={(e) => { e.stopPropagation(); handleStatusChange(t.tournament_id, "Registration"); }}
                    >
                      Open Registration
                    </button>
                  )}
                  {t.status === "Registration" && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={(e) => { e.stopPropagation(); handleStatusChange(t.tournament_id, "Ongoing"); }}
                    >
                      Start Tournament
                    </button>
                  )}
                  {["Draft", "Registration", "Ongoing"].includes(t.status) && (
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={(e) => { e.stopPropagation(); handleStatusChange(t.tournament_id, "Cancelled"); }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Selected Tournament Detail View */}
      {selectedTournament && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div>
              <h2 className="card-title" style={{ marginBottom: 4 }}>
                {selectedTournament.title} — Bracket & Registered Roster
              </h2>
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                Start Date: {new Date(selectedTournament.start_date).toLocaleDateString()} | Registered Players: {registrations.length}
              </span>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              {selectedTournament.status === "Registration" && currentUser?.app_role !== "Casual" && (
                <button className="btn btn-secondary btn-sm" onClick={() => setRegModal(true)}>
                  <Users size={14} />
                  Register Player
                </button>
              )}
              {canManage && !["Completed", "Cancelled"].includes(selectedTournament.status) && (
                <button className="btn btn-primary btn-sm" onClick={() => setMatchModal(true)}>
                  <CalendarPlus size={14} />
                  Create Match
                </button>
              )}
            </div>
          </div>

          {/* Interactive Bracket Tree */}
          <div style={{ marginTop: 10 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-muted)", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <GitBranch size={16} color="var(--accent-green)" />
              Binary Elimination Bracket Tree
            </h3>

            {roundKeys.length === 0 ? (
              <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-dim)", background: "var(--bg-secondary)", borderRadius: 8 }}>
                No match nodes constructed yet for this tournament. Use &quot;Create Match&quot; to build the bracket structure.
              </div>
            ) : (
              <div className="bracket-wrapper">
                {roundKeys.map((roundNum) => (
                  <div key={roundNum} className="bracket-round">
                    <div className="bracket-round-title">
                      {roundNum === String(roundKeys.length) ? "🏆 Grand Final" : `Round ${roundNum}`}
                    </div>
                    {roundsMap[roundNum].map((match) => (
                      <div key={match.match_id} className="bracket-match">
                        <div style={{ padding: "6px 12px", background: "rgba(0,0,0,0.3)", display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-dim)" }}>
                          <span>Match #{match.match_id}</span>
                          <span style={{ color: match.status === "Completed" ? "var(--accent-purple)" : "var(--accent-green)" }}>
                            {match.status}
                          </span>
                        </div>
                        <div className={`bracket-player ${match.winner_id === match.player1_id && match.winner_id ? "winner" : ""}`}>
                          <span>{match.player1_name || (match.player1_id ? `Player #${match.player1_id}` : "TBD")}</span>
                          <strong>{match.winner_id === match.player1_id ? "WIN" : ""}</strong>
                        </div>
                        <div className={`bracket-player ${match.winner_id === match.player2_id && match.winner_id ? "winner" : ""}`}>
                          <span>{match.player2_name || (match.player2_id ? `Player #${match.player2_id}` : "TBD")}</span>
                          <strong>{match.winner_id === match.player2_id ? "WIN" : ""}</strong>
                        </div>

                        {canManage && match.status !== "Completed" && (
                          <div style={{ padding: "6px 10px", background: "rgba(0,0,0,0.2)", borderTop: "1px solid var(--border)" }}>
                            <button
                              className="btn btn-primary btn-sm"
                              style={{ width: "100%", fontSize: 11, padding: "4px 8px" }}
                              onClick={() => onOpenScorer && onOpenScorer(match)}
                            >
                              <Swords size={12} />
                              Score Match
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Tournament Modal */}
      {createModal && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 className="modal-title">Create Championship Tournament</h3>
            </div>
            <form onSubmit={handleCreateTournament}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Tournament Title</label>
                  <input className="form-input" placeholder="e.g. BITS Autumn Snooker Open 2026" value={title} onChange={(e) => setTitle(e.target.value)} required />
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Game Type</label>
                    <select className="form-select" value={gameType} onChange={(e) => setGameType(e.target.value)}>
                      <option value="Snooker">Snooker</option>
                      <option value="Pool">Pool</option>
                      <option value="Billiards">Billiards</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Format</label>
                    <select className="form-select" value={format} onChange={(e) => setFormat(e.target.value)}>
                      <option value="Knockout">Knockout (Single Elimination)</option>
                      <option value="League">League (Round Robin)</option>
                    </select>
                  </div>
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Start Date</label>
                    <input type="date" className="form-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Entry Fee (₹)</label>
                    <input type="number" min="0" className="form-input" value={entryFee} onChange={(e) => setEntryFee(e.target.value)} required />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setCreateModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Tournament</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Register Player Modal */}
      {regModal && selectedTournament && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 className="modal-title">Register Player for {selectedTournament.title}</h3>
            </div>
            <form onSubmit={handleRegisterPlayer}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Player User ID</label>
                  <input type="number" className="form-input" value={regUserId} onChange={(e) => setRegUserId(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Seed Number</label>
                  <input type="number" min="1" className="form-input" value={regSeed} onChange={(e) => setRegSeed(e.target.value)} required />
                </div>
                <div className="form-group" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input type="checkbox" id="feePaid" checked={regFeePaid} onChange={(e) => setRegFeePaid(e.target.checked)} />
                  <label htmlFor="feePaid" style={{ fontSize: 13, color: "var(--text-main)" }}>Entry Fee Paid (₹{selectedTournament.entry_fee})</label>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setRegModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Register Player</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Match Modal */}
      {matchModal && selectedTournament && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 className="modal-title">Create Match — {selectedTournament.title}</h3>
              <p className="page-description">Add a bracket match node and link feeder progression</p>
            </div>
            <form onSubmit={handleCreateMatch}>
              <div className="modal-body">
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Round Number</label>
                    <input
                      type="number"
                      min="1"
                      className="form-input"
                      value={matchRound}
                      onChange={(e) => setMatchRound(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Table ID (Optional)</label>
                    <input
                      type="number"
                      min="1"
                      className="form-input"
                      placeholder="e.g. 1"
                      value={matchTableId}
                      onChange={(e) => setMatchTableId(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Player 1 User ID (Optional/TBD)</label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="e.g. 3"
                      value={matchP1}
                      onChange={(e) => setMatchP1(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Player 2 User ID (Optional/TBD)</label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="e.g. 4"
                      value={matchP2}
                      onChange={(e) => setMatchP2(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Next Round Match ID (Optional Feeder)</label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="e.g. 10"
                      value={matchNextId}
                      onChange={(e) => setMatchNextId(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Scheduled Time (Optional)</label>
                    <input
                      type="datetime-local"
                      className="form-input"
                      value={matchScheduled}
                      onChange={(e) => setMatchScheduled(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setMatchModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Match</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
