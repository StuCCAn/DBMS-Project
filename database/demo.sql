-- ============================================================================
-- CueClub Manager: End-to-End Workflow Demonstration Script (W1 - W4)
-- ============================================================================
USE cueclub;

-- W1: Atomic Match Completion (Semi-Finals 2 & 3 -> advances winners to Final Match 1 -> completes Final)
CALL sp_complete_match(2, '[{"p1":72,"p2":30,"break":45},{"p1":15,"p2":68,"break":50},{"p1":80,"p2":22,"break":60}]', 30, 10);
CALL sp_complete_match(3, '[{"p1":60,"p2":40,"break":38},{"p1":55,"p2":20,"break":41}]', 30, 10);
CALL sp_complete_match(1, '[{"p1":90,"p2":10,"break":72},{"p1":30,"p2":66,"break":55},{"p1":71,"p2":50,"break":48}]', 50, 20);

-- W2: Leaderboard & Analytical Reports
SELECT * FROM v_leaderboard ORDER BY rank_position;
SELECT * FROM v_win_streaks;
SELECT * FROM v_head_to_head;
SELECT * FROM v_bracket_tree;
SELECT * FROM v_specialization_anomalies;

-- W3: Booking & Credit Ledger Balance
SELECT * FROM v_member_balance;
SELECT * FROM v_table_utilisation;

-- W4: Inventory Reorder Alerts & Coaching Assessments
SELECT * FROM v_reorder_alerts;
SELECT * FROM v_player_weaknesses WHERE weakness_rank = 1;