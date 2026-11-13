# CueClub API & Database Contract Specification

> **Freeze Gate:** Phase 4 (Manya Bhateja)  
> **Target Audience:** Backend API Implementation (Phase 5 — Ananya Avunooru) & Frontend UI (Phase 6 — Ujjwal Chandak)  
> **Database:** MySQL 8.0 (InnoDB) | `cueclub`  
> **Database User:** `cueclub_api` (Least Privilege: `EXECUTE` on procedures, `SELECT` on views)

---

## 1. Overview & Architecture Boundary

The CueClub relational database encapsulates core business invariants, credit accounting, tournament progression, and security checks directly within **stored procedures**, **triggers**, and **analytical views**. 

### Contract Guarantees
1. **Zero Direct Table Writes:** The backend application MUST connect via the `cueclub_api` account. Direct `INSERT`, `UPDATE`, or `DELETE` on raw tables is denied at the database privilege level.
2. **Encapsulated State Mutation:** All mutations are executed via the five authoritative stored procedures:
   - `sp_register_member`
   - `sp_register_casual`
   - `sp_book_table`
   - `sp_cancel_booking`
   - `sp_complete_match`
3. **Atomic Operations:** Stored procedures manage their own transactions. In case of validation or constraint failure, procedures roll back automatically and return a formatted `SIGNAL SQLSTATE '45000'` with a descriptive error message.
4. **Analytical Views:** All queries for leaderboards, user balances, utilisation, tournament brackets, and alerts are consumed directly through version-controlled MySQL views.

---

## 2. Stored Procedure Specifications

### 2.1 `sp_register_member`

Registers a new user as a full **Club Member**, enforcing the Level-1 Total & Disjoint specialization in a single atomic transaction.

#### Signature
```sql
CALL sp_register_member(
    IN  p_name           VARCHAR(100),
    IN  p_phone          VARCHAR(15),
    IN  p_email          VARCHAR(120),
    IN  p_membership_no  VARCHAR(20),
    IN  p_plan           VARCHAR(10),     -- 'Monthly', 'Quarterly', 'Annual'
    IN  p_start          DATE,            -- 'YYYY-MM-DD'
    IN  p_end            DATE,            -- 'YYYY-MM-DD'
    IN  p_discount       DECIMAL(5,2),    -- e.g. 10.00 (0.00 to 100.00)
    IN  p_credit_limit   DECIMAL(10,2),   -- e.g. 3000.00 (>= 0.00)
    OUT p_user_id        INT
);
```

#### Parameters
| Parameter | Type | Required | Description / Constraints |
|---|---|---|---|
| `p_name` | `VARCHAR(100)` | Yes | Member full name. |
| `p_phone` | `VARCHAR(15)` | Yes | Unique phone number matching regex `^[0-9+]{7,15}$`. |
| `p_email` | `VARCHAR(120)` | Yes | Unique email address. |
| `p_membership_no` | `VARCHAR(20)` | Yes | Unique club membership card / roll number (e.g. `CM-010`). |
| `p_plan` | `VARCHAR(10)` | Yes | Membership billing duration: `'Monthly'`, `'Quarterly'`, or `'Annual'`. |
| `p_start` | `DATE` | Yes | Membership start date (`YYYY-MM-DD`). |
| `p_end` | `DATE` | Yes | Membership expiration date (`YYYY-MM-DD`, must be `> p_start`). |
| `p_discount` | `DECIMAL(5,2)` | Yes | Default percentage discount on table bookings (0.00 to 100.00). |
| `p_credit_limit` | `DECIMAL(10,2)` | Yes | Maximum permissible credit balance (>= 0.00). |
| `p_user_id` | `INT` (OUT) | — | Auto-generated primary key (`Users.user_id`). |

#### REST API Mapping
* **Endpoint:** `POST /api/members`
* **RBAC:** `Admin`, `Staff`
* **Request Body:**
```json
{
  "name": "Dev Sharma",
  "phone": "9876543210",
  "email": "dev.sharma@example.com",
  "membershipNo": "CM-015",
  "plan": "Annual",
  "startDate": "2026-11-01",
  "endDate": "2027-10-31",
  "discountPct": 10.00,
  "creditLimit": 4000.00
}
```
* **Success Response (`201 Created`):**
```json
{
  "status": "success",
  "data": {
    "userId": 10,
    "name": "Dev Sharma",
    "membershipNo": "CM-015",
    "userType": "Member",
    "appRole": "Member"
  }
}
```

#### Error Signals & SQLSTATE Codes
| SQLSTATE | Trigger / Constraint | Message Pattern / Reason | HTTP Code |
|---|---|---|---|
| `23000` | `uq_users_phone` | `Duplicate entry ... for key 'uq_users_phone'` | `409 Conflict` |
| `23000` | `uq_users_email` | `Duplicate entry ... for key 'uq_users_email'` | `409 Conflict` |
| `3819` | `ck_users_phone` | `Check constraint 'ck_users_phone' is violated.` | `400 Bad Request` |
| `3819` | `ck_mem_dates` | `Check constraint 'ck_mem_dates' is violated.` (`end_date > start_date`) | `400 Bad Request` |
| `3819` | `ck_mem_discount`| `Check constraint 'ck_mem_discount' is violated.` (0–100%) | `400 Bad Request` |
| `3819` | `ck_mem_credit` | `Check constraint 'ck_mem_credit' is violated.` (`credit_limit >= 0`) | `400 Bad Request` |

---

### 2.2 `sp_register_casual`

Registers a walk-in or guest player as a **Casual Player**. Casual players do not receive credit lines, cannot incur udhar, and must pay for all bookings upfront.

#### Signature
```sql
CALL sp_register_casual(
    IN  p_name     VARCHAR(100),
    IN  p_phone    VARCHAR(15),
    IN  p_email    VARCHAR(120),
    OUT p_user_id  INT
);
```

#### Parameters
| Parameter | Type | Required | Description / Constraints |
|---|---|---|---|
| `p_name` | `VARCHAR(100)` | Yes | Guest / casual player name. |
| `p_phone` | `VARCHAR(15)` | Yes | Unique phone number matching regex `^[0-9+]{7,15}$`. |
| `p_email` | `VARCHAR(120)` | Yes | Unique email address. |
| `p_user_id` | `INT` (OUT) | — | Auto-generated primary key (`Users.user_id`). |

#### REST API Mapping
* **Endpoint:** `POST /api/casuals`
* **RBAC:** `Admin`, `Staff`
* **Request Body:**
```json
{
  "name": "Karan Malhotra",
  "phone": "9811223344",
  "email": "karan.m@example.com"
}
```
* **Success Response (`201 Created`):**
```json
{
  "status": "success",
  "data": {
    "userId": 11,
    "name": "Karan Malhotra",
    "userType": "Casual",
    "appRole": "Casual"
  }
}
```

#### Error Signals & SQLSTATE Codes
| SQLSTATE | Trigger / Constraint | Message Pattern / Reason | HTTP Code |
|---|---|---|---|
| `23000` | `uq_users_phone` | `Duplicate entry ... for key 'uq_users_phone'` | `409 Conflict` |
| `23000` | `uq_users_email` | `Duplicate entry ... for key 'uq_users_email'` | `409 Conflict` |
| `3819` | `ck_users_phone` | `Check constraint 'ck_users_phone' is violated.` | `400 Bad Request` |

---

### 2.3 `sp_book_table`

Reserves a cue table for hourly or frame-based play. Automatically calculates discounts, serializes concurrent bookings with `FOR UPDATE` locks, enforces double-booking prevention, rejects midnight crossing, and posts ledger entries for credit bookings.

#### Signature
```sql
CALL sp_book_table(
    IN  p_user            INT,             -- Users.user_id
    IN  p_table           INT,             -- Game_Tables.table_id
    IN  p_start           DATETIME,        -- 'YYYY-MM-DD HH:MM:SS'
    IN  p_end             DATETIME,        -- 'YYYY-MM-DD HH:MM:SS'
    IN  p_mode            VARCHAR(10),     -- 'Hourly' or 'PerFrame'
    IN  p_frames          INT,             -- frames count (required if PerFrame, else 0)
    IN  p_pay_status      VARCHAR(10),     -- 'Pending', 'Paid', 'OnCredit'
    OUT p_reservation_id  INT
);
```

#### Parameters
| Parameter | Type | Required | Description / Constraints |
|---|---|---|---|
| `p_user` | `INT` | Yes | Registered user ID (`Users.user_id`). |
| `p_table` | `INT` | Yes | Target table ID (`Game_Tables.table_id`). |
| `p_start` | `DATETIME` | Yes | Booking start time. |
| `p_end` | `DATETIME` | Yes | Booking end time (must be `> p_start`). May terminate at `00:00:00` of next day. |
| `p_mode` | `VARCHAR(10)` | Yes | `'Hourly'` or `'PerFrame'`. |
| `p_frames` | `INT` | Yes | Number of frames played. Must be `> 0` if `p_mode = 'PerFrame'`; pass `0` for hourly. |
| `p_pay_status` | `VARCHAR(10)` | Yes | Initial status: `'Pending'`, `'Paid'`, or `'OnCredit'`. Casuals MUST use `'Paid'`. |
| `p_reservation_id` | `INT` (OUT) | — | Auto-generated ID (`Reservations.reservation_id`). |

#### Calculation Rules
1. **Hourly Mode:** `total_amount = ROUND(hourly_rate * (duration_minutes / 60) * (1 - discount_pct / 100), 2)`
2. **Per-Frame Mode:** `total_amount = ROUND(per_frame_rate * frames_played * (1 - discount_pct / 100), 2)`
3. **Discount Rule:** Discount percentage applies **only** if the user is an active member with non-expired dates on both `p_start` and `CURRENT_DATE`. Casual players receive 0% discount.
4. **Complimentary Rule:** 100% discount produces `total_amount = 0.00` which is accepted by `ck_res_total (>= 0)`.
5. **Credit Race Mitigation:** When `p_pay_status = 'OnCredit'`, `Club_Member` row is locked early via `FOR UPDATE` to serialize concurrent booking balance evaluations.

#### REST API Mapping
* **Endpoint:** `POST /api/reservations`
* **RBAC:** `Admin`, `Staff`, `Member`
* **Request Body:**
```json
{
  "userId": 1,
  "tableId": 1,
  "startTime": "2026-11-20 18:00:00",
  "endTime": "2026-11-20 20:00:00",
  "billingMode": "Hourly",
  "framesPlayed": 0,
  "paymentStatus": "Paid"
}
```
* **Success Response (`201 Created`):**
```json
{
  "status": "success",
  "data": {
    "reservationId": 12,
    "userId": 1,
    "tableId": 1,
    "startTime": "2026-11-20 18:00:00",
    "endTime": "2026-11-20 20:00:00",
    "billingMode": "Hourly",
    "totalAmount": 510.00,
    "paymentStatus": "Paid"
  }
}
```

#### Error Signals & SQLSTATE Codes
| SQLSTATE | Procedure / Trigger | Error Message | HTTP Code |
|---|---|---|---|
| `45000` | `sp_validate_reservation` | `Rule R1: Bookings cannot cross midnight` | `400 Bad Request` |
| `45000` | `sp_validate_reservation` | `Double booking: table already reserved for an overlapping time range` | `409 Conflict` |
| `45000` | `sp_validate_reservation` | `Table is not available for booking` | `409 Conflict` |
| `45000` | `sp_validate_reservation` | `Casual players must pay upfront (no credit)` | `400 Bad Request` |
| `45000` | `sp_validate_reservation` | `Only active, non-expired club members can book on credit` | `403 Forbidden` |
| `45000` | `sp_validate_reservation` | `Rule R9: Deactivated users cannot make active reservations` | `403 Forbidden` |
| `45000` | `sp_book_table` | `PerFrame billing requires frames_played > 0` | `400 Bad Request` |
| `45000` | `trg_ledger_bi` | `Credit limit exceeded` | `402 Payment Required` |

---

### 2.4 `sp_cancel_booking`

Cancels an existing table booking, updates reservation payment status to `'Cancelled'`, and issues a credit reversal refund according to **Deviation D-02**.

#### Signature
```sql
CALL sp_cancel_booking(
    IN p_reservation_id INT
);
```

#### Parameters
| Parameter | Type | Required | Description |
|---|---|---|---|
| `p_reservation_id` | `INT` | Yes | Existing booking ID to cancel (`Reservations.reservation_id`). |

#### Business Logic & Refund Rules (Deviation D-02)
1. **Row Lock:** Acquires an exclusive `FOR UPDATE` lock on `Reservations`.
2. **Idempotency:** If the reservation is already `'Cancelled'`, the procedure commits as a no-op without re-refunding or throwing an error.
3. **Credit Refund Policy (`payment_status = 'OnCredit'`):**
   - Locks the member's `Club_Member` row `FOR UPDATE`.
   - Computes outstanding balance: `outstanding_balance = SUM(charges) - SUM(payments)`.
   - The credit refund is capped at the member's current outstanding balance:  
     $$\text{refund} = \min(\text{total\_amount}, \max(\text{outstanding\_balance}, 0.00))$$
   - If `refund > 0.00`, posts a positive `Payment` entry in `Credit_Ledger` with note: `'Booking cancellation refund: #<reservation_id>'`.
   - If the booking charge was already settled/paid down, refund is capped at remaining balance to prevent violating `trg_ledger_bi` (`Payment exceeds outstanding balance`).
4. **Cash / Pending Bookings (`payment_status IN ('Pending', 'Paid')`):**
   - Status updates directly to `'Cancelled'` with **0** ledger entries posted.
5. **Terminal State:** A cancelled booking cannot be un-cancelled or transitioned to any other state.

#### REST API Mapping
* **Endpoint:** `POST /api/reservations/:id/cancel`
* **RBAC:** `Admin`, `Staff`, `Member` (own reservation only)
* **Success Response (`200 OK`):**
```json
{
  "status": "success",
  "data": {
    "reservationId": 12,
    "paymentStatus": "Cancelled",
    "refundPosted": true,
    "refundAmount": 255.00
  }
}
```

#### Error Signals & SQLSTATE Codes
| SQLSTATE | Procedure / Trigger | Error Message | HTTP Code |
|---|---|---|---|
| `45000` | `sp_cancel_booking` | `Reservation not found` | `404 Not Found` |
| `45000` | `sp_validate_reservation` | `Invalid reservation status transition: Cancelled bookings cannot change status` | `400 Bad Request` |

---

### 2.5 `sp_complete_match`

Executes the atomic tournament match completion workflow: inserts frame scores, determines the match winner, advances the bracket using deterministic feeder rules, awards ranking points, and closes the tournament if final.

#### Signature
```sql
CALL sp_complete_match(
    IN p_match_id     INT,
    IN p_frames       JSON,
    IN p_win_points   INT,
    IN p_loss_points  INT
);
```

#### Parameters
| Parameter | Type | Required | Description / Constraints |
|---|---|---|---|
| `p_match_id` | `INT` | Yes | Target match ID (`Matches.match_id`). Must be in `Scheduled` or `InProgress`. |
| `p_frames` | `JSON` | Yes | Valid non-empty JSON array of frame results (see schema below). |
| `p_win_points` | `INT` | Yes | Non-negative integer points added to winner's `ranking_points` (NOT NULL). |
| `p_loss_points`| `INT` | Yes | Non-negative integer points added to loser's `ranking_points` (NOT NULL). |

#### Frame JSON Payload Schema
```json
[
  {
    "p1": 72,       // integer (required, score for player 1)
    "p2": 30,       // integer (required, score for player 2, p1 != p2)
    "break": 45     // integer (optional, highest break in frame, default 0)
  }
]
```

#### Workflow & Atomic Guarantees
1. **Input Validation:** Verifies points are not NULL, points $\ge 0$, and `p_frames` is a valid, non-empty JSON array.
2. **Playable State:** Locks match `FOR UPDATE`. Asserts `status IN ('Scheduled', 'InProgress')` and both `player1_id` and `player2_id` are decided. Rejects completed or cancelled matches.
3. **No Drawn Frames (R5):** Rejects individual frames where `p1 == p2` (`ck_frame_no_draw`). Rejects entire match if total frame wins are tied.
4. **Winner Resolution:** Determines winner based on majority frame wins ($p1\_frames > p2\_frames \implies p1$, else $p2$). Sets `Matches.winner_id` and `Matches.status = 'Completed'`.
5. **Deterministic Bracket Feeder:** If `next_match_id` is set:
   - Queries `v_slot = MIN(match_id) FROM Matches WHERE next_match_id = v_next`.
   - If `p_match_id == v_slot`, winner advances to `player1_id` of the next match.
   - Else, winner advances to `player2_id`.
   - **Guarantee:** Result is identical regardless of which semi-final match is completed first.
6. **Ranking Materialization:** Updates `Users.ranking_points` in-place for both winner and loser.
7. **Tournament Completion:** Automatically sets `Tournaments.status = 'Completed'` when all tournament matches finish.
8. **Rollback Guarantee (R6):** If any frame score is invalid or drawn, the entire transaction rolls back to preserve clean state.

#### REST API Mapping
* **Endpoint:** `POST /api/matches/:id/complete`
* **RBAC:** `Admin`, `Staff`
* **Request Body:**
```json
{
  "frames": [
    { "p1": 72, "p2": 30, "break": 45 },
    { "p1": 15, "p2": 68, "break": 50 },
    { "p1": 80, "p2": 22, "break": 60 }
  ],
  "winPoints": 30,
  "lossPoints": 10
}
```
* **Success Response (`200 OK`):**
```json
{
  "status": "success",
  "data": {
    "matchId": 2,
    "status": "Completed",
    "winnerId": 1,
    "loserId": 2,
    "framesScore": "2-1",
    "advancedToMatchId": 1,
    "pointsAwarded": {
      "winner": { "userId": 1, "pointsAdded": 30 },
      "loser": { "userId": 2, "pointsAdded": 10 }
    }
  }
}
```

#### Error Signals & SQLSTATE Codes
| SQLSTATE | Procedure / Trigger | Error Message | HTTP Code |
|---|---|---|---|
| `45000` | `sp_complete_match` | `Ranking point increments must be non-negative` | `400 Bad Request` |
| `45000` | `sp_complete_match` | `Invalid or empty frames JSON array` | `400 Bad Request` |
| `45000` | `sp_complete_match` | `Match not found` | `404 Not Found` |
| `45000` | `sp_complete_match` | `Match is already completed` | `409 Conflict` |
| `45000` | `sp_complete_match` | `Match is not in a playable state (must be Scheduled or InProgress)` | `409 Conflict` |
| `45000` | `sp_complete_match` | `Players for this match are not decided yet` | `409 Conflict` |
| `45000` | `sp_complete_match` | `No frame scores supplied` | `400 Bad Request` |
| `45000` | `sp_complete_match` | `A match cannot finish level on frames` | `400 Bad Request` |
| `3819` | `ck_frame_no_draw` | `Check constraint 'ck_frame_no_draw' is violated.` | `400 Bad Request` |

---

## 3. Analytical Views Specification

The Node.js backend queries views using standard `SELECT` statements. The table below lists all 10 analytical views and their consumer endpoints.

| View Name | Primary Consumer Endpoint | Primary Key / Grain | Purpose |
|---|---|---|---|
| `v_member_balance` | `GET /api/members/:id/balance` | `user_id` | Member credit ledger, outstanding udhar, and credit headroom. |
| `v_player_results` | Internal join view | `(match_id, player_id)` | Normalized two-row perspective of every completed match. |
| `v_leaderboard` | `GET /api/leaderboard` | `user_id` | Tournament rankings based on `Users.ranking_points` and `RANK()`. |
| `v_win_streaks` | `GET /api/reports/win-streaks` | `(player_id, game_type, streak_start)` | Consecutive match winning streaks via gaps-and-islands. |
| `v_head_to_head` | `GET /api/reports/head-to-head` | `(player_id, opponent_id)` | Historic win/loss records between pairs of players. |
| `v_bracket_tree` | `GET /api/tournaments/:id/bracket` | `match_id` | Recursive CTE walking matches from finals to opening rounds. |
| `v_table_utilisation`| `GET /api/reports/table-utilisation`| `table_id` | Busiest tables, peak vs non-peak usage hours (18:00–23:00). |
| `v_reorder_alerts` | `GET /api/inventory/reorder-alerts`| `item_id` | Low-stock and maintenance equipment reorder triggers. |
| `v_player_weaknesses`| `GET /api/coaching/weaknesses` | `(player_id, weakness_rank)` | Lowest coaching assessment ratings per player. |
| `v_specialization_anomalies` | `GET /api/admin/diagnostics` | `(user_id, anomaly_reason)` | Diagnostic audit view detecting Level 1 / Level 2 EER anomalies. |

---

### Detailed View Schemas & Sample Outputs

#### 3.1 `v_member_balance`
```sql
SELECT * FROM v_member_balance WHERE user_id = 1;
```
| Column | Type | Nullable | Description |
|---|---|---|---|
| `user_id` | `INT` | No | Member user ID. |
| `name` | `VARCHAR(100)` | No | Member name. |
| `membership_no` | `VARCHAR(20)` | No | Membership number. |
| `plan` | `ENUM` | No | `'Monthly'`, `'Quarterly'`, `'Annual'`. |
| `start_date` | `DATE` | No | Plan start date. |
| `end_date` | `DATE` | No | Plan expiry date. |
| `discount_pct` | `DECIMAL(5,2)` | No | Booking discount %. |
| `credit_limit` | `DECIMAL(10,2)`| No | Total credit ceiling. |
| `outstanding_balance` | `DECIMAL(10,2)`| No | Current unpaid udhar balance ($\sum \text{charges} - \sum \text{payments}$). |
| `credit_headroom` | `DECIMAL(10,2)`| No | Remaining credit capacity ($\text{credit\_limit} - \text{outstanding\_balance}$). |

**Sample Output:**
```json
{
  "userId": 1,
  "name": "Rohan Mehta",
  "membershipNo": "CM-001",
  "plan": "Annual",
  "startDate": "2026-01-01",
  "endDate": "2027-12-31",
  "discountPct": 15.00,
  "creditLimit": 5000.00,
  "outstandingBalance": 200.00,
  "creditHeadroom": 4800.00
}
```

---

#### 3.2 `v_leaderboard`
```sql
SELECT * FROM v_leaderboard ORDER BY rank_position ASC LIMIT 5;
```
| Column | Type | Nullable | Description |
|---|---|---|---|
| `user_id` | `INT` | No | User ID. |
| `name` | `VARCHAR(100)` | No | User name. |
| `user_type` | `ENUM` | No | `'Member'` or `'Casual'`. |
| `preferred_game` | `ENUM` | Yes | Preferred game type (NULL for casuals without preference). |
| `ranking_points`| `INT` | No | Materialized ranking points from `Users.ranking_points`. |
| `matches_played`| `BIGINT` | No | Total completed tournament matches played. |
| `wins` | `BIGINT` | No | Total tournament matches won. |
| `rank_position` | `BIGINT` | No | Dense rank based on `ranking_points DESC, wins DESC`. |

**Sample Output:**
```json
[
  { "rankPosition": 1, "userId": 1, "name": "Rohan Mehta", "userType": "Member", "preferredGame": "Snooker", "rankingPoints": 1280, "matchesPlayed": 3, "wins": 3 },
  { "rankPosition": 2, "userId": 2, "name": "Imran Sheikh", "userType": "Member", "preferredGame": "Snooker", "rankingPoints": 1190, "matchesPlayed": 2, "wins": 1 },
  { "rankPosition": 3, "userId": 3, "name": "Aarav Nair", "userType": "Member", "preferredGame": "Snooker", "rankingPoints": 1110, "matchesPlayed": 1, "wins": 0 },
  { "rankPosition": 4, "userId": 4, "name": "Kabir Rao", "userType": "Member", "preferredGame": "Pool", "rankingPoints": 1050, "matchesPlayed": 0, "wins": 0 },
  { "rankPosition": 5, "userId": 7, "name": "Neel Kapoor", "userType": "Member", "preferredGame": null, "rankingPoints": 950, "matchesPlayed": 0, "wins": 0 }
]
```

---

#### 3.3 `v_bracket_tree`
```sql
SELECT * FROM v_bracket_tree WHERE tournament_id = 1 ORDER BY depth ASC, match_id ASC;
```
| Column | Type | Nullable | Description |
|---|---|---|---|
| `match_id` | `INT` | No | Match primary key. |
| `tournament_id` | `INT` | No | Tournament foreign key. |
| `round_number` | `INT` | No | Round number (e.g. 1 = Semis, 2 = Final). |
| `player1_id` | `INT` | Yes | Player 1 user ID. |
| `player2_id` | `INT` | Yes | Player 2 user ID. |
| `winner_id` | `INT` | Yes | Winner user ID (populated when completed). |
| `next_match_id` | `INT` | Yes | Parent feeder match ID in knockout tree (NULL for final). |
| `status` | `ENUM` | No | `'Scheduled'`, `'InProgress'`, `'Completed'`, `'Cancelled'`. |
| `depth` | `INT` | No | Tree depth (0 for final, 1 for semi-finals, etc.). |
| `path_from_final` | `VARCHAR(500)`| No | Breadcrumb string walking tree from final (e.g. `'1 <- 2'`). |

**Sample Output:**
```json
[
  {
    "matchId": 1,
    "roundNumber": 2,
    "player1Id": 1,
    "player2Id": 3,
    "winnerId": 1,
    "status": "Completed",
    "depth": 0,
    "pathFromFinal": "1"
  },
  {
    "matchId": 2,
    "roundNumber": 1,
    "player1Id": 1,
    "player2Id": 2,
    "winnerId": 1,
    "status": "Completed",
    "depth": 1,
    "pathFromFinal": "1 <- 2"
  },
  {
    "matchId": 3,
    "roundNumber": 1,
    "player1Id": 3,
    "player2Id": 4,
    "winnerId": 3,
    "status": "Completed",
    "depth": 1,
    "pathFromFinal": "1 <- 3"
  }
]
```

---

#### 3.4 `v_table_utilisation`
```sql
SELECT * FROM v_table_utilisation ORDER BY busiest_rank ASC;
```
| Column | Type | Nullable | Description |
|---|---|---|---|
| `table_id` | `INT` | No | Game table ID. |
| `name` | `VARCHAR(50)` | No | Table label (e.g. `'Snooker 1'`). |
| `game_type` | `ENUM` | No | `'Snooker'`, `'Pool'`, `'Billiards'`. |
| `bookings` | `BIGINT` | No | Total non-cancelled reservations recorded. |
| `booked_hours` | `DECIMAL(10,1)`| No | Total hours booked. |
| `peak_hours` | `DECIMAL(10,1)`| No | Total booked hours occurring during peak hours (18:00–23:00). |
| `peak_share_pct`| `DECIMAL(5,1)` | Yes | Percentage of booking duration during peak hours. |
| `busiest_rank` | `BIGINT` | No | Utilization ranking position based on total booked hours. |

**Sample Output:**
```json
[
  { "busiestRank": 1, "tableId": 1, "name": "Snooker 1", "gameType": "Snooker", "bookings": 4, "bookedHours": 7.0, "peakHours": 5.0, "peakSharePct": 71.4 },
  { "busiestRank": 2, "tableId": 2, "name": "Snooker 2", "gameType": "Snooker", "bookings": 2, "bookedHours": 3.0, "peakHours": 2.0, "peakSharePct": 66.7 },
  { "busiestRank": 3, "tableId": 3, "name": "Pool 1", "gameType": "Pool", "bookings": 1, "bookedHours": 1.5, "peakHours": 1.5, "peakSharePct": 100.0 }
]
```

---

#### 3.5 `v_reorder_alerts`
```sql
SELECT * FROM v_reorder_alerts;
```
| Column | Type | Nullable | Description |
|---|---|---|---|
| `item_id` | `INT` | No | Inventory item ID. |
| `name` | `VARCHAR(80)` | No | Item description (e.g. `'Strachan 6811 Cloth'`). |
| `category` | `ENUM` | No | `'Cues'`, `'Balls'`, `'Cloth'`, `'Chalk'`, `'Accessories'`. |
| `quantity` | `INT` | No | Current on-hand quantity. |
| `reorder_level`| `INT` | No | Minimum inventory threshold. |
| `condition_status` | `ENUM`| No | `'Good'`, `'Fair'`, `'Needs Replacement'`. |
| `last_serviced_date` | `DATE` | Yes | Date last maintained. |
| `vendor_name` | `VARCHAR(100)`| Yes | Supplier/vendor name for reordering. |

**Sample Output:**
```json
[
  {
    "itemId": 3,
    "name": "Strachan 6811 Tournament Cloth",
    "category": "Cloth",
    "quantity": 1,
    "reorderLevel": 2,
    "conditionStatus": "Needs Replacement",
    "lastServicedDate": "2026-08-10",
    "vendorName": "Strachan UK"
  }
]
```

---

#### 3.6 `v_specialization_anomalies`
```sql
SELECT * FROM v_specialization_anomalies;
```
| Column | Type | Nullable | Description |
|---|---|---|---|
| `user_id` | `INT` | No | User ID flagging the anomaly. |
| `name` | `VARCHAR(100)` | No | User name. |
| `user_type` | `ENUM` | No | Declared `Users.user_type`. |
| `anomaly_reason`| `VARCHAR(50)`| No | Diagnostic reason describing the EER specialization violation. |

**Clean Benchmark:** A healthy database produces **zero rows** for this query.

---

## 4. API Security & Role-Based Access Control (RBAC)

The backend implements JWT-based authentication using the `app_role` column added to `Users` per **Approved Deviation D-01**.

### Role Hierarchy & Permissions Matrix
| Endpoint / Resource | Admin | Staff | Member | Casual |
|---|:---:|:---:|:---:|:---:|
| `POST /api/members` (`sp_register_member`) | ✅ | ✅ | ❌ | ❌ |
| `POST /api/casuals` (`sp_register_casual`) | ✅ | ✅ | ❌ | ❌ |
| `POST /api/reservations` (`sp_book_table`) | ✅ | ✅ | ✅ (Own) | ❌ |
| `POST /api/reservations/:id/cancel` (`sp_cancel_booking`) | ✅ | ✅ | ✅ (Own) | ❌ |
| `POST /api/matches/:id/complete` (`sp_complete_match`) | ✅ | ✅ | ❌ | ❌ |
| `GET /api/leaderboard` (`v_leaderboard`) | ✅ | ✅ | ✅ | ✅ |
| `GET /api/members/:id/balance` (`v_member_balance`) | ✅ | ✅ | ✅ (Own) | ❌ |
| `GET /api/reports/*` (All analytical views) | ✅ | ✅ | ❌ | ❌ |
| `GET /api/inventory/*` (`v_reorder_alerts`) | ✅ | ✅ | ❌ | ❌ |
| `GET /api/admin/diagnostics` (`v_specialization_anomalies`) | ✅ | ❌ | ❌ | ❌ |

---

## 5. Phase 5 & 6 Sign-Off Record

| Role | Name | Responsibilities | Status |
|---|---|---|:---:|
| **Database & API Spec** | Manya Bhateja | Schema, Triggers, Stored Procedures, Views, Contract Definition | Signed Off ✅ |
| **Backend Implementation** | Ananya Avunooru | Node.js, Express, Connection Pooling, Procedure Binding, JWT Auth | Pending Review ⏳ |
| **Frontend UI & Presentation** | Ujjwal Chandak | React UI, Bracket View, Booking & Ledger Screen, Slides | Pending Review ⏳ |
