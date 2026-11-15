# CueClub

A cue sports club and tournament management system, built as the DBMS course project for CS F212 (Database Systems) at BITS Pilani, Hyderabad Campus. Group 18.

Cue clubs tend to run on paper registers and the manager's memory, so bookings overlap, credit (udhar) balances get disputed, tournament brackets get lost and stock-outs are noticed late. CueClub keeps table bookings, member credit, tournaments, rankings, coaching assessments and inventory in one relational database. The business rules live in the database as constraints, triggers and a transactional procedure, so they hold no matter which client writes the data.

## Team

| Name | ID | Contribution |
| --- | --- | --- |
| Priyansh Thadhani | 2024A3PS0356H | ER/EER model, relational mapping, schema definition, BCNF analysis |
| Goru Nikhil | 2024A3PS0357H | Triggers, CHECK constraints, foreign-key rules, `sp_complete_match` transaction |
| Ananya Avunooru | 2024A3PS0367H | REST API design, JWT authentication, MySQL connection pooling |
| Manya Bhateja | 2024A3PS0378H | Leaderboard views, recursive CTE for bracket queries, synthetic data script |
| Ujjwal Chandak | 2024A3PS0379H | React UI design for booking flow and credit ledger viewer, report compilation |

## Mid-sem submission

| Item | Where |
| --- | --- |
| Database design document (ER/EER, relational schema, constraints, normalization) | [`docs/CueClub_MidSem_Report.pdf`](docs/CueClub_MidSem_Report.pdf) |
| Application design (workflows, stack, architecture) | Sections 7 and 8 of the same PDF |

## Design summary

- 11 relations: `Users`, `Club_Member`, `Game_Tables`, `Reservations`, `Credit_Ledger`, `Tournaments`, `Tournament_Registrations`, `Matches`, `Match_Frames`, `Skill_Assessments`, `Inventory_Items`.
- Users are specialised into members and casual players (disjoint, total). Members can additionally be team members, individual players or enthusiasts (overlapping, partial). The report explains how this is mapped to tables.
- All relations are in BCNF. Three deliberate redundancies are documented in the report: the stored `Reservations.total_amount` snapshot, the materialised `Users.ranking_points`, and the outstanding balance, which is derived through a view rather than stored.
- Rules enforced in the database: no overlapping bookings on a table, credit only for members and within their limit, one registration and one seed per player per tournament, no drawn frames, and match completion as a single transaction (frames, winner, bracket advance, ranking points).

## Technology stack

| Layer | Choice |
| --- | --- |
| Database | MySQL 8.0 (InnoDB) |
| Backend | Node.js, Express REST API, JWT authentication, MySQL connection pooling |
| Frontend | React |

## Planned workflows

1. **Match completion:** a scorer submits frame scores and `sp_complete_match` records them, sets the winner, advances the bracket and updates ranking points in one transaction.
2. **Leaderboard and reports:** rankings with `RANK()`, win streaks via window functions and CTEs, head-to-head records, table utilisation, weakest skills.
3. **Booking and credit:** staff reserve a table while triggers reject overlaps and casual-player credit, and check credit limits and payments.
4. **Inventory and coaching:** low-stock reorder flags, servicing history, skill assessments for team selection.

## Progress

| Component | Status | Verified In |
| --- | --- | --- |
| Requirements, ER/EER design, relational schema, normalization | Complete ✅ | [`docs/CueClub_MidSem_Report.pdf`](docs/CueClub_MidSem_Report.pdf) |
| Schema DDL, constraints, triggers, procedures, views | Complete ✅ | `database/*.sql` (43 constraint tests) |
| Least-Privilege API Role & REST Backend | Complete ✅ | `backend/` (31 automated tests in CI) |
| Single-Page Application (SPA) Frontend | Complete ✅ | `frontend/` (React 19 + Vite) |

## Repository Layout

```
database/             MySQL 8.0 DDL schemas, triggers, procedures, views, seed, and tests
backend/              Node.js Express REST API, JWT auth, and connection pooling
frontend/             React 19 SPA dashboard, interactive bracket, and match scorer
docs/                 Immutable mid-semester design report (PDF) and API contract
```

---

## Setup and Execution Guide

### 1. Database Initialization (MySQL 8.0)

Execute the database scripts in order using a root-privileged MySQL client:

```bash
mysql -u root -p < database/schema.sql
mysql -u root -p cueclub < database/triggers.sql
mysql -u root -p cueclub < database/procedures.sql
mysql -u root -p cueclub < database/views.sql
mysql -u root -p cueclub < database/seed.sql
mysql -u root -p cueclub < database/roles.sql
```

To run the automated constraint verification suite (43 tests):
```bash
mysql -u root -p cueclub < database/constraint_tests.sql
```

To run the concurrency credit-limit race test:
```bash
bash database/tests/credit_race.sh
```

### 2. Backend API Service

```bash
cd backend
cp .env.example .env
npm install
npm test       # Runs the automated API test suite (31 tests)
npm start      # Binds REST API to http://localhost:3000
```

### 3. Frontend Application

```bash
cd frontend
npm install
npm run lint   # Runs fast static analysis (oxlint)
npm test       # Runs frontend API contract tests (10 tests)
npm run dev    # Launches development server on http://localhost:5173
```

---

## Demo Accounts & Security Notice

> [!WARNING]
> All pre-seeded demonstration accounts share the default development password: **`cueclub_default`**. Before public or production deployment, change `JWT_SECRET` in `backend/.env` to a cryptographically secure random value, and update all user passwords using the application's self-service password modal or `CALL sp_set_password(?, ?)`.

| Persona | Name | Role | Email | Password |
|---|---|---|---|---|
| **Admin** | Rohan Mehta | `Admin` | `rohan@example.com` | `cueclub_default` |
| **Staff** | Imran Sheikh | `Staff` | `imran@example.com` | `cueclub_default` |
| **Member** | Aarav Nair | `Member` | `aarav@example.com` | `cueclub_default` |
| **Casual** | Vikram Singh | `Casual` | `vikram@example.com` | `cueclub_default` |


