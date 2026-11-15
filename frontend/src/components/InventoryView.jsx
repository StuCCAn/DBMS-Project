import React, { useState, useEffect } from "react";
import { getInventory, updateInventoryStock, setInventoryCondition, getReorderAlerts } from "../api";
import { Package, AlertTriangle, Plus, Minus, Check, AlertCircle, Wrench } from "lucide-react";

export default function InventoryView({ currentUser }) {
  const canManage = currentUser?.app_role === "Admin" || currentUser?.app_role === "Staff";

  const [items, setItems] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    loadInventory();
  }, []);

  async function loadInventory() {
    setLoading(true);
    setError(null);
    try {
      const [itemList, alertList] = await Promise.all([
        getInventory(),
        getReorderAlerts()
      ]);
      setItems(itemList);
      setAlerts(alertList);
    } catch (err) {
      setError(err.message || "Failed to load inventory data");
    } finally {
      setLoading(false);
    }
  }

  async function handleStockDelta(itemId, delta) {
    setError(null);
    try {
      await updateInventoryStock(itemId, delta);
      setSuccess(`Inventory quantity updated!`);
      setTimeout(() => setSuccess(null), 2500);
      loadInventory();
    } catch (err) {
      setError(err.message || "Failed to adjust stock");
    }
  }

  async function handleConditionChange(itemId, newCondition) {
    setError(null);
    try {
      await setInventoryCondition(itemId, newCondition);
      setSuccess(`Equipment condition updated to ${newCondition}!`);
      setTimeout(() => setSuccess(null), 2500);
      loadInventory();
    } catch (err) {
      setError(err.message || "Failed to change condition");
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Equipment & Inventory Management</h1>
          <p className="page-description">Club cues, tournament balls, cloth maintenance, and automated low-stock reorder thresholds.</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={loadInventory} disabled={loading}>
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

      {/* Low Stock Alerts Banner */}
      {alerts.length > 0 && (
        <div className="card" style={{ borderLeft: "4px solid #f59e0b", background: "rgba(245, 158, 11, 0.05)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <AlertTriangle size={20} color="#fbbf24" />
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#fbbf24" }}>
              Automated Reorder Alerts ({alerts.length} Items Below Threshold)
            </h3>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {alerts.map((a) => (
              <div key={a.item_id} style={{ padding: "6px 12px", background: "rgba(0,0,0,0.3)", borderRadius: 6, fontSize: 13, border: "1px solid rgba(245, 158, 11, 0.3)" }}>
                <strong>{a.item_name}</strong>: {a.quantity} in stock (Reorder threshold: {a.reorder_level})
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inventory Catalog Table */}
      <div className="card">
        <h2 className="card-title">Club Equipment Catalog</h2>
        {items.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px 0", color: "var(--text-dim)" }}>
            No equipment items found.
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Item Code</th>
                  <th>Item Name</th>
                  <th>Category</th>
                  <th>Current Stock</th>
                  <th>Threshold</th>
                  <th>Condition Status</th>
                  <th>Unit Cost</th>
                  {canManage && <th>Manage Stock</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const isLow = Number(item.quantity) <= Number(item.reorder_level);
                  return (
                    <tr key={item.item_id}>
                      <td>#{item.item_id}</td>
                      <td>
                        <strong>{item.item_name}</strong>
                      </td>
                      <td>{item.category || "General"}</td>
                      <td>
                        <span style={{ fontWeight: 800, fontSize: 15, color: isLow ? "#f87171" : "var(--accent-green)" }}>
                          {item.quantity}
                        </span>
                        {isLow && <span style={{ marginLeft: 6, fontSize: 11, color: "#f87171" }}>(LOW)</span>}
                      </td>
                      <td>{item.reorder_level}</td>
                      <td>
                        {canManage ? (
                          <select
                            className="form-select"
                            style={{ padding: "4px 8px", fontSize: 12, width: "auto" }}
                            value={item.condition_status || "Good"}
                            onChange={(e) => handleConditionChange(item.item_id, e.target.value)}
                          >
                            <option value="Good">Good</option>
                            <option value="Needs Service">Needs Service</option>
                            <option value="Damaged">Damaged</option>
                            <option value="Retired">Retired</option>
                          </select>
                        ) : (
                          <span className={`badge ${item.condition_status === "Good" ? "badge-available" : item.condition_status === "Needs Service" ? "badge-maintenance" : "badge-cancelled"}`}>
                            {item.condition_status || "Good"}
                          </span>
                        )}
                      </td>
                      <td>₹{Number(item.unit_cost || 0).toFixed(2)}</td>
                      {canManage && (
                        <td>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleStockDelta(item.item_id, -1)}
                              disabled={item.quantity <= 0}
                              title="Decrease Stock"
                            >
                              <Minus size={12} />
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleStockDelta(item.item_id, 1)}
                              title="Increase Stock"
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
