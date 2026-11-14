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
