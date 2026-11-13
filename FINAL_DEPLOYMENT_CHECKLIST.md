# CueClub Final Deployment and Presentation Checklist

Use this document as the shared work tracker. Tick items only after they are implemented and verified. Add the owner's name, issue/PR link, or evidence beside completed work where useful.

## Source-of-truth decision

The mid-semester report and its repository, `https://github.com/StuCCAn/DBMS-Project`, are immutable and authoritative. All implementation and final deliverables must match the report.

### Alignment gate

- [x] Implement the report's schema, workflows, constraints, and terminology.
- [x] Test the report-aligned implementation before considering any deviation.
- [x] Document a deviation only when a report requirement is technically unimplementable.
- [x] Record the technical blocker, attempted solutions, affected files, impact, owner, and approval for D-01 and D-02.

### Current implementation status

- Database foundation implemented with 11 BCNF relations; core workflows demonstrated.
- CI passed repository quality, report integrity, MySQL setup, schema loading, demo execution, and constraint tests.
- **Next Gate (Phase 4 — Manya):** DB contract freeze, lifecycle/procedure fixes, and API contract specifications must be finalized before Phase 5 (Ananya) backend implementation begins.
- Backend, frontend, deployment documentation, and presentation remain open.

### Deviation register

| ID | Report requirement | Implemented deviation | Reason and impact | Affected files | Approval/evidence |
|---|---|---|---|---|---|
| D-01 | Authentication and admin/staff roles | The report's 11-table schema has no password, authentication, or role attributes, so JWT role-based access cannot be implemented from the report alone. | Add the minimum authentication/role model (`password_hash`, `app_role`) in the end-semester implementation and document the schema/API impact. | `database/schema.sql`, backend, final report | Approved by Priyansh Thadhani & Ujjwal Chandak (Nov 2026, PR #4 / `docs/SCHEMA_MAPPING_AND_BASELINE.md`). Adds minimal `password_hash` and `app_role` to `Users` to support JWT RBAC without altering the 11 report relations. |
| D-02 | Booking cancellation and credit refund | The report defines credit charges and payments, but has no explicit cancellation protocol. | Implement `sp_cancel_booking` to transition status to 'Cancelled' and post a compensating reversal entry in `Credit_Ledger`. **Refund Policy:** Credit refund is capped at the member's current outstanding balance (`LEAST(booking_amount, outstanding_balance)`) to avoid violating `trg_ledger_bi` ('Payment exceeds outstanding balance') if the charge was already paid down. Bookings never charged to credit (Pending or cash-Paid) update status to 'Cancelled' without posting ledger entries. | `database/procedures.sql`, `database/triggers.sql`, backend | Approved by Goru Nikhil & Ananya Avunooru (Nov 2026). Works without schema alteration: `Reservations.payment_status` already contains `'Cancelled'`, and credit refund is represented by a positive `Credit_Ledger` entry (`entry_type = 'Payment'`, `note = 'Booking cancellation refund: #ID'`) which decrements outstanding balance in `v_member_balance` while satisfying `ck_led_amount (amount > 0)`. |

## Report-to-file traceability

| Report area | Implementation files that must agree |
|---|---|
| Relational schema and domains | `database/schema.sql`, `database/seed.sql`, `README.md`, final report |
| Integrity constraints and triggers | `database/schema.sql`, `database/triggers.sql`, `database/constraint_tests.sql` |
| Transactions and workflows | `database/procedures.sql`, `database/demo.sql`, backend endpoints |
| Views and reports | `database/views.sql`, backend endpoints, frontend report screens |
| ER/EER and architecture | `docs/er/*`, final report, deployment documentation |
| Team contributions and progress | `README.md`, final report, presentation slides |

## Ownership

| Area | Owner | Status |
|---|---|---|
| Schema, report alignment, and normalization | Priyansh Thadhani | ☑ |
| Constraints, triggers, and transaction validation | Goru Nikhil | ☑ |
| Views, reports, dataset, and DB contract freeze for API | Manya Bhateja | ☐ |
| Backend/API and authentication deviation D-01 | Ananya Avunooru | ☐ |
| Frontend, documentation, integration, and presentation | Ujjwal Chandak | ☐ |

## Sequential work plan

Complete each phase in order. The next phase begins only after the previous phase's owner has reviewed and signed off the required files.

| Phase | Owner | Depends on | Exit condition |
|---|---|---|---|
| 1. Freeze report baseline and schema mapping | Priyansh Thadhani | None | Schema mapping and unresolved questions are recorded |
| 2. Implement schema and seed model | Priyansh Thadhani | Phase 1 | `database/schema.sql` and the base of `database/seed.sql` match the report |
| 3. Implement constraints and transactions | Goru Nikhil | Phase 2 | Triggers, procedures, and constraint tests pass on the schema |
| 4. Finalize DB contracts, lifecycle fixes, views, and data | Manya Bhateja | Phase 3 | DB contract frozen, lifecycle/procedure fixes verified, views corrected, and API contract signed off for Ananya |
| 5. Implement backend/API | Ananya Avunooru | Phase 4 and agreed view/procedure interfaces | API runs against the verified database |
| 6. Implement frontend/integration | Ujjwal Chandak | Phases 4 and 5 | Report workflows work end to end through the UI |
| 7. Final validation and presentation | All; coordinator Ujjwal Chandak | Phase 6 | Clean setup, tests, demo, report, and presentation are signed off |

### Phase 1 — Priyansh: report baseline and schema mapping

- [x] Extract the final relation, attribute, key, FK, nullability, enum, and cardinality requirements from the immutable mid-semester report.
- [x] Create the report-to-SQL mapping in the end-semester documentation.
- [x] Identify every mismatch in the current SQL and convert it into a schema correction task.
- [x] Confirm the 11-relation design and specialization mapping.
- [x] Confirm the R9 deactivation requirement and the technically necessary D-01 authentication addition.
- [x] Sign off the schema baseline before Phase 2 begins.

### Phase 2 — Priyansh: schema and seed model

- [x] Refactor `database/schema.sql` to match the report's 11 relations.
- [x] Implement the report's `user_type`, `ranking_points`, and Level-2 specialization attributes.
- [x] Implement a report-compatible deactivation mechanism for R9.
- [x] Remove implementation-only tables and columns unless required by an approved technical deviation.
- [x] Make the schema initialization safe for production and isolate any local reset script.
- [x] Update the base structure of `database/seed.sql`.
- [x] Fix the expired member seed dates for the demonstration period.
- [x] Run a schema review with Goru and Manya before handoff.

### Phase 3 — Goru: constraints, triggers, and transactions

- [x] Align `database/triggers.sql` with the finalized schema.
- [x] Enforce disjoint Level-1 specialization via triggers and totality via procedure encapsulation (diagnostic view added in Phase 4).
- [x] Enforce overlapping/partial Level-2 specialization rules.
- [x] Enforce no-midnight-crossing bookings (boundary refinement for 00:00:00 scheduled in Phase 4).
- [x] Enforce active-membership checks for discounts and credit bookings.
- [x] Enforce R9 deactivation and historical-record protection.
- [x] Align `database/procedures.sql` with the finalized schema.
- [x] Preserve atomic match completion, bracket advancement, and ranking updates.
- [x] Update `database/constraint_tests.sql` for all corrected rules.
- [x] Fix test 15 so it cannot succeed and mutate data on a fresh seed.
- [x] Sign off database constraints before Manya and Ananya build on them.

### Phase 4 — Manya: DB contract freeze, lifecycle fixes, views, and data

> [!IMPORTANT]
> This phase forms the contract freeze gate before Phase 5 (Ananya). All database fixes, test verifications, and contract definitions below must be completed and signed off before Ananya begins backend implementation.

#### Step 4.1: Database fixes and hardening
- [x] Refactor `database/views.sql` to use only finalized report relations and attributes.
- [x] Implement leaderboard output using report-defined `Users.ranking_points`.
- [x] Verify win streaks, head-to-head, bracket, table utilisation, reorder, and weakness reports.
- [x] Complete `database/seed.sql` with valid, realistic demonstration data.
- [x] Update `database/demo.sql` to demonstrate every report workflow.
- [x] **Midnight Boundary Fix (`database/schema.sql`):** Refine `ck_res_no_midnight` to allow bookings ending at `00:00:00` (midnight dot), citing report Rule R1 (which forbids multi-day reservations crossing midnight, not terminating at midnight).
- [x] **100% Discount Support (`database/schema.sql`):** Update `ck_res_total` to `CHECK (total_amount >= 0)` so complimentary bookings do not violate constraints.
- [x] **Reservation Lifecycle & Trigger Fix (`database/triggers.sql`):** Define allowed transitions (`Pending` -> `Paid`/`Cancelled`; `OnCredit` -> `Cancelled`). Update `trg_reservation_bu` / `sp_validate_reservation` so updating `payment_status` on past reservations is not blocked by current table maintenance or expired memberships.
- [x] **Booking Cancellation Procedure (`database/procedures.sql`):** Implement `sp_cancel_booking(p_reservation_id)` to set status to 'Cancelled' and post a compensating positive `'Payment'` entry in `Credit_Ledger` capped at `LEAST(total_amount, outstanding_balance)` to comply with `trg_ledger_bi` (Deviation D-02).
- [x] **Harden `sp_complete_match` (`database/procedures.sql`):** Explicitly reject cancelled matches (`status NOT IN ('Scheduled', 'InProgress')`) and reject NULL ranking increments upfront.
- [x] **Credit-Limit Race Mitigation:** Add `FOR UPDATE` lock on `Club_Member` row before balance calculation in `sp_book_table` and `trg_ledger_bi`.
- [x] **Leaderboard View Fix (`database/views.sql`):** Remove `COALESCE(cm.preferred_game, 'Snooker')` so Casual players do not default to 'Snooker'.
- [x] **Diagnostic Specialization View (`database/views.sql`):** Add `v_specialization_anomalies` to identify orphan members or casuals with member rows.
- [x] **User Role & Type Consistency:** Enforce in procedure / trigger that `Admin` and `Staff` roles require valid associated membership records where applicable, documenting allowed combinations.
- [x] **Deterministic Bracket Feeder Rule:** Implement explicit feeder-slot mapping in `sp_complete_match` so bracket progression does not depend on `match_id` insertion order.
- [x] **Least-Privilege User Script (`database/roles.sql`):** Provision `cueclub_api` user granted only `EXECUTE` on procedures and `SELECT` on views, taking credentials from environment variables.

#### Step 4.2: Comprehensive constraint and lifecycle tests (`database/constraint_tests.sql`)
- [x] **Re-runnable Test Harness:** Clean up temporary test fixtures (e.g., Tournament 2) upon completion so `sp_run_constraint_tests()` can be executed repeatedly on a live database without crashing on duplicate keys.
- [ ] **Cancellation Tests:** Test cancel before start, cancel after start, cancel already-paid booking, duplicate cancel (idempotency), verify ledger refund balance, verify that cancelling a non-credit booking (`Pending` or cash-`Paid`) posts zero ledger entries, and verify that cancelling an `OnCredit` booking whose balance is already paid down caps the refund at outstanding balance without tripping the overpayment trigger.
- [ ] **Match Hardening Tests:** Test rejection of cancelled-match completion and rejection of NULL ranking inputs.
- [ ] **Boundary Tests:** Test a booking ending exactly at `00:00:00` and a 100% discount booking (`total_amount = 0.00`).
- [ ] **Lifecycle Settlement Test:** Test updating `payment_status` to `'Paid'` on a historical reservation where the table is in maintenance and membership is expired.
- [ ] **R9 Historical Delete Test:** Assert `trg_users_bd` rejects physical deletion of users with historical records.
- [ ] **Credit-Limit Concurrency Test:** Execute a two-session test demonstrating that concurrent bookings against a shared credit limit prevent overbooking.
- [ ] **Privilege Test:** Verify `cueclub_api` user can execute procedures and select views, but direct table `INSERT`/`UPDATE`/`DELETE` are denied.

#### Step 4.3: Interface freeze and documentation
- [ ] **Freeze API Contract (`docs/API_CONTRACT.md`):** Document exact inputs, outputs, JSON formats, error messages, and SQLSTATE codes for all procedures (`sp_register_member`, `sp_register_casual`, `sp_book_table`, `sp_cancel_booking`, `sp_complete_match`) and views.
- [ ] Capture expected outputs for presentation and API integration.
- [ ] Sign off view names, columns, and procedure contracts with Ananya and Ujjwal before Phase 5 starts.

### Phase 5 — Ananya: backend/API and D-01

- [ ] Create `backend/` with Node.js, Express, and MySQL pooling.
- [ ] Connect to MySQL as the least-privilege `cueclub_api` user (never as root).
- [ ] Code API strictly against frozen procedure and view contracts in `docs/API_CONTRACT.md`.
- [ ] Implement D-01 authentication fields and document the exact schema/API impact.
- [ ] Add password handling, JWT authentication, and admin/staff/member access boundaries.
- [ ] Use a password-hashing algorithm; never store or log plaintext passwords.
- [ ] Configure JWT expiry, signing secrets, and authentication failure handling through environment variables.
- [ ] Add authorization tests for every supported role and protected endpoint.
- [ ] Add environment configuration and a database health endpoint.
- [ ] Implement endpoints for booking, credit ledger, tournaments, match completion, and reports.
- [ ] Use stored procedures and views rather than duplicating business rules in the API.
- [ ] Add request validation and consistent error responses.
- [ ] Add API tests for successful workflows and database-rejected operations.
- [ ] Sign off API contracts before frontend integration.

### Phase 6 — Ujjwal: frontend, integration, and documentation

- [ ] Update `README.md` first with setup, execution order, environment variables, and demo accounts to unblock all team workflows.
- [ ] Create `frontend/` React scaffolding and build screens against mock responses from `docs/API_CONTRACT.md` in parallel with Phase 5.
- [ ] Implement login and role-aware navigation.
- [ ] Implement manager, staff/scorer, member, team, and casual-player screens.
- [ ] Implement booking, credit ledger, tournament/bracket, scorer, leaderboard, inventory, and coaching screens.
- [ ] Integrate every screen with the verified backend API.
- [ ] Add loading, empty, validation, and error states.
- [x] Add the final schema mapping and approved D-01 explanation to end-semester documentation.
- [ ] Keep the immutable mid-semester report unchanged.

### Phase 7 — All contributors: final validation and presentation

- [x] Priyansh verifies report/schema consistency and normalization claims.
- [ ] Goru runs the complete constraint, rollback, and transaction test suite.
- [ ] Manya verifies all views, seed data, and demo outputs.
- [ ] Ananya verifies authentication, API tests, and database connectivity.
- [ ] Ujjwal verifies frontend workflows, README setup, and presentation flow.
- [x] Run the database system from a clean CI environment.
- [x] Verify the final repository contains the current source, database tests, documentation, report, and diagrams.
- [ ] Demonstrate the complete report workflows in the agreed order.
- [ ] Obtain team sign-off before the final release.

## 1. Report alignment and design freeze

- [x] Freeze the mid-semester report's 11-relation design as the final baseline.
- [x] Confirm every relation, attribute, nullable marker, key, FK, enum, and cardinality in the report.
- [x] Keep the mid-semester report unchanged in its original repository.
- [x] Add implementation notes only in the end-semester deliverable.
- [x] Preserve or verify the report's repository URL as `https://github.com/StuCCAn/DBMS-Project`.
- [ ] Update the ER/EER diagrams in `docs/er/` to match the report's final schema.
- [x] Add a schema-to-implementation mapping table to the end-semester documentation.
- [x] Complete the D-01 and D-02 deviation register entries with blocker, attempted alternatives, impact, owner, and approval evidence.
- [x] Reconcile all functional dependencies and normalization claims after the schema freeze.
- [x] Retain `database/seed.sql` as the clean authoritative demo seed; defer 500+ synthetic dataset generator to Tier 3.
- [ ] Produce and review the final report before changing presentation material.

## 2. Database implementation: report-aligned changes

### `database/schema.sql`

- [x] Make `Users` match the report, including `user_type` and `ranking_points`.
- [x] Make `Club_Member` match the report, including the documented specialization flags and nullable subtype attributes.
- [x] Remove separate `Casual_Player`, `Team_Member`, `Individual_Player`, and `Team_Enthusiast` tables unless technically required by the report.
- [x] Remove extra tables not in the report, including `Teams`, `Penalties`, `Player_Rankings`, `Vendors`, and `Purchase_Orders`.
- [x] Make `Credit_Ledger.entry_type` match the report's documented domain.
- [x] Make `Tournaments.format` match the report's documented domain.
- [x] Make inventory/vendor attributes match the report.
- [x] Recheck all PKs, FKs, nullability, unique constraints, CHECK constraints, and delete actions against the report.
- [x] Preserve the report's disjoint/total Level-1 specialization and overlapping/partial Level-2 specialization.
- [x] Preserve the report's rule that historical financial and match records are not physically deleted.
- [x] Add a report-compatible deactivation field or mechanism for R9, and prevent deletion of users with historical records.
- [x] Approve and document authentication and role fields under D-01 before backend release.
- [x] Add a safe non-destructive initialization path; do not drop an existing production database.
- [x] Remove or isolate the `DROP DATABASE` statement from production deployment.
- [ ] Fix `ck_res_no_midnight` to allow reservations ending exactly at midnight (`00:00:00`), citing report Rule R1.
- [ ] Fix `ck_res_total` to `total_amount >= 0` to permit complimentary (100% discount) bookings.

### `database/triggers.sql`

- [x] Rewrite specialization triggers for the report's `user_type` and `Club_Member` flags, or document the approved alternative.
- [x] Enforce the report's total specialization rule for every `Users` row via procedure encapsulation and diagnostic checks.
- [x] Enforce the report's conditional subtype-attribute rules.
- [x] Align booking, credit, registration, match, coaching, and inventory triggers with the final schema.
- [ ] Add update-path triggers and lifecycle rules wherever the report requires invariants after updates (Phase 4).
- [x] Verify every trigger message maps to a documented report rule.
- [x] Enforce R1 by rejecting reservations whose start and end dates differ.
- [x] Enforce membership expiry for discounts and credit bookings.
- [x] Enforce deactivation rules before user operations.
- [ ] Refactor `trg_reservation_bu` / `sp_validate_reservation` so updating `payment_status` (settling past dues or cancelling) does not fail due to current table maintenance or expired memberships.
- [ ] Mitigate credit-limit race conditions by acquiring `FOR UPDATE` locks on `Club_Member` before balance verification in `trg_ledger_bi`.
- [ ] Test direct SQL attempts to create a member without `Club_Member` and to remove `Club_Member` while retaining `user_type = 'Member'`.
- [ ] Revalidate tournament status and active-user status on every relevant registration update.

### `database/procedures.sql`

- [x] Make registration procedures create exactly the report-defined user/subtype state.
- [x] Make booking and credit procedures use the report-defined ledger domains and relationships.
- [x] Apply discounts only for active members.
- [x] Allow `OnCredit` only for active members.
- [x] Update match completion to maintain the report-defined `Users.ranking_points`.
- [x] Keep frame insertion, winner selection, bracket advancement, ranking updates, and tournament closure atomic.
- [ ] Add explicit validation against NULL ranking-point inputs and cancelled matches (JSON format and basic bounds currently handled).
- [ ] Implement `sp_cancel_booking(p_reservation_id)` to transition status to 'Cancelled' and post a compensating reversal entry in `Credit_Ledger` capped at outstanding balance (Deviation D-02).
- [ ] Harden `sp_complete_match` to reject already-cancelled matches (`status NOT IN ('Scheduled', 'InProgress')`) and reject NULL ranking increments upfront.
- [ ] Mitigate credit-limit race conditions in `sp_book_table` by taking `SELECT ... FOR UPDATE` on `Club_Member`.
- [ ] Replace `match_id` ordering as the bracket-slot selector with an explicit, deterministic feeder-slot rule.

### `database/views.sql`

- [x] Update every view to use only report-defined relations and attributes.
- [x] Replace `Player_Rankings` dependencies if the report-aligned schema stores ranking points in `Users`.
- [x] Verify member balance, leaderboard, win streak, head-to-head, bracket, utilisation, reorder, and weakness reports.
- [x] Document any view that intentionally uses an implementation-only helper relation.
- [ ] Fix `v_leaderboard` by removing `COALESCE(cm.preferred_game, 'Snooker')` so Casual players do not default to 'Snooker'.
- [ ] Add diagnostic specialization view `v_specialization_anomalies` to identify orphan users or casual players with membership records.

### `database/seed.sql`

- [x] Seed only report-defined relations.
- [x] Add enough realistic data to demonstrate every report workflow.
- [x] Maintain clean demonstration dataset in `database/seed.sql`; defer 500+ synthetic generator to Tier 3.
- [x] Ensure seed data satisfies all specialization, FK, date, enum, and business-rule constraints.
- [x] Fix the expired seed memberships for members 4 and 7, or move all demonstration dates to a consistent valid period.
- [x] Make seed execution repeatable from a clean database.

### `database/demo.sql`

- [x] Demonstrate every workflow listed in the report.
- [x] Demonstrate report-defined ranking storage and output.
- [x] Demonstrate valid and invalid specialization states.
- [x] Demonstrate booking, credit, tournament, bracket, inventory, and coaching workflows.
- [ ] Make the demo output suitable for screenshots and presentation evidence.

### `database/constraint_tests.sql`

- [x] Rewrite tests against the report-aligned schema.
- [x] Add tests for total/disjoint Level-1 specialization.
- [x] Add tests for overlapping/partial Level-2 specialization flags.
- [x] Add tests for every documented enum and CHECK boundary.
- [x] Add tests for all report-listed triggers and transaction rollback behavior.
- [x] Fix test harness re-runnability by adding teardown logic for temporary test fixtures (Tournament 2, Matches 10/11) so `sp_run_constraint_tests()` does not fail on duplicate keys on repeated runs.
- [ ] Add explicit test asserting `trg_users_bd` blocks physical deletion of users with historical records (Rule R9).
- [ ] Add direct-SQL tests for total-specialization bypass attempts.
- [ ] Add registration-update tests for closed tournaments and deactivated users.
- [ ] Add bracket tests that do not depend on insertion order or `match_id` ordering.

### Database verification

- [x] Provision MySQL 8.0.16 or later.
- [x] Run all SQL files in order on a clean CI server.
- [x] Verify all expected tables exist.
- [x] Verify all triggers exist.
- [x] Verify all procedures exist.
- [x] Verify all views exist.
- [x] Verify foreign keys and indexes.
- [x] Verify constraints with valid and invalid data.
- [x] Verify booking overlap rejection.
- [x] Verify adjacent bookings are allowed.
- [x] Verify bookings crossing midnight are rejected.
- [x] Verify casual players cannot use credit.
- [x] Verify credit limits.
- [x] Verify expired members do not receive discounts or book on credit.
- [x] Verify deactivated users cannot perform active operations.
- [x] Verify overpayment rejection.
- [x] Verify member/casual disjointness.
- [x] Verify active-membership restrictions.
- [x] Verify tournament registration restrictions.
- [x] Verify unregistered match players are rejected.
- [x] Verify drawn frames are rejected.
- [x] Verify match-completion rollback.
- [x] Verify bracket advancement.
- [x] Verify ranking updates.
- [x] Verify tournament completion.
- [x] Verify reorder flags.
- [x] Verify every analytical view is created and exercised by the demo.

## 3. Testing

- [x] Make `database/constraint_tests.sql` runnable in a controlled test harness.
- [x] Fix test 15 so it explicitly prepares a completed match or asserts the precondition before testing repeat completion.
- [x] Ensure test 15 cannot succeed and mutate data on a fresh seed.
- [x] Add a test for bookings that cross midnight.
- [x] Add tests for expired-member discounts and credit bookings.
- [x] Add tests for deactivated users and historical-record deletion protection.
- [x] Add explicit pass/fail output for each test.
- [x] Ensure expected failures do not stop the entire test run unexpectedly.
- [ ] Add update-path tests, not only insert-path tests (Phase 4).
- [ ] Add null and boundary-value tests (Phase 4).
- [ ] Add cancelled-reservation tests (Phase 4).
- [x] Add repeated match-completion tests.
- [ ] Add concurrent-booking and credit-limit race tests (Phase 4).
- [x] Add a clean-database reset procedure.
- [x] Separate destructive local reset logic from production-safe deployment logic.
- [ ] Record test results and attach them to the final submission.

## 4. Backend/API: implement the report workflows

- [ ] Create `backend/`.
- [ ] Add Node.js project configuration.
- [ ] Add the Express server.
- [ ] Add a MySQL connection pool.
- [ ] Add environment-variable configuration.
- [ ] Add a database health-check endpoint.
- [ ] Add authentication and JWT handling.
- [ ] Add role-based authorization.
- [ ] Implement D-01 only in the end-semester implementation and document its schema/API impact.
- [ ] Add endpoints for every intended user role in the report.
- [ ] Add table-availability and reservation endpoints.
- [ ] Add credit-ledger and balance endpoints.
- [ ] Add tournament registration, bracket, and match-completion endpoints.
- [ ] Add leaderboard, win-streak, head-to-head, and utilisation report endpoints.
- [ ] Add inventory/reorder and coaching-assessment endpoints.
- [ ] Ensure API payloads use the report's final names and domains.
- [ ] Add request validation.
- [ ] Add consistent error responses.
- [ ] Add API tests.
- [ ] Add backend setup instructions.

## 5. Frontend/UI: demonstrate the report workflows

- [ ] Create `frontend/`.
- [ ] Add React project configuration.
- [ ] Add login/authentication flow.
- [ ] Add role-aware navigation.
- [ ] Add the main dashboard.
- [ ] Add screens for the report's manager, staff/scorer, member, team, and casual-player workflows.
- [ ] Add table availability and booking screens.
- [ ] Add the credit-ledger and outstanding-balance screen.
- [ ] Add tournament registration and bracket screens.
- [ ] Add scorer/match-completion screens.
- [ ] Add leaderboard, win-streak, head-to-head, and utilisation report screens.
- [ ] Add inventory/reorder and coaching-assessment screens.
- [ ] Ensure UI terminology matches the report and final schema.
- [ ] Add loading, empty, and error states.
- [ ] Add form validation.
- [ ] Add responsive layout.
- [ ] Add frontend tests.
- [ ] Add frontend startup instructions.

## 6. Deployment and documentation

- [ ] Add `.env.example`.
- [ ] Confirm no secrets are committed.
- [ ] Add production database configuration.
- [x] Standardize database initialization and clean reset via `database/schema.sql` and `database/reset_local.sql` (incremental versioned migrations deferred to Tier 3).
- [ ] Document the database setup and reset process.
- [ ] Document script execution order.
- [ ] Document backend build and start commands.
- [ ] Document frontend build and deploy commands.
- [ ] Configure CORS.
- [ ] Document HTTPS requirements.
- [ ] Document database backup and restore.
- [ ] Add logging and error-monitoring guidance.
- [ ] Add service health checks.
- [ ] Add a deployment architecture diagram.
- [ ] Test deployment from a clean machine.
- [ ] Configure `main` branch protection to require pull requests, review approval, and passing CI checks.
- [ ] Disable direct pushes and force pushes to `main`.
- [ ] Ensure CI includes database, backend, frontend, build, and static-quality checks before release.
- [ ] Tag a final release commit.
- [ ] Update `README.md` with complete setup and usage instructions.
- [ ] Update `README.md` to describe the report-aligned schema.
- [ ] Add a final schema mapping to `README.md`.

## 7. Presentation and demo

- [ ] Prepare a 5–10 minute project walkthrough.
- [ ] Explain the problem and intended users.
- [ ] Show the ER/EER design.
- [ ] Explain normalization and BCNF.
- [ ] Demonstrate foreign keys and constraints.
- [ ] Demonstrate a rejected overlapping booking.
- [ ] Demonstrate member credit and casual-player restrictions.
- [ ] Demonstrate the atomic match-completion transaction.
- [ ] Demonstrate rollback after invalid frame data.
- [ ] Demonstrate bracket advancement.
- [ ] Demonstrate ranking and report views.
- [ ] Demonstrate reorder alerts.
- [ ] Demonstrate the application UI.
- [ ] Prepare a backup demo dataset.
- [ ] Prepare screenshots or recorded output in case the live demo fails.
- [ ] Prepare individual contribution explanations.
- [ ] Prepare likely viva questions and answers.
- [ ] Ensure the report, repository, slides, and live demo are consistent.
- [ ] Demonstrate behavior defined by the report and any approved technical deviations.

## 8. Tier 3 (P2 — Nice to Have / Deferrable — Do Not Block Backend/Frontend)

These items represent secondary hardening, volumetric scaling, and enterprise testing. They are intentionally classified as non-blocking for Phase 5 (Backend) and Phase 6 (Frontend) implementation, and can be addressed after or in parallel with application workflows.

- [ ] **500+ Synthetic Seed Generator:** Create a dedicated script (`scripts/generate_large_seed.py`) to generate `database/seed_large.sql` for volumetric testing without cluttering the clean demo seed.
- [ ] **Trigger Mutation Test Harness:** Script an automated job to drop triggers sequentially and verify that at least one named test in `constraint_tests.sql` fails.
- [ ] **Versioned Database Migrations:** Add a versioned `migrations/` directory if incremental upgrades are requested, moving beyond baseline DDL scripts.
- [ ] **Two-Session Table Collision Script:** Script a simulated two-session test for table booking collisions, accompanied by a written explanation of MySQL InnoDB locking strategies (credit-limit concurrency test verified in Phase 4).
- [ ] **Recorded Demo Fallback:** Prepare recorded video walkthroughs and captured query output screenshots in case the live MySQL database is unavailable during presentation.
- [ ] **Viva Q&A Defense Sheet:** Prepare a 1-page quick-reference sheet containing concise answers for every business rule (R1–R9), trigger, procedure, and normalization claim.

## Final release gate

- [ ] All required sections above are complete or explicitly marked out of scope.
- [ ] A clean-machine setup succeeds from the README.
- [ ] Database tests pass.
- [x] CI pipeline executes `CALL sp_run_constraint_tests();` twice in succession to verify test suite re-runnability and state idempotency.
- [ ] Mutation run completed once before release and results attached, or trigger-coverage claims in final report/slides are scoped to verified test cases.
- [ ] Backend tests pass.
- [ ] Frontend tests pass.
- [ ] The end-to-end demo succeeds.
- [ ] The final report matches the repository.
- [ ] Every report-to-file traceability row has been checked.
- [ ] The deviation register is empty or fully approved and documented with evidence for D-01 and D-02.
- [ ] The presentation slides, README, and final report explicitly state the specialization design boundary: "Application-path integrity with database-level diagnostic detection, not full database-enforced specialization."
- [ ] The reviewed final implementation is pushed to `main` in `https://github.com/StuCCAn/DBMS-Project`.
- [ ] The team has reviewed and signed off the presentation package.
