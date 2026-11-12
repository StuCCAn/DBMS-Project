# CueClub Phase 1: Report Baseline Freeze, Schema Mapping & Mismatch Log

**Owner:** Priyansh Thadhani (2024A3PS0356H)  
**Source of Truth:** `docs/CueClub_MidSem_Report.pdf` (Immutable Mid-Semester Report)  
**Status:** Signed Off ☑

---

## 1. Exact Mismatches Identified in Legacy SQL vs. Mid-Semester Report

| # | Legacy SQL Mismatch (`Database/*.sql`) | Report Requirement (`CueClub_MidSem_Report.pdf`) | Correction Implemented |
|---|---|---|---|
| 1 | `Users` lacked `user_type` and `ranking_points`. | Table 3: `Users` has `user_type ENUM('Member','Casual')` and `ranking_points INT`. | Added `user_type` and `ranking_points` to `Users`. |
| 2 | Separate tables `Casual_Player`, `Team_Member`, `Individual_Player`, `Team_Enthusiast`. | Section 3 & Table 3: `Casual_Player` has no separate table; Level-2 subtypes are mapped inside `Club_Member` via boolean flags (`is_team_member`, `is_individual_player`, `is_enthusiast`) and nullable columns. | Dropped all 4 separate subtype tables; collapsed Level-2 attributes and `IFF` `CHECK` constraints into `Club_Member`. |
| 3 | Extra non-report tables: `Teams`, `Penalties`, `Player_Rankings`, `Vendors`, `Purchase_Orders`. | Section 4 defines strictly 11 relations. Fines live in `Credit_Ledger`, rankings in `Users.ranking_points`, and vendor in `Inventory_Items.vendor_name`. | Removed all 5 extra tables and refactored procedures/views to use the 11 report tables. |
| 4 | `Credit_Ledger.entry_type` was `ENUM('Charge','Payment')`. | Table 3 specifies `ENUM('Booking charge', 'Canteen charge', 'Fine', 'Payment')`. | Updated `Credit_Ledger.entry_type` domain and all triggers/procedures/views. |
| 5 | `Tournaments.format` included `'Fixture'` and `team_id` FK. | Section 1 marks inter-club fixtures out of scope; Table 3 specifies `format ENUM('Knockout', 'League')` and no `team_id`. | Removed `team_id` and restricted `format` to `ENUM('Knockout', 'League')`. |
| 6 | `Inventory_Items` had `vendor_id` FK and `condition_status = 'NeedsService'`. | Table 3 specifies `vendor_name VARCHAR(100)` and `condition_status ENUM('Good', 'Needs Service', 'Damaged', 'Retired')` (with space). | Replaced `vendor_id` with `vendor_name VARCHAR(100)` and fixed `'Needs Service'`. |
| 7 | `Club_Member.user_id` had `ON DELETE CASCADE`; `Users` had no deactivation flag for Rule R9. | Rule R9 & Table 4: Users with active historical records are deactivated rather than physically deleted (`RESTRICT` on financial/match records). | Changed `Club_Member` FK to `ON DELETE RESTRICT`, added `Users.is_active BOOL`, and added deletion-protection & active-user triggers. |
| 8 | `schema.sql` started with `DROP DATABASE IF EXISTS cueclub;`. | Checklist Section 2: Do not drop an existing production database; isolate local reset script. | Replaced with `CREATE DATABASE IF NOT EXISTS cueclub;` and isolated local reset in `database/reset_local.sql`. |
| 9 | `seed.sql` Members 4 and 7 had `end_date = '2026-11-01'` (expired). | Checklist Phase 2: Fix expired member seed dates for the demonstration period. | Updated active member `end_date` values through `2027-12-31` (and added dedicated test cases for expiry in `constraint_tests.sql`). |
| 10 | `constraint_tests.sql` ran raw failing statements at top level and mutated Match 2 on Test 15. | Checklist Section 3: Wrap tests in a controlled test harness with pass/fail output so expected failures do not abort MySQL CLI/CI, and fix Test 15 precondition. | Implemented `sp_run_constraint_tests()` harness with `CONTINUE HANDLER` and explicit precondition checks. |

---

## 2. Final 11-Relation Schema Summary (All in BCNF)

1. **`Users`**: `user_id` (PK), `name`, `phone` [U], `email` [U], `joined_on`, `user_type` ENUM('Member','Casual'), `ranking_points` INT, `is_active` BOOL (R9), `app_role` ENUM('Admin','Staff','Member','Casual') (D-01), `password_hash` VARCHAR(255) [N] (D-01).
2. **`Club_Member`**: `user_id` (PK, FK -> `Users`), `membership_no` [U], `plan`, `start_date`, `end_date`, `discount_pct`, `credit_limit`, `is_team_member`, `team_role` [N], `selection_status` [N], `handedness` [N], `is_individual_player`, `handicap` [N], `preferred_game` [N], `is_enthusiast`, `interest_type` [N], `wants_trial` [N].
3. **`Game_Tables`**: `table_id` (PK), `name` [U], `game_type`, `hourly_rate`, `per_frame_rate`, `status`.
4. **`Reservations`**: `reservation_id` (PK), `user_id` (FK -> `Users`), `table_id` (FK -> `Game_Tables`), `start_time`, `end_time`, `billing_mode`, `frames_played`, `total_amount`, `payment_status`.
5. **`Credit_Ledger`**: `entry_id` (PK), `user_id` (FK -> `Club_Member`), `reservation_id` [N] (FK -> `Reservations`), `entry_type`, `amount`, `entry_date`, `note` [N].
6. **`Tournaments`**: `tournament_id` (PK), `title`, `game_type`, `format`, `start_date`, `entry_fee`, `status`.
7. **`Tournament_Registrations`**: `registration_id` (PK), `tournament_id` (FK -> `Tournaments`), `user_id` (FK -> `Users`), `seed_number` [N], `fee_paid`.
8. **`Matches`**: `match_id` (PK), `tournament_id` (FK -> `Tournaments`), `round_number`, `player1_id` [N] (FK -> `Users`), `player2_id` [N] (FK -> `Users`), `winner_id` [N] (FK -> `Users`), `next_match_id` [N] (FK -> `Matches`), `table_id` [N] (FK -> `Game_Tables`), `scheduled_time` [N], `status`.
9. **`Match_Frames`**: `(match_id, frame_number)` (Composite PK; `match_id` FK -> `Matches` ON DELETE CASCADE), `p1_score`, `p2_score`, `highest_break`.
10. **`Skill_Assessments`**: `assessment_id` (PK), `player_id` (FK -> `Users`), `assessed_by` (FK -> `Users`), `skill_area`, `rating`, `notes` [N], `assessed_on`.
11. **`Inventory_Items`**: `item_id` (PK), `name`, `category`, `quantity`, `reorder_level`, `reorder_flag`, `table_id` [N] (FK -> `Game_Tables`), `condition_status`, `last_serviced_date` [N], `vendor_name`.