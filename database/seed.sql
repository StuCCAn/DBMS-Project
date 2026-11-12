-- ============================================================================
-- CueClub Manager: Report-Aligned Seed Data (MySQL 8.0.16+)
-- Repeatable seed script; fixes expired dates for Members 4 & 7 through 2027.
-- ============================================================================
USE cueclub;

SET FOREIGN_KEY_CHECKS = 0;
DELETE FROM Match_Frames;
DELETE FROM Matches;
DELETE FROM Tournament_Registrations;
DELETE FROM Tournaments;
DELETE FROM Skill_Assessments;
DELETE FROM Credit_Ledger;
DELETE FROM Reservations;
DELETE FROM Inventory_Items;
DELETE FROM Game_Tables;
DELETE FROM Club_Member;
DELETE FROM Users;
SET FOREIGN_KEY_CHECKS = 1;

-- 1. Users: 1-4 and 7-8 are Club Members; 5-6 and 9 are Casual Players
INSERT INTO Users (user_id, name, phone, email, joined_on, user_type, ranking_points, is_active, app_role) VALUES
 (1, 'Rohan Mehta',   '9000000001', 'rohan@example.com',  '2025-01-10', 'Member', 1200, TRUE,  'Admin'),
 (2, 'Imran Sheikh',  '9000000002', 'imran@example.com',  '2025-02-14', 'Member', 1150, TRUE,  'Staff'),
 (3, 'Aarav Nair',    '9000000003', 'aarav@example.com',  '2025-03-01', 'Member', 1100, TRUE,  'Member'),
 (4, 'Kabir Rao',     '9000000004', 'kabir@example.com',  '2025-06-20', 'Member', 1050, TRUE,  'Member'),
 (5, 'Vikram Singh',  '9000000005', 'vikram@example.com', '2026-09-30', 'Casual',    0, TRUE,  'Casual'),
 (6, 'Sahil Verma',   '9000000006', 'sahil@example.com',  '2026-10-05', 'Casual',    0, TRUE,  'Casual'),
 (7, 'Neel Kapoor',   '9000000007', 'neel@example.com',   '2026-08-15', 'Member',  950, TRUE,  'Member'),
 (8, 'Vihaan Tongia', '9000000008', 'vihaan@example.com', '2025-05-01', 'Member',  900, TRUE,  'Member'),
 (9, 'Arjun Old',     '9000000009', 'arjun@example.com',  '2025-04-10', 'Casual',    0, FALSE, 'Casual');

-- 2. Club_Member: Members 1, 2, 3, 4, 7 have non-expired dates through 2027.
--    Member 8 has an expired membership ('2026-09-01') to test expiry restrictions.
INSERT INTO Club_Member (
    user_id, membership_no, plan, start_date, end_date, discount_pct, credit_limit,
    is_team_member, team_role, selection_status, handedness,
    is_individual_player, handicap, preferred_game,
    is_enthusiast, interest_type, wants_trial
) VALUES
 (1, 'CM-001', 'Annual',    '2026-01-01', '2027-12-31', 15.00, 5000.00,
     TRUE,  'Captain', 'Selected', 'Right',
     TRUE,  0,   'Snooker',
     FALSE, NULL, NULL),
 (2, 'CM-002', 'Annual',    '2026-01-01', '2027-12-31', 10.00, 3000.00,
     TRUE,  'Player',  'Selected', 'Left',
     TRUE,  -10, 'Snooker',
     FALSE, NULL, NULL),
 (3, 'CM-003', 'Quarterly', '2026-07-01', '2027-12-31',  5.00, 2000.00,
     TRUE,  'Player',  'Probable', 'Right',
     FALSE, NULL, NULL,
     FALSE, NULL, NULL),
 (4, 'CM-004', 'Annual',    '2026-10-01', '2027-10-01',  0.00, 1000.00,
     FALSE, NULL, NULL, NULL,
     TRUE,  0,   'Snooker',
     FALSE, NULL, NULL),
 (7, 'CM-005', 'Annual',    '2026-10-01', '2027-10-01',  0.00,  500.00,
     FALSE, NULL, NULL, NULL,
     FALSE, NULL, NULL,
     TRUE,  'Aspiring Player', TRUE),
 (8, 'CM-006', 'Monthly',   '2026-08-01', '2026-09-01', 10.00, 1000.00,
     FALSE, NULL, NULL, NULL,
     FALSE, NULL, NULL,
     TRUE,  'Supporter', FALSE);

-- 3. Game_Tables
INSERT INTO Game_Tables (table_id, name, game_type, hourly_rate, per_frame_rate, status) VALUES
 (1, 'Snooker 1', 'Snooker',   300.00, 120.00, 'Available'),
 (2, 'Snooker 2', 'Snooker',   300.00, 120.00, 'Available'),
 (3, 'Snooker 3', 'Snooker',   250.00, 100.00, 'Maintenance'),
 (4, 'Pool 1',    'Pool',      200.00,  80.00, 'Available'),
 (5, 'Billiards 1','Billiards',240.00,  90.00, 'Available');

-- 4. Inventory_Items (Trigger automatically sets reorder_flag = (quantity < reorder_level))
INSERT INTO Inventory_Items (
    item_id, name, category, quantity, reorder_level,
    table_id, condition_status, last_serviced_date, vendor_name
) VALUES
 (1, 'Cue tips 10mm',          'Consumable', 6,  10, NULL, 'Good',          NULL,         'Cue Sports Supplies'),
 (2, 'Chalk boxes',            'Chalk',     24,  12, NULL, 'Good',          NULL,         'Cue Sports Supplies'),
 (3, 'Table cloth - Snooker 1','Cloth',      1,   2, 1,    'Needs Service', '2026-03-12', 'Baize and Balls Co.'),
 (4, 'Snooker ball set',       'Balls',      3,   2, NULL, 'Good',          '2026-08-01', 'Baize and Balls Co.');

-- 5. Skill_Assessments
INSERT INTO Skill_Assessments (player_id, assessed_by, skill_area, rating, notes, assessed_on) VALUES
 (2, 1, 'Safety play',       4, 'Leaves the white loose after pots', '2026-10-01'),
 (2, 1, 'Break building',    8, 'Strong in the 40-60 range',         '2026-10-01'),
 (2, 1, 'Pressure handling', 5, NULL,                                '2026-10-01'),
 (3, 1, 'Long potting',      6, NULL,                                '2026-10-01'),
 (4, 1, 'Cue ball control',  7, 'Good positional recovery',          '2026-10-02');

-- 6. Reservations & Credit_Ledger via sp_book_table
CALL sp_book_table(2, 1, '2026-10-09 19:00:00', '2026-10-09 21:00:00', 'Hourly',   0, 'OnCredit', @r1);
CALL sp_book_table(3, 2, '2026-10-09 18:00:00', '2026-10-09 19:00:00', 'Hourly',   0, 'Paid',     @r2);
CALL sp_book_table(5, 4, '2026-10-09 20:00:00', '2026-10-09 21:30:00', 'Hourly',   0, 'Paid',     @r3);
CALL sp_book_table(4, 1, '2026-10-10 17:00:00', '2026-10-10 18:00:00', 'PerFrame', 4, 'OnCredit', @r4);

INSERT INTO Credit_Ledger (user_id, reservation_id, entry_type, amount, note) VALUES
 (2, NULL, 'Canteen charge', 120.00, 'Refreshments during practice'),
 (2, NULL, 'Payment',        300.00, 'Part payment in cash'),
 (3, NULL, 'Fine',           150.00, 'Damaged house cue tip');

-- 7. Knockout Tournament with 4 seeded players (Match 1 is Final; Matches 2 & 3 are Semi-Finals)
INSERT INTO Tournaments (tournament_id, title, game_type, format, start_date, entry_fee, status) VALUES
 (1, 'Club Open Snooker 2026', 'Snooker', 'Knockout', '2026-10-18', 200.00, 'Registration');

INSERT INTO Tournament_Registrations (tournament_id, user_id, seed_number, fee_paid) VALUES
 (1, 1, 1, TRUE),
 (1, 2, 2, TRUE),
 (1, 3, 3, TRUE),
 (1, 4, 4, FALSE);

UPDATE Tournaments SET status = 'Ongoing' WHERE tournament_id = 1;

INSERT INTO Matches (match_id, tournament_id, round_number, player1_id, player2_id, next_match_id, table_id, scheduled_time, status) VALUES
 (1, 1, 2, NULL, NULL, NULL, 1, '2026-10-18 17:00:00', 'Scheduled'),
 (2, 1, 1, 1,    4,    1,    1, '2026-10-18 11:00:00', 'Scheduled'),
 (3, 1, 1, 2,    3,    1,    2, '2026-10-18 11:00:00', 'Scheduled');