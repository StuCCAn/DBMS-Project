-- ============================================================================
-- CueClub Manager: Analytical Views (Window Functions & Recursive CTEs)
-- Strictly uses only the 11 report-defined relations and attributes.
-- ============================================================================
USE cueclub;

-- 1. Outstanding udhar per club member (Report Section 6: derived, never stored)
CREATE OR REPLACE VIEW v_member_balance AS
SELECT cm.user_id, u.name, cm.membership_no, cm.plan, cm.start_date, cm.end_date,
       cm.discount_pct, cm.credit_limit,
       COALESCE(SUM(
           CASE
               WHEN cl.entry_type IN ('Booking charge','Canteen charge','Fine') THEN cl.amount
               WHEN cl.entry_type = 'Payment' THEN -cl.amount
               ELSE 0.00
           END
       ), 0.00) AS outstanding_balance,
       cm.credit_limit - COALESCE(SUM(
           CASE
               WHEN cl.entry_type IN ('Booking charge','Canteen charge','Fine') THEN cl.amount
               WHEN cl.entry_type = 'Payment' THEN -cl.amount
               ELSE 0.00
           END
       ), 0.00) AS credit_headroom
  FROM Club_Member cm
  JOIN Users u ON u.user_id = cm.user_id
  LEFT JOIN Credit_Ledger cl ON cl.user_id = cm.user_id
 GROUP BY cm.user_id, u.name, cm.membership_no, cm.plan, cm.start_date, cm.end_date, cm.discount_pct, cm.credit_limit;

-- 2. Helper view: one row per player per completed match
CREATE OR REPLACE VIEW v_player_results AS
SELECT m.match_id, t.game_type, m.player1_id AS player_id, m.player2_id AS opponent_id,
       (m.winner_id = m.player1_id) AS won,
       COALESCE(m.scheduled_time, CAST(t.start_date AS DATETIME)) AS played_at
  FROM Matches m JOIN Tournaments t ON t.tournament_id = m.tournament_id
 WHERE m.status = 'Completed'
UNION ALL
SELECT m.match_id, t.game_type, m.player2_id AS player_id, m.player1_id AS opponent_id,
       (m.winner_id = m.player2_id) AS won,
       COALESCE(m.scheduled_time, CAST(t.start_date AS DATETIME)) AS played_at
  FROM Matches m JOIN Tournaments t ON t.tournament_id = m.tournament_id
 WHERE m.status = 'Completed';

-- 3. Dynamic leaderboard using report-defined Users.ranking_points and RANK()
CREATE OR REPLACE VIEW v_leaderboard AS
SELECT u.user_id, u.name, u.user_type,
       cm.preferred_game AS preferred_game,
       u.ranking_points,
       COUNT(pr.match_id) AS matches_played,
       COALESCE(SUM(pr.won), 0) AS wins,
       RANK() OVER (ORDER BY u.ranking_points DESC, COALESCE(SUM(pr.won), 0) DESC) AS rank_position
  FROM Users u
  LEFT JOIN Club_Member cm ON cm.user_id = u.user_id
  LEFT JOIN v_player_results pr ON pr.player_id = u.user_id
 WHERE u.is_active = TRUE
 GROUP BY u.user_id, u.name, u.user_type, cm.preferred_game, u.ranking_points;

-- 4. Win streaks (gaps-and-islands with window functions)
CREATE OR REPLACE VIEW v_win_streaks AS
WITH ordered AS (
    SELECT player_id, game_type, won, played_at, match_id,
           ROW_NUMBER() OVER (PARTITION BY player_id, game_type ORDER BY played_at, match_id)      AS rn_all,
           ROW_NUMBER() OVER (PARTITION BY player_id, game_type, won ORDER BY played_at, match_id) AS rn_result
      FROM v_player_results
), streaks AS (
    SELECT player_id, game_type, COUNT(*) AS streak_length,
           MIN(played_at) AS streak_start, MAX(played_at) AS streak_end
      FROM ordered
     WHERE won = 1
     GROUP BY player_id, game_type, (rn_all - rn_result)
)
SELECT s.player_id, u.name, s.game_type, s.streak_length, s.streak_start, s.streak_end,
       MAX(s.streak_length) OVER (PARTITION BY s.player_id, s.game_type) AS longest_streak
  FROM streaks s JOIN Users u ON u.user_id = s.player_id;

-- 5. Head-to-head record for every pair of players who have met
CREATE OR REPLACE VIEW v_head_to_head AS
SELECT r.player_id, up.name AS player, r.opponent_id, uo.name AS opponent,
       COUNT(*) AS matches_played, SUM(r.won) AS wins, COUNT(*) - SUM(r.won) AS losses
  FROM v_player_results r
  JOIN Users up ON up.user_id = r.player_id
  JOIN Users uo ON uo.user_id = r.opponent_id
 GROUP BY r.player_id, up.name, r.opponent_id, uo.name;

-- 6. Bracket tree walked from the final down to round 1 (recursive CTE)
CREATE OR REPLACE VIEW v_bracket_tree AS
WITH RECURSIVE tree AS (
    SELECT match_id, tournament_id, round_number, player1_id, player2_id, winner_id,
           next_match_id, status, 0 AS depth,
           CAST(match_id AS CHAR(500)) AS path_from_final
      FROM Matches WHERE next_match_id IS NULL
    UNION ALL
    SELECT m.match_id, m.tournament_id, m.round_number, m.player1_id, m.player2_id, m.winner_id,
           m.next_match_id, m.status, t.depth + 1,
           CAST(CONCAT(t.path_from_final, ' <- ', m.match_id) AS CHAR(500))
      FROM Matches m JOIN tree t ON m.next_match_id = t.match_id
)
SELECT * FROM tree;

-- 7. Table utilisation with peak-hour share (peak = 18:00 to 23:00 on the booking date)
CREATE OR REPLACE VIEW v_table_utilisation AS
WITH usage_minutes AS (
    SELECT r.table_id,
           TIMESTAMPDIFF(MINUTE, r.start_time, r.end_time) AS booked_min,
           GREATEST(0, TIMESTAMPDIFF(MINUTE,
               GREATEST(r.start_time, TIMESTAMP(DATE(r.start_time), '18:00:00')),
               LEAST(r.end_time,      TIMESTAMP(DATE(r.start_time), '23:00:00')))) AS peak_min
      FROM Reservations r WHERE r.payment_status <> 'Cancelled'
)
SELECT g.table_id, g.name, g.game_type,
       COUNT(u.table_id)                             AS bookings,
       ROUND(COALESCE(SUM(u.booked_min), 0) / 60, 1) AS booked_hours,
       ROUND(COALESCE(SUM(u.peak_min), 0) / 60, 1)   AS peak_hours,
       ROUND(100 * COALESCE(SUM(u.peak_min), 0) / NULLIF(SUM(u.booked_min), 0), 1) AS peak_share_pct,
       RANK() OVER (ORDER BY COALESCE(SUM(u.booked_min), 0) DESC) AS busiest_rank
  FROM Game_Tables g LEFT JOIN usage_minutes u ON u.table_id = g.table_id
 GROUP BY g.table_id, g.name, g.game_type;

-- 8. Items to reorder with vendor_name from Inventory_Items
CREATE OR REPLACE VIEW v_reorder_alerts AS
SELECT i.item_id, i.name, i.category, i.quantity, i.reorder_level,
       i.condition_status, i.last_serviced_date, i.vendor_name
  FROM Inventory_Items i
 WHERE i.reorder_flag = TRUE;

-- 9. Weakest skill area per assessed player (latest rating per area, lowest first)
CREATE OR REPLACE VIEW v_player_weaknesses AS
WITH latest AS (
    SELECT sa.*, ROW_NUMBER() OVER (PARTITION BY player_id, skill_area ORDER BY assessed_on DESC, assessment_id DESC) AS rn
      FROM Skill_Assessments sa
), ranked AS (
    SELECT player_id, skill_area, rating,
           ROW_NUMBER() OVER (PARTITION BY player_id ORDER BY rating ASC, skill_area) AS weakness_rank
      FROM latest WHERE rn = 1
)
SELECT r.player_id, u.name, r.skill_area, r.rating, r.weakness_rank
  FROM ranked r JOIN Users u ON u.user_id = r.player_id;

-- 10. Diagnostic view for Level 1 & Level 2 specialization integrity
CREATE OR REPLACE VIEW v_specialization_anomalies AS
SELECT u.user_id, u.name, u.user_type,
       'Casual player with Club_Member record' AS anomaly_reason
  FROM Users u
  JOIN Club_Member cm ON cm.user_id = u.user_id
 WHERE u.user_type = 'Casual'
UNION ALL
SELECT u.user_id, u.name, u.user_type,
       'Member missing Club_Member record' AS anomaly_reason
  FROM Users u
  LEFT JOIN Club_Member cm ON cm.user_id = u.user_id
 WHERE u.user_type = 'Member' AND cm.user_id IS NULL
UNION ALL
SELECT u.user_id, u.name, u.user_type,
       'Invalid Level-2 Team Member attributes' AS anomaly_reason
  FROM Users u
  JOIN Club_Member cm ON cm.user_id = u.user_id
 WHERE (cm.is_team_member = FALSE AND (cm.team_role IS NOT NULL OR cm.selection_status IS NOT NULL OR cm.handedness IS NOT NULL))
    OR (cm.is_team_member = TRUE  AND (cm.team_role IS NULL     OR cm.selection_status IS NULL     OR cm.handedness IS NULL))
UNION ALL
SELECT u.user_id, u.name, u.user_type,
       'Invalid Level-2 Individual Player attributes' AS anomaly_reason
  FROM Users u
  JOIN Club_Member cm ON cm.user_id = u.user_id
 WHERE (cm.is_individual_player = FALSE AND (cm.handicap IS NOT NULL OR cm.preferred_game IS NOT NULL))
    OR (cm.is_individual_player = TRUE  AND (cm.handicap IS NULL     OR cm.preferred_game IS NULL))
UNION ALL
SELECT u.user_id, u.name, u.user_type,
       'Invalid Level-2 Enthusiast attributes' AS anomaly_reason
  FROM Users u
  JOIN Club_Member cm ON cm.user_id = u.user_id
 WHERE (cm.is_enthusiast = FALSE AND (cm.interest_type IS NOT NULL OR cm.wants_trial IS NOT NULL))
    OR (cm.is_enthusiast = TRUE  AND (cm.interest_type IS NULL     OR cm.wants_trial IS NULL));