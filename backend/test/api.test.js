// Set default environment variables for testing if not already populated
process.env.JWT_SECRET = process.env.JWT_SECRET || "ci-test-jwt-secret-key-32charslong";
process.env.DB_HOST = process.env.DB_HOST || "127.0.0.1";
process.env.DB_PORT = process.env.DB_PORT || "3306";
process.env.DB_USER = process.env.DB_USER || "cueclub_api";
process.env.DB_PASSWORD = process.env.DB_PASSWORD || "cueclub_api_pw";
process.env.DB_NAME = process.env.DB_NAME || "cueclub";

const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { app, pool } = require("../index");

let server;
let baseUrl;

let adminToken;
let staffToken;
let memberToken;
let casualToken;

async function request(method, path, options = {}) {
    const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
    const body = options.body ? JSON.stringify(options.body) : undefined;
    const res = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body
    });
    let data;
    const text = await res.text();
    try {
        data = JSON.parse(text);
    } catch {
        data = text;
    }
    return { status: res.status, data };
}

describe("CueClub API Integration Test Suite", () => {
    before(async () => {
        // Start server on an ephemeral free port
        server = http.createServer(app);
        await new Promise((resolve) => server.listen(0, resolve));
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
    });

    after(async () => {
        if (server) {
            await new Promise((resolve) => server.close(resolve));
        }
        await pool.end();
    });

    test("1. Health check returns 200 and connected status", async () => {
        const res = await request("GET", "/api/health");
        assert.equal(res.status, 200);
        assert.equal(res.data.status, "ok");
        assert.equal(res.data.database, "connected");
    });

    describe("2. Authentication & Seed User Logins", () => {
        test("Rejects empty credentials with 400", async () => {
            const res = await request("POST", "/api/auth/login", {
                body: { email: "", password: "" }
            });
            assert.equal(res.status, 400);
        });

        test("Rejects incorrect password with 401", async () => {
            const res = await request("POST", "/api/auth/login", {
                body: { email: "rohan@example.com", password: "wrongpassword" }
            });
            assert.equal(res.status, 401);
        });

        test("Rejects inactive user with 403 (Arjun Old)", async () => {
            const res = await request("POST", "/api/auth/login", {
                body: { email: "arjun@example.com", password: "cueclub_default" }
            });
            assert.equal(res.status, 403);
            assert.match(res.data.error, /inactive/i);
        });

        test("Admin login succeeds with seed password (Rohan Mehta)", async () => {
            const res = await request("POST", "/api/auth/login", {
                body: { email: "rohan@example.com", password: "cueclub_default" }
            });
            assert.equal(res.status, 200);
            assert.ok(res.data.token);
            assert.equal(res.data.user.app_role, "Admin");
            adminToken = res.data.token;
        });

        test("Staff login succeeds (Imran Sheikh)", async () => {
            const res = await request("POST", "/api/auth/login", {
                body: { email: "imran@example.com", password: "cueclub_default" }
            });
            assert.equal(res.status, 200);
            assert.ok(res.data.token);
            assert.equal(res.data.user.app_role, "Staff");
            staffToken = res.data.token;
        });

        test("Member login succeeds (Aarav Nair)", async () => {
            const res = await request("POST", "/api/auth/login", {
                body: { email: "aarav@example.com", password: "cueclub_default" }
            });
            assert.equal(res.status, 200);
            assert.ok(res.data.token);
            assert.equal(res.data.user.app_role, "Member");
            memberToken = res.data.token;
        });

        test("Casual player login succeeds (Vikram Singh)", async () => {
            const res = await request("POST", "/api/auth/login", {
                body: { email: "vikram@example.com", password: "cueclub_default" }
            });
            assert.equal(res.status, 200);
            assert.ok(res.data.token);
            assert.equal(res.data.user.app_role, "Casual");
            casualToken = res.data.token;
        });
    });

    describe("3. Token Guard & Immediate Revocation", () => {
        test("Unauthenticated /api/auth/me returns 401", async () => {
            const res = await request("GET", "/api/auth/me");
            assert.equal(res.status, 401);
        });

        test("Authenticated /api/auth/me returns current user identity", async () => {
            const res = await request("GET", "/api/auth/me", {
                headers: { Authorization: `Bearer ${adminToken}` }
            });
            assert.equal(res.status, 200);
            assert.equal(res.data.user.email, "rohan@example.com");
        });
    });

    describe("4. Password Update Rules & Security", () => {
        test("Rejects password shorter than 6 characters with 400", async () => {
            const res = await request("PUT", "/api/users/3/password", {
                headers: { Authorization: `Bearer ${memberToken}` },
                body: { currentPassword: "cueclub_default", newPassword: "x" }
            });
            assert.equal(res.status, 400);
            assert.match(res.data.error, /at least 6 characters/i);
        });

        test("Self-change requires currentPassword", async () => {
            const res = await request("PUT", "/api/users/3/password", {
                headers: { Authorization: `Bearer ${memberToken}` },
                body: { newPassword: "newsecretpassword" }
            });
            assert.equal(res.status, 400);
            assert.match(res.data.error, /currentPassword is required/i);
        });

        test("Self-change fails with incorrect currentPassword", async () => {
            const res = await request("PUT", "/api/users/3/password", {
                headers: { Authorization: `Bearer ${memberToken}` },
                body: { currentPassword: "wrongcurrentpassword", newPassword: "newsecretpassword" }
            });
            assert.equal(res.status, 400);
            assert.match(res.data.error, /Current password is incorrect/i);
        });

        test("Admin can reset user password without currentPassword", async () => {
            const res = await request("PUT", "/api/users/4/password", {
                headers: { Authorization: `Bearer ${adminToken}` },
                body: { newPassword: "cueclub_default" }
            });
            assert.equal(res.status, 200);
            assert.equal(res.data.status, "success");
        });
    });

    describe("5. Role-Based Access Control (RBAC) & Ownership", () => {
        test("Casual player is forbidden from viewing credit ledger (403)", async () => {
            const res = await request("GET", "/api/ledger/entries", {
                headers: { Authorization: `Bearer ${casualToken}` }
            });
            assert.equal(res.status, 403);
        });

        test("Member is forbidden from viewing inventory catalog (403)", async () => {
            const res = await request("GET", "/api/inventory", {
                headers: { Authorization: `Bearer ${memberToken}` }
            });
            assert.equal(res.status, 403);
        });

        test("Member cannot view another member's balance (403)", async () => {
            const res = await request("GET", "/api/members/1/balance", {
                headers: { Authorization: `Bearer ${memberToken}` }
            });
            assert.equal(res.status, 403);
        });

        test("Member can view their own balance (200)", async () => {
            const res = await request("GET", "/api/members/3/balance", {
                headers: { Authorization: `Bearer ${memberToken}` }
            });
            assert.equal(res.status, 200);
            assert.equal(res.data.status, "success");
            assert.ok(res.data.data.membership_no);
        });

        test("Member cannot register another member (403)", async () => {
            const res = await request("POST", "/api/members", {
                headers: { Authorization: `Bearer ${memberToken}` },
                body: { name: "Fake Member" }
            });
            assert.equal(res.status, 403);
        });

        test("Admin can view system diagnostics (200)", async () => {
            const res = await request("GET", "/api/admin/diagnostics", {
                headers: { Authorization: `Bearer ${adminToken}` }
            });
            assert.equal(res.status, 200);
            assert.equal(res.data.status, "success");
        });

        test("Staff can view inventory and tables (200)", async () => {
            const res = await request("GET", "/api/inventory", {
                headers: { Authorization: `Bearer ${staffToken}` }
            });
            assert.equal(res.status, 200);
            assert.equal(res.data.status, "success");
        });
    });

    describe("6. Tournament Invariants & Terminal States", () => {
        test("Reject status reversion from Completed to Draft (400)", async () => {
            // Tournament 1 in seed data is 'Completed'
            const res = await request("PATCH", "/api/tournaments/1/status", {
                headers: { Authorization: `Bearer ${adminToken}` },
                body: { status: "Draft" }
            });
            assert.equal(res.status, 400);
            assert.match(res.data.error, /cannot change status|Invalid tournament status/i);
        });

        test("Reject manual transition to Completed status (400)", async () => {
            const res = await request("PATCH", "/api/tournaments/1/status", {
                headers: { Authorization: `Bearer ${adminToken}` },
                body: { status: "Completed" }
            });
            assert.equal(res.status, 400);
            assert.match(res.data.error, /Completed status can only be set via match completion/i);
        });

        test("Reject creating match with unregistered player (400)", async () => {
            const res = await request("POST", "/api/tournaments/2/matches", {
                headers: { Authorization: `Bearer ${adminToken}` },
                body: {
                    roundNumber: 1,
                    player1Id: 9999, // Non-existent or unregistered
                    player2Id: 1
                }
            });
            assert.ok([400, 404].includes(res.status));
        });
    });

    describe("7. Concurrency & Ledger Lock Serialization", () => {
        test("Parallel charges for the same member serialize without deadlocks", async () => {
            const chargeRequests = Array.from({ length: 5 }, (_, i) =>
                request("POST", "/api/ledger/charge", {
                    headers: { Authorization: `Bearer ${adminToken}` },
                    body: {
                        userId: 3,
                        type: "Canteen charge",
                        amount: 10.00,
                        note: `Concurrent test charge #${i + 1}`
                    }
                })
            );

            const results = await Promise.all(chargeRequests);
            for (const r of results) {
                // Must be either 201 (success) or 402 (credit limit exceeded if accumulated),
                // but never 500 (unhandled internal server error / deadlock).
                assert.notEqual(r.status, 500, `Concurrent charge failed with 500: ${JSON.stringify(r.data)}`);
            }
        });
    });
});
