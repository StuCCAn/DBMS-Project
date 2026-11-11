-- CueClub Manager: negative tests. Run on a freshly seeded database (01 to 05); each failing statement is expected to raise the error named in its heading.
USE cueclub;
SELECT '1 double booking' t; INSERT INTO Reservations(user_id,table_id,start_time,end_time,payment_status) VALUES (1,1,'2026-10-09 20:00:00','2026-10-09 22:00:00','Paid');
SELECT '2 adjacent ok' t; INSERT INTO Reservations(user_id,table_id,start_time,end_time,payment_status) VALUES (1,1,'2026-10-09 21:00:00','2026-10-09 22:00:00','Paid');
SELECT '3 casual credit' t; INSERT INTO Reservations(user_id,table_id,start_time,end_time,payment_status) VALUES (5,2,'2026-10-12 18:00:00','2026-10-12 19:00:00','OnCredit');
SELECT '4 limit' t; INSERT INTO Credit_Ledger(user_id,entry_type,amount) VALUES (7,'Charge',900);
SELECT '5 overpay' t; INSERT INTO Credit_Ledger(user_id,entry_type,amount) VALUES (7,'Payment',10);
SELECT '6 casual ledger FK' t; INSERT INTO Credit_Ledger(user_id,entry_type,amount) VALUES (5,'Charge',10);
SELECT '7 disjoint' t; INSERT INTO Casual_Player(user_id) VALUES (1);
SELECT '8 end<start' t; INSERT INTO Reservations(user_id,table_id,start_time,end_time,payment_status) VALUES (1,2,'2026-10-12 19:00:00','2026-10-12 18:00:00','Paid');
SELECT '9 maintenance table' t; INSERT INTO Reservations(user_id,table_id,start_time,end_time,payment_status) VALUES (1,3,'2026-10-12 18:00:00','2026-10-12 19:00:00','Paid');
SELECT '10 assess non-player' t; INSERT INTO Skill_Assessments(player_id,assessed_by,skill_area,rating) VALUES (7,1,'Safety play',5);
SELECT '11 rating 11' t; INSERT INTO Skill_Assessments(player_id,assessed_by,skill_area,rating) VALUES (2,1,'Safety play',11);
-- atomicity: new tournament, drawn frame in 2nd frame must roll back everything
INSERT INTO Tournaments(tournament_id,title,game_type,format,start_date,status) VALUES (2,'T2','Pool','Knockout','2026-11-01','Registration');
INSERT INTO Tournament_Registrations(tournament_id,user_id,seed_number) VALUES (2,1,1),(2,2,2);
UPDATE Tournaments SET status='Ongoing' WHERE tournament_id=2;
INSERT INTO Matches(match_id,tournament_id,round_number,player1_id,player2_id) VALUES (10,2,1,1,2);
SELECT '12 drawn frame -> rollback' t; CALL sp_complete_match(10,'[{"p1":50,"p2":20},{"p1":40,"p2":40}]',3,1);
SELECT status, winner_id, (SELECT COUNT(*) FROM Match_Frames WHERE match_id=10) frames, (SELECT COUNT(*) FROM Player_Rankings WHERE game_type='Pool') pool_rank_rows FROM Matches WHERE match_id=10;
SELECT '13 unregistered player' t; INSERT INTO Matches(tournament_id,round_number,player1_id,player2_id) VALUES (2,1,1,3);
SELECT '14 level match' t; CALL sp_complete_match(10,'[{"p1":50,"p2":20},{"p1":10,"p2":40}]',3,1);
SELECT '15 already completed' t; CALL sp_complete_match(2,'[{"p1":50,"p2":20}]',3,1);
SELECT '16 undecided players' t; INSERT INTO Matches(match_id,tournament_id,round_number,next_match_id) VALUES (11,2,2,NULL),(12,2,1,11); CALL sp_complete_match(11,'[{"p1":50,"p2":20}]',3,1);
