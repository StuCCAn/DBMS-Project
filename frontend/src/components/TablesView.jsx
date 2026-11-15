import React, { useState, useEffect, useCallback } from "react";
import { getTables, setTableStatus, getReservations, createReservation, cancelReservation, getToken } from "../api";
import { Calendar, Check, AlertCircle, Wrench, X } from "lucide-react";

function getDefaultTimes() {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  const inTwoHours = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const formatDt = (d) => {
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  return {
    start: formatDt(now),
    end: formatDt(inTwoHours)
  };
}

function getTableDisplayName(table) {
  if (!table) return "Table";
  return table.name || table.table_name || (table.table_number ? `Table ${table.table_number}` : `Table #${table.table_id}`);
}

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
  const defaultTimes = getDefaultTimes();
  const [startTime, setStartTime] = useState(defaultTimes.start);
  const [endTime, setEndTime] = useState(defaultTimes.end);
  const [billingMode, setBillingMode] = useState("Hourly");
  const [framesPlayed, setFramesPlayed] = useState(0);
  const [paymentStatus, setPaymentStatus] = useState(currentUser?.app_role === "Member" ? "OnCredit" : "Paid");
  const [submittingBooking, setSubmittingBooking] = useState(false);

  const canManageTables = currentUser?.app_role === "Admin" || currentUser?.app_role === "Staff";
  const canBook = currentUser?.app_role === "Admin" || currentUser?.app_role === "Staff" || currentUser?.app_role === "Member";

  const loadData = useCallback(async () => {
    if (!getToken()) {
      setTables([]);
      setReservations([]);
      setLoading(false);
      return;
    }
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
  }, []);

  useEffect(() => {
    let ignore = false;
    async function init() {
      if (!getToken()) {
        setTables([]);
        setReservations([]);
        setLoading(false);
        return;
      }
      try {
        const [tList, rList] = await Promise.all([getTables(), getReservations()]);
        if (!ignore) {
          setTables(tList);
          setReservations(rList);
        }
      } catch (err) {
        if (!ignore) {
          setError(err.message || "Failed to load table data");
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
  }, [currentUser]);

  async function handleToggleStatus(table) {
    const nextStatus = table.status === "Available" ? "Maintenance" : "Available";
    try {
      await setTableStatus(table.table_id, nextStatus);
      setSuccess(`${getTableDisplayName(table)} status updated to ${nextStatus}`);
      setTimeout(() => setSuccess(null), 3000);
      loadData();
    } catch (err) {
      setError(err.message || "Failed to change table status");
    }
  }

  function openBookingModal(table) {
    setSelectedTable(table);
    setTargetUserId(currentUser?.user_id || 1);
    setPaymentStatus(currentUser?.app_role === "Member" ? "OnCredit" : "Paid");
    const freshTimes = getDefaultTimes();
    setStartTime(freshTimes.start);
    setEndTime(freshTimes.end);
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
        start: formatSql(startTime),
        end: formatSql(endTime),
        mode: billingMode,
        frames: billingMode === "PerFrame" ? Number(framesPlayed) : 0,
        payStatus: paymentStatus
      });

      setSuccess(`Booking confirmed for ${getTableDisplayName(selectedTable)}!`);
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
                <h3 style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginTop: 2 }}>
                  {getTableDisplayName(t)}
                </h3>
              </div>
              <span className={`badge badge-${t.status.toLowerCase()}`}>
                {t.status}
              </span>
            </div>

            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
              <div>Rate: <strong>₹{t.hourly_rate}</strong> / hr</div>
              <div>Frame: <strong>₹{t.per_frame_rate}</strong> / frame</div>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {t.status === "Available" && canBook && (
                <button
                  className="btn btn-primary btn-sm"
                  style={{ flex: 1 }}
                  onClick={() => openBookingModal(t)}
                >
                  <Calendar size={14} />
                  Book Table
                </button>
              )}
              {t.status === "Available" && !canBook && (
                <span style={{ fontSize: 12, color: "var(--text-dim)", fontStyle: "italic", flex: 1 }}>
                  Book at club desk
                </span>
              )}

              {canManageTables && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleToggleStatus(t)}
                  title={t.status === "Available" ? "Mark Maintenance" : "Mark Available"}
                >
                  <Wrench size={14} />
                  {t.status === "Available" ? "Maint" : "Enable"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Active Reservations Ledger */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 className="card-title" style={{ margin: 0 }}>Recent Reservations & Status</h2>
          <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
            Rule R1: Strictly single calendar day & no midnight crossing
          </span>
        </div>

        {reservations.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px 0", color: "var(--text-dim)" }}>
            No reservations found. Book a table above to start playing.
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>User / Member</th>
                  <th>Table</th>
                  <th>Start Time</th>
                  <th>End Time</th>
                  <th>Billing Mode</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((r) => {
                  const canCancelThisBooking = (
                    currentUser?.app_role === "Admin" ||
                    currentUser?.app_role === "Staff" ||
                    (currentUser?.app_role === "Member" && Number(r.user_id) === Number(currentUser?.user_id))
                  ) && r.payment_status !== "Cancelled";

                  return (
                    <tr key={r.reservation_id}>
                      <td>#{r.reservation_id}</td>
                      <td>
                        <strong>{r.user_name || `User #${r.user_id}`}</strong>
                      </td>
                      <td>{r.table_name || r.name || (r.table_number ? `Table ${r.table_number}` : `Table #${r.table_id}`)}</td>
                      <td>{new Date(r.start_time).toLocaleString()}</td>
                      <td>{new Date(r.end_time).toLocaleTimeString()}</td>
                      <td>{r.billing_mode} {r.billing_mode === "PerFrame" ? `(${r.frames_played}f)` : ""}</td>
                      <td>₹{r.total_amount}</td>
                      <td>
                        <span className={`badge badge-${r.payment_status.toLowerCase()}`}>
                          {r.payment_status}
                        </span>
                      </td>
                      <td>
                        {canCancelThisBooking ? (
                          <button
                            className="btn btn-danger btn-sm"
                            style={{ padding: "4px 8px", fontSize: 11 }}
                            onClick={() => handleCancelBooking(r.reservation_id)}
                          >
                            <X size={12} /> Cancel
                          </button>
                        ) : (
                          <span style={{ color: "var(--text-dim)" }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Booking Form Modal */}
      {bookingModalOpen && selectedTable && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 className="modal-title">Book {getTableDisplayName(selectedTable)}</h3>
              <p className="page-description">{selectedTable.game_type} table reservation</p>
            </div>

            <form onSubmit={handleCreateBooking}>
              <div className="modal-body">
                {currentUser?.app_role !== "Member" && (
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
                      <option value="Paid">Paid (Cash / UPI / Card)</option>
                      <option value="Pending">Pending (Pay upon exit)</option>
                      <option value="OnCredit">OnCredit (Debit Member Credit Ledger)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setBookingModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submittingBooking}
                >
                  {submittingBooking ? "Booking..." : "Confirm Reservation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
