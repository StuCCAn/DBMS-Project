const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const pool = require("./db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { body, param, validationResult } = require("express-validator");

if (!process.env.JWT_SECRET) {
    console.error("FATAL: JWT_SECRET is not defined in environment variables.");
    process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// CORS headers for frontend integration (restricted to Vite dev & preview origins)
const allowedOrigins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173"
];

app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
        res.header("Access-Control-Allow-Origin", origin);
        res.header("Access-Control-Allow-Credentials", "true");
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }
    next();
});

// ---------------------------------------------------------------------------
// Helpers: Validation middleware, OUT runner with deadlock retry & Error mapper
// ---------------------------------------------------------------------------
function validate(validations) {
    return async (req, res, next) => {
        for (const validation of validations) {
            const result = await validation.run(req);
            if (result.errors.length) break;
        }
        const errors = validationResult(req);
        if (errors.isEmpty()) {
            return next();
        }
        return res.status(400).json({
            error: errors.array()[0].msg,
            errors: errors.array()
        });
    };
}

async function callProcWithOut(callSql, params, selectOutSql, maxRetries = 2) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const conn = await pool.getConnection();
        try {
            await conn.query(callSql, params);
            const [rows] = await conn.query(selectOutSql);
            return rows[0];
        } catch (err) {
            const isLockConflict =
                err.errno === 1213 ||
                err.errno === 1205 ||
                err.code === "ER_LOCK_DEADLOCK" ||
                err.code === "ER_LOCK_WAIT_TIMEOUT";
            if (isLockConflict && attempt < maxRetries) {
                // Jittered backoff between 20ms and 50ms before retrying
                await new Promise((resolve) => setTimeout(resolve, 20 + Math.random() * 30));
                continue;
            }
            throw err;
        } finally {
            conn.release();
        }
    }
}

function sendDbError(res, error, contextMessage) {
    console.error(`${contextMessage}:`, error.message);

    // Deadlock (1213) or lock wait timeout (1205) under concurrency
    if (
        error.errno === 1213 ||
        error.errno === 1205 ||
        error.code === "ER_LOCK_DEADLOCK" ||
        error.code === "ER_LOCK_WAIT_TIMEOUT"
    ) {
        return res.status(503).json({
            error: "Service temporarily unavailable due to concurrent lock conflict. Please retry."
        });
    }

    // MySQL 8 CHECK constraint violation (sqlState HY000, errno 3819)
    if (error.errno === 3819) {
        return res.status(400).json({ error: error.message });
    }

    // Duplicate key or FK constraint violation
    if (error.sqlState === "23000") {
        const isDuplicate = error.errno === 1062;
        return res.status(isDuplicate ? 409 : 400).json({
            error: isDuplicate ? "Duplicate record already exists" : error.message
        });
    }

    // Application-level SIGNAL SQLSTATE '45000' from procedures/triggers
    if (error.sqlState === "45000") {
        const msg = error.message || "Operation rejected by database rule";
        if (msg.includes("not found")) {
            return res.status(404).json({ error: msg });
        }
        if (
            msg.includes("Rule R9") ||
            msg.includes("registered club members") ||
            msg.includes("active, non-expired club members")
        ) {
            return res.status(403).json({ error: msg });
        }
        if (
            msg.includes("Double booking") ||
            msg.includes("not available for booking") ||
            msg.includes("Registration is not open")
        ) {
            return res.status(409).json({ error: msg });
        }
        if (msg.includes("Credit limit exceeded")) {
            return res.status(402).json({ error: msg });
        }
        return res.status(400).json({ error: msg });
    }

    return res.status(500).json({ error: "Internal server error" });
}

// ---------------------------------------------------------------------------
// Health & Authentication
// ---------------------------------------------------------------------------
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

const EMAIL_ALIASES = {
    "admin@example.com": "rohan@example.com",
    "staff@example.com": "imran@example.com",
    "member@example.com": "aarav@example.com",
    "casual@example.com": "vikram@example.com"
};

app.post(
    "/api/auth/login",
    validate([
        body("email").trim().notEmpty().withMessage("Email is required").isEmail().withMessage("Valid email is required"),
        body("password").notEmpty().withMessage("Password is required")
    ]),
    async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                error: "Email and password are required"
            });
        }

        const rawEmail = (email || "").trim().toLowerCase();
        const lookupEmail = EMAIL_ALIASES[rawEmail] || rawEmail;

        const [rows] = await pool.query("CALL sp_get_login(?)", [lookupEmail]);
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

        if (!user.password_hash) {
            return res.status(401).json({
                error: "Password not configured for this account"
            });
        }

        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        if (!passwordMatch) {
            return res.status(401).json({
                error: "Invalid email or password"
            });
        }

        const isAlias = Boolean(EMAIL_ALIASES[rawEmail]);
        const displayEmail = isAlias ? rawEmail : user.email;
        const displayName = isAlias ? `${user.app_role} User` : user.name;

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
                name: displayName,
                email: displayEmail,
                app_role: user.app_role,
                user_type: user.user_type
            }
        });
    } catch (error) {
        sendDbError(res, error, "Login failed");
    }
});

app.post(
    "/api/auth/register",
    validate([
        body("name").trim().notEmpty().withMessage("Full name is required"),
        body("email").trim().notEmpty().withMessage("Email is required").isEmail().withMessage("Valid email is required"),
        body("password").isString().isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
        body("phone").optional().trim()
    ]),
    async (req, res) => {
    try {
        const { name, email, password, phone, role } = req.body;
        const cleanEmail = (email || "").trim().toLowerCase();
        const cleanPhone = (phone && phone.trim()) || "9876543210";
        const requestedRole = (role === "Member") ? "Member" : "Casual";

        // Check if email already exists
        const [existing] = await pool.query("CALL sp_get_login(?)", [cleanEmail]);
        if (existing[0] && existing[0].length > 0) {
            return res.status(409).json({ error: "An account with this email already exists" });
        }

        let userId;
        if (requestedRole === "Member") {
            const membershipNo = `MEM-${Date.now().toString().slice(-6)}`;
            const today = new Date();
            const nextYear = new Date(today);
            nextYear.setFullYear(today.getFullYear() + 1);
            const startDate = today.toISOString().split("T")[0];
            const endDate = nextYear.toISOString().split("T")[0];

            const out = await callProcWithOut(
                "CALL sp_register_member(?, ?, ?, ?, ?, ?, ?, ?, ?, @p_user_id)",
                [
                    name.trim(),
                    cleanPhone,
                    cleanEmail,
                    membershipNo,
                    "Annual",
                    startDate,
                    endDate,
                    0,
                    2000
                ],
                "SELECT @p_user_id AS user_id"
            );
            userId = out.user_id;
        } else {
            const out = await callProcWithOut(
                "CALL sp_register_casual(?, ?, ?, @p_user_id)",
                [name.trim(), cleanPhone, cleanEmail],
                "SELECT @p_user_id AS user_id"
            );
            userId = out.user_id;
        }

        const passwordHash = await bcrypt.hash(password, 10);
        await pool.query("CALL sp_set_password(?, ?)", [userId, passwordHash]);

        const token = jwt.sign(
            {
                user_id: userId,
                email: cleanEmail,
                app_role: requestedRole,
                user_type: requestedRole
            },
            process.env.JWT_SECRET,
            { expiresIn: "2h" }
        );

        res.status(201).json({
            token,
            user: {
                user_id: userId,
                name: name.trim(),
                email: cleanEmail,
                app_role: requestedRole,
                user_type: requestedRole
            }
        });
    } catch (error) {
        sendDbError(res, error, "Registration failed");
    }
});

async function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            error: "Authentication required"
        });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Immediate revocation check: deactivated users cannot make authenticated requests
        const [rows] = await pool.query("CALL sp_get_login(?)", [decoded.email]);
        const users = rows[0];
        if (!users || users.length === 0 || !users[0].is_active) {
            return res.status(403).json({
                error: "User account is deactivated or no longer exists"
            });
        }

        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({
            error: "Invalid or expired token"
        });
    }
}

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

app.get("/api/auth/me", authenticateToken, (req, res) => {
    res.json({ user: req.user });
});

// ---------------------------------------------------------------------------
// User Registration & Lifecycle (Members, Casuals, Password, Deactivate)
// ---------------------------------------------------------------------------
app.post(
    "/api/members",
    authenticateToken,
    requireRole("Admin", "Staff"),
    validate([
        body("name").trim().notEmpty().withMessage("name is required"),
        body("phone").trim().notEmpty().withMessage("phone is required"),
        body("email").trim().notEmpty().withMessage("email is required").isEmail().withMessage("Valid email is required"),
        body("membershipNo").trim().notEmpty().withMessage("membershipNo is required"),
        body("plan").isIn(["Monthly", "Quarterly", "Annual"]).withMessage("plan must be Monthly, Quarterly, or Annual"),
        body("startDate").trim().notEmpty().withMessage("startDate is required"),
        body("endDate").trim().notEmpty().withMessage("endDate is required"),
        body("discountPct").optional().isFloat({ min: 0, max: 100 }).withMessage("discountPct must be between 0 and 100"),
        body("creditLimit").optional().isFloat({ min: 0 }).withMessage("creditLimit must be a non-negative number"),
        body("password").optional({ checkFalsy: true }).isString().isLength({ min: 6 }).withMessage("Password must be at least 6 characters")
    ]),
    async (req, res) => {
    try {
        const {
            name,
            phone,
            email,
            membershipNo,
            plan,
            startDate,
            endDate,
            discountPct = 0,
            creditLimit = 0,
            password
        } = req.body;

        if (!name || !phone || !email || !membershipNo || !plan || !startDate || !endDate) {
            return res.status(400).json({
                error: "name, phone, email, membershipNo, plan, startDate, and endDate are required"
            });
        }

        if (password !== undefined && password !== null && password !== "") {
            if (typeof password !== "string" || password.length < 6) {
                return res.status(400).json({
                    error: "Password must be at least 6 characters"
                });
            }
        }

        const out = await callProcWithOut(
            "CALL sp_register_member(?, ?, ?, ?, ?, ?, ?, ?, ?, @p_user_id)",
            [
                name,
                phone,
                email,
                membershipNo,
                plan,
                startDate,
                endDate,
                Number(discountPct),
                Number(creditLimit)
            ],
            "SELECT @p_user_id AS user_id"
        );

        if (password) {
            const passwordHash = await bcrypt.hash(password, 10);
            await pool.query("CALL sp_set_password(?, ?)", [out.user_id, passwordHash]);
        }

        res.status(201).json({
            status: "success",
            data: {
                user_id: out.user_id,
                userId: out.user_id,
                name,
                membershipNo,
                userType: "Member",
                appRole: "Member"
            }
        });
    } catch (error) {
        sendDbError(res, error, "Failed to register member");
    }
});

app.post(
    "/api/casuals",
    authenticateToken,
    requireRole("Admin", "Staff"),
    validate([
        body("name").trim().notEmpty().withMessage("name is required"),
        body("phone").trim().notEmpty().withMessage("phone is required"),
        body("email").trim().notEmpty().withMessage("email is required").isEmail().withMessage("Valid email is required"),
        body("password").optional({ checkFalsy: true }).isString().isLength({ min: 6 }).withMessage("Password must be at least 6 characters")
    ]),
    async (req, res) => {
    try {
        const { name, phone, email, password } = req.body;

        if (!name || !phone || !email) {
            return res.status(400).json({
                error: "name, phone, and email are required"
            });
        }

        if (password !== undefined && password !== null && password !== "") {
            if (typeof password !== "string" || password.length < 6) {
                return res.status(400).json({
                    error: "Password must be at least 6 characters"
                });
            }
        }

        const out = await callProcWithOut(
            "CALL sp_register_casual(?, ?, ?, @p_user_id)",
            [name, phone, email],
            "SELECT @p_user_id AS user_id"
        );

        if (password) {
            const passwordHash = await bcrypt.hash(password, 10);
            await pool.query("CALL sp_set_password(?, ?)", [out.user_id, passwordHash]);
        }

        res.status(201).json({
            status: "success",
            data: {
                user_id: out.user_id,
                userId: out.user_id,
                name,
                userType: "Casual",
                appRole: "Casual"
            }
        });
    } catch (error) {
        sendDbError(res, error, "Failed to register casual player");
    }
});

app.put(
    "/api/users/:id/password",
    authenticateToken,
    validate([
        param("id").isInt({ min: 1 }).withMessage("Invalid user ID"),
        body("newPassword").isString().isLength({ min: 6 }).withMessage("Password must be at least 6 characters")
    ]),
    async (req, res) => {
    try {
        const targetUserId = Number(req.params.id);
        const { currentPassword, newPassword } = req.body;

        if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
            return res.status(400).json({ error: "Invalid user ID" });
        }

        if (typeof newPassword !== "string" || newPassword.length < 6) {
            return res.status(400).json({ error: "Password must be at least 6 characters" });
        }

        const isAdmin = req.user.app_role === "Admin";
        const isSelf = Number(req.user.user_id) === targetUserId;

        if (!isAdmin && !isSelf) {
            return res.status(403).json({
                error: "You can only change your own password"
            });
        }

        // Self-change requires verification of currentPassword
        if (isSelf) {
            if (!currentPassword || typeof currentPassword !== "string") {
                return res.status(400).json({ error: "currentPassword is required to change password" });
            }

            const [userRows] = await pool.query("CALL sp_get_login(?)", [req.user.email]);
            const users = userRows[0];

            if (!users || users.length === 0) {
                return res.status(404).json({ error: "User not found" });
            }

            const currentHash = users[0].password_hash;
            const isMatch = currentHash ? await bcrypt.compare(currentPassword, currentHash) : false;
            if (!isMatch) {
                return res.status(400).json({ error: "Current password is incorrect" });
            }
        }

        const passwordHash = await bcrypt.hash(newPassword, 10);
        await pool.query("CALL sp_set_password(?, ?)", [targetUserId, passwordHash]);

        res.json({
            status: "success",
            data: { user_id: targetUserId }
        });
    } catch (error) {
        sendDbError(res, error, "Failed to set password");
    }
});

async function handleDeactivateUser(req, res) {
    try {
        const targetUserId = Number(req.params.id);

        if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
            return res.status(400).json({ error: "Invalid user ID" });
        }

        if (targetUserId === Number(req.user.user_id)) {
            return res.status(400).json({ error: "You cannot deactivate your own account" });
        }

        await pool.query("CALL sp_deactivate_user(?)", [targetUserId]);

        res.json({
            status: "success",
            data: {
                user_id: targetUserId,
                is_active: false
            }
        });
    } catch (error) {
        sendDbError(res, error, "Failed to deactivate user");
    }
}

app.patch("/api/users/:id/deactivate", authenticateToken, requireRole("Admin"), validate([param("id").isInt({ min: 1 }).withMessage("Invalid user ID")]), handleDeactivateUser);
app.post("/api/users/:id/deactivate", authenticateToken, requireRole("Admin"), validate([param("id").isInt({ min: 1 }).withMessage("Invalid user ID")]), handleDeactivateUser);

// ---------------------------------------------------------------------------
// Tables & Reservations
// ---------------------------------------------------------------------------
app.get("/api/tables", authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM v_tables_status");
        res.json({ status: "success", data: rows });
    } catch (error) {
        sendDbError(res, error, "Failed to fetch tables");
    }
});

app.patch(
    "/api/tables/:id/status",
    authenticateToken,
    requireRole("Admin", "Staff"),
    validate([
        param("id").isInt({ min: 1 }).withMessage("Invalid table ID"),
        body("status").isIn(["Available", "Maintenance", "Retired"]).withMessage("Invalid table status: must be Available, Maintenance, or Retired")
    ]),
    async (req, res) => {
    try {
        const tableId = Number(req.params.id);
        const { status } = req.body;

        if (!Number.isInteger(tableId) || tableId <= 0) {
            return res.status(400).json({ error: "Invalid table ID" });
        }
        if (!status) {
            return res.status(400).json({ error: "status is required" });
        }

        await pool.query("CALL sp_set_table_status(?, ?)", [tableId, status]);

        res.json({
            status: "success",
            data: { table_id: tableId, status }
        });
    } catch (error) {
        sendDbError(res, error, "Failed to update table status");
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
            res.json({ status: "success", data: rows });
        } catch (error) {
            sendDbError(res, error, "Failed to fetch reservations");
        }
    }
);

app.post(
    "/api/reservations",
    authenticateToken,
    validate([
        body("tableId").isInt({ min: 1 }).withMessage("tableId must be a positive integer"),
        body("start").trim().notEmpty().withMessage("start is required"),
        body("end").trim().notEmpty().withMessage("end is required"),
        body("mode").isIn(["Hourly", "PerFrame"]).withMessage("mode must be Hourly or PerFrame"),
        body("frames").isInt({ min: 0 }).withMessage("frames must be a non-negative integer"),
        body("payStatus").isIn(["Pending", "Paid", "OnCredit", "Cancelled"]).withMessage("payStatus must be Pending, Paid, OnCredit, or Cancelled"),
        body("userId").optional().isInt({ min: 1 }).withMessage("userId must be a positive integer")
    ]),
    async (req, res) => {
    try {
        const { userId, tableId, start, end, mode, frames, payStatus } = req.body;

        if (req.user.app_role === "Casual") {
            return res.status(403).json({ error: "Insufficient permissions" });
        }

        const targetUserId = userId === undefined
            ? Number(req.user.user_id)
            : Number(userId);

        if (
            req.user.app_role === "Member" &&
            targetUserId !== Number(req.user.user_id)
        ) {
            return res.status(403).json({
                error: "Members can only book for themselves"
            });
        }

        if (!tableId || !start || !end || !mode || frames === undefined || !payStatus) {
            return res.status(400).json({
                error: "tableId, start, end, mode, frames, and payStatus are required"
            });
        }

        const out = await callProcWithOut(
            "CALL sp_book_table(?, ?, ?, ?, ?, ?, ?, @p_reservation_id)",
            [
                targetUserId,
                Number(tableId),
                start,
                end,
                mode,
                Number(frames),
                payStatus
            ],
            "SELECT @p_reservation_id AS reservation_id"
        );

        res.status(201).json({
            status: "success",
            data: { reservation_id: out.reservation_id }
        });
    } catch (error) {
        sendDbError(res, error, "Failed to create reservation");
    }
});

app.post(
    "/api/reservations/:id/cancel",
    authenticateToken,
    validate([
        param("id").isInt({ min: 1 }).withMessage("Invalid reservation ID")
    ]),
    async (req, res) => {
    try {
        const reservationId = Number(req.params.id);

        if (!Number.isInteger(reservationId) || reservationId <= 0) {
            return res.status(400).json({ error: "Invalid reservation ID" });
        }

        if (req.user.app_role === "Casual") {
            return res.status(403).json({ error: "Insufficient permissions" });
        }

        if (req.user.app_role === "Member") {
            const [rows] = await pool.query(
                "SELECT user_id FROM v_reservations_all WHERE reservation_id = ?",
                [reservationId]
            );

            if (!rows.length) {
                return res.status(404).json({ error: "Reservation not found" });
            }

            if (Number(rows[0].user_id) !== Number(req.user.user_id)) {
                return res.status(403).json({
                    error: "Members can only cancel their own reservations"
                });
            }
        }

        const out = await callProcWithOut(
            "CALL sp_cancel_booking(?, @p_refund_amount)",
            [reservationId],
            "SELECT @p_refund_amount AS refund_amount"
        );

        res.json({
            status: "success",
            data: {
                reservation_id: reservationId,
                refund_amount: out.refund_amount
            }
        });
    } catch (error) {
        sendDbError(res, error, "Failed to cancel reservation");
    }
});

// ---------------------------------------------------------------------------
// Credit Ledger & Member Balance
// ---------------------------------------------------------------------------
app.get("/api/members/:id/balance", authenticateToken, async (req, res) => {
    try {
        const memberId = Number(req.params.id);

        if (!Number.isInteger(memberId) || memberId <= 0) {
            return res.status(400).json({ error: "Invalid member ID" });
        }

        if (req.user.app_role === "Casual") {
            return res.status(403).json({ error: "Insufficient permissions" });
        }

        if (
            req.user.app_role === "Member" &&
            memberId !== Number(req.user.user_id)
        ) {
            return res.status(403).json({
                error: "Members can only view their own balance"
            });
        }

        const [rows] = await pool.query(
            "SELECT * FROM v_member_balance WHERE user_id = ?",
            [memberId]
        );

        if (!rows.length) {
            return res.status(404).json({ error: "Member balance not found" });
        }

        res.json({ status: "success", data: rows[0] });
    } catch (error) {
        sendDbError(res, error, "Failed to fetch member balance");
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
        res.json({ status: "success", data: rows });
    } catch (error) {
        sendDbError(res, error, "Failed to fetch ledger entries");
    }
});

app.post(
    "/api/ledger/payment",
    authenticateToken,
    requireRole("Admin", "Staff"),
    validate([
        body("userId").isInt({ min: 1 }).withMessage("userId must be a positive integer"),
        body("amount").isFloat({ gt: 0 }).withMessage("amount must be a positive number"),
        body("note").optional().isString()
    ]),
    async (req, res) => {
    try {
        const { userId, amount, note } = req.body;

        if (!userId || amount === undefined || !Number.isFinite(Number(amount))) {
            return res.status(400).json({
                error: "userId and numeric amount are required"
            });
        }

        const out = await callProcWithOut(
            "CALL sp_record_payment(?, ?, ?, @p_entry_id)",
            [Number(userId), Number(amount), note || null],
            "SELECT @p_entry_id AS entry_id"
        );

        res.status(201).json({
            status: "success",
            data: { entry_id: out.entry_id }
        });
    } catch (error) {
        sendDbError(res, error, "Failed to record payment");
    }
});

app.post(
    "/api/ledger/charge",
    authenticateToken,
    requireRole("Admin", "Staff"),
    validate([
        body("userId").isInt({ min: 1 }).withMessage("userId must be a positive integer"),
        body("type").isIn(["Canteen charge", "Fine"]).withMessage("type must be Canteen charge or Fine"),
        body("amount").isFloat({ gt: 0 }).withMessage("amount must be a positive number"),
        body("note").optional().isString()
    ]),
    async (req, res) => {
    try {
        const { userId, type, amount, note } = req.body;

        if (!userId || !type || amount === undefined || !Number.isFinite(Number(amount))) {
            return res.status(400).json({
                error: "userId, type, and numeric amount are required"
            });
        }

        const out = await callProcWithOut(
            "CALL sp_record_charge(?, ?, ?, ?, @p_entry_id)",
            [Number(userId), type, Number(amount), note || null],
            "SELECT @p_entry_id AS entry_id"
        );

        res.status(201).json({
            status: "success",
            data: { entry_id: out.entry_id }
        });
    } catch (error) {
        sendDbError(res, error, "Failed to record charge");
    }
});

// ---------------------------------------------------------------------------
// Tournaments, Matches & Leaderboard
// ---------------------------------------------------------------------------
app.get("/api/leaderboard", authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM v_leaderboard");
        res.json({ status: "success", data: rows });
    } catch (error) {
        sendDbError(res, error, "Failed to fetch leaderboard");
    }
});

app.get("/api/tournaments", authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM v_tournaments_list");
        res.json({ status: "success", data: rows });
    } catch (error) {
        sendDbError(res, error, "Failed to fetch tournaments");
    }
});

app.post(
    "/api/tournaments",
    authenticateToken,
    requireRole("Admin", "Staff"),
    validate([
        body("title").trim().notEmpty().withMessage("title is required"),
        body("game").isIn(["Snooker", "Pool", "Billiards"]).withMessage("game must be Snooker, Pool, or Billiards"),
        body("format").isIn(["Knockout", "League"]).withMessage("format must be Knockout or League"),
        body("start").trim().notEmpty().withMessage("start is required"),
        body("fee").isFloat({ min: 0 }).withMessage("fee must be a non-negative number")
    ]),
    async (req, res) => {
    try {
        const { title, game, format, start, fee } = req.body;

        if (!title || !game || !format || !start || fee === undefined) {
            return res.status(400).json({
                error: "title, game, format, start, and fee are required"
            });
        }

        const out = await callProcWithOut(
            "CALL sp_create_tournament(?, ?, ?, ?, ?, @p_tournament_id)",
            [title, game, format, start, Number(fee)],
            "SELECT @p_tournament_id AS tournament_id"
        );

        res.status(201).json({
            status: "success",
            data: { tournament_id: out.tournament_id }
        });
    } catch (error) {
        sendDbError(res, error, "Failed to create tournament");
    }
});

app.patch(
    "/api/tournaments/:id/status",
    authenticateToken,
    requireRole("Admin", "Staff"),
    validate([
        param("id").isInt({ min: 1 }).withMessage("Invalid tournament ID"),
        body("status").isIn(["Draft", "Registration", "Ongoing", "Completed", "Cancelled"]).withMessage("Invalid tournament status: must be Draft, Registration, Ongoing, Completed, or Cancelled")
    ]),
    async (req, res) => {
    try {
        const tournamentId = Number(req.params.id);
        const { status } = req.body;

        if (!Number.isInteger(tournamentId) || tournamentId <= 0) {
            return res.status(400).json({ error: "Invalid tournament ID" });
        }
        if (!status) {
            return res.status(400).json({ error: "status is required" });
        }

        await pool.query("CALL sp_set_tournament_status(?, ?)", [tournamentId, status]);

        res.json({
            status: "success",
            data: { tournament_id: tournamentId, status }
        });
    } catch (error) {
        sendDbError(res, error, "Failed to update tournament status");
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
        res.json({ status: "success", data: rows });
    } catch (error) {
        sendDbError(res, error, "Failed to fetch tournament registrations");
    }
});

app.post(
    "/api/tournaments/:id/register",
    authenticateToken,
    validate([
        param("id").isInt({ min: 1 }).withMessage("Invalid tournament ID"),
        body("feePaid").isBoolean().withMessage("feePaid is required and must be boolean"),
        body("userId").optional().isInt({ min: 1 }).withMessage("userId must be a positive integer"),
        body("seed").optional({ nullable: true }).isInt({ min: 1 }).withMessage("seed must be a positive integer")
    ]),
    async (req, res) => {
    try {
        const tournamentId = Number(req.params.id);
        const { userId, seed, feePaid } = req.body;

        if (!Number.isInteger(tournamentId) || tournamentId <= 0) {
            return res.status(400).json({ error: "Invalid tournament ID" });
        }

        if (req.user.app_role === "Casual") {
            return res.status(403).json({ error: "Insufficient permissions" });
        }

        const targetUserId = userId === undefined
            ? Number(req.user.user_id)
            : Number(userId);

        if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
            return res.status(400).json({ error: "Invalid user ID" });
        }

        if (
            req.user.app_role === "Member" &&
            targetUserId !== Number(req.user.user_id)
        ) {
            return res.status(403).json({
                error: "Members can only register themselves"
            });
        }

        if (feePaid === undefined) {
            return res.status(400).json({ error: "feePaid is required" });
        }

        await pool.query(
            "CALL sp_register_tournament_player(?, ?, ?, ?)",
            [tournamentId, targetUserId, seed === undefined ? null : seed, feePaid]
        );

        res.status(201).json({
            status: "success",
            data: {
                tournament_id: tournamentId,
                user_id: targetUserId,
                seed: seed === undefined ? null : seed,
                fee_paid: feePaid
            }
        });
    } catch (error) {
        sendDbError(res, error, "Failed to register tournament player");
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
        res.json({ status: "success", data: rows });
    } catch (error) {
        sendDbError(res, error, "Failed to fetch tournament bracket");
    }
});

app.post(
    "/api/tournaments/:id/matches",
    authenticateToken,
    requireRole("Admin", "Staff"),
    validate([
        param("id").isInt({ min: 1 }).withMessage("Invalid tournament ID"),
        body("roundNumber").isInt({ min: 1 }).withMessage("roundNumber is required and must be an integer >= 1"),
        body("player1Id").optional({ nullable: true }).isInt({ min: 1 }).withMessage("player1Id must be a positive integer"),
        body("player2Id").optional({ nullable: true }).isInt({ min: 1 }).withMessage("player2Id must be a positive integer"),
        body("nextMatchId").optional({ nullable: true }).isInt({ min: 1 }).withMessage("nextMatchId must be a positive integer"),
        body("tableId").optional({ nullable: true }).isInt({ min: 1 }).withMessage("tableId must be a positive integer")
    ]),
    async (req, res) => {
    try {
        const tournamentId = Number(req.params.id);
        const {
            roundNumber,
            player1Id = null,
            player2Id = null,
            nextMatchId = null,
            tableId = null,
            scheduledTime = null
        } = req.body;

        if (!Number.isInteger(tournamentId) || tournamentId <= 0) {
            return res.status(400).json({ error: "Invalid tournament ID" });
        }

        if (roundNumber === undefined || !Number.isInteger(Number(roundNumber))) {
            return res.status(400).json({ error: "roundNumber is required" });
        }

        const out = await callProcWithOut(
            "CALL sp_create_match(?, ?, ?, ?, ?, ?, ?, @p_match_id)",
            [
                tournamentId,
                Number(roundNumber),
                player1Id === null ? null : Number(player1Id),
                player2Id === null ? null : Number(player2Id),
                nextMatchId === null ? null : Number(nextMatchId),
                tableId === null ? null : Number(tableId),
                scheduledTime
            ],
            "SELECT @p_match_id AS match_id"
        );

        res.status(201).json({
            status: "success",
            data: { match_id: out.match_id }
        });
    } catch (error) {
        sendDbError(res, error, "Failed to create match");
    }
});

app.post(
    "/api/matches/:id/complete",
    authenticateToken,
    requireRole("Admin", "Staff"),
    validate([
        param("id").isInt({ min: 1 }).withMessage("Invalid match ID"),
        body("frames").isArray({ min: 1 }).withMessage("frames must be an array"),
        body("winPoints").isInt({ min: 0 }).withMessage("winPoints must be an integer >= 0"),
        body("lossPoints").isInt({ min: 0 }).withMessage("lossPoints must be an integer >= 0")
    ]),
    async (req, res) => {
    try {
        const matchId = Number(req.params.id);
        const { frames, winPoints, lossPoints } = req.body;

        if (!Number.isInteger(matchId) || matchId <= 0) {
            return res.status(400).json({ error: "Invalid match ID" });
        }
        if (!Array.isArray(frames)) {
            return res.status(400).json({ error: "frames must be an array" });
        }
        if (winPoints === undefined || lossPoints === undefined) {
            return res.status(400).json({ error: "winPoints and lossPoints are required" });
        }

        await pool.query(
            "CALL sp_complete_match(?, ?, ?, ?)",
            [matchId, JSON.stringify(frames), Number(winPoints), Number(lossPoints)]
        );

        res.json({
            status: "success",
            data: { match_id: matchId }
        });
    } catch (error) {
        sendDbError(res, error, "Failed to complete match");
    }
});

// ---------------------------------------------------------------------------
// Inventory & Reorder Alerts
// ---------------------------------------------------------------------------
app.get("/api/inventory", authenticateToken, requireRole("Admin", "Staff"), async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM v_inventory_catalog");
        const mapped = rows.map((r) => ({
            ...r,
            item_name: r.name,
            quantity_available: r.quantity
        }));
        res.json({ status: "success", data: mapped });
    } catch (error) {
        sendDbError(res, error, "Failed to fetch inventory");
    }
});

app.get("/api/inventory/reorder-alerts", authenticateToken, requireRole("Admin", "Staff"), async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM v_reorder_alerts");
        const mapped = rows.map((r) => ({
            ...r,
            item_name: r.name,
            quantity_available: r.quantity
        }));
        res.json({ status: "success", data: mapped });
    } catch (error) {
        sendDbError(res, error, "Failed to fetch reorder alerts");
    }
});

app.patch(
    "/api/inventory/:id/stock",
    authenticateToken,
    requireRole("Admin", "Staff"),
    validate([
        param("id").isInt({ min: 1 }).withMessage("Invalid inventory item ID"),
        body("delta").isNumeric().withMessage("numeric delta is required")
    ]),
    async (req, res) => {
    try {
        const itemId = Number(req.params.id);
        const { delta } = req.body;

        if (!Number.isInteger(itemId) || itemId <= 0) {
            return res.status(400).json({ error: "Invalid inventory item ID" });
        }
        if (delta === undefined || !Number.isFinite(Number(delta))) {
            return res.status(400).json({ error: "numeric delta is required" });
        }

        await pool.query("CALL sp_update_inventory_stock(?, ?)", [itemId, Number(delta)]);

        res.json({
            status: "success",
            data: { item_id: itemId, delta: Number(delta) }
        });
    } catch (error) {
        sendDbError(res, error, "Failed to update inventory stock");
    }
});

app.patch(
    "/api/inventory/:id/condition",
    authenticateToken,
    requireRole("Admin", "Staff"),
    validate([
        param("id").isInt({ min: 1 }).withMessage("Invalid inventory item ID"),
        body("status").isIn(["Good", "Needs Service", "Damaged", "Retired"]).withMessage("status must be Good, Needs Service, Damaged, or Retired")
    ]),
    async (req, res) => {
    try {
        const itemId = Number(req.params.id);
        const { status } = req.body;

        if (!Number.isInteger(itemId) || itemId <= 0) {
            return res.status(400).json({ error: "Invalid inventory item ID" });
        }
        if (!status) {
            return res.status(400).json({ error: "status is required" });
        }

        await pool.query("CALL sp_set_inventory_condition(?, ?)", [itemId, status]);

        res.json({
            status: "success",
            data: { item_id: itemId, status }
        });
    } catch (error) {
        sendDbError(res, error, "Failed to update inventory condition");
    }
});

// ---------------------------------------------------------------------------
// Coaching Assessments, History & Weaknesses
// ---------------------------------------------------------------------------
app.post(
    "/api/coaching/assessments",
    authenticateToken,
    requireRole("Admin", "Staff"),
    validate([
        body("playerId").isInt({ min: 1 }).withMessage("playerId must be a positive integer"),
        body("rating").isInt({ min: 1, max: 10 }).withMessage("rating must be between 1 and 10"),
        body().custom((val) => {
            const skill = val.skillArea || val.skill;
            const valid = ["Long potting", "Safety play", "Break building", "Positional play", "Cue ball control", "Pressure handling"];
            if (!skill || !valid.includes(skill)) {
                throw new Error("skillArea must match allowed assessment categories");
            }
            return true;
        })
    ]),
    async (req, res) => {
    try {
        const { playerId, assessedBy, coachId, skillArea, skill, rating, notes } = req.body;
        const resolvedSkill = skillArea || skill;
        const resolvedAssessor = assessedBy !== undefined
            ? Number(assessedBy)
            : coachId !== undefined
                ? Number(coachId)
                : Number(req.user.user_id);

        if (!playerId || !resolvedSkill || rating === undefined) {
            return res.status(400).json({
                error: "playerId, skillArea, and rating are required"
            });
        }

        await pool.query(
            "CALL sp_record_assessment(?, ?, ?, ?, ?)",
            [
                Number(playerId),
                resolvedAssessor,
                resolvedSkill,
                Number(rating),
                notes || null
            ]
        );

        res.status(201).json({
            status: "success",
            data: {
                player_id: Number(playerId),
                assessed_by: resolvedAssessor,
                skill_area: resolvedSkill,
                rating: Number(rating)
            }
        });
    } catch (error) {
        sendDbError(res, error, "Failed to record coaching assessment");
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
        const mapped = rows.map((r) => ({
            ...r,
            assessment_date: r.assessed_on,
            focus_area: r.skill_area
        }));
        res.json({ status: "success", data: mapped });
    } catch (error) {
        sendDbError(res, error, "Failed to fetch coaching history");
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
        const mapped = rows.map((r) => ({
            ...r,
            focus_area: r.skill_area,
            avg_rating: r.rating
        }));
        res.json({ status: "success", data: mapped });
    } catch (error) {
        sendDbError(res, error, "Failed to fetch player weaknesses");
    }
});

// ---------------------------------------------------------------------------
// Analytical Reports & Admin Diagnostics
// ---------------------------------------------------------------------------
app.get("/api/reports/win-streaks", authenticateToken, requireRole("Admin", "Staff"), async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM v_win_streaks");
        const mapped = rows.map((r) => ({
            ...r,
            player_name: r.name,
            current_win_streak: Number(r.streak_length || 0)
        }));
        res.json({ status: "success", data: mapped });
    } catch (error) {
        sendDbError(res, error, "Failed to fetch win streaks");
    }
});

app.get("/api/reports/head-to-head", authenticateToken, requireRole("Admin", "Staff"), async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM v_head_to_head");
        const mapped = rows.map((r) => ({
            ...r,
            player1_name: r.player,
            player2_name: r.opponent,
            player1_wins: Number(r.wins || 0),
            player2_wins: Number(r.losses || 0)
        }));
        res.json({ status: "success", data: mapped });
    } catch (error) {
        sendDbError(res, error, "Failed to fetch head-to-head report");
    }
});

app.get("/api/reports/table-utilisation", authenticateToken, requireRole("Admin", "Staff"), async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM v_table_utilisation");
        const mapped = rows.map((r) => ({
            ...r,
            table_name: r.name,
            total_reservations: Number(r.bookings || 0),
            utilisation_percentage: r.peak_share_pct !== null && r.peak_share_pct !== undefined ? Number(r.peak_share_pct) : 0,
            booked_hours: Number(r.booked_hours || 0)
        }));
        res.json({ status: "success", data: mapped });
    } catch (error) {
        sendDbError(res, error, "Failed to fetch table utilisation");
    }
});

app.get("/api/admin/diagnostics", authenticateToken, requireRole("Admin"), async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM v_specialization_anomalies");
        const mapped = rows.map((r) => ({
            ...r,
            anomaly_type: r.anomaly_reason
        }));
        res.json({ status: "success", data: mapped });
    } catch (error) {
        sendDbError(res, error, "Failed to fetch diagnostics");
    }
});

let server;
if (require.main === module) {
    server = app.listen(PORT, () => {
        console.log(`CueClub API running on port ${PORT}`);
    });
}

module.exports = { app, pool };