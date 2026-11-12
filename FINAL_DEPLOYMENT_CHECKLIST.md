# CueClub Final Deployment and Presentation Checklist

Use this document as the shared work tracker. Tick items only after they are implemented and verified. Add the owner's name, issue/PR link, or evidence beside completed work where useful.

## Source-of-truth decision

The mid-semester report and its repository, `https://github.com/StuCCAn/DBMS-Project`, are immutable and authoritative. All implementation and final deliverables must match the report.

### Alignment gate

- [x] Implement the report's schema, workflows, constraints, and terminology.
- [x] Test the report-aligned implementation before considering any deviation.
- [x] Document a deviation only when a report requirement is technically unimplementable.
- [ ] Record the technical blocker, attempted solutions, affected files, impact, owner, and approval for D-01.

### Current implementation status

- Database implementation merged to `main` at `964d24d`.
- CI passed repository quality, report integrity, MySQL setup, schema loading, demo execution, and constraint tests.
- Backend, frontend, large-scale dataset, deployment documentation, and presentation remain open.

### Deviation register

| ID | Report requirement | Implemented deviation | Reason and impact | Affected files | Approval/evidence |
|---|---|---|---|---|---|
| D-01 | Authentication and admin/staff roles | The report's 11-table schema has no password, authentication, or role attributes, so JWT role-based access cannot be implemented from the report alone. | Add the minimum authentication/role model in the end-semester implementation and document the schema/API impact. | `database/schema.sql`, backend, final report |  |

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
| Backend/API and authentication deviation D-01 | Ananya Avunooru | ☐ |
| Views, reports, and dataset | Manya Bhateja | ☐ |
| Frontend, documentation, integration, and presentation | Ujjwal Chandak | ☐ |

## Sequential work plan

Complete each phase in order. The next phase begins only after the previous phase's owner has reviewed and signed off the required files.

| Phase | Owner | Depends on | Exit condition |
|---|---|---|---|
| 1. Freeze report baseline and schema mapping | Priyansh Thadhani | None | Schema mapping and unresolved questions are recorded |
| 2. Implement schema and seed model | Priyansh Thadhani | Phase 1 | `database/schema.sql` and the base of `database/seed.sql` match the report |
| 3. Implement constraints and transactions | Goru Nikhil | Phase 2 | Triggers, procedures, and constraint tests pass on the schema |
| 4. Implement views and demonstration data | Manya Bhateja | Phase 3 | Views, seed completion, and demo outputs are verified |
| 5. Implement backend/API | Ananya Avunooru | Phase 3 and agreed view/procedure interfaces | API runs against the verified database |
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
- [x] Enforce total/disjoint Level-1 specialization.
- [x] Enforce overlapping/partial Level-2 specialization rules.
- [x] Enforce no-midnight-crossing bookings.
- [x] Enforce active-membership checks for discounts and credit bookings.
- [x] Enforce R9 deactivation and historical-record protection.
- [x] Align `database/procedures.sql` with the finalized schema.
- [x] Preserve atomic match completion, bracket advancement, and ranking updates.
- [x] Update `database/constraint_tests.sql` for all corrected rules.
- [x] Fix test 15 so it cannot succeed and mutate data on a fresh seed.
- [x] Sign off database constraints before Manya and Ananya build on them.

### Phase 4 — Manya: views, reports, and dataset

- [x] Refactor `database/views.sql` to use only finalized report relations and attributes.
- [x] Implement leaderboard output using report-defined `Users.ranking_points`.
- [x] Verify win streaks, head-to-head, bracket, table utilisation, reorder, and weakness reports.
- [x] Complete `database/seed.sql` with valid, realistic demonstration data.
- [ ] Add the report's required sample-data volume or record the approved technical limitation.
- [x] Update `database/demo.sql` to demonstrate every report workflow.
- [ ] Capture expected outputs for presentation and API integration.
- [ ] Sign off view names, columns, and procedure contracts with Ananya and Ujjwal.

### Phase 5 — Ananya: backend/API and D-01

- [ ] Create `backend/` with Node.js, Express, and MySQL pooling.
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

- [ ] Create `frontend/` with the report's intended user workflows.
- [ ] Implement login and role-aware navigation.
- [ ] Implement manager, staff/scorer, member, team, and casual-player screens.
- [ ] Implement booking, credit ledger, tournament/bracket, scorer, leaderboard, inventory, and coaching screens.
- [ ] Integrate every screen with the verified backend API.
- [ ] Add loading, empty, validation, and error states.
- [ ] Update `README.md` with setup, execution order, environment variables, and demo instructions.
- [x] Add the final schema mapping and approved D-01 explanation to end-semester documentation.
- [ ] Keep the immutable mid-semester report unchanged.

### Phase 7 — All contributors: final validation and presentation

- [x] Priyansh verifies report/schema consistency and normalization claims.
- [x] Goru runs the complete constraint, rollback, and transaction test suite.
- [x] Manya verifies all views, seed data, and demo outputs.
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
- [ ] Complete the D-01 deviation register entry with blocker, attempted alternatives, impact, owner, and approval evidence.
- [x] Reconcile all functional dependencies and normalization claims after the schema freeze.
- [ ] Decide whether to implement or remove the promised 500+ sample records.
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
- [ ] Approve and document authentication and role fields under D-01 before backend release.
- [x] Add a safe non-destructive initialization path; do not drop an existing production database.
- [x] Remove or isolate the `DROP DATABASE` statement from production deployment.

### `database/triggers.sql`

- [x] Rewrite specialization triggers for the report's `user_type` and `Club_Member` flags, or document the approved alternative.
- [x] Enforce the report's total specialization rule for every `Users` row.
- [x] Enforce the report's conditional subtype-attribute rules.
- [x] Align booking, credit, registration, match, coaching, and inventory triggers with the final schema.
- [x] Add update-path triggers wherever the report requires invariants after updates.
- [x] Verify every trigger message maps to a documented report rule.
- [x] Enforce R1 by rejecting reservations whose start and end dates differ.
- [x] Enforce membership expiry for discounts and credit bookings.
- [x] Enforce deactivation rules before user operations.
- [ ] Test direct SQL attempts to create a member without `Club_Member` and to remove `Club_Member` while retaining `user_type = 'Member'`.
- [ ] Revalidate tournament status and active-user status on every relevant registration update.

### `database/procedures.sql`

- [x] Make registration procedures create exactly the report-defined user/subtype state.
- [x] Make booking and credit procedures use the report-defined ledger domains and relationships.
- [x] Apply discounts only for active members.
- [x] Allow `OnCredit` only for active members.
- [x] Update match completion to maintain the report-defined `Users.ranking_points`.
- [x] Keep frame insertion, winner selection, bracket advancement, ranking updates, and tournament closure atomic.
- [x] Add explicit validation for invalid JSON, invalid frame counts, and invalid ranking-point inputs.
- [ ] Replace `match_id` ordering as the bracket-slot selector with an explicit, deterministic feeder-slot rule.

### `database/views.sql`

- [x] Update every view to use only report-defined relations and attributes.
- [x] Replace `Player_Rankings` dependencies if the report-aligned schema stores ranking points in `Users`.
- [x] Verify member balance, leaderboard, win streak, head-to-head, bracket, utilisation, reorder, and weakness outputs against the report.
- [x] Document any view that intentionally uses an implementation-only helper relation.

### `database/seed.sql`

- [x] Seed only report-defined relations.
- [x] Add enough realistic data to demonstrate every report workflow.
- [ ] Implement the report's 500+ record requirement, or remove that claim everywhere.
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
- [x] Add update-path tests, not only insert-path tests.
- [x] Add null and boundary-value tests.
- [x] Add cancelled-reservation tests.
- [x] Add repeated match-completion tests.
- [ ] Add concurrent-booking tests or explicitly document why the chosen MySQL locking strategy is sufficient.
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
- [ ] Add versioned database migrations for upgrades to an existing installation.
- [ ] Test migration and rollback procedures against a database containing existing data.
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

## Final release gate

- [ ] All required sections above are complete or explicitly marked out of scope.
- [ ] A clean-machine setup succeeds from the README.
- [ ] Database tests pass.
- [ ] Backend tests pass.
- [ ] Frontend tests pass.
- [ ] The end-to-end demo succeeds.
- [ ] The final report matches the repository.
- [ ] Every report-to-file traceability row has been checked.
- [ ] The deviation register is empty or fully approved and documented.
- [ ] The reviewed final implementation is pushed to `main` in `https://github.com/StuCCAn/DBMS-Project`.
- [ ] The team has reviewed and signed off the presentation package.
