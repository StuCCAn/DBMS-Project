import React, { useState, useEffect } from "react";
import { getTables, setTableStatus, getReservations, createReservation, cancelReservation } from "../api";
import { PlayCircle, Clock, Calendar, Check, AlertCircle, Wrench, X, ShieldAlert } from "lucide-react";

export default function TablesView({ currentUser }) {
  const [tables, setTables] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Booking Modal State
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState(null);
  const [targetUserId, setTargetUserId] = useState(currentUser?.user_id || 1);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [billingMode, setBillingMode] = useState("Hourly");
  const [framesPlayed, setFramesPlayed] = useState(0);
  const [paymentStatus, setPaymentStatus] = useState(currentUser?.app_role === "Member" ? "OnCredit" : "Cash");
  const [submittingBooking, setSubmittingBooking] = useState(false);

  const canManageTables = currentUser?.app_role === "Admin" || currentUser?.app_role === "Staff";
  const canBook = currentUser?.app_role !== "Casual" || true; // Casuals can book with Cash/Pending

  useEffect(() => {
    loadData();
    // Default start/end time
    const now = new Date();
    now.setMinutes(0, 0, 0);
    const inTwoHours = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const formatDt = (d) => {
      const pad = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    setStartTime(formatDt(now));
    setEndTime(formatDt(inTwoHours));
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [tList, rList] = await Promise.all([getTables(), getReservations()]);
      setTables(tList);
      setReservations(rList);
    } catch (err) {
      setError(err.message || "Failed to load table data");
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleStatus(table) {
    const nextStatus = table.status === "Available" ? "Maintenance" : "Available";
    try {
      await setTableStatus(table.table_id, nextStatus);
      setSuccess(`Table ${table.table_number} status updated to ${nextStatus}`);
      setTimeout(() => setSuccess(null), 3000);
      loadData();
    } catch (err) {
      setError(err.message || "Failed to change table status");
    }
  }

  function openBookingModal(table) {
    setSelectedTable(table);
    setTargetUserId(currentUser?.user_id || 1);
    setPaymentStatus(currentUser?.app_role === "Member" ? "OnCredit" : "Cash");
    setBookingModalOpen(true);
    setError(null);
  }

  async function handleCreateBooking(e) {
    e.preventDefault();
    setSubmittingBooking(true);
    setError(null);

    // Format datetime string: "YYYY-MM-DD HH:mm:ss"
    const formatSql = (isoStr) => isoStr.replace("T", " ") + ":00";

    try {
      await createReservation({
        userId: Number(targetUserId),
        tableId: selectedTable.table_id,
        startTime: formatSql(startTime),
        endTime: formatSql(endTime),
        billingMode,
        framesPlayed: billingMode === "PerFrame" ? Number(framesPlayed) : 0,
        paymentStatus
      });

      setSuccess(`Booking confirmed for ${selectedTable.table_name || selectedTable.table_number}!`);
      setTimeout(() => setSuccess(null), 3000);
      setBookingModalOpen(false);
      loadData();
    } catch (err) {
      setError(err.message || "Booking failed");
    } finally {
      setSubmittingBooking(false);
    }
  }

  async function handleCancelBooking(resId) {
    if (!window.confirm(`Are you sure you want to cancel reservation #${resId}?`)) return;
    try {
      const res = await cancelReservation(resId);
      const refund = res.data?.refund_amount;
      setSuccess(`Reservation #${resId} cancelled.${refund > 0 ? ` Refund credited: ₹${refund}` : ""}`);
      setTimeout(() => setSuccess(null), 4000);
      loadData();
    } catch (err) {
      setError(err.message || "Failed to cancel reservation");
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Game Tables & Bookings</h1>
          <p className="page-description">Real-time table availability, hourly & per-frame rates, and reservation scheduling.</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={loadData} disabled={loading}>
          Refresh
        </button>
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

      {/* Table Cards Grid */}
      <h2 className="card-title">Available Tables ({tables.length})</h2>
      <div className="grid-3" style={{ marginBottom: 32 }}>
        {tables.map((t) => (
          <div key={t.table_id} className="card" style={{ padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--accent-green)" }}>
                  {t.game_type}
                </span>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginTop: 2 }}>{t.table_name || `Table ${t.table_number}`}</h3>
              </div>
              <span className={`badge badge-${(t.status || "available").toLowerCase()}`}>
                {t.status}
              </span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", margin: "16px 0", padding: "10px 14px", background: "var(--bg-secondary)", borderRadius: 8 }}>
              <div>
                <span style={{ fontSize: 11, color: "var(--text-dim)", display: "block" }}>Hourly Rate</span>
                <span style={{ fontWeight: 700, color: "#fff" }}>₹{Number(t.hourly_rate).toFixed(2)}/hr</span>
              </div>
              <div>
                <span style={{ fontSize: 11, color: "var(--text-dim)", display: "block" }}>Per Frame</span>
                <span style={{ fontWeight: 700, color: "#fff" }}>₹{Number(t.per_frame_rate).toFixed(2)}</span>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button
                className="btn btn-primary btn-sm"
                style={{ flex: 1 }}
                disabled={t.status !== "Available"}
                onClick={() => openBookingModal(t)}
              >
                <Calendar size={14} />
                Book Table
              </button>
              {canManageTables && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleToggleStatus(t)}
                  title="Toggle Maintenance"
                >
                  <Wrench size={14} />
                  {t.status === "Available" ? "Maintenance" : "Activate"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Reservations Table */}
      <div className="card">
        <h2 className="card-title">
          <span>Active & Upcoming Reservations</span>
          <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: "normal" }}>
            {currentUser?.app_role === "Member" ? "Showing your bookings" : "Showing all club bookings"}
          </span>
        </h2>

        {reservations.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px 0", color: "var(--text-dim)" }}>
            No reservations found.
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Player</th>
                  <th>Table</th>
                  <th>Start Time</th>
                  <th>End Time</th>
                  <th>Billing Mode</th>
                  <th>Amount</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((r) => (
                  <tr key={r.reservation_id}>
                    <td>#{r.reservation_id}</td>
                    <td>
                      <strong>{r.user_name || `User #${r.user_id}`}</strong>
                      <span style={{ display: "block", fontSize: 11, color: "var(--text-dim)" }}>{r.user_type}</span>
                    </td>
                    <td>{r.table_name || `Table ${r.table_number}`}</td>
                    <td>{new Date(r.start_time).toLocaleString()}</td>
                    <td>{new Date(r.end_time).toLocaleString()}</td>
                    <td>{r.billing_mode}</td>
                    <td><strong>₹{Number(r.total_amount).toFixed(2)}</strong></td>
                    <td>
                      <span className={`badge ${r.payment_status === "Paid" ? "badge-ongoing" : r.payment_status === "OnCredit" ? "badge-registration" : "badge-draft"}`}>
                        {r.payment_status}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${r.status === "Confirmed" ? "badge-available" : r.status === "Cancelled" ? "badge-cancelled" : "badge-completed"}`}>
                        {r.status || "Confirmed"}
                      </span>
                    </td>
                    <td>
                      {r.status !== "Cancelled" && (
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleCancelBooking(r.reservation_id)}
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Booking Modal */}
      {bookingModalOpen && selectedTable && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 className="modal-title">Book {selectedTable.table_name || `Table ${selectedTable.table_number}`}</h3>
              <button onClick={() => setBookingModalOpen(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateBooking}>
              <div className="modal-body">
                {canManageTables && (
                  <div className="form-group">
                    <label className="form-label">Booking on Behalf of User ID</label>
                    <input
                      type="number"
                      className="form-input"
                      value={targetUserId}
                      onChange={(e) => setTargetUserId(e.target.value)}
                      required
                    />
                  </div>
                )}

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Start Time</label>
                    <input
                      type="datetime-local"
                      className="form-input"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">End Time</label>
                    <input
                      type="datetime-local"
                      className="form-input"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Billing Mode</label>
                    <select
                      className="form-select"
                      value={billingMode}
                      onChange={(e) => setBillingMode(e.target.value)}
                    >
                      <option value="Hourly">Hourly (₹{selectedTable.hourly_rate}/hr)</option>
                      <option value="PerFrame">Per Frame (₹{selectedTable.per_frame_rate}/frame)</option>
                    </select>
                  </div>

                  {billingMode === "PerFrame" && (
                    <div className="form-group">
                      <label className="form-label">Estimated Frames Played</label>
                      <input
                        type="number"
                        min="1"
                        className="form-input"
                        value={framesPlayed}
                        onChange={(e) => setFramesPlayed(e.target.value)}
                        required
                      />
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label">Payment Method</label>
                    <select
                      className="form-select"
                      value={paymentStatus}
                      onChange={(e) => setPaymentStatus(e.target.value)}
                    >
                      <option value="Cash">Cash (Immediate Pay)</option>
                      <option value="Pending">Pending (Pay upon exit)</option>
                      <option value="OnCredit">OnCredit (Debit Member Credit Ledger)</option>
                    </select>
                  </div>
                </div>

                <div style={{ padding: 12, borderRadius: 8, background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.2)", marginTop: 10 }}>
                  <div style={{ fontSize: 12, color: "var(--accent-green)", fontWeight: 600 }}>Discount & Credit Invariants</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                    Club members receive active membership discount automatically. OnCredit bookings verify credit limit headroom in real-time.
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setBookingModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submittingBooking}>
                  {submittingBooking ? "Confirming..." : "Confirm Booking"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
