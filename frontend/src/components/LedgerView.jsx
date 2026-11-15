import React, { useState, useEffect } from "react";
import { getMemberBalance, getLedgerEntries, recordCharge, recordPayment, registerMember, registerCasual } from "../api";
import { CreditCard, DollarSign, PlusCircle, ArrowUpRight, ArrowDownLeft, AlertCircle, Check, UserPlus } from "lucide-react";

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
  const [mNo, setMNo] = useState("");
  const [mPlan, setMPlan] = useState("Annual");
  const [mDiscount, setMDiscount] = useState("10");
  const [mCreditLimit, setMCreditLimit] = useState("3000");

  useEffect(() => {
    loadLedgerData();
  }, [selectedUserId]);

  async function loadLedgerData() {
    setLoading(true);
    setError(null);
    try {
      const targetId = isMember ? currentUser.user_id : selectedUserId;
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
  }

  async function handlePostCharge(e) {
    e.preventDefault();
    setError(null);
    try {
      const res = await recordCharge(Number(selectedUserId), chargeType, Number(chargeAmount), chargeNote);
      setSuccess(`Charge of ₹${chargeAmount} recorded successfully (Entry #${res.data?.entry_id})`);
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
        password: "cueclub_default"
      });

      setSuccess(`Member ${mName} onboarded successfully with ID #${res.data?.userId}!`);
      setMemberRegModal(false);
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

      {canManage && (
        <div className="card" style={{ padding: "14px 20px", display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)" }}>Inspect Member User ID:</span>
          <input
            type="number"
            className="form-input"
            style={{ width: 120, padding: "6px 10px" }}
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
          />
          <button className="btn btn-secondary btn-sm" onClick={loadLedgerData}>
            Load Member
          </button>
        </div>
      )}

      {/* Financial Overview Cards */}
      {balance && (
        <div className="grid-4" style={{ marginBottom: 28 }}>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: "rgba(239, 68, 68, 0.15)", color: "#f87171" }}>
              <DollarSign size={24} />
            </div>
            <div>
              <div className="stat-label">Outstanding Udhar (Due)</div>
              <div className="stat-value" style={{ color: "#f87171" }}>₹{Number(balance.current_balance || balance.outstanding_balance || 0).toFixed(2)}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: "rgba(59, 130, 246, 0.15)", color: "#60a5fa" }}>
              <CreditCard size={24} />
            </div>
            <div>
              <div className="stat-label">Credit Limit</div>
              <div className="stat-value">₹{Number(balance.credit_limit || 0).toFixed(2)}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#34d399" }}>
              <Check size={24} />
            </div>
            <div>
              <div className="stat-label">Available Headroom</div>
              <div className="stat-value" style={{ color: "var(--accent-green)" }}>
                ₹{(Number(balance.credit_limit || 0) - Number(balance.current_balance || balance.outstanding_balance || 0)).toFixed(2)}
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: "rgba(245, 158, 11, 0.15)", color: "#fbbf24" }}>
              <CreditCard size={24} />
            </div>
            <div>
              <div className="stat-label">Membership Tier</div>
              <div className="stat-value" style={{ fontSize: 18 }}>{balance.plan || "Annual"} ({balance.discount_pct || 0}% Off)</div>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Statement Table */}
      <div className="card">
        <h2 className="card-title">Transaction Ledger History</h2>
        {entries.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px 0", color: "var(--text-dim)" }}>
            No transaction records found for this member.
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Entry ID</th>
                  <th>Timestamp</th>
                  <th>Type</th>
                  <th>Description / Note</th>
                  <th>Reservation Ref</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const isCredit = entry.entry_type === "Payment";
                  return (
                    <tr key={entry.entry_id}>
                      <td>#{entry.entry_id}</td>
                      <td>{new Date(entry.created_at || entry.timestamp).toLocaleString()}</td>
                      <td>
                        <span className={`badge ${isCredit ? "badge-ongoing" : entry.entry_type === "Fine" ? "badge-cancelled" : "badge-registration"}`}>
                          {entry.entry_type}
                        </span>
                      </td>
                      <td>{entry.note || "—"}</td>
                      <td>{entry.reservation_id ? `#${entry.reservation_id}` : "Direct Transaction"}</td>
                      <td>
                        <strong style={{ color: isCredit ? "var(--accent-green)" : "#f87171" }}>
                          {isCredit ? "- " : "+ "}₹{Number(entry.amount).toFixed(2)}
                        </strong>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Charge Modal */}
      {chargeModal && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 className="modal-title">Record Non-Booking Charge (User #{selectedUserId})</h3>
            </div>
            <form onSubmit={handlePostCharge}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Charge Type</label>
                  <select className="form-select" value={chargeType} onChange={(e) => setChargeType(e.target.value)}>
                    <option value="Canteen charge">Canteen charge</option>
                    <option value="Fine">Fine (Club penalty)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    className="form-input"
                    value={chargeAmount}
                    onChange={(e) => setChargeAmount(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Note / Invoice Reference</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Snack bar bill or late table fine"
                    value={chargeNote}
                    onChange={(e) => setChargeNote(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setChargeModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Submit Charge</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {paymentModal && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 className="modal-title">Record Member Payment (User #{selectedUserId})</h3>
            </div>
            <form onSubmit={handlePostPayment}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Payment Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    className="form-input"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Note / Receipt Number</label>
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
                    <label className="form-label">Membership Card #</label>
                    <input className="form-input" placeholder="e.g. CM-009" value={mNo} onChange={(e) => setMNo(e.target.value)} required />
                  </div>
                </div>
                <div className="grid-3">
                  <div className="form-group">
                    <label className="form-label">Plan Tier</label>
                    <select className="form-select" value={mPlan} onChange={(e) => setMPlan(e.target.value)}>
                      <option value="Monthly">Monthly</option>
                      <option value="Quarterly">Quarterly</option>
                      <option value="Annual">Annual</option>
                    </select>
                  </div>
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
