const API_BASE = "/api";

export function getToken() {
  return localStorage.getItem("cueclub_token");
}

export function setToken(token) {
  if (token) {
    localStorage.setItem("cueclub_token", token);
  } else {
    localStorage.removeItem("cueclub_token");
  }
}

export function getCurrentUser() {
  const user = localStorage.getItem("cueclub_user");
  try {
    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
}

export function setCurrentUser(user) {
  if (user) {
    localStorage.setItem("cueclub_user", JSON.stringify(user));
  } else {
    localStorage.removeItem("cueclub_user");
  }
}

export async function apiRequest(endpoint, method = "GET", body = null) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json"
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const options = {
    method,
    headers
  };

  if (body && method !== "GET") {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, options);
  let data;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const errorMsg = data && data.error ? data.error : `Request failed with status ${response.status}`;
    const error = new Error(errorMsg);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

// ---------------------------------------------------------------------------
// Authentication & Self-Service
// ---------------------------------------------------------------------------
export async function login(email, password) {
  const res = await apiRequest("/auth/login", "POST", { email, password });
  if (res.token) {
    setToken(res.token);
    setCurrentUser(res.user);
  }
  return res;
}

export async function getMe() {
  return apiRequest("/auth/me");
}

export async function changePassword(userId, currentPassword, newPassword) {
  return apiRequest(`/users/${userId}/password`, "PUT", { currentPassword, newPassword });
}

export async function deactivateUser(userId) {
  return apiRequest(`/users/${userId}/deactivate`, "PATCH");
}

// ---------------------------------------------------------------------------
// Tables & Booking
// ---------------------------------------------------------------------------
export async function getTables() {
  const res = await apiRequest("/tables");
  return res.data || [];
}

export async function setTableStatus(tableId, status) {
  return apiRequest(`/tables/${tableId}/status`, "PATCH", { status });
}

export async function getReservations() {
  const res = await apiRequest("/reservations");
  return res.data || [];
}

export async function createReservation(data) {
  return apiRequest("/reservations", "POST", data);
}

export async function cancelReservation(reservationId) {
  return apiRequest(`/reservations/${reservationId}/cancel`, "POST");
}

// ---------------------------------------------------------------------------
// Financial Ledger & Members
// ---------------------------------------------------------------------------
export async function getMemberBalance(userId) {
  const res = await apiRequest(`/members/${userId}/balance`);
  return res.data;
}

export async function getLedgerEntries(userId = null) {
  const url = userId ? `/ledger/entries?userId=${userId}` : "/ledger/entries";
  const res = await apiRequest(url);
  return res.data || [];
}

export async function recordPayment(userId, amount, note) {
  return apiRequest("/ledger/payment", "POST", { userId, amount, note });
}

export async function recordCharge(userId, type, amount, note) {
  return apiRequest("/ledger/charge", "POST", { userId, type, amount, note });
}

export async function registerMember(data) {
  return apiRequest("/members", "POST", data);
}

export async function registerCasual(data) {
  return apiRequest("/casuals", "POST", data);
}

// ---------------------------------------------------------------------------
// Tournaments & Matches
// ---------------------------------------------------------------------------
export async function getTournaments() {
  const res = await apiRequest("/tournaments");
  return res.data || [];
}

export async function createTournament(data) {
  return apiRequest("/tournaments", "POST", data);
}

export async function setTournamentStatus(tournamentId, status) {
  return apiRequest(`/tournaments/${tournamentId}/status`, "PATCH", { status });
}

export async function registerTournamentPlayer(tournamentId, userId, seedNumber, feePaid = false) {
  return apiRequest(`/tournaments/${tournamentId}/register`, "POST", { userId, seedNumber, feePaid });
}

export async function getTournamentRegistrations(tournamentId) {
  const res = await apiRequest(`/tournaments/${tournamentId}/registrations`);
  return res.data || [];
}

export async function createMatch(tournamentId, data) {
  return apiRequest(`/tournaments/${tournamentId}/matches`, "POST", data);
}

export async function getBracketTree(tournamentId) {
  const res = await apiRequest(`/tournaments/${tournamentId}/bracket`);
  return res.data || [];
}

export async function completeMatch(matchId, frames, winPoints, lossPoints) {
  return apiRequest(`/matches/${matchId}/complete`, "POST", { frames, winPoints, lossPoints });
}

// ---------------------------------------------------------------------------
// Leaderboard & Reports
// ---------------------------------------------------------------------------
export async function getLeaderboard() {
  const res = await apiRequest("/leaderboard");
  return res.data || [];
}

export async function getWinStreaks() {
  const res = await apiRequest("/reports/win-streaks");
  return res.data || [];
}

export async function getHeadToHead(player1 = null, player2 = null) {
  let url = "/reports/head-to-head";
  const params = [];
  if (player1) params.push(`player1=${player1}`);
  if (player2) params.push(`player2=${player2}`);
  if (params.length) url += `?${params.join("&")}`;
  const res = await apiRequest(url);
  return res.data || [];
}

export async function getTableUtilisation() {
  const res = await apiRequest("/reports/table-utilisation");
  return res.data || [];
}

export async function getAdminDiagnostics() {
  const res = await apiRequest("/admin/diagnostics");
  return res.data || [];
}

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------
export async function getInventory() {
  const res = await apiRequest("/inventory");
  return res.data || [];
}

export async function updateInventoryStock(itemId, delta) {
  return apiRequest(`/inventory/${itemId}/stock`, "PATCH", { delta });
}

export async function setInventoryCondition(itemId, status) {
  return apiRequest(`/inventory/${itemId}/condition`, "PATCH", { status });
}

export async function getReorderAlerts() {
  const res = await apiRequest("/inventory/reorder-alerts");
  return res.data || [];
}

// ---------------------------------------------------------------------------
// Coaching Academy
// ---------------------------------------------------------------------------
export async function recordAssessment(data) {
  return apiRequest("/coaching/assessments", "POST", data);
}

export async function getCoachingHistory(playerId = null) {
  const url = playerId ? `/coaching/history?playerId=${playerId}` : "/coaching/history";
  const res = await apiRequest(url);
  return res.data || [];
}

export async function getPlayerWeaknesses(playerId = null) {
  const url = playerId ? `/coaching/weaknesses?playerId=${playerId}` : "/coaching/weaknesses";
  const res = await apiRequest(url);
  return res.data || [];
}
