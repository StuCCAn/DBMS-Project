# CueClub — Cue Sports & Tournament Management System

A cue sports club and tournament management system, built as the DBMS course project for **CS F212 (Database Systems)** at **BITS Pilani, Hyderabad Campus** (Semester I, 2026–27). Group 18.

Cue clubs tend to run on paper registers and the manager's memory, so bookings overlap, credit (udhar) balances get disputed, tournament brackets get lost and stock-outs are noticed late. CueClub keeps table bookings, member credit, tournaments, rankings, coaching assessments and inventory in one relational database. The business rules live in the database as constraints, triggers and transactional procedures, so they hold no matter which client writes the data.

---

## Final Submission Metadata

> [!IMPORTANT]
> Per **Section 1.B** of the project submission guidelines, this repository is tagged as **`final`** for course evaluation.
> Only the state at tag `final` should be evaluated.

- **Course:** CS F212 Database Systems | Final Project Submission
- **Deadline:** Sunday, 15 November 2026, 11:59 PM
- **Git Submission Tag:** [`final`](https://github.com/StuCCAn/DBMS-Project/releases/tag/final)
- **Submitted Commit Hash:** See Git tag `final` (`git rev-parse final`)
- **Repository Link:** [https://github.com/StuCCAn/DBMS-Project](https://github.com/StuCCAn/DBMS-Project)
- **Final Release Tag:** [https://github.com/StuCCAn/DBMS-Project/releases/tag/final](https://github.com/StuCCAn/DBMS-Project/releases/tag/final)
- **Evaluation Checkout:**
  ```bash
  git fetch --all --tags
  git checkout final
  ```

---

## Team Members & Individual Contributions

| Name | Student ID | Project Role & Individual Contributions |
|---|---|---|
| **Priyansh Thadhani** | `2024A3PS0356H` | **Database Architecture & Modeling:** Designed ER/EER model with Level-1 & Level-2 specialization, relational mapping to 11 relations, formal BCNF functional dependency proofs, and `docs/SCHEMA_MAPPING_AND_BASELINE.md`. |
| **Goru Nikhil** | `2024A3PS0357H` | **Integrity Enforcement & Routines:** Implemented table/ledger triggers (`trg_reservation_bi`, `trg_ledger_bi`), CHECK boundaries, foreign-key rules, `sp_complete_match` multi-table atomic transaction with rollback, and concurrency locking (`SELECT ... FOR UPDATE`). |
| **Ananya Avunooru** | `2024A3PS0367H` | **Backend API & Security:** Designed Node.js Express REST API (30 endpoints), least-privilege DB role (`roles.sql`), JWT authentication, `express-validator` schema rules, and 31 automated integration tests in CI. |
| **Manya Bhateja** | `2024A3PS0378H` | **Advanced SQL & Analytics:** Developed SQL views including recursive CTE binary bracket tree (`v_bracket_tree`), gaps-and-islands win streaks (`v_win_streaks`), table utilisation (`v_table_utilisation`), and 43 automated constraint test harness cases. |
| **Ujjwal Chandak** | `2024A3PS0379H` | **Frontend Application & Integration:** Built React 19 SPA dashboard with Vite, role-aware routing, interactive bracket visualizer, frame-by-frame match scorer modal, credit ledger viewer, API client layer, and report compilation. |

---

## Mid-Sem Submission Reference

| Item | Where |
|---|---|
| Database design document (ER/EER, relational schema, constraints, normalization) | [`docs/CueClub_MidSem_Report.pdf`](docs/CueClub_MidSem_Report.pdf) *(Immutable, verified by CI sha256)* |
| Schema Mapping & Baseline Freeze | [`docs/SCHEMA_MAPPING_AND_BASELINE.md`](docs/SCHEMA_MAPPING_AND_BASELINE.md) |
| REST API Contract Specification | [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md) |

---

## Design Summary

- **11 Relations in BCNF:** `Users`, `Club_Member`, `Game_Tables`, `Reservations`, `Credit_Ledger`, `Tournaments`, `Tournament_Registrations`, `Matches`, `Match_Frames`, `Skill_Assessments`, `Inventory_Items`.
- **Specialization Hierarchy:**
  - **Level-1:** Total and disjoint (`Users` $\rightarrow$ `Club_Member`, `Casual`).
  - **Level-2:** Overlapping and partial within `Club_Member` (Team Member, Individual Player, Enthusiast) enforced via boolean flags and `CHECK` constraints.
- **Weak Entity:** `Match_Frames(match_id, frame_number)` dependent upon `Matches` with `ON DELETE CASCADE`.
- **Deliberate Design Decisions:**
  1. Stored snapshot of `Reservations.total_amount` to preserve historical billing rates.
  2. Materialized `Users.ranking_points` maintained atomically during match completions.
  3. Dynamic outstanding balance derived on-the-fly via `v_member_balance` (rather than stored) to avoid update anomalies.
- **Approved Technical Deviations:**
  - **D-01:** Addition of `password_hash`, `app_role`, and `is_active` to `Users` for web application authentication.
  - **D-02:** `sp_cancel_booking` caps credit refund at outstanding balance to prevent trigger overpayment violations.

---

## Technology Stack

| Layer | Choice | Details & Justification |
|---|---|---|
| **Database** | MySQL 8.0 (InnoDB) | Strict ACID compliance, foreign keys, row-level locking (`SELECT ... FOR UPDATE`), window functions, and recursive CTEs. |
| **Backend API** | Node.js (v20+), Express 4.x | RESTful API service, `mysql2` connection pooling, `bcryptjs` password hashing, `jsonwebtoken`, and `express-validator`. |
| **Frontend UI** | React 19, Vite | Modern Single-Page Application (SPA), Lucide icons, responsive layout, and role-based view guarding. |

---

## Major Application Workflows

The application implements end-to-end workflows demonstrating distinct DBMS principles:

1. **Workflow 1: Atomic Match Scoring & Bracket Progression (Multi-Relation Transaction)**
   - *DBMS Aspect:* ACID transaction (`START TRANSACTION ... COMMIT / ROLLBACK`).
   - *Behavior:* Scorer enters frame-by-frame scores and clicks "Finalize Match" $\rightarrow$ `sp_complete_match` parses frames, enforces no-drawn-frames (Rule R6), determines winner, advances winner to next round's feeder match (`player1_id` or `player2_id`), increments `Users.ranking_points`, and marks tournament `Completed` if finals. Any error triggers `ROLLBACK`.

2. **Workflow 2: Tournament Bracket Hierarchy & Streak Analytics (Complex Retrieval & CTEs)**
   - *DBMS Aspect:* Recursive CTE (`WITH RECURSIVE`) and window functions (`ROW_NUMBER() OVER`, `RANK() OVER`).
   - *Behavior:* Frontend visualizes tournament trees via `v_bracket_tree`, which recursively traverses parent-child match relationships from the final round down to preliminary rounds; `v_win_streaks` computes active consecutive win streaks using the gaps-and-islands partition difference `(rn_all - rn_result)`.

3. **Workflow 3: Table Booking & Credit Headroom Guard (Integrity & Concurrency Control)**
   - *DBMS Aspect:* Row-level concurrency locking (`SELECT ... FOR UPDATE`) and exclusion triggers (`trg_reservation_bi`, `trg_ledger_bi`).
   - *Behavior:* User selects a table and time slot $\rightarrow$ `sp_book_table` acquires an exclusive row lock on `Club_Member`, verifies available credit headroom via `v_member_balance`, and creates reservation. Double bookings are blocked with `SQLSTATE 45000` (Rule R1), and casual players or over-limit charges on credit are blocked (Rules R2, R3).

---

## Project Verification & Readiness

| Component | Status | Verification Evidence |
|---|---|---|
| Requirements, ER/EER design, relational schema, normalization | Complete ✅ | [`docs/CueClub_MidSem_Report.pdf`](docs/CueClub_MidSem_Report.pdf) (Immutable) |
| Schema DDL, constraints, triggers, procedures, views | Complete ✅ | `database/*.sql` (**43 constraint tests pass re-runnably**) |
| Concurrency credit race protection | Complete ✅ | `database/tests/credit_race.sh` (**Thread race test passes**) |
| Least-Privilege API Role & REST Backend | Complete ✅ | `backend/` (**31 automated integration tests pass in CI**) |
| Single-Page Application (SPA) Frontend | Complete ✅ | `frontend/` (**10 contract tests pass, 0 oxlint errors, clean build**) |
| GitHub Actions CI Pipeline | Green ✅ | [CI Run #43693260246](https://github.com/StuCCAn/DBMS-Project/actions) (3/3 jobs passed in 46s) |

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

> [!TIP]
> **Database Datasets:**
> - `database/seed.sql` provides the clean, curated demonstration dataset (~68 records) ideal for concise 7-minute UI walkthroughs.
> - `database/seed_volumetric.sql` (generated via `scripts/generate_large_seed.py`) provides an additive 646-record dataset bringing total database records to exactly **692 rows** across all 11 relations to satisfy the course project volumetric scope requirement:
>   ```bash
>   mysql -u root -p cueclub < database/seed_volumetric.sql
>   ```

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

| Role | Recommended Login | Underlying Identity | Password | Permissions & Focus |
|---|---|---|---|---|
| **Admin** | `admin@example.com` | Rohan Mehta (`rohan@example.com`) | `cueclub_default` | Full administrative control, diagnostics, user management, analytics |
| **Staff** | `staff@example.com` | Imran Sheikh (`imran@example.com`) | `cueclub_default` | Match scoring, tournament setup, ledger charges & payments |
| **Member** | `member@example.com` | Aarav Nair (`aarav@example.com`) | `cueclub_default` | Book tables on credit, view own ledger balance & coaching progress |
| **Casual** | `casual@example.com` | Vikram Singh (`vikram@example.com`) | `cueclub_default` | Pay-and-play casual player, browse tables & leaderboard |

> [!TIP]
> Both the generic test emails (`admin@example.com`, etc.) and the original seed emails are accepted by the authentication endpoint. The login dialog provides convenient one-click quick-fill buttons for fast testing.


