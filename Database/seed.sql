-- CueClub Manager: sample data for demonstration and testing
USE cueclub;

-- Users: 1-4 and 7 are club members, 5-6 are casual players
INSERT INTO Users (user_id, name, phone, email, joined_on) VALUES
 (1,'Rohan Mehta','9000000001','rohan@example.com','2025-01-10'),
 (2,'Imran Sheikh','9000000002','imran@example.com','2025-02-14'),
 (3,'Aarav Nair','9000000003','aarav@example.com','2025-03-01'),
 (4,'Kabir Rao','9000000004','kabir@example.com','2025-06-20'),
 (5,'Vikram Singh','9000000005','vikram@example.com','2026-09-30'),
 (6,'Sahil Verma','9000000006','sahil@example.com','2026-10-05'),
 (7,'Neel Kapoor','9000000007','neel@example.com','2026-08-15');

INSERT INTO Club_Member (user_id, membership_no, plan, start_date, end_date, discount_pct, credit_limit) VALUES
 (1,'CM-001','Annual','2026-01-01','2026-12-31',15,5000),
 (2,'CM-002','Annual','2026-01-01','2026-12-31',10,3000),
 (3,'CM-003','Quarterly','2026-07-01','2026-12-31',5,2000),
 (4,'CM-004','Monthly','2026-10-01','2026-11-01',0,1000),
 (7,'CM-005','Monthly','2026-10-01','2026-11-01',0,500);

INSERT INTO Casual_Player (user_id, visit_count, last_visit) VALUES (5,3,'2026-10-09'),(6,1,'2026-10-05');

INSERT INTO Teams (team_id, name, captain_id, formed_on) VALUES (1,'Club Snooker Squad',1,'2025-02-01');
INSERT INTO Team_Member (user_id, team_id, team_role, selection_status, handedness) VALUES
 (1,1,'Captain','Selected','Right'),(2,1,'Player','Selected','Left'),(3,1,'Player','Probable','Right');
INSERT INTO Individual_Player (user_id, handicap, preferred_game) VALUES (2,-10,'Snooker'),(4,0,'Snooker');
INSERT INTO Team_Enthusiast (user_id, interest_type, wants_trial) VALUES (7,'Aspiring Player',TRUE);

INSERT INTO Game_Tables (table_id, name, game_type, hourly_rate, per_frame_rate, status) VALUES
 (1,'Snooker 1','Snooker',300,120,'Available'),
 (2,'Snooker 2','Snooker',300,120,'Available'),
 (3,'Snooker 3','Snooker',250,100,'Maintenance'),
 (4,'Pool 1','Pool',200,80,'Available');

-- Vendors and inventory (trigger sets reorder_flag)
INSERT INTO Vendors (vendor_id, name, phone, supplies_category) VALUES
 (1,'Cue Sports Supplies','9111111111','Cues and tips'),
 (2,'Baize and Balls Co.','9222222222','Cloth and balls');
INSERT INTO Inventory_Items (item_id, name, category, quantity, reorder_level, table_id, condition_status, last_serviced_date, vendor_id) VALUES
 (1,'Cue tips 10mm','Consumable',6,10,NULL,'Good',NULL,1),
 (2,'Chalk boxes','Chalk',24,12,NULL,'Good',NULL,1),
 (3,'Table cloth - Snooker 1','Cloth',1,1,1,'NeedsService','2026-03-12',2),
 (4,'Snooker ball set','Balls',3,2,NULL,'Good','2026-08-01',2);
INSERT INTO Purchase_Orders (po_id, vendor_id, item_id, quantity, cost, order_date, status, amount_paid) VALUES
 (1,1,1,50,1500,'2026-10-02','Ordered',500);

-- Penalty and coaching data
INSERT INTO Penalties (user_id, violation_type, issued_at, fine_amount, paid) VALUES
 (6,'Damaged cue tip','2026-10-05 20:10:00',150,FALSE);
INSERT INTO Skill_Assessments (player_id, assessed_by, skill_area, rating, notes, assessed_on) VALUES
 (2,1,'Safety play',4,'Leaves the white loose after pots','2026-10-01'),
 (2,1,'Break building',8,'Strong in the 40-60 range','2026-10-01'),
 (2,1,'Pressure handling',5,NULL,'2026-10-01'),
 (3,1,'Long potting',6,NULL,'2026-10-01');

-- Reservations through the booking procedure (applies discount, posts ledger charges)
CALL sp_book_table(2,1,'2026-10-09 19:00:00','2026-10-09 21:00:00','Hourly',0,'OnCredit',@r);
CALL sp_book_table(3,2,'2026-10-09 18:00:00','2026-10-09 19:00:00','Hourly',0,'Paid',@r);
CALL sp_book_table(5,4,'2026-10-09 20:00:00','2026-10-09 21:30:00','Hourly',0,'Paid',@r);
CALL sp_book_table(4,1,'2026-10-10 17:00:00','2026-10-10 18:00:00','PerFrame',4,'OnCredit',@r);
INSERT INTO Credit_Ledger (user_id, reservation_id, entry_type, amount, note) VALUES
 (2,NULL,'Payment',300,'Part payment in cash');

-- Knockout tournament with four players; the final is inserted first so the semi-finals can point to it
INSERT INTO Tournaments (tournament_id, title, game_type, format, start_date, entry_fee, status, team_id) VALUES
 (1,'Club Open Snooker 2026','Snooker','Knockout','2026-10-18',200,'Registration',NULL);
INSERT INTO Tournament_Registrations (tournament_id, user_id, seed_number, fee_paid) VALUES
 (1,1,1,TRUE),(1,2,2,TRUE),(1,3,3,TRUE),(1,4,4,FALSE);
UPDATE Tournaments SET status = 'Ongoing' WHERE tournament_id = 1;
INSERT INTO Matches (match_id, tournament_id, round_number, player1_id, player2_id, next_match_id, table_id, scheduled_time) VALUES
 (1,1,2,NULL,NULL,NULL,1,'2026-10-18 17:00:00'),
 (2,1,1,1,4,1,1,'2026-10-18 11:00:00'),
 (3,1,1,2,3,1,2,'2026-10-18 11:00:00');
