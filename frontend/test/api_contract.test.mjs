import test from "node:test";
import assert from "node:assert/strict";

// Mock localStorage
const storage = new Map();
globalThis.localStorage = {
  getItem: (k) => (storage.has(k) ? storage.get(k) : null),
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
  clear: () => storage.clear()
};

// Mock fetch to inspect outgoing requests
let lastRequest = null;
globalThis.fetch = async (url, options = {}) => {
  lastRequest = {
    url,
    method: options.method || "GET",
    headers: options.headers || {},
    body: options.body ? JSON.parse(options.body) : null
  };

  return {
    ok: true,
    status: 200,
    json: async () => ({ status: "success", data: { id: 1 } })
  };
};

// Import frontend API module
const api = await import("../src/api.js");

test("createReservation correctly serializes backend contract parameters", async () => {
  api.setToken("mock-jwt-token");

  await api.createReservation({
    userId: 3,
    tableId: 2,
    startTime: "2026-12-01 10:00:00",
    endTime: "2026-12-01 12:00:00",
    billingMode: "PerFrame",
    framesPlayed: 5,
    paymentStatus: "Paid"
  });

  assert.equal(lastRequest.url, "/api/reservations");
  assert.equal(lastRequest.method, "POST");
  assert.equal(lastRequest.headers["Authorization"], "Bearer mock-jwt-token");
  assert.deepEqual(lastRequest.body, {
    userId: 3,
    tableId: 2,
    start: "2026-12-01 10:00:00",
    end: "2026-12-01 12:00:00",
    mode: "PerFrame",
    frames: 5,
    payStatus: "Paid"
  });
});

test("createReservation maps Cash payment method to Paid", async () => {
  await api.createReservation({
    userId: 4,
    tableId: 1,
    start: "2026-12-01 14:00:00",
    end: "2026-12-01 16:00:00",
    mode: "Hourly",
    frames: 0,
    paymentStatus: "Cash"
  });

  assert.equal(lastRequest.body.payStatus, "Paid");
});

test("createTournament maps gameType, startDate, and entryFee to game, start, and fee", async () => {
  await api.createTournament({
    title: "BITS Open 2026",
    gameType: "Snooker",
    format: "Knockout",
    startDate: "2026-12-05",
    entryFee: 250
  });

  assert.equal(lastRequest.url, "/api/tournaments");
  assert.equal(lastRequest.method, "POST");
  assert.deepEqual(lastRequest.body, {
    title: "BITS Open 2026",
    game: "Snooker",
    format: "Knockout",
    start: "2026-12-05",
    fee: 250
  });
});

test("registerTournamentPlayer sends seed parameter instead of seedNumber", async () => {
  await api.registerTournamentPlayer(1, 3, 2, true);

  assert.equal(lastRequest.url, "/api/tournaments/1/register");
  assert.equal(lastRequest.method, "POST");
  assert.deepEqual(lastRequest.body, {
    userId: 3,
    seed: 2,
    feePaid: true
  });
});

test("recordAssessment correctly sends skillArea and assessedBy", async () => {
  await api.recordAssessment({
    playerId: 3,
    coachId: 2,
    focusArea: "Long potting",
    rating: 8,
    notes: "Solid cue delivery on straight pots"
  });

  assert.equal(lastRequest.url, "/api/coaching/assessments");
  assert.equal(lastRequest.method, "POST");
  assert.deepEqual(lastRequest.body, {
    playerId: 3,
    assessedBy: 2,
    skillArea: "Long potting",
    rating: 8,
    notes: "Solid cue delivery on straight pots"
  });
});

test("createMatch sends roundNumber, player IDs, and feeder links", async () => {
  await api.createMatch(1, {
    roundNumber: 2,
    player1Id: 3,
    player2Id: 4,
    nextMatchId: 10,
    tableId: 1,
    scheduledTime: "2026-12-05 15:00:00"
  });

  assert.equal(lastRequest.url, "/api/tournaments/1/matches");
  assert.equal(lastRequest.method, "POST");
  assert.deepEqual(lastRequest.body, {
    roundNumber: 2,
    player1Id: 3,
    player2Id: 4,
    nextMatchId: 10,
    tableId: 1,
    scheduledTime: "2026-12-05 15:00:00"
  });
});

test("recordCharge restricts and normalizes types to Canteen charge and Fine", async () => {
  // Test direct valid Fine
  await api.recordCharge(3, "Fine", 200, "Late return fee");
  assert.equal(lastRequest.url, "/api/ledger/charge");
  assert.equal(lastRequest.body.type, "Fine");
  assert.equal(lastRequest.body.note, "Late return fee");

  // Test mapping subcategory fine to Fine with note preserved
  await api.recordCharge(3, "Damaged equipment fine", 350, "Broken cue tip");
  assert.equal(lastRequest.body.type, "Fine");
  assert.equal(lastRequest.body.note, "[Damaged equipment fine] Broken cue tip");

  // Test Canteen charge
  await api.recordCharge(3, "Canteen charge", 120, "Snacks & soda");
  assert.equal(lastRequest.body.type, "Canteen charge");
  assert.equal(lastRequest.body.note, "Snacks & soda");
});

test("setTournamentStatus sends valid status to PATCH endpoint", async () => {
  await api.setTournamentStatus(1, "Registration");
  assert.equal(lastRequest.url, "/api/tournaments/1/status");
  assert.equal(lastRequest.method, "PATCH");
  assert.deepEqual(lastRequest.body, { status: "Registration" });
});

test("setInventoryCondition sends valid condition to PATCH endpoint", async () => {
  await api.setInventoryCondition(5, "Needs Service");
  assert.equal(lastRequest.url, "/api/inventory/5/condition");
  assert.equal(lastRequest.method, "PATCH");
  assert.deepEqual(lastRequest.body, { status: "Needs Service" });
});

test("Token management correctly stores and clears JWT", () => {
  api.setToken("test-jwt");
  assert.equal(api.getToken(), "test-jwt");
  api.setToken(null);
  assert.equal(api.getToken(), null);
});
