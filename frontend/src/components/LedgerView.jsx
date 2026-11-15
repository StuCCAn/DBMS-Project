import React, { useState, useEffect, useCallback } from "react";
import { getMemberBalance, getLedgerEntries, recordCharge, recordPayment, registerMember, getToken } from "../api";
import { CreditCard, DollarSign, ArrowUpRight, ArrowDownLeft, AlertCircle, Check, UserPlus } from "lucide-react";

export default function LedgerView({ currentUser }) {
  const isMember = currentUser?.app_role === "Member";
  const canManage = currentUser?.app_role === "Admin" || currentUser?.app_role === "Staff";

  const [selectedUserId, setSelectedUserId] = useState(currentUser?.user_id || 3);
  const [balance, setBalance] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Modals
  const [chargeModal, setChargeModal] = useState(false);
  const [chargeType, setChargeType] = useState("Canteen charge");
  const [chargeAmount, setChargeAmount] = useState("");
  const [chargeNote, setChargeNote] = useState("");

  const [paymentModal, setPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNote, setPaymentNote] = useState("");

  const [memberRegModal, setMemberRegModal] = useState(false);
  const [mName, setMName] = useState("");
  const [mPhone, setMPhone] = useState("");
  const [mEmail, setMEmail] = useState("");
  const [mPassword, setMPassword] = useState("");
  const [mNo, setMNo] = useState("");
  const [mPlan, setMPlan] = useState("Annual");
  const [mDiscount, setMDiscount] = useState("10");
  const [mCreditLimit, setMCreditLimit] = useState("3000");

  const loadLedgerData = useCallback(async () => {
    if (!getToken()) {
      setBalance(null);
      setEntries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const targetId = isMember ? currentUser?.user_id : selectedUserId;
      const [bal, ent] = await Promise.all([
        getMemberBalance(targetId).catch(() => null),
        getLedgerEntries(isMember ? null : targetId)
      ]);
      setBalance(bal);
      setEntries(ent);
    } catch (err) {
      setError(err.message || "Failed to load ledger data");
    } finally {
      setLoading(false);
    }
  }, [currentUser, isMember, selectedUserId]);

  useEffect(() => {
    let ignore = false;
    async function init() {
      if (!getToken()) {
        setBalance(null);
        setEntries([]);
        setLoading(false);
        return;
      }
      try {
        const targetId = isMember ? currentUser?.user_id : selectedUserId;
        const [bal, ent] = await Promise.all([
          getMemberBalance(targetId).catch(() => null),
          getLedgerEntries(isMember ? null : targetId)
        ]);
        if (!ignore) {
          setBalance(bal);
          setEntries(ent);
        }
      } catch (err) {
        if (!ignore) {
          setError(err.message || "Failed to load ledger data");
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
  }, [selectedUserId, isMember, currentUser]);

  function generatePassword() {
    const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$";
    let pwd = "";
    for (let i = 0; i < 10; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setMPassword(pwd);
  }

  async function handlePostCharge(e) {
    e.preventDefault();
    setError(null);
    try {
      const res = await recordCharge(Number(selectedUserId), chargeType, Number(chargeAmount), chargeNote);
      setSuccess(`Charge of ₹${chargeAmount} recorded successfully (Entry #${res.data?.entry_id})`);
      setTimeout(() => setSuccess(null), 3000);
      setChargeModal(false);
      setChargeAmount("");
      setChargeNote("");
      loadLedgerData();
    } catch (err) {
      setError(err.message || "Failed to record charge");
    }
  }

  async function handlePostPayment(e) {
    e.preventDefault();
    setError(null);
    try {
      const res = await recordPayment(Number(selectedUserId), Number(paymentAmount), paymentNote);
      setSuccess(`Payment of ₹${paymentAmount} settled successfully (Entry #${res.data?.entry_id})`);
      setTimeout(() => setSuccess(null), 3000);
      setPaymentModal(false);
      setPaymentAmount("");
      setPaymentNote("");
      loadLedgerData();
    } catch (err) {
      setError(err.message || "Failed to record payment");
    }
  }

  async function handleRegisterMember(e) {
    e.preventDefault();
    setError(null);

    if (!mPassword || mPassword.length < 6) {
      setError("Member account password must be at least 6 characters long.");
      return;
    }

    try {
      const today = new Date().toISOString().split("T")[0];
      const nextYear = new Date();
      nextYear.setFullYear(nextYear.getFullYear() + 1);
      const nextYearStr = nextYear.toISOString().split("T")[0];

      const res = await registerMember({
        name: mName,
        phone: mPhone,
        email: mEmail,
        membershipNo: mNo,
        plan: mPlan,
        startDate: today,
        endDate: nextYearStr,
        discountPct: Number(mDiscount),
        creditLimit: Number(mCreditLimit),
        password: mPassword
      });

      setSuccess(`Member ${mName} onboarded successfully with ID #${res.data?.userId}!`);
      setTimeout(() => setSuccess(null), 3000);
      setMemberRegModal(false);
      // Reset form
      setMName("");
      setMPhone("");
      setMEmail("");
      setMPassword("");
      setMNo("");
      setSelectedUserId(res.data?.userId);
    } catch (err) {
      setError(err.message || "Failed to register member");
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Member Credit Ledger & Financials</h1>
          <p className="page-description">Credit accounts, non-booking charges (canteen & fines), and payment settlements.</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-secondary btn-sm" onClick={loadLedgerData} disabled={loading}>
            Refresh
          </button>
          {canManage && (
            <>
              <button className="btn btn-secondary btn-sm" onClick={() => setMemberRegModal(true)}>
                <UserPlus size={14} />
                Onboard Member
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setChargeModal(true)}>
                <ArrowUpRight size={14} />
                Record Charge
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => setPaymentModal(true)}>
                <ArrowDownLeft size={14} />
                Record Payment
              </button>
            </>
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

      {/* Target Member Picker for Admin/Staff */}
      {canManage && (
        <div className="card" style={{ marginBottom: 24, padding: "14px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)" }}>Inspect Member Ledger:</span>
            <input
              type="number"
              className="form-input"
              style={{ width: 140 }}
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              placeholder="User ID"
            />
            <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
              (e.g. 3 = Aarav Nair, 4 = Priya Sharma, 5 = Rohan Verma)
            </span>
          </div>
        </div>
      )}

      {/* Balance Summary Cards */}
      <div className="grid-3" style={{ marginBottom: 30 }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "rgba(239, 68, 68, 0.15)", color: "#f87171" }}>
            <CreditCard size={24} />
          </div>
          <div>
            <div className="stat-label">Outstanding Udhar / Balance</div>
            <div className="stat-value" style={{ color: Number(balance?.outstanding_balance || 0) > 0 ? "#f87171" : "var(--accent-green)" }}>
              ₹{Number(balance?.outstanding_balance || 0).toFixed(2)}
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: "rgba(16, 185, 129, 0.15)", color: "var(--accent-green)" }}>
            <DollarSign size={24} />
          </div>
          <div>
            <div className="stat-label">Total Lifetime Spend</div>
            <div className="stat-value">₹{Number(balance?.total_spent || 0).toFixed(2)}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: "rgba(59, 130, 246, 0.15)", color: "#60a5fa" }}>
            <CreditCard size={24} />
          </div>
          <div>
            <div className="stat-label">Credit Limit (Max Allowed)</div>
            <div className="stat-value">₹{Number(balance?.credit_limit || 0).toFixed(2)}</div>
            <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>
              Available: ₹{Math.max(0, Number(balance?.credit_limit || 0) - Number(balance?.outstanding_balance || 0)).toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Ledger Entries Table */}
      <div className="card">
        <h2 className="card-title">Transaction & Settlement History</h2>
        {entries.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px 0", color: "var(--text-dim)" }}>
            {loading ? "Loading transactions..." : "No ledger entries found for this member."}
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Entry #</th>
                  <th>Timestamp</th>
                  <th>Member</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Description / Notes</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.entry_id}>
                    <td>#{entry.entry_id}</td>
                    <td>{new Date(entry.entry_timestamp).toLocaleString()}</td>
                    <td>
                      <strong>{entry.user_name || `User #${entry.user_id}`}</strong>
                    </td>
                    <td>
                      <span className={`badge badge-${entry.entry_type === "Payment" ? "completed" : "pending"}`}>
                        {entry.entry_type}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700, color: entry.entry_type === "Payment" ? "var(--accent-green)" : "#f87171" }}>
                      {entry.entry_type === "Payment" ? "-" : "+"}₹{Number(entry.amount).toFixed(2)}
                    </td>
                    <td>{entry.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Charge Modal */}
      {chargeModal && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 className="modal-title">Record Club Charge</h3>
              <p className="page-description">Post debit against Member #{selectedUserId}&apos;s credit ledger</p>
            </div>
            <form onSubmit={handlePostCharge}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Charge Category</label>
                  <select className="form-select" value={chargeType} onChange={(e) => setChargeType(e.target.value)}>
                    <option value="Canteen charge">Canteen charge</option>
                    <option value="Fine">Fine (Equipment damage / Late fee / Penalty)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Amount (₹)</label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    className="form-input"
                    placeholder="e.g. 150.00"
                    value={chargeAmount}
                    onChange={(e) => setChargeAmount(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Note / Item Description</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Canteen bill: Red Bull & snacks"
                    value={chargeNote}
                    onChange={(e) => setChargeNote(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setChargeModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Post Charge</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {paymentModal && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 className="modal-title">Settle Member Payment</h3>
              <p className="page-description">Credit payment towards outstanding balance of Member #{selectedUserId}</p>
            </div>
            <form onSubmit={handlePostPayment}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Settlement Amount (₹)</label>
                  <input
                    type="number"
                    min="0.01"
                    max={balance?.outstanding_balance || 99999}
                    step="0.01"
                    className="form-input"
                    placeholder="e.g. 500.00"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    required
                  />
                  <span style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4, display: "block" }}>
                    Rule trg_ledger_bi: Payment cannot exceed outstanding balance (Current: ₹{Number(balance?.outstanding_balance || 0).toFixed(2)})
                  </span>
                </div>
                <div className="form-group">
                  <label className="form-label">Payment Reference / Note</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. UPI Ref / Cash receipt #1042"
                    value={paymentNote}
                    onChange={(e) => setPaymentNote(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setPaymentModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Record Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Member Onboarding Modal */}
      {memberRegModal && (
        <div className="modal-overlay">
          <div className="modal-dialog" style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h3 className="modal-title">Onboard New Club Member</h3>
            </div>
            <form onSubmit={handleRegisterMember}>
              <div className="modal-body">
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Full Name</label>
                    <input className="form-input" value={mName} onChange={(e) => setMName(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone Number</label>
                    <input className="form-input" value={mPhone} onChange={(e) => setMPhone(e.target.value)} required />
                  </div>
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <input type="email" className="form-input" value={mEmail} onChange={(e) => setMEmail(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <label className="form-label" style={{ margin: 0 }}>Initial Password (min 6)</label>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ padding: "2px 8px", fontSize: 11 }}
                        onClick={generatePassword}
                      >
                        Generate
                      </button>
                    </div>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Custom password or click Generate"
                      value={mPassword}
                      minLength={6}
                      onChange={(e) => setMPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Membership Card #</label>
                    <input className="form-input" placeholder="e.g. CM-009" value={mNo} onChange={(e) => setMNo(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Plan Tier</label>
                    <select className="form-select" value={mPlan} onChange={(e) => setMPlan(e.target.value)}>
                      <option value="Monthly">Monthly</option>
                      <option value="Quarterly">Quarterly</option>
                      <option value="Annual">Annual</option>
                    </select>
                  </div>
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Discount %</label>
                    <input type="number" min="0" max="100" className="form-input" value={mDiscount} onChange={(e) => setMDiscount(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Credit Limit (₹)</label>
                    <input type="number" min="0" className="form-input" value={mCreditLimit} onChange={(e) => setMCreditLimit(e.target.value)} required />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setMemberRegModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Register Member</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
