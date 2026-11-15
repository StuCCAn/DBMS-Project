# CueClub Backend API

Production-ready REST API service for CueClub (Cue sports club and tournament management system), built for **CS F212 Database Systems** at BITS Pilani, Hyderabad Campus.

---

## 1. Architecture Overview

The backend acts as a secure, authenticated REST gateway communicating with MySQL 8.0:
- **Zero Business Logic in Application Code:** All domain rules, state transitions, financial ledger entries, and bracket computations are executed directly inside MySQL stored procedures, triggers, and views.
- **Least-Privilege Security:** Connects using the restricted database role `cueclub_api` (no raw table writes; execute-only on procedures and select-only on views).
- **Session & Concurrency Isolation:** OUT-parameter procedures acquire dedicated connections via `pool.getConnection()` with automatic exponential-jitter retry on MySQL deadlocks (1213) and lock wait timeouts (1205).
- **Authentication & RBAC:** Stateless JWT tokens signed with `JWT_SECRET` with instant token revocation check on deactivated user accounts. Passwords hashed using standard `bcryptjs`.

---

## 2. Environment Configuration

Copy `.env.example` to `.env` in the `backend/` directory:

```bash
cp .env.example .env
```

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `3000` | HTTP port for the Express application. |
| `JWT_SECRET` | **Yes** | — | Cryptographic secret for signing and verifying JWT tokens. |
| `DB_HOST` | **Yes** | `127.0.0.1` | MySQL server hostname or IP. |
| `DB_PORT` | No | `3306` | MySQL TCP port. |
| `DB_USER` | **Yes** | `cueclub_api` | Restricted MySQL user account. |
| `DB_PASSWORD` | **Yes** | `api-secret-2026` | MySQL user password. |
| `DB_NAME` | **Yes** | `cueclub` | Target database name. |

---

## 3. Quick Start

### 3.1 Install Dependencies
```bash
npm install
```

### 3.2 Generate Seed Passwords (Optional)
Seed accounts come pre-configured with the standard default password `cueclub_default`. To generate or verify hashes:
```bash
npm run seed:hash [password]
```

### 3.3 Start the Server
```bash
npm start
```
The server will bind to `http://localhost:3000` and output connection status.

### 3.4 Run Automated Integration Tests
```bash
npm test
```

---

## 4. Pre-Seeded Demo Accounts

The database seed (`database/seed.sql`) initializes the following demonstration users. All accounts use the standard password: `cueclub_default`.

| User ID | Email | Name | User Type | App Role | Initial State |
|:---:|---|---|---|---|---|
| **1** | `rohan@example.com` | Rohan Mehta | Member | **Admin** | Active |
| **2** | `imran@example.com` | Imran Sheikh | Member | **Staff** | Active |
| **3** | `aarav@example.com` | Aarav Nair | Member | **Member** | Active |
| **4** | `kabir@example.com` | Kabir Rao | Member | **Member** | Active |
| **5** | `vikram@example.com` | Vikram Singh | Casual | **Casual** | Active |
| **7** | `neel@example.com` | Neel Kapoor | Member | **Member** | Active |
| **8** | `vihaan@example.com` | Vihaan Tongia | Member | **Member** | Expired Membership |
| **9** | `arjun@example.com` | Arjun Old | Casual | **Casual** | Deactivated (`is_active = FALSE`) |

---

## 5. API Endpoint Summary

See [`docs/API_CONTRACT.md`](../docs/API_CONTRACT.md) for full request/response schemas.

### Authentication & Self-Service
- `POST /api/auth/login` — Public login; returns JWT token and user profile.
- `GET /api/auth/me` — Authenticated user identity inspection.
- `PUT /api/users/:id/password` — Change password (requires `currentPassword` for self-change; Admin can reset any user).

### Tables & Bookings
- `GET /api/tables` — Real-time table status and hourly/frame rates.
- `PATCH /api/tables/:id/status` — Admin/Staff table maintenance toggle.
- `GET /api/reservations` — Booking history (Members see own; Admin/Staff see all).
- `POST /api/reservations` — Book table (`Cash`, `Pending`, `OnCredit`).
- `POST /api/reservations/:id/cancel` — Cancel booking with automatic credit refund calculation.

### Financial Ledger & Members
- `GET /api/members/:id/balance` — View member credit balance, udhar, and credit limit.
- `POST /api/members` — Admin/Staff onboard new Club Member.
- `POST /api/casuals` — Admin/Staff onboard Casual Player.
- `GET /api/ledger/entries` — Credit ledger statement.
- `POST /api/ledger/charge` — Admin/Staff post non-booking charge (`Canteen charge`, `Fine`).
- `POST /api/ledger/payment` — Admin/Staff record member payment against outstanding balance.

### Tournaments & Brackets
- `GET /api/tournaments` — List tournaments and statuses.
- `POST /api/tournaments` — Admin/Staff create tournament.
- `PATCH /api/tournaments/:id/status` — Transition tournament status (`Draft` $\rightarrow$ `Registration` $\rightarrow$ `Ongoing` $\rightarrow$ `Completed` / `Cancelled`). Reversion from terminal states is rejected.
- `POST /api/tournaments/:id/register` — Register player in tournament.
- `GET /api/tournaments/:id/registrations` — View registered players and seed numbers.
- `POST /api/tournaments/:id/matches` — Admin/Staff construct bracket match tree.
- `GET /api/tournaments/:id/bracket` — Recursive CTE hierarchical bracket tree.
- `POST /api/matches/:id/complete` — Atomic match scoring, winner advancement, and ranking point award.

### Equipment & Coaching
- `GET /api/inventory` — Equipment inventory list.
- `PATCH /api/inventory/:id/stock` — Adjust equipment stock.
- `PATCH /api/inventory/:id/condition` — Update equipment physical condition.
- `GET /api/inventory/reorder-alerts` — View items below reorder threshold.
- `POST /api/coaching/assessments` — Record player skill assessment.
- `GET /api/coaching/history` — Assessment history.
- `GET /api/coaching/weaknesses` — Aggregated weakness analysis.

### System & Reports
- `GET /api/health` — Database health check.
- `PATCH /api/users/:id/deactivate` — Admin deactivate user account.
- `GET /api/admin/diagnostics` — Admin specialization anomaly audit.
- `GET /api/leaderboard` — Elo/ranking points leaderboard.
- `GET /api/reports/win-streaks` — Analytics: consecutive match win streaks.
- `GET /api/reports/head-to-head` — Analytics: head-to-head player records.
- `GET /api/reports/table-utilisation` — Analytics: table utilization by hour and revenue.
