# CueClub Final Deployment and Presentation Checklist

Use this document as the shared work tracker. Tick items only after they are implemented and verified. Add the owner's name, issue/PR link, or evidence beside completed work where useful.

## Source-of-truth decision

The mid-semester report and its repository, `https://github.com/StuCCAn/DBMS-Project`, are immutable and authoritative. All implementation and final deliverables must match the report.

### Alignment gate

- [ ] Implement the report's schema, workflows, constraints, and terminology.
- [ ] Test the report-aligned implementation before considering any deviation.
- [ ] Document a deviation only when a report requirement is technically unimplementable.
- [ ] Record the technical blocker, attempted solutions, affected files, impact, owner, and approval for each deviation.

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
| Schema, report alignment, and normalization | Priyansh Thadhani | ☐ |
| Constraints, triggers, and transaction validation | Goru Nikhil | ☐ |
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

- [ ] Extract the final relation, attribute, key, FK, nullability, enum, and cardinality requirements from the immutable mid-semester report.
- [ ] Create the report-to-SQL mapping in the end-semester documentation.
- [ ] Identify every mismatch in the current SQL and convert it into a schema correction task.
- [ ] Confirm the 11-relation design and specialization mapping.
- [ ] Confirm the R9 deactivation requirement and the technically necessary D-01 authentication addition.
- [ ] Sign off the schema baseline before Phase 2 begins.

### Phase 2 — Priyansh: schema and seed model

- [ ] Refactor `database/schema.sql` to match the report's 11 relations.
- [ ] Implement the report's `user_type`, `ranking_points`, and Level-2 specialization attributes.
- [ ] Implement a report-compatible deactivation mechanism for R9.
- [ ] Remove implementation-only tables and columns unless required by an approved technical deviation.
- [ ] Make the schema initialization safe for production and isolate any local reset script.
- [ ] Update the base structure of `database/seed.sql`.
- [ ] Fix the expired member seed dates for the demonstration period.
- [ ] Run a schema review with Goru and Manya before handoff.

### Phase 3 — Goru: constraints, triggers, and transactions

- [ ] Align `database/triggers.sql` with the finalized schema.
- [ ] Enforce total/disjoint Level-1 specialization.
- [ ] Enforce overlapping/partial Level-2 specialization rules.
- [ ] Enforce no-midnight-crossing bookings.
- [ ] Enforce active-membership checks for discounts and credit bookings.
- [ ] Enforce R9 deactivation and historical-record protection.
- [ ] Align `database/procedures.sql` with the finalized schema.
- [ ] Preserve atomic match completion, bracket advancement, and ranking updates.
- [ ] Update `database/constraint_tests.sql` for all corrected rules.
- [ ] Fix test 15 so it cannot succeed and mutate data on a fresh seed.
- [ ] Sign off database constraints before Manya and Ananya build on them.

### Phase 4 — Manya: views, reports, and dataset

- [ ] Refactor `database/views.sql` to use only finalized report relations and attributes.
- [ ] Implement leaderboard output using report-defined `Users.ranking_points`.
- [ ] Verify win streaks, head-to-head, bracket, table utilisation, reorder, and weakness reports.
- [ ] Complete `database/seed.sql` with valid, realistic demonstration data.
- [ ] Add the report's required sample-data volume or record the approved technical limitation.
- [ ] Update `database/demo.sql` to demonstrate every report workflow.
- [ ] Capture expected outputs for presentation and API integration.
- [ ] Sign off view names, columns, and procedure contracts with Ananya and Ujjwal.

### Phase 5 — Ananya: backend/API and D-01

- [ ] Create `backend/` with Node.js, Express, and MySQL pooling.
- [ ] Implement D-01 authentication fields and document the exact schema/API impact.
- [ ] Add password handling, JWT authentication, and admin/staff/member access boundaries.
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
- [ ] Add the final schema mapping and approved D-01 explanation to end-semester documentation.
- [ ] Keep the immutable mid-semester report unchanged.

### Phase 7 — All contributors: final validation and presentation

- [ ] Priyansh verifies report/schema consistency and normalization claims.
- [ ] Goru runs the complete constraint, rollback, and transaction test suite.
- [ ] Manya verifies all views, seed data, and demo outputs.
- [ ] Ananya verifies authentication, API tests, and database connectivity.
- [ ] Ujjwal verifies frontend workflows, README setup, and presentation flow.
- [ ] Run the complete system from a clean machine.
- [ ] Verify the final repository contains source, tests, documentation, report, diagrams, and presentation artefacts.
- [ ] Demonstrate the report workflows in the agreed order.
- [ ] Obtain team sign-off before the final release.

## 1. Report alignment and design freeze

- [ ] Freeze the mid-semester report's 11-relation design as the final baseline.
- [ ] Confirm every relation, attribute, nullable marker, key, FK, enum, and cardinality in the report.
- [ ] Keep the mid-semester report unchanged in its original repository.
- [ ] Add implementation notes only in the end-semester deliverable.
- [ ] Preserve or verify the report's repository URL as `https://github.com/StuCCAn/DBMS-Project`.
- [ ] Keep the mid-semester report unchanged; put implementation status in the end-semester deliverable.
- [ ] Update the ER/EER diagrams in `docs/er/` to match the report's final schema.
- [ ] Add a schema-to-implementation mapping table to the final report.
- [ ] Add the deviation register to the end-semester report only when a technical unimplementability finding is approved.
- [ ] Reconcile all functional dependencies and normalization claims after the schema freeze.
- [ ] Decide whether to implement or remove the promised 500+ sample records.
- [ ] Produce and review the final report before changing presentation material.

## 2. Database implementation: report-aligned changes

### `database/schema.sql`

- [ ] Make `Users` match the report, including `user_type` and `ranking_points`.
- [ ] Make `Club_Member` match the report, including the documented specialization flags and nullable subtype attributes.
- [ ] Remove separate `Casual_Player`, `Team_Member`, `Individual_Player`, and `Team_Enthusiast` tables unless technically required by the report.
- [ ] Remove extra tables not in the report, including `Teams`, `Penalties`, `Player_Rankings`, `Vendors`, and `Purchase_Orders`.
- [ ] Make `Credit_Ledger.entry_type` match the report's documented domain.
- [ ] Make `Tournaments.format` match the report's documented domain.
- [ ] Make inventory/vendor attributes match the report.
- [ ] Recheck all PKs, FKs, nullability, unique constraints, CHECK constraints, and delete actions against the report.
- [ ] Preserve the report's disjoint/total Level-1 specialization and overlapping/partial Level-2 specialization.
- [ ] Preserve the report's rule that historical financial and match records are not physically deleted.
- [ ] Add a report-compatible deactivation field or mechanism for R9, and prevent deletion of users with historical records.
- [ ] Add authentication and role fields only under approved deviation D-01.
- [ ] Add a safe non-destructive initialization path; do not drop an existing production database.
- [ ] Remove or isolate the `DROP DATABASE` statement from production deployment.

### `database/triggers.sql`

- [ ] Rewrite specialization triggers for the report's `user_type` and `Club_Member` flags, or document the approved alternative.
- [ ] Enforce the report's total specialization rule for every `Users` row.
- [ ] Enforce the report's conditional subtype-attribute rules.
- [ ] Align booking, credit, registration, match, coaching, and inventory triggers with the final schema.
- [ ] Add update-path triggers wherever the report requires invariants after updates.
- [ ] Verify every trigger message maps to a documented report rule.
- [ ] Enforce R1 by rejecting reservations whose start and end dates differ.
- [ ] Enforce membership expiry for discounts and credit bookings.
- [ ] Enforce deactivation rules before user operations.

### `database/procedures.sql`

- [ ] Make registration procedures create exactly the report-defined user/subtype state.
- [ ] Make booking and credit procedures use the report-defined ledger domains and relationships.
- [ ] Apply discounts only for active members.
- [ ] Allow `OnCredit` only for active members.
- [ ] Update match completion to maintain the report-defined `Users.ranking_points`.
- [ ] Keep frame insertion, winner selection, bracket advancement, ranking updates, and tournament closure atomic.
- [ ] Add explicit validation for invalid JSON, invalid frame counts, and invalid ranking-point inputs.

### `database/views.sql`

- [ ] Update every view to use only report-defined relations and attributes.
- [ ] Replace `Player_Rankings` dependencies if the report-aligned schema stores ranking points in `Users`.
- [ ] Verify member balance, leaderboard, win streak, head-to-head, bracket, utilisation, reorder, and weakness outputs against the report.
- [ ] Document any view that intentionally uses an implementation-only helper relation.

### `database/seed.sql`

- [ ] Seed only report-defined relations.
- [ ] Add enough realistic data to demonstrate every report workflow.
- [ ] Implement the report's 500+ record requirement, or remove that claim everywhere.
- [ ] Ensure seed data satisfies all specialization, FK, date, enum, and business-rule constraints.
- [ ] Fix the expired seed memberships for members 4 and 7, or move all demonstration dates to a consistent valid period.
- [ ] Make seed execution repeatable from a clean database.

### `database/demo.sql`

- [ ] Demonstrate every workflow listed in the report.
- [ ] Demonstrate report-defined ranking storage and output.
- [ ] Demonstrate valid and invalid specialization states.
- [ ] Demonstrate booking, credit, tournament, bracket, inventory, and coaching workflows.
- [ ] Make the demo output suitable for screenshots and presentation evidence.

### `database/constraint_tests.sql`

- [ ] Rewrite tests against the report-aligned schema.
- [ ] Add tests for total/disjoint Level-1 specialization.
- [ ] Add tests for overlapping/partial Level-2 specialization flags.
- [ ] Add tests for every documented enum and CHECK boundary.
- [ ] Add tests for all report-listed triggers and transaction rollback behavior.

### Database verification

- [ ] Provision MySQL 8.0.16 or later.
- [ ] Run all SQL files in order on a clean server.
- [ ] Verify all expected tables exist.
- [ ] Verify all triggers exist.
- [ ] Verify all procedures exist.
- [ ] Verify all views exist.
- [ ] Verify foreign keys and indexes.
- [ ] Verify constraints with valid and invalid data.
- [ ] Verify booking overlap rejection.
- [ ] Verify adjacent bookings are allowed.
- [ ] Verify bookings crossing midnight are rejected.
- [ ] Verify casual players cannot use credit.
- [ ] Verify credit limits.
- [ ] Verify expired members do not receive discounts or book on credit.
- [ ] Verify deactivated users cannot perform active operations.
- [ ] Verify overpayment rejection.
- [ ] Verify member/casual disjointness.
- [ ] Verify active-membership restrictions.
- [ ] Verify tournament registration restrictions.
- [ ] Verify unregistered match players are rejected.
- [ ] Verify drawn frames are rejected.
- [ ] Verify match-completion rollback.
- [ ] Verify bracket advancement.
- [ ] Verify ranking updates.
- [ ] Verify tournament completion.
- [ ] Verify reorder flags.
- [ ] Verify every analytical view produces correct output.

## 3. Testing

- [ ] Make `database/constraint_tests.sql` runnable in a controlled test harness.
- [ ] Fix test 15 so it explicitly prepares a completed match or asserts the precondition before testing repeat completion.
- [ ] Ensure test 15 cannot succeed and mutate data on a fresh seed.
- [ ] Add a test for bookings that cross midnight.
- [ ] Add tests for expired-member discounts and credit bookings.
- [ ] Add tests for deactivated users and historical-record deletion protection.
- [ ] Add explicit pass/fail output for each test.
- [ ] Ensure expected failures do not stop the entire test run unexpectedly.
- [ ] Add update-path tests, not only insert-path tests.
- [ ] Add null and boundary-value tests.
- [ ] Add cancelled-reservation tests.
- [ ] Add repeated match-completion tests.
- [ ] Add concurrent-booking tests if possible.
- [ ] Add a clean-database reset procedure.
- [ ] Separate destructive local reset logic from production-safe deployment logic.
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
