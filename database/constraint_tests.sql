-- ============================================================================
-- CueClub Manager: Automated Constraint, Trigger & Transaction Test Harness
-- Safely catches expected errors, prints PASS/FAIL per test, and fails CI if
-- any constraint fails to reject invalid data or fails a valid operation.
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

    -- Clean any existing temporary test fixtures before starting
    DELETE FROM Match_Frames WHERE match_id IN (10, 11);
    DELETE FROM Matches WHERE match_id IN (10, 11);
    DELETE FROM Tournament_Registrations WHERE tournament_id = 2;
    DELETE FROM Tournaments WHERE tournament_id = 2;
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
    -- Test 15: Repeat completion of already-completed match (Fixed precondition check!) -> MUST FAIL
    -- Ensures Match 2 is completed first if running on a fresh seed without demo.sql, then rejects repeat call.
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

    -- Teardown temporary test fixtures so the test harness is completely re-runnable
    DELETE FROM Match_Frames WHERE match_id IN (10, 11);
    DELETE FROM Matches WHERE match_id IN (10, 11);
    DELETE FROM Tournament_Registrations WHERE tournament_id = 2;
    DELETE FROM Tournaments WHERE tournament_id = 2;
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