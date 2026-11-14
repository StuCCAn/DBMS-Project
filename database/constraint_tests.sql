-- ============================================================================
-- CueClub Manager: Automated Constraint, Trigger & Transaction Test Harness
-- Safely catches expected errors, prints PASS/FAIL per test, and fails CI if
-- any constraint fails to reject invalid data or fails a valid operation.
-- Includes Tests 1-16 (Core Model & Business Rules) and Tests 17-38 (Phase 4 API & Lifecycle).
-- ============================================================================
USE cueclub;

DROP PROCEDURE IF EXISTS sp_run_constraint_tests;

DELIMITER $$

CREATE PROCEDURE sp_run_constraint_tests()
BEGIN
    DECLARE v_failed INT DEFAULT 0;
    DECLARE v_err_count INT DEFAULT 0;
    DECLARE v_frames_after INT DEFAULT 0;
    DECLARE v_p1_pts_before INT DEFAULT 0;
    DECLARE v_p1_pts_after INT DEFAULT 0;
    DECLARE v_m2_status VARCHAR(15);

    CREATE TEMPORARY TABLE IF NOT EXISTS Test_Results (
        test_no INT PRIMARY KEY,
        test_name VARCHAR(120),
        expected_outcome VARCHAR(30),
        actual_outcome VARCHAR(30),
        passed BOOL
    );
    TRUNCATE TABLE Test_Results;

    -- Clean any existing temporary test fixtures before starting (ensures re-runnability)
    DELETE FROM Match_Frames WHERE match_id IN (10, 11, 90, 91);
    DELETE FROM Matches WHERE match_id IN (10, 11, 90, 91);
    DELETE FROM Tournament_Registrations WHERE tournament_id IN (2, 90, 91);
    DELETE FROM Tournaments WHERE tournament_id IN (2, 90, 91);
    DELETE FROM Skill_Assessments WHERE notes LIKE 'Test %';
    DELETE FROM Credit_Ledger WHERE note LIKE 'Test %'
        OR user_id IN (98, 99)
        OR reservation_id IN (SELECT reservation_id FROM Reservations WHERE start_time >= '2026-12-01' OR user_id IN (98, 99));
    DELETE FROM Reservations WHERE start_time >= '2026-12-01' OR user_id IN (98, 99);
    DELETE FROM Club_Member WHERE user_id IN (98, 99);
    DELETE FROM Users WHERE user_id IN (98, 99);
    UPDATE Game_Tables SET status = 'Available' WHERE table_id IN (1, 2, 4, 5);
    UPDATE Game_Tables SET status = 'Maintenance' WHERE table_id = 3;
    UPDATE Inventory_Items SET quantity = 6, condition_status = 'Good' WHERE item_id = 1;
    DELETE FROM Reservations WHERE user_id = 1 AND table_id = 1 AND start_time = '2026-10-09 21:00:00';

    -- ----------------------------------------------------------------
    -- Test 1: Double booking on Snooker 1 (overlapping 19:00-21:00) -> MUST FAIL
    -- ----------------------------------------------------------------
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_err_count = 1;
        SET v_err_count = 0;
        INSERT INTO Reservations(user_id,table_id,start_time,end_time,billing_mode,frames_played,total_amount,payment_status)
        VALUES (1,1,'2026-10-09 20:00:00','2026-10-09 22:00:00','Hourly',0,600.00,'Paid');
        INSERT INTO Test_Results VALUES (1, 'R1: Reject overlapping double booking', 'REJECTED', IF(v_err_count=1,'REJECTED','ACCEPTED'), v_err_count=1);
    END;

    -- ----------------------------------------------------------------
    -- Test 2: Adjacent booking on Snooker 1 (21:00-22:00) -> MUST SUCCEED
    -- ----------------------------------------------------------------
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_err_count = 1;
        SET v_err_count = 0;
        INSERT INTO Reservations(user_id,table_id,start_time,end_time,billing_mode,frames_played,total_amount,payment_status)
        VALUES (1,1,'2026-10-09 21:00:00','2026-10-09 22:00:00','Hourly',0,255.00,'Paid');
        INSERT INTO Test_Results VALUES (2, 'R1: Allow adjacent non-overlapping booking', 'ACCEPTED', IF(v_err_count=0,'ACCEPTED','REJECTED'), v_err_count=0);
    END;

    -- ----------------------------------------------------------------
    -- Test 3: Booking crossing midnight (R1) -> MUST FAIL
    -- ----------------------------------------------------------------
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_err_count = 1;
        SET v_err_count = 0;
        INSERT INTO Reservations(user_id,table_id,start_time,end_time,billing_mode,frames_played,total_amount,payment_status)
        VALUES (1,1,'2026-10-11 23:00:00','2026-10-12 01:00:00','Hourly',0,510.00,'Paid');
        INSERT INTO Test_Results VALUES (3, 'R1: Reject booking crossing midnight', 'REJECTED', IF(v_err_count=1,'REJECTED','ACCEPTED'), v_err_count=1);
    END;

    -- ----------------------------------------------------------------
    -- Test 4: Casual player booking OnCredit (R2) -> MUST FAIL
    -- ----------------------------------------------------------------
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_err_count = 1;
        SET v_err_count = 0;
        INSERT INTO Reservations(user_id,table_id,start_time,end_time,billing_mode,frames_played,total_amount,payment_status)
        VALUES (5,2,'2026-10-12 18:00:00','2026-10-12 19:00:00','Hourly',0,300.00,'OnCredit');
        INSERT INTO Test_Results VALUES (4, 'R2: Reject casual player booking OnCredit', 'REJECTED', IF(v_err_count=1,'REJECTED','ACCEPTED'), v_err_count=1);
    END;

    -- ----------------------------------------------------------------
    -- Test 5: Credit limit exceeded for Member 7 (limit 500) -> MUST FAIL
    -- ----------------------------------------------------------------
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_err_count = 1;
        SET v_err_count = 0;
        INSERT INTO Credit_Ledger(user_id,entry_type,amount) VALUES (7,'Booking charge',900.00);
        INSERT INTO Test_Results VALUES (5, 'R3: Reject credit charge exceeding credit_limit', 'REJECTED', IF(v_err_count=1,'REJECTED','ACCEPTED'), v_err_count=1);
    END;

    -- ----------------------------------------------------------------
    -- Test 6: Overpayment exceeding balance for Member 7 (balance 0) -> MUST FAIL
    -- ----------------------------------------------------------------
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_err_count = 1;
        SET v_err_count = 0;
        INSERT INTO Credit_Ledger(user_id,entry_type,amount) VALUES (7,'Payment',10.00);
        INSERT INTO Test_Results VALUES (6, 'R3: Reject payment exceeding outstanding balance', 'REJECTED', IF(v_err_count=1,'REJECTED','ACCEPTED'), v_err_count=1);
    END;

    -- ----------------------------------------------------------------
    -- Test 7: Casual player inserted into Credit_Ledger (FK violation) -> MUST FAIL
    -- ----------------------------------------------------------------
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_err_count = 1;
        SET v_err_count = 0;
        INSERT INTO Credit_Ledger(user_id,entry_type,amount) VALUES (5,'Canteen charge',10.00);
        INSERT INTO Test_Results VALUES (7, 'R2: Reject casual player in Credit_Ledger (FK)', 'REJECTED', IF(v_err_count=1,'REJECTED','ACCEPTED'), v_err_count=1);
    END;

    -- ----------------------------------------------------------------
    -- Test 8: Disjoint Level-1 specialization (Casual user inserted into Club_Member) -> MUST FAIL
    -- ----------------------------------------------------------------
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_err_count = 1;
        SET v_err_count = 0;
        INSERT INTO Club_Member(user_id,membership_no,plan,start_date,end_date)
        VALUES (5,'CM-999','Monthly','2026-10-01','2026-11-01');
        INSERT INTO Test_Results VALUES (8, 'Level-1 Disjoint: Reject Casual user in Club_Member', 'REJECTED', IF(v_err_count=1,'REJECTED','ACCEPTED'), v_err_count=1);
    END;

    -- ----------------------------------------------------------------
    -- Test 9: Level-2 IFF check (is_team_member=TRUE but team_role=NULL) -> MUST FAIL
    -- ----------------------------------------------------------------
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_err_count = 1;
        SET v_err_count = 0;
        UPDATE Club_Member SET is_team_member = TRUE, team_role = NULL WHERE user_id = 4;
        INSERT INTO Test_Results VALUES (9, 'Level-2 IFF: Reject incomplete Team_Member flags', 'REJECTED', IF(v_err_count=1,'REJECTED','ACCEPTED'), v_err_count=1);
    END;

    -- ----------------------------------------------------------------
    -- Test 10: Expired member booking OnCredit (User 8 expired 2026-09-01) -> MUST FAIL
    -- ----------------------------------------------------------------
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_err_count = 1;
        SET v_err_count = 0;
        INSERT INTO Reservations(user_id,table_id,start_time,end_time,billing_mode,frames_played,total_amount,payment_status)
        VALUES (8,2,'2026-10-12 14:00:00','2026-10-12 15:00:00','Hourly',0,300.00,'OnCredit');
        INSERT INTO Test_Results VALUES (10, 'Expiry: Reject OnCredit booking by expired member', 'REJECTED', IF(v_err_count=1,'REJECTED','ACCEPTED'), v_err_count=1);
    END;

    -- ----------------------------------------------------------------
    -- Test 11: Deactivated user (User 9) attempting reservation & deletion of User 1 (R9) -> MUST FAIL
    -- ----------------------------------------------------------------
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_err_count = v_err_count + 1;
        SET v_err_count = 0;
        INSERT INTO Reservations(user_id,table_id,start_time,end_time,billing_mode,frames_played,total_amount,payment_status)
        VALUES (9,2,'2026-10-12 12:00:00','2026-10-12 13:00:00','Hourly',0,300.00,'Paid');
        DELETE FROM Users WHERE user_id = 1;
        INSERT INTO Test_Results VALUES (11, 'R9: Reject deactivated user booking & historical user deletion', 'REJECTED', IF(v_err_count=2,'REJECTED','ACCEPTED'), v_err_count=2);
    END;

    -- ----------------------------------------------------------------
    -- Test 12: Maintenance table (Table 3) & end_time < start_time -> MUST FAIL
    -- ----------------------------------------------------------------
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_err_count = v_err_count + 1;
        SET v_err_count = 0;
        INSERT INTO Reservations(user_id,table_id,start_time,end_time,billing_mode,frames_played,total_amount,payment_status)
        VALUES (1,2,'2026-10-12 19:00:00','2026-10-12 18:00:00','Hourly',0,300.00,'Paid');
        INSERT INTO Reservations(user_id,table_id,start_time,end_time,billing_mode,frames_played,total_amount,payment_status)
        VALUES (1,3,'2026-10-12 18:00:00','2026-10-12 19:00:00','Hourly',0,250.00,'Paid');
        INSERT INTO Test_Results VALUES (12, 'Domain/Trigger: Reject end<start and Maintenance table', 'REJECTED', IF(v_err_count=2,'REJECTED','ACCEPTED'), v_err_count=2);
    END;

    -- ----------------------------------------------------------------
    -- Test 13: Coaching assessment on non-player (User 7 is enthusiast only) & rating 11 -> MUST FAIL
    -- ----------------------------------------------------------------
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_err_count = v_err_count + 1;
        SET v_err_count = 0;
        INSERT INTO Skill_Assessments(player_id,assessed_by,skill_area,rating) VALUES (7,1,'Safety play',5);
        INSERT INTO Skill_Assessments(player_id,assessed_by,skill_area,rating) VALUES (2,1,'Safety play',11);
        INSERT INTO Test_Results VALUES (13, 'Coaching: Reject non-player assessment and rating > 10', 'REJECTED', IF(v_err_count=2,'REJECTED','ACCEPTED'), v_err_count=2);
    END;

    -- ----------------------------------------------------------------
    -- Test 14: Transaction Rollback on Drawn Frame in sp_complete_match (R5 & R6) -> MUST ROLL BACK
    -- ----------------------------------------------------------------
    INSERT INTO Tournaments(tournament_id,title,game_type,format,start_date,entry_fee,status)
    VALUES (2,'T2 Pool Knockout','Pool','Knockout','2026-11-01',100.00,'Registration');
    INSERT INTO Tournament_Registrations(tournament_id,user_id,seed_number,fee_paid)
    VALUES (2,1,1,TRUE),(2,2,2,TRUE);
    UPDATE Tournaments SET status='Ongoing' WHERE tournament_id=2;
    INSERT INTO Matches(match_id,tournament_id,round_number,player1_id,player2_id)
    VALUES (10,2,1,1,2);

    SELECT ranking_points INTO v_p1_pts_before FROM Users WHERE user_id = 1;
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_err_count = 1;
        SET v_err_count = 0;
        CALL sp_complete_match(10,'[{"p1":50,"p2":20},{"p1":40,"p2":40}]',30,10);
    END;
    SELECT COUNT(*) INTO v_frames_after FROM Match_Frames WHERE match_id = 10;
    SELECT ranking_points INTO v_p1_pts_after FROM Users WHERE user_id = 1;
    INSERT INTO Test_Results VALUES (
        14,
        'R5/R6 Atomicity: Drawn frame rolls back frames & ranking_points',
        'ROLLED BACK',
        IF(v_err_count=1 AND v_frames_after=0 AND v_p1_pts_before=v_p1_pts_after,'ROLLED BACK','MUTATED'),
        (v_err_count=1 AND v_frames_after=0 AND v_p1_pts_before=v_p1_pts_after)
    );

    -- ----------------------------------------------------------------
    -- Test 15: Repeat completion of already-completed match -> MUST FAIL
    -- ----------------------------------------------------------------
    SELECT status INTO v_m2_status FROM Matches WHERE match_id = 2;
    IF v_m2_status <> 'Completed' THEN
        CALL sp_complete_match(2, '[{"p1":72,"p2":30,"break":45},{"p1":15,"p2":68,"break":50},{"p1":80,"p2":22,"break":60}]', 30, 10);
    END IF;
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_err_count = 1;
        SET v_err_count = 0;
        CALL sp_complete_match(2,'[{"p1":50,"p2":20}]',30,10);
        INSERT INTO Test_Results VALUES (15, 'Precondition: Reject completing an already-completed match', 'REJECTED', IF(v_err_count=1,'REJECTED','ACCEPTED'), v_err_count=1);
    END;

    -- ----------------------------------------------------------------
    -- Test 16: Unregistered match player, level match on frames, & undecided players -> MUST FAIL
    -- ----------------------------------------------------------------
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_err_count = v_err_count + 1;
        SET v_err_count = 0;
        INSERT INTO Matches(tournament_id,round_number,player1_id,player2_id) VALUES (2,1,1,3);
        CALL sp_complete_match(10,'[{"p1":50,"p2":20},{"p1":10,"p2":40}]',30,10);
        INSERT INTO Matches(match_id,tournament_id,round_number,next_match_id) VALUES (11,2,2,NULL);
        CALL sp_complete_match(11,'[{"p1":50,"p2":20}]',30,10);
        INSERT INTO Test_Results VALUES (16, 'Tournament/Match: Reject unregistered player, tied match & NULL slots', 'REJECTED', IF(v_err_count=3,'REJECTED','ACCEPTED'), v_err_count=3);
    END;

    -- Clean up fixtures from Test 14-16
    DELETE FROM Match_Frames WHERE match_id IN (10, 11);
    DELETE FROM Matches WHERE match_id IN (10, 11);
    DELETE FROM Tournament_Registrations WHERE tournament_id = 2;
    DELETE FROM Tournaments WHERE tournament_id = 2;

    -- ================================================================
    -- PHASE 4 API SURFACE & LIFECYCLE TESTS (Tests 17 - 38)
    -- ================================================================

    -- ----------------------------------------------------------------
    -- Test 17: sp_get_login: valid email returns record, empty/null rejected
    -- ----------------------------------------------------------------
    BEGIN
        DECLARE v_found INT DEFAULT 0;
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_err_count = v_err_count + 1;
        SET v_err_count = 0;
        CALL sp_get_login('');
        CALL sp_get_login(NULL);
        SELECT COUNT(*) INTO v_found FROM Users WHERE email = 'rohan@example.com';
        CALL sp_get_login('rohan@example.com');
        INSERT INTO Test_Results VALUES (
            17,
            'sp_get_login: Authenticates valid email and rejects empty/null input',
            'SUCCESS',
            IF(v_err_count = 2 AND v_found = 1, 'SUCCESS', 'FAILED'),
            (v_err_count = 2 AND v_found = 1)
        );
    END;

    -- ----------------------------------------------------------------
    -- Test 18: sp_record_payment: valid payment succeeds, non-member & non-positive amount rejected
    -- ----------------------------------------------------------------
    BEGIN
        DECLARE v_pay_id INT DEFAULT NULL;
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_err_count = v_err_count + 1;
        SET v_err_count = 0;
        -- Rejection 1: Casual player (not in Club_Member)
        CALL sp_record_payment(5, 50.00, 'Test payment casual', v_pay_id);
        -- Rejection 2: Zero or negative amount
        CALL sp_record_payment(2, 0.00, 'Test payment zero', v_pay_id);
        CALL sp_record_payment(2, -25.00, 'Test payment neg', v_pay_id);
        -- Success: Valid payment for Member 2
        CALL sp_record_payment(2, 50.00, 'Test payment valid', v_pay_id);
        INSERT INTO Test_Results VALUES (
            18,
            'sp_record_payment: Valid payment succeeds, non-member & non-positive amount rejected',
            'SUCCESS',
            IF(v_err_count = 3 AND v_pay_id IS NOT NULL, 'SUCCESS', 'FAILED'),
            (v_err_count = 3 AND v_pay_id IS NOT NULL)
        );
        IF v_pay_id IS NOT NULL THEN
            DELETE FROM Credit_Ledger WHERE entry_id = v_pay_id;
        END IF;
    END;

    -- ----------------------------------------------------------------
    -- Test 19: sp_record_charge: valid Canteen/Fine charge succeeds, invalid type & non-member rejected
    -- ----------------------------------------------------------------
    BEGIN
        DECLARE v_chg_id INT DEFAULT NULL;
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_err_count = v_err_count + 1;
        SET v_err_count = 0;
        -- Rejection 1: Casual player
        CALL sp_record_charge(5, 'Canteen charge', 20.00, 'Test charge casual', v_chg_id);
        -- Rejection 2: Disallowed charge type 'Booking charge'
        CALL sp_record_charge(4, 'Booking charge', 20.00, 'Test booking charge', v_chg_id);
        -- Rejection 3: Invalid type 'Miscellaneous'
        CALL sp_record_charge(4, 'Miscellaneous', 20.00, 'Test misc charge', v_chg_id);
        -- Rejection 4: Negative amount
        CALL sp_record_charge(4, 'Fine', -10.00, 'Test neg fine', v_chg_id);
        -- Success: Valid Canteen charge for Member 4
        CALL sp_record_charge(4, 'Canteen charge', 25.00, 'Test valid canteen', v_chg_id);
        INSERT INTO Test_Results VALUES (
            19,
            'sp_record_charge: Valid Canteen/Fine charge succeeds, invalid type & non-member rejected',
            'SUCCESS',
            IF(v_err_count = 4 AND v_chg_id IS NOT NULL, 'SUCCESS', 'FAILED'),
            (v_err_count = 4 AND v_chg_id IS NOT NULL)
        );
        IF v_chg_id IS NOT NULL THEN
            DELETE FROM Credit_Ledger WHERE entry_id = v_chg_id;
        END IF;
    END;

    -- ----------------------------------------------------------------
    -- Test 20: sp_create_tournament: valid tournament succeeds, invalid game/format/fee rejected
    -- ----------------------------------------------------------------
    BEGIN
        DECLARE v_tour_id INT DEFAULT NULL;
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_err_count = v_err_count + 1;
        SET v_err_count = 0;
        -- Rejection 1: Invalid game type
        CALL sp_create_tournament('Test Tour', 'Darts', 'Knockout', '2026-12-10', 100.00, v_tour_id);
        -- Rejection 2: Invalid format
        CALL sp_create_tournament('Test Tour', 'Snooker', 'Swiss', '2026-12-10', 100.00, v_tour_id);
        -- Rejection 3: Negative fee
        CALL sp_create_tournament('Test Tour', 'Snooker', 'Knockout', '2026-12-10', -50.00, v_tour_id);
        -- Success: Valid tournament
        CALL sp_create_tournament('Test Winter Open', 'Snooker', 'Knockout', '2026-12-10', 150.00, v_tour_id);
        INSERT INTO Test_Results VALUES (
            20,
            'sp_create_tournament: Valid tournament created, invalid game/format/fee rejected',
            'SUCCESS',
            IF(v_err_count = 3 AND v_tour_id IS NOT NULL, 'SUCCESS', 'FAILED'),
            (v_err_count = 3 AND v_tour_id IS NOT NULL)
        );
        IF v_tour_id IS NOT NULL THEN
            DELETE FROM Tournaments WHERE tournament_id = v_tour_id;
        END IF;
    END;

    -- ----------------------------------------------------------------
    -- Test 21: sp_register_tournament_player: valid registration succeeds, deactivated user & closed status rejected
    -- ----------------------------------------------------------------
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_err_count = v_err_count + 1;
        SET v_err_count = 0;
        INSERT INTO Tournaments(tournament_id, title, game_type, format, start_date, entry_fee, status)
        VALUES (90, 'Test Registration Tour', 'Pool', 'Knockout', '2026-12-15', 50.00, 'Registration');

        -- Success: Register active Member 1
        CALL sp_register_tournament_player(90, 1, 1, TRUE);

        -- Rejection 1: Register deactivated User 9 (Rule R9)
        CALL sp_register_tournament_player(90, 9, 2, TRUE);

        -- Rejection 2: Non-existent tournament
        CALL sp_register_tournament_player(9999, 2, 3, TRUE);

        -- Rejection 3: Tournament not in Registration status
        UPDATE Tournaments SET status = 'Ongoing' WHERE tournament_id = 90;
        CALL sp_register_tournament_player(90, 2, 2, TRUE);

        INSERT INTO Test_Results VALUES (
            21,
            'sp_register_tournament_player: Valid registration succeeds, deactivated user & closed status rejected',
            'SUCCESS',
            IF(v_err_count = 3, 'SUCCESS', 'FAILED'),
            (v_err_count = 3)
        );
        DELETE FROM Tournament_Registrations WHERE tournament_id = 90;
        DELETE FROM Tournaments WHERE tournament_id = 90;
    END;

    -- ----------------------------------------------------------------
    -- Test 22: sp_set_table_status: valid status transition succeeds, invalid status rejected
    -- ----------------------------------------------------------------
    BEGIN
        DECLARE v_st VARCHAR(20);
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_err_count = v_err_count + 1;
        SET v_err_count = 0;
        -- Rejection: Invalid status
        CALL sp_set_table_status(5, 'Broken');
        -- Success: Set to Maintenance
        CALL sp_set_table_status(5, 'Maintenance');
        SELECT status INTO v_st FROM Game_Tables WHERE table_id = 5;
        -- Restore to Available
        CALL sp_set_table_status(5, 'Available');
        INSERT INTO Test_Results VALUES (
            22,
            'sp_set_table_status: Valid status transition succeeds, invalid status rejected',
            'SUCCESS',
            IF(v_err_count = 1 AND v_st = 'Maintenance', 'SUCCESS', 'FAILED'),
            (v_err_count = 1 AND v_st = 'Maintenance')
        );
    END;

    -- ----------------------------------------------------------------
    -- Test 23: sp_record_assessment: valid assessment succeeds, invalid skill/rating/self-assessment rejected
    -- ----------------------------------------------------------------
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_err_count = v_err_count + 1;
        SET v_err_count = 0;
        -- Rejection 1: Invalid skill area
        CALL sp_record_assessment(2, 1, 'Trick shots', 8, 'Test invalid skill');
        -- Rejection 2: Rating out of bounds (11)
        CALL sp_record_assessment(2, 1, 'Safety play', 11, 'Test rating 11');
        -- Rejection 3: Rating out of bounds (0)
        CALL sp_record_assessment(2, 1, 'Safety play', 0, 'Test rating 0');
        -- Rejection 4: Self-assessment
        CALL sp_record_assessment(1, 1, 'Break building', 7, 'Test self assessment');
        -- Rejection 5: Non-player (User 7 is enthusiast only, rejected by trg_assessment_bi)
        CALL sp_record_assessment(7, 1, 'Safety play', 5, 'Test non-player');
        -- Success: Valid assessment for Player 2
        CALL sp_record_assessment(2, 1, 'Safety play', 9, 'Test assessment valid note');
        INSERT INTO Test_Results VALUES (
            23,
            'sp_record_assessment: Valid assessment succeeds, invalid skill/rating/self-assessment rejected',
            'SUCCESS',
            IF(v_err_count = 5, 'SUCCESS', 'FAILED'),
            (v_err_count = 5)
        );
        DELETE FROM Skill_Assessments WHERE notes = 'Test assessment valid note';
    END;

    -- ----------------------------------------------------------------
    -- Test 24: sp_update_inventory_stock: stock update succeeds with R8 flag maintenance, negative stock rejected
    -- ----------------------------------------------------------------
    BEGIN
        DECLARE v_q_after INT;
        DECLARE v_flag_after BOOL;
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_err_count = v_err_count + 1;
        SET v_err_count = 0;
        -- Rejection: Delta causing negative quantity
        CALL sp_update_inventory_stock(1, -50);
        -- Success: Increase stock to 11 (above reorder_level 10)
        CALL sp_update_inventory_stock(1, 5);
        SELECT quantity, reorder_flag INTO v_q_after, v_flag_after FROM Inventory_Items WHERE item_id = 1;
        -- Restore stock
        CALL sp_update_inventory_stock(1, -5);
        INSERT INTO Test_Results VALUES (
            24,
            'sp_update_inventory_stock: Stock update succeeds with R8 flag maintenance, negative stock rejected',
            'SUCCESS',
            IF(v_err_count = 1 AND v_q_after = 11 AND v_flag_after = FALSE, 'SUCCESS', 'FAILED'),
            (v_err_count = 1 AND v_q_after = 11 AND v_flag_after = FALSE)
        );
    END;

    -- ----------------------------------------------------------------
    -- Test 25: sp_set_inventory_condition: valid condition succeeds, invalid condition rejected
    -- ----------------------------------------------------------------
    BEGIN
        DECLARE v_cond VARCHAR(30);
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_err_count = v_err_count + 1;
        SET v_err_count = 0;
        -- Rejection: Invalid condition
        CALL sp_set_inventory_condition(1, 'Destroyed');
        -- Success: Set to Needs Service
        CALL sp_set_inventory_condition(1, 'Needs Service');
        SELECT condition_status INTO v_cond FROM Inventory_Items WHERE item_id = 1;
        -- Restore
        CALL sp_set_inventory_condition(1, 'Good');
        INSERT INTO Test_Results VALUES (
            25,
            'sp_set_inventory_condition: Valid condition succeeds, invalid condition rejected',
            'SUCCESS',
            IF(v_err_count = 1 AND v_cond = 'Needs Service', 'SUCCESS', 'FAILED'),
            (v_err_count = 1 AND v_cond = 'Needs Service')
        );
    END;

    -- ----------------------------------------------------------------
    -- Test 26: sp_deactivate_user: deactivates active user, idempotent on inactive, rejects non-existent user
    -- ----------------------------------------------------------------
    BEGIN
        DECLARE v_act BOOL;
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_err_count = v_err_count + 1;
        SET v_err_count = 0;
        INSERT INTO Users(user_id, name, phone, email, user_type, app_role, is_active)
        VALUES (98, 'Test Deact', '9999990098', 'testdeact@example.com', 'Casual', 'Casual', TRUE);

        -- Success 1: Deactivate active user
        CALL sp_deactivate_user(98);
        SELECT is_active INTO v_act FROM Users WHERE user_id = 98;

        -- Success 2: Repeat call on already-deactivated user (idempotent no-op)
        CALL sp_deactivate_user(98);

        -- Rejection: Non-existent user
        CALL sp_deactivate_user(99999);

        INSERT INTO Test_Results VALUES (
            26,
            'sp_deactivate_user: Deactivates active user, idempotent on inactive, rejects non-existent user',
            'SUCCESS',
            IF(v_err_count = 1 AND v_act = FALSE, 'SUCCESS', 'FAILED'),
            (v_err_count = 1 AND v_act = FALSE)
        );
        DELETE FROM Users WHERE user_id = 98;
    END;

    -- ----------------------------------------------------------------
    -- Test 27: Cancellation: Pending booking cancelled with 0 ledger rows and 0.00 refund
    -- ----------------------------------------------------------------
    BEGIN
        DECLARE v_res_id INT;
        DECLARE v_ref DECIMAL(10,2) DEFAULT -1.00;
        DECLARE v_status VARCHAR(15);
        DECLARE v_led_cnt INT DEFAULT -1;
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_err_count = 1;
        SET v_err_count = 0;

        INSERT INTO Reservations(user_id, table_id, start_time, end_time, billing_mode, frames_played, total_amount, payment_status)
        VALUES (1, 4, '2026-12-01 10:00:00', '2026-12-01 11:00:00', 'Hourly', 0, 170.00, 'Pending');
        SET v_res_id = LAST_INSERT_ID();

        CALL sp_cancel_booking(v_res_id, v_ref);
        SELECT payment_status INTO v_status FROM Reservations WHERE reservation_id = v_res_id;
        SELECT COUNT(*) INTO v_led_cnt FROM Credit_Ledger WHERE reservation_id = v_res_id;

        INSERT INTO Test_Results VALUES (
            27,
            'Cancellation: Pending booking cancelled with 0 ledger rows and 0.00 refund',
            'SUCCESS',
            IF(v_err_count = 0 AND v_status = 'Cancelled' AND v_ref = 0.00 AND v_led_cnt = 0, 'SUCCESS', 'FAILED'),
            (v_err_count = 0 AND v_status = 'Cancelled' AND v_ref = 0.00 AND v_led_cnt = 0)
        );
        DELETE FROM Reservations WHERE reservation_id = v_res_id;
    END;

    -- ----------------------------------------------------------------
    -- Test 28: Cancellation: Cash-Paid booking cancelled with 0 ledger rows and 0.00 refund
    -- ----------------------------------------------------------------
    BEGIN
        DECLARE v_res_id INT;
        DECLARE v_ref DECIMAL(10,2) DEFAULT -1.00;
        DECLARE v_status VARCHAR(15);
        DECLARE v_led_cnt INT DEFAULT -1;
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_err_count = 1;
        SET v_err_count = 0;

        INSERT INTO Reservations(user_id, table_id, start_time, end_time, billing_mode, frames_played, total_amount, payment_status)
        VALUES (1, 4, '2026-12-01 12:00:00', '2026-12-01 13:00:00', 'Hourly', 0, 170.00, 'Paid');
        SET v_res_id = LAST_INSERT_ID();

        CALL sp_cancel_booking(v_res_id, v_ref);
        SELECT payment_status INTO v_status FROM Reservations WHERE reservation_id = v_res_id;
        SELECT COUNT(*) INTO v_led_cnt FROM Credit_Ledger WHERE reservation_id = v_res_id;

        INSERT INTO Test_Results VALUES (
            28,
            'Cancellation: Cash-Paid booking cancelled with 0 ledger rows and 0.00 refund',
            'SUCCESS',
            IF(v_err_count = 0 AND v_status = 'Cancelled' AND v_ref = 0.00 AND v_led_cnt = 0, 'SUCCESS', 'FAILED'),
            (v_err_count = 0 AND v_status = 'Cancelled' AND v_ref = 0.00 AND v_led_cnt = 0)
        );
        DELETE FROM Reservations WHERE reservation_id = v_res_id;
    END;

    -- ----------------------------------------------------------------
    -- Test 29: Cancellation: OnCredit booking cancelled with Payment refund posted and balance restored
    -- ----------------------------------------------------------------
    BEGIN
        DECLARE v_res_id INT;
        DECLARE v_ref DECIMAL(10,2) DEFAULT -1.00;
        DECLARE v_status VARCHAR(15);
        DECLARE v_bal_before DECIMAL(10,2);
        DECLARE v_bal_after DECIMAL(10,2);
        DECLARE v_refund_rows INT DEFAULT 0;
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_err_count = 1;
        SET v_err_count = 0;

        SELECT COALESCE(SUM(CASE WHEN entry_type IN ('Booking charge','Canteen charge','Fine') THEN amount WHEN entry_type = 'Payment' THEN -amount ELSE 0 END), 0)
          INTO v_bal_before FROM Credit_Ledger WHERE user_id = 1;

        CALL sp_book_table(1, 4, '2026-12-01 14:00:00', '2026-12-01 15:00:00', 'Hourly', 0, 'OnCredit', v_res_id);

        CALL sp_cancel_booking(v_res_id, v_ref);

        SELECT payment_status INTO v_status FROM Reservations WHERE reservation_id = v_res_id;
        SELECT COUNT(*) INTO v_refund_rows FROM Credit_Ledger WHERE reservation_id = v_res_id AND entry_type = 'Payment' AND amount = 170.00;
        SELECT COALESCE(SUM(CASE WHEN entry_type IN ('Booking charge','Canteen charge','Fine') THEN amount WHEN entry_type = 'Payment' THEN -amount ELSE 0 END), 0)
          INTO v_bal_after FROM Credit_Ledger WHERE user_id = 1;

        INSERT INTO Test_Results VALUES (
            29,
            'Cancellation: OnCredit booking cancelled with Payment refund posted and balance restored',
            'SUCCESS',
            IF(v_err_count = 0 AND v_status = 'Cancelled' AND v_ref = 170.00 AND v_refund_rows = 1 AND v_bal_after = v_bal_before, 'SUCCESS', 'FAILED'),
            (v_err_count = 0 AND v_status = 'Cancelled' AND v_ref = 170.00 AND v_refund_rows = 1 AND v_bal_after = v_bal_before)
        );
        DELETE FROM Credit_Ledger WHERE reservation_id = v_res_id;
        DELETE FROM Reservations WHERE reservation_id = v_res_id;
    END;

    -- ----------------------------------------------------------------
    -- Test 30: Cancellation: Repeat cancellation is idempotent and yields no second refund
    -- ----------------------------------------------------------------
    BEGIN
        DECLARE v_res_id INT;
        DECLARE v_ref1 DECIMAL(10,2);
        DECLARE v_ref2 DECIMAL(10,2);
        DECLARE v_pay_count INT;
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_err_count = 1;
        SET v_err_count = 0;

        CALL sp_book_table(1, 4, '2026-12-01 16:00:00', '2026-12-01 17:00:00', 'Hourly', 0, 'OnCredit', v_res_id);
        CALL sp_cancel_booking(v_res_id, v_ref1);
        -- Repeat cancellation call
        CALL sp_cancel_booking(v_res_id, v_ref2);

        SELECT COUNT(*) INTO v_pay_count FROM Credit_Ledger WHERE reservation_id = v_res_id AND entry_type = 'Payment';

        INSERT INTO Test_Results VALUES (
            30,
            'Cancellation: Repeat cancellation is idempotent and yields no second refund',
            'SUCCESS',
            IF(v_err_count = 0 AND v_ref1 = 170.00 AND v_ref2 = 0.00 AND v_pay_count = 1, 'SUCCESS', 'FAILED'),
            (v_err_count = 0 AND v_ref1 = 170.00 AND v_ref2 = 0.00 AND v_pay_count = 1)
        );
        DELETE FROM Credit_Ledger WHERE reservation_id = v_res_id;
        DELETE FROM Reservations WHERE reservation_id = v_res_id;
    END;

    -- ----------------------------------------------------------------
    -- Test 31: Cancellation: Fully paid-down credit booking yields 0.00 refund without overpayment error
    -- ----------------------------------------------------------------
    BEGIN
        DECLARE v_res_id INT;
        DECLARE v_ref DECIMAL(10,2) DEFAULT -1.00;
        DECLARE v_status VARCHAR(15);
        DECLARE v_pay_rows INT DEFAULT 0;
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_err_count = 1;
        SET v_err_count = 0;

        CALL sp_book_table(1, 4, '2026-12-01 18:00:00', '2026-12-01 19:00:00', 'Hourly', 0, 'OnCredit', v_res_id);
        -- Member pays off the charge in full
        INSERT INTO Credit_Ledger(user_id, reservation_id, entry_type, amount, note)
        VALUES (1, NULL, 'Payment', 170.00, 'Test payoff in full');

        -- Cancel booking after full payoff
        CALL sp_cancel_booking(v_res_id, v_ref);
        SELECT payment_status INTO v_status FROM Reservations WHERE reservation_id = v_res_id;
        SELECT COUNT(*) INTO v_pay_rows FROM Credit_Ledger WHERE reservation_id = v_res_id AND entry_type = 'Payment';

        INSERT INTO Test_Results VALUES (
            31,
            'Cancellation: Fully paid-down credit booking yields 0.00 refund without overpayment error',
            'SUCCESS',
            IF(v_err_count = 0 AND v_status = 'Cancelled' AND v_ref = 0.00 AND v_pay_rows = 0, 'SUCCESS', 'FAILED'),
            (v_err_count = 0 AND v_status = 'Cancelled' AND v_ref = 0.00 AND v_pay_rows = 0)
        );
        DELETE FROM Credit_Ledger WHERE user_id = 1 AND note = 'Test payoff in full';
        DELETE FROM Credit_Ledger WHERE reservation_id = v_res_id;
        DELETE FROM Reservations WHERE reservation_id = v_res_id;
    END;

    -- ----------------------------------------------------------------
    -- Test 32: sp_complete_match: Rejects completing cancelled match and rejects NULL ranking points
    -- ----------------------------------------------------------------
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_err_count = v_err_count + 1;
        SET v_err_count = 0;

        INSERT INTO Tournaments(tournament_id, title, game_type, format, start_date, entry_fee, status)
        VALUES (91, 'Test Match Cancellation Tour', 'Snooker', 'Knockout', '2026-12-20', 100.00, 'Registration');
        INSERT INTO Tournament_Registrations(tournament_id, user_id, seed_number, fee_paid)
        VALUES (91, 1, 1, TRUE), (91, 2, 2, TRUE);
        UPDATE Tournaments SET status = 'Ongoing' WHERE tournament_id = 91;
        INSERT INTO Matches(match_id, tournament_id, round_number, player1_id, player2_id, status)
        VALUES (91, 91, 1, 1, 2, 'Cancelled');

        -- Rejection 1: Complete cancelled match
        CALL sp_complete_match(91, '[{"p1":50,"p2":20}]', 30, 10);

        -- Rejection 2: NULL ranking points
        CALL sp_complete_match(91, '[{"p1":50,"p2":20}]', NULL, 10);
        CALL sp_complete_match(91, '[{"p1":50,"p2":20}]', 30, NULL);

        INSERT INTO Test_Results VALUES (
            32,
            'sp_complete_match: Rejects completing cancelled match and rejects NULL ranking points',
            'REJECTED',
            IF(v_err_count = 3, 'REJECTED', 'ACCEPTED'),
            (v_err_count = 3)
        );
        DELETE FROM Matches WHERE match_id = 91;
        DELETE FROM Tournament_Registrations WHERE tournament_id = 91;
        DELETE FROM Tournaments WHERE tournament_id = 91;
    END;

    -- ----------------------------------------------------------------
    -- Test 33: R1 Midnight Boundary: Booking ending exactly at midnight 00:00:00 succeeds
    -- ----------------------------------------------------------------
    BEGIN
        DECLARE v_res_id INT;
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_err_count = 1;
        SET v_err_count = 0;

        INSERT INTO Reservations(user_id, table_id, start_time, end_time, billing_mode, frames_played, total_amount, payment_status)
        VALUES (1, 4, '2026-12-05 22:00:00', '2026-12-06 00:00:00', 'Hourly', 0, 340.00, 'Paid');
        SET v_res_id = LAST_INSERT_ID();

        INSERT INTO Test_Results VALUES (
            33,
            'R1 Midnight Boundary: Booking ending exactly at midnight 00:00:00 succeeds',
            'ACCEPTED',
            IF(v_err_count = 0 AND v_res_id IS NOT NULL, 'ACCEPTED', 'REJECTED'),
            (v_err_count = 0 AND v_res_id IS NOT NULL)
        );
        IF v_res_id IS NOT NULL THEN
            DELETE FROM Reservations WHERE reservation_id = v_res_id;
        END IF;
    END;

    -- ----------------------------------------------------------------
    -- Test 34: 100% Discount: Succeeds on cash AND on credit with zero Credit_Ledger rows
    -- ----------------------------------------------------------------
    BEGIN
        DECLARE v_r_cash INT;
        DECLARE v_r_credit INT;
        DECLARE v_led_rows INT DEFAULT -1;
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_err_count = 1;
        SET v_err_count = 0;

        INSERT INTO Users(user_id, name, phone, email, user_type, app_role, is_active)
        VALUES (99, 'Test 100Pct Member', '9999990099', 'test99@example.com', 'Member', 'Member', TRUE);
        INSERT INTO Club_Member(user_id, membership_no, plan, start_date, end_date, discount_pct, credit_limit)
        VALUES (99, 'CM-TEST-99', 'Annual', '2026-01-01', '2027-12-31', 100.00, 1000.00);

        -- Cash booking at 100% discount
        CALL sp_book_table(99, 4, '2026-12-06 10:00:00', '2026-12-06 11:00:00', 'Hourly', 0, 'Paid', v_r_cash);

        -- Credit booking at 100% discount
        CALL sp_book_table(99, 4, '2026-12-06 12:00:00', '2026-12-06 13:00:00', 'Hourly', 0, 'OnCredit', v_r_credit);

        SELECT COUNT(*) INTO v_led_rows FROM Credit_Ledger WHERE reservation_id = v_r_credit;

        INSERT INTO Test_Results VALUES (
            34,
            '100% Discount: Succeeds on cash AND on credit with zero Credit_Ledger rows',
            'SUCCESS',
            IF(v_err_count = 0 AND v_r_cash IS NOT NULL AND v_r_credit IS NOT NULL AND v_led_rows = 0, 'SUCCESS', 'FAILED'),
            (v_err_count = 0 AND v_r_cash IS NOT NULL AND v_r_credit IS NOT NULL AND v_led_rows = 0)
        );
        DELETE FROM Reservations WHERE reservation_id IN (v_r_cash, v_r_credit);
        DELETE FROM Club_Member WHERE user_id = 99;
        DELETE FROM Users WHERE user_id = 99;
    END;

    -- ----------------------------------------------------------------
    -- Test 35: Lifecycle: Settling past Pending reservation to Paid while table is in Maintenance succeeds
    -- ----------------------------------------------------------------
    BEGIN
        DECLARE v_res_id INT;
        DECLARE v_new_st VARCHAR(10);
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_err_count = 1;
        SET v_err_count = 0;

        UPDATE Game_Tables SET status = 'Available' WHERE table_id = 3;
        INSERT INTO Reservations(user_id, table_id, start_time, end_time, billing_mode, frames_played, total_amount, payment_status)
        VALUES (1, 3, '2026-09-01 10:00:00', '2026-09-01 11:00:00', 'Hourly', 0, 212.50, 'Pending');
        SET v_res_id = LAST_INSERT_ID();
        UPDATE Game_Tables SET status = 'Maintenance' WHERE table_id = 3;

        -- Settle Pending -> Paid while table is in Maintenance
        UPDATE Reservations SET payment_status = 'Paid' WHERE reservation_id = v_res_id;
        SELECT payment_status INTO v_new_st FROM Reservations WHERE reservation_id = v_res_id;

        INSERT INTO Test_Results VALUES (
            35,
            'Lifecycle: Settling past Pending reservation to Paid while table is in Maintenance succeeds',
            'SUCCESS',
            IF(v_err_count = 0 AND v_new_st = 'Paid', 'SUCCESS', 'FAILED'),
            (v_err_count = 0 AND v_new_st = 'Paid')
        );
        DELETE FROM Reservations WHERE reservation_id = v_res_id;
    END;

    -- ----------------------------------------------------------------
    -- Test 36: Lifecycle: Paid reservations cannot transition to Pending or OnCredit
    -- ----------------------------------------------------------------
    BEGIN
        DECLARE v_res_id INT;
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_err_count = v_err_count + 1;
        SET v_err_count = 0;

        INSERT INTO Reservations(user_id, table_id, start_time, end_time, billing_mode, frames_played, total_amount, payment_status)
        VALUES (1, 4, '2026-12-07 10:00:00', '2026-12-07 11:00:00', 'Hourly', 0, 170.00, 'Paid');
        SET v_res_id = LAST_INSERT_ID();

        -- Rejection 1: Paid -> Pending
        UPDATE Reservations SET payment_status = 'Pending' WHERE reservation_id = v_res_id;

        -- Rejection 2: Paid -> OnCredit
        UPDATE Reservations SET payment_status = 'OnCredit' WHERE reservation_id = v_res_id;

        INSERT INTO Test_Results VALUES (
            36,
            'Lifecycle: Paid reservations cannot transition to Pending or OnCredit',
            'REJECTED',
            IF(v_err_count = 2, 'REJECTED', 'ACCEPTED'),
            (v_err_count = 2)
        );
        DELETE FROM Reservations WHERE reservation_id = v_res_id;
    END;

    -- ----------------------------------------------------------------
    -- Test 37: Rule R9: trg_users_bd rejects deletion of users with historical reservations/ledger/matches
    -- ----------------------------------------------------------------
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_err_count = v_err_count + 1;
        SET v_err_count = 0;

        -- Attempt 1: Delete User 1 (Member with reservations, matches, ledger)
        DELETE FROM Users WHERE user_id = 1;

        -- Attempt 2: Delete User 2 (Member with reservations, ledger)
        DELETE FROM Users WHERE user_id = 2;

        -- Attempt 3: Delete User 5 (Casual user with reservation #3)
        DELETE FROM Users WHERE user_id = 5;

        INSERT INTO Test_Results VALUES (
            37,
            'Rule R9: trg_users_bd rejects deletion of users with historical reservations/ledger/matches',
            'REJECTED',
            IF(v_err_count = 3, 'REJECTED', 'ACCEPTED'),
            (v_err_count = 3)
        );
    END;

    -- ----------------------------------------------------------------
    -- Test 38: Privilege: cueclub_api has EXECUTE on procedures, SELECT on views, and table INSERT is denied
    -- ----------------------------------------------------------------
    BEGIN
        DECLARE v_has_exec INT DEFAULT 0;
        DECLARE v_has_view INT DEFAULT 0;
        DECLARE v_has_table_insert INT DEFAULT 0;
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_err_count = 1;
        SET v_err_count = 0;

        -- Verify routine execution privilege in mysql.procs_priv (MySQL 8.0 system grant table)
        SELECT COUNT(*) INTO v_has_exec
          FROM mysql.procs_priv
         WHERE User = 'cueclub_api'
           AND Routine_name = 'sp_book_table'
           AND FIND_IN_SET('Execute', Proc_priv) > 0;

        -- Verify view SELECT privilege in information_schema.TABLE_PRIVILEGES
        SELECT COUNT(*) INTO v_has_view
          FROM information_schema.TABLE_PRIVILEGES
         WHERE GRANTEE LIKE '%cueclub_api%'
           AND TABLE_NAME = 'v_leaderboard'
           AND PRIVILEGE_TYPE = 'SELECT';

        -- Verify direct table INSERT is denied (0 rows granted)
        SELECT COUNT(*) INTO v_has_table_insert
          FROM information_schema.TABLE_PRIVILEGES
         WHERE GRANTEE LIKE '%cueclub_api%'
           AND TABLE_NAME = 'Reservations'
           AND PRIVILEGE_TYPE = 'INSERT';

        INSERT INTO Test_Results VALUES (
            38,
            'Privilege: cueclub_api has EXECUTE on procedures, SELECT on views, and table INSERT is denied',
            'SUCCESS',
            IF(v_err_count = 0 AND v_has_exec >= 1 AND v_has_view >= 1 AND v_has_table_insert = 0, 'SUCCESS', 'FAILED'),
            (v_err_count = 0 AND v_has_exec >= 1 AND v_has_view >= 1 AND v_has_table_insert = 0)
        );
    END;

    -- ----------------------------------------------------------------
    -- Teardown all temporary test fixtures (re-runnability guarantee)
    -- ----------------------------------------------------------------
    DELETE FROM Match_Frames WHERE match_id IN (10, 11, 90, 91);
    DELETE FROM Matches WHERE match_id IN (10, 11, 90, 91);
    DELETE FROM Tournament_Registrations WHERE tournament_id IN (2, 90, 91);
    DELETE FROM Tournaments WHERE tournament_id IN (2, 90, 91);
    DELETE FROM Skill_Assessments WHERE notes LIKE 'Test %';
    DELETE FROM Credit_Ledger WHERE note LIKE 'Test %'
        OR user_id IN (98, 99)
        OR reservation_id IN (SELECT reservation_id FROM Reservations WHERE start_time >= '2026-12-01' OR user_id IN (98, 99));
    DELETE FROM Reservations WHERE start_time >= '2026-12-01' OR user_id IN (98, 99);
    DELETE FROM Club_Member WHERE user_id IN (98, 99);
    DELETE FROM Users WHERE user_id IN (98, 99);
    UPDATE Game_Tables SET status = 'Available' WHERE table_id IN (1, 2, 4, 5);
    UPDATE Game_Tables SET status = 'Maintenance' WHERE table_id = 3;
    UPDATE Inventory_Items SET quantity = 6, condition_status = 'Good' WHERE item_id = 1;
    DELETE FROM Reservations WHERE user_id = 1 AND table_id = 1 AND start_time = '2026-10-09 21:00:00';

    -- Output full test report
    SELECT * FROM Test_Results;

    SELECT COUNT(*) INTO v_failed FROM Test_Results WHERE passed = FALSE;
    IF v_failed > 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'One or more database constraint tests FAILED!';
    END IF;
END$$

DELIMITER ;

CALL sp_run_constraint_tests();
