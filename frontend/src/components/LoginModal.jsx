import React, { useState } from "react";
import { login } from "../api";
import { Shield, User, KeyRound, AlertCircle, CheckCircle } from "lucide-react";

const DEMO_PERSONAS = [
  { role: "Admin", name: "Rohan Mehta", email: "rohan@example.com", badge: "role-admin", desc: "Full administrative control, diagnostics, user management" },
  { role: "Staff", name: "Imran Sheikh", email: "imran@example.com", badge: "role-staff", desc: "Match scorer, table manager, ledger charges & payments" },
  { role: "Member", name: "Aarav Nair", email: "aarav@example.com", badge: "role-member", desc: "Book on credit, view own balance & coaching progress" },
  { role: "Casual", name: "Vikram Singh", email: "vikram@example.com", badge: "role-casual", desc: "Pay-and-play casual player, view tables & leaderboard" },
];

export default function LoginModal({ isOpen, onClose, onLoginSuccess }) {
  const [email, setEmail] = useState("rohan@example.com");
  const [password, setPassword] = useState("cueclub_default");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  async function handleLogin(e) {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await login(email, password);
      onLoginSuccess(res.user);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to log in");
    } finally {
      setLoading(false);
    }
  }

  function handlePersonaSelect(persona) {
    setEmail(persona.email);
    setPassword("cueclub_default");
    setError(null);
  }

  return (
    <div className="modal-overlay">
      <div className="modal-dialog" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <div>
            <h3 className="modal-title">Sign in to CueClub</h3>
            <p className="page-description">Select a pre-configured persona or enter custom credentials</p>
          </div>
        </div>
        <div className="modal-body">
          {error && (
            <div className="alert alert-error">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div style={{ marginBottom: 20 }}>
            <span className="form-label" style={{ marginBottom: 10 }}>Quick-Select Test Persona</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {DEMO_PERSONAS.map((p) => (
                <div
                  key={p.role}
                  onClick={() => handlePersonaSelect(p)}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: email === p.email ? "1px solid var(--accent-green)" : "1px solid var(--border)",
                    background: email === p.email ? "rgba(16, 185, 129, 0.08)" : "var(--bg-secondary)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between"
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 600, color: "#fff", fontSize: 13 }}>{p.name}</span>
                      <span className={`user-role-pill ${p.badge}`}>{p.role}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>{p.desc}</div>
                  </div>
                  {email === p.email && <CheckCircle size={16} color="var(--accent-green)" />}
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: "100%", marginTop: 10 }}
            >
              {loading ? "Authenticating..." : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
