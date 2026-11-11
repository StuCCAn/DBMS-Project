-- CueClub Manager: constraint and transaction tests. Run on a freshly seeded database.
USE cueclub;

DROP PROCEDURE IF EXISTS run_constraint_tests;

DELIMITER $$

CREATE PROCEDURE run_constraint_tests()
BEGIN
    DECLARE got_error BOOL DEFAULT FALSE;

    -- Expected failure: overlapping reservations are rejected.
    SET got_error = FALSE;
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET got_error = TRUE;
        INSERT INTO Reservations(user_id, table_id, start_time, end_time, payment_status)
        VALUES (1, 1, '2026-10-09 20:00:00', '2026-10-09 22:00:00', 'Paid');
    END;
    IF NOT got_error THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '1 double booking: expected an error';
    END IF;

    -- Adjacent reservations do not overlap.
    SET got_error = FALSE;
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET got_error = TRUE;
        INSERT INTO Reservations(user_id, table_id, start_time, end_time, payment_status)
        VALUES (1, 1, '2026-10-09 21:00:00', '2026-10-09 22:00:00', 'Paid');
    END;
    IF got_error THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '2 adjacent reservation unexpectedly failed';
    END IF;

    -- Expected failures: payment, credit, hierarchy, and table constraints.
    SET got_error = FALSE;
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET got_error = TRUE;
        INSERT INTO Reservations(user_id, table_id, start_time, end_time, payment_status)
        VALUES (5, 2, '2026-10-12 18:00:00', '2026-10-12 19:00:00', 'OnCredit');
    END;
    IF NOT got_error THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '3 casual credit: expected an error';
    END IF;

    SET got_error = FALSE;
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET got_error = TRUE;
        INSERT INTO Credit_Ledger(user_id, entry_type, amount)
        VALUES (7, 'Charge', 900);
    END;
    IF NOT got_error THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '4 credit limit: expected an error';
    END IF;

    SET got_error = FALSE;
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET got_error = TRUE;
        INSERT INTO Credit_Ledger(user_id, entry_type, amount)
        VALUES (7, 'Payment', 10);
    END;
    IF NOT got_error THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '5 overpay: expected an error';
    END IF;

    SET got_error = FALSE;
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET got_error = TRUE;
        INSERT INTO Credit_Ledger(user_id, entry_type, amount)
        VALUES (5, 'Charge', 10);
    END;
    IF NOT got_error THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '6 casual ledger FK: expected an error';
    END IF;

    SET got_error = FALSE;
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET got_error = TRUE;
        INSERT INTO Casual_Player(user_id) VALUES (1);
    END;
    IF NOT got_error THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '7 disjoint: expected an error';
    END IF;

    SET got_error = FALSE;
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET got_error = TRUE;
        INSERT INTO Reservations(user_id, table_id, start_time, end_time, payment_status)
        VALUES (1, 2, '2026-10-12 19:00:00', '2026-10-12 18:00:00', 'Paid');
    END;
    IF NOT got_error THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '8 end<start: expected an error';
    END IF;

    SET got_error = FALSE;
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET got_error = TRUE;
        INSERT INTO Reservations(user_id, table_id, start_time, end_time, payment_status)
        VALUES (1, 3, '2026-10-12 18:00:00', '2026-10-12 19:00:00', 'Paid');
    END;
    IF NOT got_error THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '9 maintenance table: expected an error';
    END IF;

    SET got_error = FALSE;
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET got_error = TRUE;
        INSERT INTO Skill_Assessments(player_id, assessed_by, skill_area, rating)
        VALUES (7, 1, 'Safety play', 5);
    END;
    IF NOT got_error THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '10 assess non-player: expected an error';
    END IF;

    SET got_error = FALSE;
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET got_error = TRUE;
        INSERT INTO Skill_Assessments(player_id, assessed_by, skill_area, rating)
        VALUES (2, 1, 'Safety play', 11);
    END;
    IF NOT got_error THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '11 rating 11: expected an error';
    END IF;

    -- Match completion must roll back all writes when a frame result is invalid.
    INSERT INTO Tournaments(tournament_id, title, game_type, format, start_date, status)
    VALUES (2, 'T2', 'Pool', 'Knockout', '2026-11-01', 'Registration');
    INSERT INTO Tournament_Registrations(tournament_id, user_id, seed_number)
    VALUES (2, 1, 1), (2, 2, 2);
    UPDATE Tournaments SET status = 'Ongoing' WHERE tournament_id = 2;
    INSERT INTO Matches(match_id, tournament_id, round_number, player1_id, player2_id)
    VALUES (10, 2, 1, 1, 2);

    SET got_error = FALSE;
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET got_error = TRUE;
        CALL sp_complete_match(10, '[{"p1":50,"p2":20},{"p1":40,"p2":40}]', 3, 1);
    END;
    IF NOT got_error THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '12 drawn frame: expected an error';
    END IF;

    IF (SELECT status <> 'Scheduled' OR winner_id IS NOT NULL
        FROM Matches WHERE match_id = 10) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '12.1 match state mutated after rollback';
    END IF;
    IF (SELECT COUNT(*) <> 0 FROM Match_Frames WHERE match_id = 10) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '12.2 frames were inserted despite rollback';
    END IF;
    IF (SELECT COUNT(*) <> 0 FROM Player_Rankings WHERE game_type = 'Pool') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '12.3 rankings were inserted despite rollback';
    END IF;

    SET got_error = FALSE;
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET got_error = TRUE;
        INSERT INTO Matches(tournament_id, round_number, player1_id, player2_id)
        VALUES (2, 1, 1, 3);
    END;
    IF NOT got_error THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '13 unregistered player: expected an error';
    END IF;

    SET got_error = FALSE;
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET got_error = TRUE;
        CALL sp_complete_match(10, '[{"p1":50,"p2":20},{"p1":10,"p2":40}]', 3, 1);
    END;
    IF NOT got_error THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '14 level match: expected an error';
    END IF;

    SET got_error = FALSE;
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET got_error = TRUE;
        CALL sp_complete_match(2, '[{"p1":50,"p2":20}]', 3, 1);
    END;
    IF NOT got_error THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '15 already completed: expected an error';
    END IF;

    INSERT INTO Matches(match_id, tournament_id, round_number, next_match_id)
    VALUES (11, 2, 2, NULL), (12, 2, 1, 11);
    SET got_error = FALSE;
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET got_error = TRUE;
        CALL sp_complete_match(11, '[{"p1":50,"p2":20}]', 3, 1);
    END;
    IF NOT got_error THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '16 undecided players: expected an error';
    END IF;
END$$

DELIMITER ;

CALL run_constraint_tests();
DROP PROCEDURE run_constraint_tests;
