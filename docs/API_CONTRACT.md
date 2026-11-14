# CueClub API & Database Contract Specification

> **Freeze Gate:** Phase 4 (Manya Bhateja)  
> **Target Audience:** Backend API Implementation (Phase 5 — Ananya Avunooru) & Frontend UI (Phase 6 — Ujjwal Chandak)  
> **Database:** MySQL 8.0 (InnoDB) | `cueclub`  
> **Database User:** `cueclub_api` (Least Privilege: `EXECUTE` on procedures, `SELECT` on views)

---

## 1. Overview & Architecture Boundary

The CueClub relational database encapsulates core business invariants, credit accounting, tournament progression, and security checks directly within **stored procedures**, **triggers**, and **views**. 

### Contract Guarantees
1. **Zero Direct Table Writes:** The backend application MUST connect via the least-privilege `cueclub_api` account. Direct `INSERT`, `UPDATE`, or `DELETE` on raw tables is denied at the database privilege level.
2. **Encapsulated State Mutation:** All mutations are executed via authoritative stored procedures:
   - **Authentication:** `sp_get_login`
   - **Member & Casual Registration:** `sp_register_member`, `sp_register_casual`
   - **Bookings & Lifecycle:** `sp_book_table`, `sp_cancel_booking`
   - **Credit Ledger:** `sp_record_payment`, `sp_record_charge`
   - **Tournaments & Matches:** `sp_create_tournament`, `sp_register_tournament_player`, `sp_complete_match`
   - **Facilities & Equipment:** `sp_set_table_status`, `sp_update_inventory_stock`, `sp_set_inventory_condition`
   - **Coaching & Player Lifecycle:** `sp_record_assessment`, `sp_deactivate_user`
3. **Atomic Operations:** Stored procedures manage their own transactions (`START TRANSACTION` ... `COMMIT`). In case of validation or constraint failure, procedures roll back automatically and return a formatted `SIGNAL SQLSTATE '45000'` with a descriptive error message.
4. **Analytical & Operational Views:** All queries for operational workflows, leaderboards, user balances, utilisation, tournament brackets, and alerts are consumed directly through version-controlled MySQL views.

---

## 2. Stored Procedure Specifications

### 2.1 `sp_get_login`

Retrieves authentication and authorization profile for a user by their unique email.

#### Signature
```sql
CALL sp_get_login(
    IN p_email VARCHAR(120)
);
```

#### Parameters
| Parameter | Type | Required | Description / Constraints |
|---|---|---|---|
| `p_email` | `VARCHAR(120)` | Yes | Exact registered email address. Cannot be empty or NULL. |

#### REST API Mapping
* **Endpoint:** `POST /api/auth/login`
* **RBAC:** Public (unauthenticated)
* **Request Body:**
```json
{
  "email": "rohan@example.com",
  "password": "user_submitted_plaintext_password"
}
```
* **Success Response (`200 OK`):**
```json
{
  "status": "success",
  "data": {
    "token": "jwt_token_string",
    "user": {
      "userId": 1,
      "name": "Rohan Mehta",
      "email": "rohan@example.com",
      "appRole": "Admin",
      "userType": "Member",
      "isActive": true
    }
  }
}
```

#### Error Signals & SQLSTATE Codes
| SQLSTATE | Procedure / Trigger | Message Pattern / Reason | HTTP Code |
|---|---|---|---|
| `45000` | `sp_get_login` | `Email is required` | `400 Bad Request` |

---

### 2.2 `sp_register_member`

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
| `p_membership_no` | `VARCHAR(20)` | Yes | Unique club membership card number (e.g. `CM-010`). |
| `p_plan` | `VARCHAR(10)` | Yes | Membership billing plan: `'Monthly'`, `'Quarterly'`, or `'Annual'`. |
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
| `3819` | `ck_member_dates` | `Check constraint 'ck_member_dates' is violated.` (`end_date > start_date`) | `400 Bad Request` |
| `3819` | `ck_member_discount`| `Check constraint 'ck_member_discount' is violated.` (0–100%) | `400 Bad Request` |
| `3819` | `ck_member_credit` | `Check constraint 'ck_member_credit' is violated.` (`credit_limit >= 0`) | `400 Bad Request` |

---

### 2.3 `sp_register_casual`

Registers a walk-in player as a **Casual Player**. Casual players do not receive credit lines, cannot incur udhar, and must pay for all bookings upfront.

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
| `p_name` | `VARCHAR(100)` | Yes | Casual player full name. |
| `p_phone` | `VARCHAR(15)` | Yes | Unique phone number matching regex `^[0-9+]{7,15}$`. |
| `p_email` | `VARCHAR(120)` | Yes | Unique email address. |
| `p_user_id` | `INT` (OUT) | — | Auto-generated primary key (`Users.user_id`). |

#### REST API Mapping
* **Endpoint:** `POST /api/casuals`
* **RBAC:** `Admin`, `Staff`

---

### 2.4 `sp_book_table`

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
| `p_end` | `DATETIME` | Yes | Booking end time (`> p_start`). May terminate at `00:00:00` of next day. |
| `p_mode` | `VARCHAR(10)` | Yes | `'Hourly'` or `'PerFrame'`. |
| `p_frames` | `INT` | Yes | Frames played. Must be `> 0` if `p_mode = 'PerFrame'`; pass `0` for hourly. |
| `p_pay_status` | `VARCHAR(10)` | Yes | Initial status: `'Pending'`, `'Paid'`, or `'OnCredit'`. Casuals MUST use `'Paid'`. |
| `p_reservation_id` | `INT` (OUT) | — | Auto-generated ID (`Reservations.reservation_id`). |

#### Calculation Rules & Invariants
1. **Hourly Mode:** `total_amount = ROUND(hourly_rate * (duration_minutes / 60) * (1 - discount_pct / 100), 2)`
2. **Per-Frame Mode:** `total_amount = ROUND(per_frame_rate * frames_played * (1 - discount_pct / 100), 2)`
3. **Discount Rule:** Discount percentage applies **only** if the user is an active member with non-expired dates on both `p_start` and `CURRENT_DATE`. Casual players receive 0% discount.
4. **Complimentary Rule (100% Discount):** 100% discount produces `total_amount = 0.00` which is accepted by `ck_res_total (>= 0)`. When booked `OnCredit`, no row is inserted into `Credit_Ledger` because `v_total = 0.00`, successfully preventing a violation of `ck_led_amount (amount > 0)`.
5. **Credit Race Mitigation:** When `p_pay_status = 'OnCredit'`, `Club_Member` row is locked early via `FOR UPDATE` to serialize concurrent booking balance evaluations.

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

### 2.5 `sp_cancel_booking`

Cancels an existing table booking, updates reservation payment status to `'Cancelled'`, and issues a credit reversal refund according to **Deviation D-02**.

#### Signature
```sql
CALL sp_cancel_booking(
    IN  p_reservation_id INT,
    OUT p_refund_amount  DECIMAL(10,2)
);
```

#### Parameters
| Parameter | Type | Required | Description |
|---|---|---|---|
| `p_reservation_id` | `INT` | Yes | Existing booking ID to cancel (`Reservations.reservation_id`). |
| `p_refund_amount` | `DECIMAL(10,2)` (OUT) | — | Actual credit refund posted (0.00 if pending, cash-paid, or paid down). |

#### Business Logic & Refund Rules (Deviation D-02)
1. **Row Lock:** Acquires an exclusive `FOR UPDATE` lock on `Reservations`.
2. **Idempotency:** If the reservation is already `'Cancelled'`, the procedure commits as a no-op, sets `p_refund_amount = 0.00`, and posts zero duplicate ledger entries.
3. **Credit Refund Policy (`payment_status = 'OnCredit'`):**
   - Locks the member's `Club_Member` row `FOR UPDATE`.
   - Computes outstanding balance: `outstanding_balance = SUM(charges) - SUM(payments)`.
   - **Balance-Wide Scope:** Refunds are applied against the member's **whole outstanding balance**, not just this booking's charge:
     $$\text{refund} = \min(\text{total\_amount}, \max(\text{outstanding\_balance}, 0.00))$$
   - If `refund > 0.00`, posts a positive `Payment` entry in `Credit_Ledger` with note: `'Booking cancellation refund: #<reservation_id>'`.
   - **Zero-Refund on Full Payoff:** A credit booking paid in full before cancellation gets **no refund** (`p_refund_amount = 0.00`). This avoids tripping `trg_ledger_bi` (`Payment exceeds outstanding balance`).
4. **Cash / Pending Bookings (`payment_status IN ('Pending', 'Paid')`):**
   - Status updates directly to `'Cancelled'` with **0** ledger entries posted and `p_refund_amount = 0.00`.
5. **No Start-Time Restriction:** Cancellation is allowed at any time (there is no rule restricting cancellation prior to or after start time).
6. **Terminal State:** A cancelled booking cannot be un-cancelled or transitioned to any other state.

#### REST API Mapping
* **Endpoint:** `POST /api/reservations/:id/cancel`
* **RBAC:** `Admin`, `Staff`, `Member` (own reservation only)

---

### 2.6 `sp_record_payment`

Records a member's bill settlement or credit repayment into the Credit Ledger.

#### Signature
```sql
CALL sp_record_payment(
    IN  p_user     INT,
    IN  p_amount   DECIMAL(10,2),
    IN  p_note     VARCHAR(200),
    OUT p_entry_id INT
);
```

#### Parameters
| Parameter | Type | Required | Description / Constraints |
|---|---|---|---|
| `p_user` | `INT` | Yes | Registered Club Member ID (`Club_Member.user_id`). Casuals rejected. |
| `p_amount` | `DECIMAL(10,2)` | Yes | Payment amount (`> 0.00`). Cannot exceed current outstanding balance. |
| `p_note` | `VARCHAR(200)` | No | Settlement remarks (e.g. `'UPI payment ref 9988'`). |
| `p_entry_id` | `INT` (OUT) | — | Auto-generated ledger ID (`Credit_Ledger.entry_id`). |

#### REST API Mapping
* **Endpoint:** `POST /api/ledger/payment`
* **RBAC:** `Admin`, `Staff`

#### Error Signals & SQLSTATE Codes
| SQLSTATE | Procedure / Trigger | Error Message | HTTP Code |
|---|---|---|---|
| `45000` | `sp_record_payment` | `Payment amount must be greater than zero` | `400 Bad Request` |
| `45000` | `sp_record_payment` | `Payments can only be recorded for registered club members` | `403 Forbidden` |
| `45000` | `trg_ledger_bi` | `Payment exceeds outstanding balance` | `400 Bad Request` |

---

### 2.7 `sp_record_charge`

Records non-booking operational charges (e.g. Canteen refreshments or disciplinary Fines) against a member's credit ledger.

#### Signature
```sql
CALL sp_record_charge(
    IN  p_user     INT,
    IN  p_type     VARCHAR(20),     -- Exactly 'Canteen charge' or 'Fine'
    IN  p_amount   DECIMAL(10,2),
    IN  p_note     VARCHAR(200),
    OUT p_entry_id INT
);
```

#### Parameters
| Parameter | Type | Required | Description / Constraints |
|---|---|---|---|
| `p_user` | `INT` | Yes | Member ID. Casuals rejected. |
| `p_type` | `VARCHAR(20)` | Yes | Must be exactly `'Canteen charge'` or `'Fine'`. `'Booking charge'` rejected. |
| `p_amount` | `DECIMAL(10,2)` | Yes | Charge amount (`> 0.00`). |
| `p_note` | `VARCHAR(200)` | No | Charge description. |
| `p_entry_id` | `INT` (OUT) | — | Generated ledger ID. |

#### REST API Mapping
* **Endpoint:** `POST /api/ledger/charge`
* **RBAC:** `Admin`, `Staff`

#### Error Signals & SQLSTATE Codes
| SQLSTATE | Procedure / Trigger | Error Message | HTTP Code |
|---|---|---|---|
| `45000` | `sp_record_charge` | `Invalid charge type: must be Canteen charge or Fine` | `400 Bad Request` |
| `45000` | `sp_record_charge` | `Charge amount must be greater than zero` | `400 Bad Request` |
| `45000` | `sp_record_charge` | `Charges can only be recorded for registered club members` | `403 Forbidden` |
| `45000` | `trg_ledger_bi` | `Credit limit exceeded` | `402 Payment Required` |

---

### 2.8 `sp_create_tournament`

Creates a new tournament in `'Draft'` status.

#### Signature
```sql
CALL sp_create_tournament(
    IN  p_title         VARCHAR(120),
    IN  p_game          VARCHAR(20),     -- 'Snooker', 'Pool', 'Billiards'
    IN  p_format        VARCHAR(20),     -- 'Knockout', 'League'
    IN  p_start         DATE,
    IN  p_fee           DECIMAL(8,2),    -- >= 0.00
    OUT p_tournament_id INT
);
```

#### Parameters
| Parameter | Type | Required | Description / Constraints |
|---|---|---|---|
| `p_title` | `VARCHAR(120)` | Yes | Tournament name. Cannot be empty. |
| `p_game` | `VARCHAR(20)` | Yes | Must be `'Snooker'`, `'Pool'`, or `'Billiards'`. |
| `p_format` | `VARCHAR(20)` | Yes | Must be `'Knockout'` or `'League'`. |
| `p_start` | `DATE` | Yes | Scheduled tournament start date. |
| `p_fee` | `DECIMAL(8,2)` | Yes | Entry fee (`>= 0.00`). Default `200.00`. |
| `p_tournament_id` | `INT` (OUT) | — | Auto-generated tournament ID. |

#### REST API Mapping
* **Endpoint:** `POST /api/tournaments`
* **RBAC:** `Admin`, `Staff`

---

### 2.9 `sp_register_tournament_player`

Registers an active user for an open tournament in `'Registration'` status.

#### Signature
```sql
CALL sp_register_tournament_player(
    IN p_tournament_id INT,
    IN p_user_id       INT,
    IN p_seed          INT,     -- Optional seed number (>= 1 or NULL)
    IN p_fee_paid      BOOL     -- TRUE if paid, FALSE otherwise
);
```

#### Parameters
| Parameter | Type | Required | Description / Constraints |
|---|---|---|---|
| `p_tournament_id` | `INT` | Yes | Target tournament ID. Must have `status = 'Registration'`. |
| `p_user_id` | `INT` | Yes | Active user ID. Deactivated users rejected (Rule R9). |
| `p_seed` | `INT` | No | Seed position (`>= 1` or `NULL`). Must be unique per tournament. |
| `p_fee_paid` | `BOOL` | Yes | Entry fee settlement status. |

#### REST API Mapping
* **Endpoint:** `POST /api/tournaments/:id/register`
* **RBAC:** `Admin`, `Staff`, `Member` (self-registration)

#### Error Signals & SQLSTATE Codes
| SQLSTATE | Procedure / Trigger | Error Message | HTTP Code |
|---|---|---|---|
| `45000` | `trg_registration_bi` | `Registration is not open for this tournament` | `409 Conflict` |
| `45000` | `trg_registration_bi` | `Rule R9: Deactivated users cannot register for tournaments` | `403 Forbidden` |
| `23000` | `uq_reg_player` | `Duplicate entry ... for key 'uq_reg_player'` | `409 Conflict` |

---

### 2.10 `sp_complete_match`

Executes the atomic tournament match completion workflow: inserts frame scores, determines the match winner, advances the bracket using deterministic feeder rules, awards ranking points, and closes the tournament if final.

#### Signature
```sql
CALL sp_complete_match(
    IN p_match_id     INT,
    IN p_frames       JSON,    -- Array of frame objects: [{"p1": 70, "p2": 30, "break": 45}]
    IN p_win_points   INT,     -- Ranking points for winner (>= 0)
    IN p_loss_points  INT      -- Ranking points for loser (>= 0)
);
```

#### REST API Mapping
* **Endpoint:** `POST /api/matches/:id/complete`
* **RBAC:** `Admin`, `Staff`

---

### 2.11 `sp_set_table_status`

Updates a game table's operational availability.

#### Signature
```sql
CALL sp_set_table_status(
    IN p_table_id INT,
    IN p_status   VARCHAR(20)    -- 'Available', 'Maintenance', 'Retired'
);
```

#### Parameters
| Parameter | Type | Required | Description / Constraints |
|---|---|---|---|
| `p_table_id` | `INT` | Yes | Target table ID. |
| `p_status` | `VARCHAR(20)` | Yes | Allowed values: `'Available'`, `'Maintenance'`, `'Retired'`. |

#### REST API Mapping
* **Endpoint:** `PATCH /api/tables/:id/status`
* **RBAC:** `Admin`, `Staff`

---

### 2.12 `sp_record_assessment`

Records a coaching skill rating and qualitative notes for a team member or individual player.

#### Signature
```sql
CALL sp_record_assessment(
    IN p_player_id   INT,
    IN p_assessed_by INT,
    IN p_skill       VARCHAR(30),
    IN p_rating      INT,           -- 1 to 10
    IN p_notes       VARCHAR(300)
);
```

#### Parameters
| Parameter | Type | Required | Description / Constraints |
|---|---|---|---|
| `p_player_id` | `INT` | Yes | Evaluated player ID. Must be a Team Member or Individual Player. |
| `p_assessed_by` | `INT` | Yes | Coach / Assessor user ID (`assessed_by != player_id`). |
| `p_skill` | `VARCHAR(30)` | Yes | Allowed: `'Long potting'`, `'Safety play'`, `'Break building'`, `'Positional play'`, `'Cue ball control'`, `'Pressure handling'`. |
| `p_rating` | `INT` | Yes | Skill score between `1` and `10`. |
| `p_notes` | `VARCHAR(300)` | No | Qualitative feedback remarks. |

#### REST API Mapping
* **Endpoint:** `POST /api/coaching/assessments`
* **RBAC:** `Admin`, `Staff`

---

### 2.13 `sp_update_inventory_stock`

Increments or decrements inventory stock by a signed delta. Automatically updates `reorder_flag` (Rule R8).

#### Signature
```sql
CALL sp_update_inventory_stock(
    IN p_item_id INT,
    IN p_delta   INT     -- Positive to add stock, negative to consume
);
```

#### Parameters
| Parameter | Type | Required | Description / Constraints |
|---|---|---|---|
| `p_item_id` | `INT` | Yes | Inventory item ID. |
| `p_delta` | `INT` | Yes | Quantity adjustment. `quantity + p_delta` cannot be negative. |

#### REST API Mapping
* **Endpoint:** `PATCH /api/inventory/:id/stock`
* **RBAC:** `Admin`, `Staff`

---

### 2.14 `sp_set_inventory_condition`

Updates physical maintenance status for club equipment.

#### Signature
```sql
CALL sp_set_inventory_condition(
    IN p_item_id INT,
    IN p_status  VARCHAR(30)    -- 'Good', 'Needs Service', 'Damaged', 'Retired'
);
```

#### REST API Mapping
* **Endpoint:** `PATCH /api/inventory/:id/condition`
* **RBAC:** `Admin`, `Staff`

---

### 2.15 `sp_deactivate_user`

Deactivates a user account while preserving all historical records in compliance with Rule R9.

#### Signature
```sql
CALL sp_deactivate_user(
    IN p_user_id INT
);
```

#### Parameters
| Parameter | Type | Required | Description / Constraints |
|---|---|---|---|
| `p_user_id` | `INT` | Yes | Target user ID. Sets `is_active = FALSE`. Idempotent if already inactive. |

#### REST API Mapping
* **Endpoint:** `PATCH /api/users/:id/deactivate`
* **RBAC:** `Admin`

---

## 3. Views Specification

All queries consume verified MySQL views. Direct table access is forbidden for `cueclub_api`.

### 3.A Analytical Views (Phase 3)

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

### 3.B Operational Read Views (Phase 4)

#### 3.11 `v_reservations_all`
Exposes all reservation records joined with user and table labels for operational dispatch and player history.
* **Endpoint:** `GET /api/reservations` (filters: `userId`, `tableId`, `status`)
* **Columns:** `reservation_id`, `user_id`, `user_name`, `table_id`, `table_name`, `start_time`, `end_time`, `billing_mode`, `frames_played`, `total_amount`, `payment_status`.

#### 3.12 `v_tables_status`
Exposes the real-time operational catalog of all tables and tariff rates.
* **Endpoint:** `GET /api/tables`
* **Columns:** `table_id`, `name`, `game_type`, `hourly_rate`, `per_frame_rate`, `status`.

#### 3.13 `v_credit_ledger_entries`
Exposes granular transaction lines of the credit ledger.
* **Endpoint:** `GET /api/ledger/entries` (filter: `userId`)
* **Columns:** `entry_id`, `user_id`, `reservation_id`, `entry_type`, `amount`, `entry_date`, `note`.

#### 3.14 `v_tournaments_list`
Exposes tournaments with live registered player counts.
* **Endpoint:** `GET /api/tournaments`
* **Columns:** `tournament_id`, `title`, `game_type`, `format`, `start_date`, `entry_fee`, `status`, `registered_players`.

#### 3.15 `v_tournament_registrations`
Exposes player registrations and seeding per tournament.
* **Endpoint:** `GET /api/tournaments/:id/registrations`
* **Columns:** `tournament_id`, `user_id`, `user_name`, `seed_number`, `fee_paid`.

#### 3.16 `v_inventory_catalog`
Exposes entire club equipment catalog with stock and condition status.
* **Endpoint:** `GET /api/inventory`
* **Columns:** `item_id`, `name`, `category`, `quantity`, `reorder_level`, `reorder_flag`, `condition_status`, `last_serviced_date`, `vendor_name`.

#### 3.17 `v_coaching_history`
Exposes longitudinal coaching evaluation history.
* **Endpoint:** `GET /api/coaching/history` (filter: `playerId`)
* **Columns:** `assessment_id`, `player_id`, `player_name`, `assessed_by`, `coach_name`, `skill_area`, `rating`, `notes`, `assessed_on`.

---

## 4. API Security & Role-Based Access Control (RBAC) Matrix

| Endpoint / Operation | Procedure / View Called | Admin | Staff | Member | Casual |
|---|---|:---:|:---:|:---:|:---:|
| `POST /api/auth/login` | `sp_get_login` | ✅ | ✅ | ✅ | ✅ |
| `POST /api/members` | `sp_register_member` | ✅ | ✅ | ❌ | ❌ |
| `POST /api/casuals` | `sp_register_casual` | ✅ | ✅ | ❌ | ❌ |
| `POST /api/reservations` | `sp_book_table` | ✅ | ✅ | ✅ (Own) | ❌ |
| `POST /api/reservations/:id/cancel`| `sp_cancel_booking` | ✅ | ✅ | ✅ (Own) | ❌ |
| `GET /api/reservations` | `v_reservations_all` | ✅ | ✅ | ✅ (Own) | ❌ |
| `GET /api/tables` | `v_tables_status` | ✅ | ✅ | ✅ | ✅ |
| `PATCH /api/tables/:id/status` | `sp_set_table_status` | ✅ | ✅ | ❌ | ❌ |
| `POST /api/ledger/payment` | `sp_record_payment` | ✅ | ✅ | ❌ | ❌ |
| `POST /api/ledger/charge` | `sp_record_charge` | ✅ | ✅ | ❌ | ❌ |
| `GET /api/ledger/entries` | `v_credit_ledger_entries` | ✅ | ✅ | ✅ (Own) | ❌ |
| `GET /api/members/:id/balance` | `v_member_balance` | ✅ | ✅ | ✅ (Own) | ❌ |
| `POST /api/tournaments` | `sp_create_tournament` | ✅ | ✅ | ❌ | ❌ |
| `GET /api/tournaments` | `v_tournaments_list` | ✅ | ✅ | ✅ | ✅ |
| `POST /api/tournaments/:id/register`| `sp_register_tournament_player` | ✅ | ✅ | ✅ (Own) | ❌ |
| `GET /api/tournaments/:id/registrations`| `v_tournament_registrations` | ✅ | ✅ | ✅ | ✅ |
| `POST /api/matches/:id/complete` | `sp_complete_match` | ✅ | ✅ | ❌ | ❌ |
| `GET /api/tournaments/:id/bracket` | `v_bracket_tree` | ✅ | ✅ | ✅ | ✅ |
| `GET /api/leaderboard` | `v_leaderboard` | ✅ | ✅ | ✅ | ✅ |
| `GET /api/inventory` | `v_inventory_catalog` | ✅ | ✅ | ❌ | ❌ |
| `PATCH /api/inventory/:id/stock` | `sp_update_inventory_stock` | ✅ | ✅ | ❌ | ❌ |
| `PATCH /api/inventory/:id/condition`| `sp_set_inventory_condition` | ✅ | ✅ | ❌ | ❌ |
| `GET /api/inventory/reorder-alerts`| `v_reorder_alerts` | ✅ | ✅ | ❌ | ❌ |
| `POST /api/coaching/assessments` | `sp_record_assessment` | ✅ | ✅ | ❌ | ❌ |
| `GET /api/coaching/history` | `v_coaching_history` | ✅ | ✅ | ✅ (Own) | ❌ |
| `GET /api/coaching/weaknesses` | `v_player_weaknesses` | ✅ | ✅ | ✅ (Own) | ❌ |
| `PATCH /api/users/:id/deactivate` | `sp_deactivate_user` | ✅ | ❌ | ❌ | ❌ |
| `GET /api/admin/diagnostics` | `v_specialization_anomalies` | ✅ | ❌ | ❌ | ❌ |
| `GET /api/reports/*` | Analytical Views (all) | ✅ | ✅ | ❌ | ❌ |

---

## 5. Phase 5 & 6 Sign-Off Record

| Role | Name | Responsibilities | Status |
|---|---|---|:---:|
| **Database & API Spec** | Manya Bhateja | Schema, Triggers, Stored Procedures, Views, Contract Definition | Signed Off ✅ |
| **Backend Implementation** | Ananya Avunooru | Node.js, Express, Connection Pooling, Procedure Binding, JWT Auth | Pending Review ⏳ |
| **Frontend UI & Presentation** | Ujjwal Chandak | React UI, Bracket View, Booking & Ledger Screen, Slides | Pending Review ⏳ |
