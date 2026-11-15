import React, { useState } from "react";
import { login } from "../api";
import { AlertCircle, X } from "lucide-react";

const DEMO_ACCOUNTS = [
  { role: "Admin", label: "admin@example.com", email: "admin@example.com", badge: "role-admin" },
  { role: "Staff", label: "staff@example.com", email: "staff@example.com", badge: "role-staff" },
  { role: "Member", label: "member@example.com", email: "member@example.com", badge: "role-member" },
  { role: "Casual", label: "casual@example.com", email: "casual@example.com", badge: "role-casual" },
];

export default function LoginModal({ isOpen, onClose, onLoginSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

  function fillDemo(demoEmail) {
    setEmail(demoEmail);
    setPassword("cueclub_default");
    setError(null);
  }

  return (
    <div className="modal-overlay">
      <div className="modal-dialog" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <div>
            <h3 className="modal-title">Sign in to CueClub</h3>
            <p className="page-description">Enter your account credentials to access the platform</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
            title="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">
          {error && (
            <div className="alert alert-error">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-input"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-input"
                placeholder="Enter account password"
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

          <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Test Accounts Quick-Fill
              </span>
              <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
                pwd: <code style={{ color: "var(--accent-green)", background: "rgba(16, 185, 129, 0.1)", padding: "1px 4px", borderRadius: 3 }}>cueclub_default</code>
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.role}
                  type="button"
                  onClick={() => fillDemo(acc.email)}
                  className="btn btn-secondary btn-sm"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "6px 10px",
                    fontSize: 11
                  }}
                  title={`Quick-fill credentials for ${acc.role}`}
                >
                  <span style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{acc.label}</span>
                  <span className={`user-role-pill ${acc.badge}`} style={{ fontSize: 9, padding: "1px 5px", marginLeft: 4 }}>{acc.role}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
