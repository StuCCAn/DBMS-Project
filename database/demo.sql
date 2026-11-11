-- CueClub Manager: demonstration queries (run after seed.sql)
USE cueclub;

-- 1. Complete the semi-finals and the final; each call is one atomic transaction
CALL sp_complete_match(2, '[{"p1":72,"p2":30,"break":45},{"p1":15,"p2":68,"break":50},{"p1":80,"p2":22,"break":60}]', 3, 1);
CALL sp_complete_match(3, '[{"p1":60,"p2":40,"break":38},{"p1":55,"p2":20,"break":41}]', 3, 1);
CALL sp_complete_match(1, '[{"p1":90,"p2":10,"break":72},{"p1":30,"p2":66,"break":55},{"p1":71,"p2":50,"break":48}]', 3, 1);

SELECT * FROM v_leaderboard ORDER BY game_type, rank_position;
SELECT * FROM v_win_streaks;
SELECT * FROM v_head_to_head;
SELECT * FROM v_bracket_tree;
SELECT * FROM v_member_balance;
SELECT * FROM v_table_utilisation;
SELECT * FROM v_reorder_alerts;
SELECT * FROM v_player_weaknesses WHERE weakness_rank = 1;

-- 2. Constraint demonstrations (each statement below is expected to FAIL)
-- Double booking on Snooker 1:
-- INSERT INTO Reservations(user_id,table_id,start_time,end_time,payment_status) VALUES (1,1,'2026-10-09 20:00:00','2026-10-09 22:00:00','Paid');
-- Casual player asking for credit:
-- INSERT INTO Reservations(user_id,table_id,start_time,end_time,payment_status) VALUES (5,2,'2026-10-12 18:00:00','2026-10-12 19:00:00','OnCredit');
-- Credit limit exceeded:
-- INSERT INTO Credit_Ledger(user_id,entry_type,amount) VALUES (7,'Charge',900);
