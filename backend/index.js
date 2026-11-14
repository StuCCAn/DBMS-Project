const express = require("express");
const pool = require("./db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/api/health", async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT 1 AS connected");

        res.json({
            status: "ok",
            database: rows[0].connected === 1 ? "connected" : "error"
        });
    } catch (error) {
        console.error("Database health check failed:", error.message);

        res.status(500).json({
            status: "error",
            database: "disconnected"
        });
    }
});

app.listen(PORT, () => {
    console.log(`CueClub API running on port ${PORT}`);
});
app.post("/api/auth/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                error: "Email and password are required"
            });
        }

        const [rows] = await pool.query(
            "CALL sp_get_login(?)",
            [email]
        );

        const users = rows[0];

        if (!users || users.length === 0) {
            return res.status(401).json({
                error: "Invalid email or password"
            });
        }

        const user = users[0];

        if (!user.is_active) {
            return res.status(403).json({
                error: "Account is inactive"
            });
        }

        const passwordMatch = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!passwordMatch) {
            return res.status(401).json({
                error: "Invalid email or password"
            });
        }

        const token = jwt.sign(
            {
                user_id: user.user_id,
                email: user.email,
                app_role: user.app_role,
                user_type: user.user_type
            },
            process.env.JWT_SECRET,
            { expiresIn: "2h" }
        );

        res.json({
            token,
            user: {
                user_id: user.user_id,
                name: user.name,
                email: user.email,
                app_role: user.app_role,
                user_type: user.user_type
            }
        });
    } catch (error) {
        console.error("Login failed:", error.message);

        res.status(500).json({
            error: "Internal server error"
        });
    }
});

function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            error: "Authentication required"
        });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({
            error: "Invalid or expired token"
        });
    }
}

app.get("/api/auth/me", authenticateToken, (req, res) => {
    res.json({
        user: req.user
    });
});

function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.app_role)) {
            return res.status(403).json({
                error: "Insufficient permissions"
            });
        }

        next();
    };
}


app.get("/api/tables", authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.query(
            "SELECT * FROM v_tables_status"
        );

        res.json({
            status: "success",
            data: rows
        });
    } catch (error) {
        console.error("Failed to fetch tables:", error.message);

        res.status(500).json({
            error: "Internal server error"
        });
    }
});
app.get(
    "/api/reservations",
    authenticateToken,
    requireRole("Admin", "Staff", "Member"),
    async (req, res) => {
        try {
            const { userId, tableId, status } = req.query;

            let query = "SELECT * FROM v_reservations_all WHERE 1=1";
            const params = [];

            if (req.user.app_role === "Member") {
                if (userId && Number(userId) !== Number(req.user.user_id)) {
                    return res.status(403).json({
                        error: "Members can only view their own reservations"
                    });
                }

                query += " AND user_id = ?";
                params.push(req.user.user_id);
            } else if (userId) {
                query += " AND user_id = ?";
                params.push(userId);
            }

            if (tableId) {
                query += " AND table_id = ?";
                params.push(tableId);
            }

            if (status) {
                query += " AND payment_status = ?";
                params.push(status);
            }

            const [rows] = await pool.query(query, params);

            res.json({
                status: "success",
                data: rows
            });
        } catch (error) {
            console.error("Failed to fetch reservations:", error.message);

            res.status(500).json({
                error: "Internal server error"
            });
        }
    }
);
app.get("/api/leaderboard", authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.query(
            "SELECT * FROM v_leaderboard"
        );

        res.json({
            status: "success",
            data: rows
        });
    } catch (error) {
        console.error("Failed to fetch leaderboard:", error.message);

        res.status(500).json({
            error: "Internal server error"
        });
    }
});
app.get("/api/reports/win-streaks", authenticateToken, requireRole("Admin", "Staff"), async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM v_win_streaks");

        res.json({
            status: "success",
            data: rows
        });
    } catch (error) {
        console.error("Failed to fetch win streaks:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
});


app.get("/api/reports/head-to-head", authenticateToken, requireRole("Admin", "Staff"), async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM v_head_to_head");

        res.json({
            status: "success",
            data: rows
        });
    } catch (error) {
        console.error("Failed to fetch head-to-head report:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
});


app.get("/api/tournaments/:id/bracket", authenticateToken, async (req, res) => {
    try {
        const tournamentId = Number(req.params.id);

        if (!Number.isInteger(tournamentId) || tournamentId <= 0) {
            return res.status(400).json({ error: "Invalid tournament ID" });
        }

        const [rows] = await pool.query(
            "SELECT * FROM v_bracket_tree WHERE tournament_id = ?",
            [tournamentId]
        );

        res.json({
            status: "success",
            data: rows
        });
    } catch (error) {
        console.error("Failed to fetch tournament bracket:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
});


app.get("/api/reports/table-utilisation", authenticateToken, requireRole("Admin", "Staff"), async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM v_table_utilisation");

        res.json({
            status: "success",
            data: rows
        });
    } catch (error) {
        console.error("Failed to fetch table utilisation:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
});


app.get("/api/inventory/reorder-alerts", authenticateToken, requireRole("Admin", "Staff"), async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM v_reorder_alerts");

        res.json({
            status: "success",
            data: rows
        });
    } catch (error) {
        console.error("Failed to fetch reorder alerts:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
});


app.get("/api/coaching/weaknesses", authenticateToken, async (req, res) => {
    try {
        const { playerId } = req.query;

        if (req.user.app_role === "Casual") {
            return res.status(403).json({ error: "Insufficient permissions" });
        }

        if (req.user.app_role === "Member") {
            if (playerId && Number(playerId) !== Number(req.user.user_id)) {
                return res.status(403).json({
                    error: "Members can only view their own weaknesses"
                });
            }
        }

        let query = "SELECT * FROM v_player_weaknesses";
        const params = [];

        if (playerId) {
            query += " WHERE player_id = ?";
            params.push(playerId);
        } else if (req.user.app_role === "Member") {
            query += " WHERE player_id = ?";
            params.push(req.user.user_id);
        }

        const [rows] = await pool.query(query, params);

        res.json({
            status: "success",
            data: rows
        });
    } catch (error) {
        console.error("Failed to fetch player weaknesses:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
});


app.get("/api/admin/diagnostics", authenticateToken, requireRole("Admin"), async (req, res) => {
    try {
        const [rows] = await pool.query(
            "SELECT * FROM v_specialization_anomalies"
        );

        res.json({
            status: "success",
            data: rows
        });
    } catch (error) {
        console.error("Failed to fetch diagnostics:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
});


app.get("/api/ledger/entries", authenticateToken, async (req, res) => {
    try {
        const { userId } = req.query;

        if (req.user.app_role === "Casual") {
            return res.status(403).json({ error: "Insufficient permissions" });
        }

        if (req.user.app_role === "Member") {
            if (userId && Number(userId) !== Number(req.user.user_id)) {
                return res.status(403).json({
                    error: "Members can only view their own ledger"
                });
            }
        }

        let query = "SELECT * FROM v_credit_ledger_entries";
        const params = [];

        if (userId) {
            query += " WHERE user_id = ?";
            params.push(userId);
        } else if (req.user.app_role === "Member") {
            query += " WHERE user_id = ?";
            params.push(req.user.user_id);
        }

        const [rows] = await pool.query(query, params);

        res.json({
            status: "success",
            data: rows
        });
    } catch (error) {
        console.error("Failed to fetch ledger entries:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
});


app.get("/api/tournaments", authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.query(
            "SELECT * FROM v_tournaments_list"
        );

        res.json({
            status: "success",
            data: rows
        });
    } catch (error) {
        console.error("Failed to fetch tournaments:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
});


app.get("/api/tournaments/:id/registrations", authenticateToken, async (req, res) => {
    try {
        const tournamentId = Number(req.params.id);

        if (!Number.isInteger(tournamentId) || tournamentId <= 0) {
            return res.status(400).json({ error: "Invalid tournament ID" });
        }

        const [rows] = await pool.query(
            "SELECT * FROM v_tournament_registrations WHERE tournament_id = ?",
            [tournamentId]
        );

        res.json({
            status: "success",
            data: rows
        });
    } catch (error) {
        console.error("Failed to fetch tournament registrations:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
});


app.get("/api/inventory", authenticateToken, requireRole("Admin", "Staff"), async (req, res) => {
    try {
        const [rows] = await pool.query(
            "SELECT * FROM v_inventory_catalog"
        );

        res.json({
            status: "success",
            data: rows
        });
    } catch (error) {
        console.error("Failed to fetch inventory:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
});


app.get("/api/coaching/history", authenticateToken, async (req, res) => {
    try {
        const { playerId } = req.query;

        if (req.user.app_role === "Casual") {
            return res.status(403).json({ error: "Insufficient permissions" });
        }

        if (req.user.app_role === "Member") {
            if (playerId && Number(playerId) !== Number(req.user.user_id)) {
                return res.status(403).json({
                    error: "Members can only view their own coaching history"
                });
            }
        }

        let query = "SELECT * FROM v_coaching_history";
        const params = [];

        if (playerId) {
            query += " WHERE player_id = ?";
            params.push(playerId);
        } else if (req.user.app_role === "Member") {
            query += " WHERE player_id = ?";
            params.push(req.user.user_id);
        }

        const [rows] = await pool.query(query, params);

        res.json({
            status: "success",
            data: rows
        });
    } catch (error) {
        console.error("Failed to fetch coaching history:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
});