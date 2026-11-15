import React, { useState, useEffect, useCallback } from "react";
import { getInventory, updateInventoryStock, setInventoryCondition, getReorderAlerts, getToken } from "../api";
import { AlertTriangle, Plus, Minus, Check, AlertCircle } from "lucide-react";

export default function InventoryView({ currentUser }) {
  const canManage = currentUser?.app_role === "Admin" || currentUser?.app_role === "Staff";

  const [items, setItems] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const loadInventory = useCallback(async () => {
    if (!getToken()) {
      setItems([]);
      setAlerts([]);
      setLoading(false);
      return;
    }
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
  }, []);

  useEffect(() => {
    let ignore = false;
    async function init() {
      if (!getToken()) {
        setItems([]);
        setAlerts([]);
        setLoading(false);
        return;
      }
      try {
        const [itemList, alertList] = await Promise.all([
          getInventory(),
          getReorderAlerts()
        ]);
        if (!ignore) {
          setItems(itemList);
          setAlerts(alertList);
        }
      } catch (err) {
        if (!ignore) {
          setError(err.message || "Failed to load inventory data");
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
          <p className="page-description">Real-time club stock, cue maintenance status, and automated reorder alerts.</p>
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

      {/* Critical Reorder Alerts */}
      {alerts.length > 0 && (
        <div className="card" style={{ borderLeft: "4px solid #f87171", marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <AlertTriangle size={20} color="#f87171" />
            <h3 className="card-title" style={{ margin: 0, color: "#f87171" }}>
              Automated Reorder Threshold Alerts ({alerts.length})
            </h3>
          </div>
          <div className="grid-3">
            {alerts.map((a) => {
              const alertName = a.name || a.item_name || `Item #${a.item_id}`;
              const alertQty = a.quantity !== undefined ? a.quantity : (a.quantity_available !== undefined ? a.quantity_available : 0);
              const alertRlvl = a.reorder_level !== undefined ? a.reorder_level : 0;
              return (
                <div key={a.item_id} style={{ padding: 12, background: "var(--bg-secondary)", borderRadius: 8, border: "1px solid var(--border)" }}>
                  <div style={{ fontWeight: 700, color: "#fff", fontSize: 13 }}>{alertName}</div>
                  <div style={{ fontSize: 12, color: "#f87171", marginTop: 4, fontWeight: 600 }}>
                    Current Stock: {alertQty} (Reorder Min: {alertRlvl})
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Inventory Items Table */}
      <div className="card">
        <h2 className="card-title">Club Equipment & Consumables Catalog</h2>
        {items.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px 0", color: "var(--text-dim)" }}>
            {loading ? "Loading inventory..." : "No inventory records found."}
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Item #</th>
                  <th>Item Name</th>
                  <th>Category</th>
                  <th>Quantity Available</th>
                  <th>Reorder Level</th>
                  <th>Condition</th>
                  {canManage && <th>Stock Adjustment</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const itemName = item.name || item.item_name || `Item #${item.item_id}`;
                  const qty = item.quantity !== undefined ? item.quantity : (item.quantity_available !== undefined ? item.quantity_available : 0);
                  const rlvl = item.reorder_level !== undefined ? item.reorder_level : 0;
                  return (
                    <tr key={item.item_id}>
                      <td>#{item.item_id}</td>
                      <td>
                        <strong>{itemName}</strong>
                      </td>
                      <td>{item.category}</td>
                      <td>
                        <span style={{ fontWeight: 700, color: qty <= rlvl ? "#f87171" : "var(--accent-green)" }}>
                          {qty} units
                        </span>
                      </td>
                      <td>{rlvl} units</td>
                      <td>
                        {canManage ? (
                          <select
                            className="form-select"
                            style={{ padding: "4px 8px", fontSize: 12, width: 130 }}
                            value={item.condition_status}
                            onChange={(e) => handleConditionChange(item.item_id, e.target.value)}
                          >
                            <option value="Good">Good</option>
                            <option value="Needs Service">Needs Service</option>
                            <option value="Damaged">Damaged</option>
                            <option value="Retired">Retired</option>
                          </select>
                        ) : (
                          <span className={`badge badge-${(item.condition_status || "").toLowerCase().replace(/\s+/g, "-")}`}>
                            {item.condition_status}
                          </span>
                        )}
                      </td>
                      {canManage && (
                        <td>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ padding: "4px 8px" }}
                              title="Decrement stock (-1)"
                              onClick={() => handleStockDelta(item.item_id, -1)}
                              disabled={qty <= 0}
                            >
                              <Minus size={12} />
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ padding: "4px 8px" }}
                              title="Increment stock (+1)"
                              onClick={() => handleStockDelta(item.item_id, 1)}
                            >
                              <Plus size={12} />
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ padding: "4px 8px", fontSize: 11 }}
                              title="Bulk Restock (+10)"
                              onClick={() => handleStockDelta(item.item_id, 10)}
                            >
                              +10
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
