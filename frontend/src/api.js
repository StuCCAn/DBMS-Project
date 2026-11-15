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
  const payload = {
    userId: data.userId,
    tableId: Number(data.tableId),
    start: data.start || data.startTime,
    end: data.end || data.endTime,
    mode: data.mode || data.billingMode,
    frames: data.frames !== undefined ? Number(data.frames) : (data.framesPlayed !== undefined ? Number(data.framesPlayed) : 0),
    payStatus: data.payStatus || (data.paymentStatus === "Cash" ? "Paid" : data.paymentStatus)
  };
  return apiRequest("/reservations", "POST", payload);
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
  let resolvedType = type;
  let resolvedNote = note;

  // Map any fine variants or subcategories to valid DB enum types: 'Canteen charge' | 'Fine'
  if (type === "Fine" || type.toLowerCase().includes("fine") || type === "Late fee" || type === "Damaged equipment fine") {
    resolvedType = "Fine";
    if (type !== "Fine" && (!note || !note.includes(type))) {
      resolvedNote = note ? `[${type}] ${note}` : `[${type}]`;
    }
  } else if (type === "Canteen charge") {
    resolvedType = "Canteen charge";
  } else {
    resolvedType = "Canteen charge";
    if (type && (!note || !note.includes(type))) {
      resolvedNote = note ? `[${type}] ${note}` : `[${type}]`;
    }
  }

  return apiRequest("/ledger/charge", "POST", {
    userId: Number(userId),
    type: resolvedType,
    amount: Number(amount),
    note: resolvedNote || null
  });
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
  const payload = {
    title: data.title,
    game: data.game || data.gameType,
    format: data.format,
    start: data.start || data.startDate,
    fee: data.fee !== undefined ? Number(data.fee) : Number(data.entryFee)
  };
  return apiRequest("/tournaments", "POST", payload);
}

export async function setTournamentStatus(tournamentId, status) {
  return apiRequest(`/tournaments/${tournamentId}/status`, "PATCH", { status });
}

export async function registerTournamentPlayer(tournamentId, userId, seed, feePaid = false) {
  const payload = {
    userId: Number(userId),
    seed: seed !== undefined && seed !== null && seed !== "" ? Number(seed) : null,
    feePaid: Boolean(feePaid)
  };
  return apiRequest(`/tournaments/${tournamentId}/register`, "POST", payload);
}

export async function getTournamentRegistrations(tournamentId) {
  const res = await apiRequest(`/tournaments/${tournamentId}/registrations`);
  return res.data || [];
}

export async function createMatch(tournamentId, data) {
  const payload = {
    roundNumber: Number(data.roundNumber),
    player1Id: data.player1Id ? Number(data.player1Id) : null,
    player2Id: data.player2Id ? Number(data.player2Id) : null,
    nextMatchId: data.nextMatchId ? Number(data.nextMatchId) : null,
    tableId: data.tableId ? Number(data.tableId) : null,
    scheduledTime: data.scheduledTime || null
  };
  return apiRequest(`/tournaments/${tournamentId}/matches`, "POST", payload);
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
  const payload = {
    playerId: Number(data.playerId),
    assessedBy: data.assessedBy !== undefined ? Number(data.assessedBy) : (data.coachId !== undefined ? Number(data.coachId) : undefined),
    skillArea: data.skillArea || data.focusArea,
    rating: Number(data.rating),
    notes: data.notes || null
  };
  return apiRequest("/coaching/assessments", "POST", payload);
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
