# CueClub Frontend Application

Modern React 19 single-page application (SPA) built with Vite and Lucide icons for the **CueClub Management System** (CS F212 Database Systems, BITS Pilani, Group 18).

---

## 1. Features & Role-Aware Screens

The UI automatically adapts based on the active user's `app_role` claim (`Admin`, `Staff`, `Member`, `Casual`):

### 1.1 Tables & Bookings (`/tables`)
- Live table cards for Snooker, Pool, and English Billiards with hourly & per-frame pricing.
- Interactive table booking modal supporting `Hourly` and `PerFrame` billing modes.
- Real-time payment method selection (`Cash`, `Pending`, `OnCredit`).
- Active reservation table with cancellation action and automatic credit refund preview.
- Table maintenance toggle for Staff/Admin (`sp_set_table_status`).

### 1.2 Credit Ledger & Financials (`/ledger`)
- Member financial card displaying outstanding udhar, credit limit, available headroom, and plan discounts.
- Full chronological transaction ledger statement (`Booking charge`, `Canteen charge`, `Fine`, `Payment`).
- Staff/Admin modals to record non-booking charges (canteen & fines) and settle member payments.
- Member onboarding modal (`sp_register_member`).

### 1.3 Tournaments & Elimination Brackets (`/tournaments`)
- Event cards with format (`Knockout`, `League`), entry fee, and lifecycle status badges.
- Admin/Staff tournament creation and forward status transitions (`Draft` $\rightarrow$ `Registration` $\rightarrow$ `Ongoing`).
- Player registration modal with seed allocation and entry fee tracking.
- Interactive hierarchical binary elimination bracket tree rendered from recursive CTE `v_bracket_tree`.

### 1.4 Live Match Scorer (`MatchScorer` widget)
- Frame-by-frame live scoring modal for matches.
- Dynamic frame addition, score tracking, highest break tracking, and live frame count tally.
- Atomic match completion via `sp_complete_match`, advancing the winner to the next bracket round and awarding ranking points.

### 1.5 Club Championship Leaderboard (`/leaderboard`)
- Gold, Silver, and Bronze podium highlights for top 3 ranked players.
- Full player table with ranking points, matches won/lost, and win percentage rate.

### 1.6 Equipment & Inventory (`/inventory`)
- Equipment catalog with current quantities and unit costs.
- Physical maintenance condition updater (`Good`, `Needs Service`, `Damaged`, `Retired`).
- Automated low-stock reorder threshold banner from `v_reorder_alerts`.

### 1.7 Coaching Academy (`/coaching`)
- Skill assessment history log with coach remarks and ratings out of 10.
- Priority training areas widget highlighting aggregated technical weaknesses (`v_player_weaknesses`).
- Assessment recorder for coaches (`sp_record_assessment`).

### 1.8 Executive Analytics & Diagnostics (`/analytics`)
- Table utilisation and gross revenue breakdown (`v_table_utilisation`).
- Consecutive match win streaks ranking (`v_win_streaks`).
- Head-to-head rivalry records (`v_head_to_head`).
- Database EER Specialization anomaly auditor (`v_specialization_anomalies`).
- Rule R9 user account deactivation form (`sp_deactivate_user`).

---

## 2. Quick Start

### 2.1 Install Dependencies
```bash
npm install
```

### 2.2 Run Development Server
```bash
npm run dev
```
The application will launch on `http://localhost:5173`. API requests to `/api` are automatically proxied to the backend at `http://localhost:3000`.

### 2.3 Run Linting & Contract Tests
```bash
npm run lint   # Fast static analysis using oxlint
npm test       # Automated frontend contract tests (10 tests)
```

### 2.4 Build for Production
```bash
npm run build
```
Generates production-optimized static assets in `dist/`.

---

## 3. Demo Persona Logins

The application includes an instant **Quick-Select Persona** switcher in the login modal:

| Persona | Name | Role | Pre-configured Email | Default Password |
|---|---|---|---|---|
| **Admin** | Rohan Mehta | `Admin` | `rohan@example.com` | `cueclub_default` |
| **Staff** | Imran Sheikh | `Staff` | `imran@example.com` | `cueclub_default` |
| **Member** | Aarav Nair | `Member` | `aarav@example.com` | `cueclub_default` |
| **Casual** | Vikram Singh | `Casual` | `vikram@example.com` | `cueclub_default` |
