import React, { useState } from "react";
import { login, register } from "../api";
import { AlertCircle, X, UserPlus, LogIn } from "lucide-react";

const DEMO_ACCOUNTS = [
  { role: "Admin", label: "admin@example.com", email: "admin@example.com", badge: "role-admin" },
  { role: "Staff", label: "staff@example.com", email: "staff@example.com", badge: "role-staff" },
  { role: "Member", label: "member@example.com", email: "member@example.com", badge: "role-member" },
  { role: "Casual", label: "casual@example.com", email: "casual@example.com", badge: "role-casual" },
];

export default function LoginModal({ isOpen, onClose, onLoginSuccess, initialMode = "login" }) {
  const [mode, setMode] = useState(initialMode); // 'login' | 'register'

  // Login state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Register state
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regRole, setRegRole] = useState("Member");

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

  async function handleRegister(e) {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await register({
        name: regName,
        email: regEmail,
        password: regPassword,
        phone: regPhone,
        role: regRole
      });
      onLoginSuccess(res.user);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to create account");
    } finally {
      setLoading(false);
    }
  }

  function handleSelectEmail(selectedEmail) {
    setEmail(selectedEmail);
    setError(null);
  }

  return (
    <div className="modal-overlay">
      <div className="modal-dialog" style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <div>
            <h3 className="modal-title">
              {mode === "login" ? "Sign in to CueClub" : "Create CueClub Account"}
            </h3>
            <p className="page-description">
              {mode === "login"
                ? "Enter your account credentials to access the platform"
                : "Register a new player account to start playing"}
            </p>
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

        {/* Tab switcher: Sign In vs Sign Up */}
        <div style={{ display: "flex", gap: 8, padding: "0 24px", marginTop: 4, marginBottom: 16 }}>
          <button
            type="button"
            onClick={() => { setMode("login"); setError(null); }}
            className={`btn btn-sm ${mode === "login" ? "btn-primary" : "btn-secondary"}`}
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
          >
            <LogIn size={14} /> Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode("register"); setError(null); }}
            className={`btn btn-sm ${mode === "register" ? "btn-primary" : "btn-secondary"}`}
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
          >
            <UserPlus size={14} /> Sign Up
          </button>
        </div>

        <div className="modal-body" style={{ paddingTop: 0 }}>
          {error && (
            <div className="alert alert-error">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {mode === "login" ? (
            <>
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
                    Test Accounts
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
                    Password: <code>cueclub_default</code>
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {DEMO_ACCOUNTS.map((acc) => (
                    <button
                      key={acc.role}
                      type="button"
                      onClick={() => handleSelectEmail(acc.email)}
                      className="btn btn-secondary btn-sm"
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "6px 10px",
                        fontSize: 11
                      }}
                      title={`Use ${acc.email}`}
                    >
                      <span style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{acc.label}</span>
                      <span className={`user-role-pill ${acc.badge}`} style={{ fontSize: 9, padding: "1px 5px", marginLeft: 4 }}>{acc.role}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ textAlign: "center", marginTop: 16 }}>
                <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
                  Need a new account?{" "}
                  <button
                    type="button"
                    onClick={() => { setMode("register"); setError(null); }}
                    style={{ background: "none", border: "none", color: "var(--accent-green)", fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}
                  >
                    Sign up here
                  </button>
                </span>
              </div>
            </>
          ) : (
            <>
              <form onSubmit={handleRegister}>
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Sameer Khanna"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="sameer@example.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input
                    type="tel"
                    className="form-input"
                    placeholder="e.g. 9876543210"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Password (min 6 characters)</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="Choose a password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Membership Type</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div
                      onClick={() => setRegRole("Member")}
                      style={{
                        padding: 10,
                        borderRadius: 6,
                        border: `1.5px solid ${regRole === "Member" ? "var(--accent-green)" : "var(--border)"}`,
                        background: regRole === "Member" ? "rgba(16, 185, 129, 0.1)" : "var(--bg-secondary)",
                        cursor: "pointer",
                        transition: "all 0.15s ease"
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 13, color: regRole === "Member" ? "var(--accent-green)" : "var(--text-main)" }}>
                        Club Member
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>
                        Book on credit, tracking, full club access
                      </div>
                    </div>

                    <div
                      onClick={() => setRegRole("Casual")}
                      style={{
                        padding: 10,
                        borderRadius: 6,
                        border: `1.5px solid ${regRole === "Casual" ? "var(--accent-green)" : "var(--border)"}`,
                        background: regRole === "Casual" ? "rgba(16, 185, 129, 0.1)" : "var(--bg-secondary)",
                        cursor: "pointer",
                        transition: "all 0.15s ease"
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 13, color: regRole === "Casual" ? "var(--accent-green)" : "var(--text-main)" }}>
                        Casual Player
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>
                        Pay-and-play, view availability & brackets
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                  style={{ width: "100%", marginTop: 10 }}
                >
                  {loading ? "Creating Account..." : "Create Account & Sign In"}
                </button>
              </form>

              <div style={{ textAlign: "center", marginTop: 16 }}>
                <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => { setMode("login"); setError(null); }}
                    style={{ background: "none", border: "none", color: "var(--accent-green)", fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}
                  >
                    Sign in here
                  </button>
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
