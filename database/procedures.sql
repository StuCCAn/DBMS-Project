-- ============================================================================
-- CueClub Manager: Stored Procedures (MySQL 8.0.16+)
-- Aligned with the 11-relation schema, Users.ranking_points, and Credit_Ledger ENUMs.
-- ============================================================================
USE cueclub;

DROP PROCEDURE IF EXISTS sp_register_member;
DROP PROCEDURE IF EXISTS sp_register_casual;
DROP PROCEDURE IF EXISTS sp_book_table;
DROP PROCEDURE IF EXISTS sp_cancel_booking;
DROP PROCEDURE IF EXISTS sp_complete_match;

DELIMITER $$

-- ---------------------------------------------------------------
-- 1. Registration helpers (enforce total/disjoint Level-1 specialization)
-- ---------------------------------------------------------------
CREATE PROCEDURE sp_register_member(
    IN p_name VARCHAR(100), IN p_phone VARCHAR(15), IN p_email VARCHAR(120),
    IN p_membership_no VARCHAR(20), IN p_plan VARCHAR(10),
    IN p_start DATE, IN p_end DATE, IN p_discount DECIMAL(5,2), IN p_credit_limit DECIMAL(10,2),
    OUT p_user_id INT
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
    START TRANSACTION;
        INSERT INTO Users(name, phone, email, user_type, app_role)
        VALUES (p_name, p_phone, p_email, 'Member', 'Member');
        SET p_user_id = LAST_INSERT_ID();

        INSERT INTO Club_Member(user_id, membership_no, plan, start_date, end_date, discount_pct, credit_limit)
        VALUES (p_user_id, p_membership_no, p_plan, p_start, p_end, p_discount, p_credit_limit);
    COMMIT;
END$$

CREATE PROCEDURE sp_register_casual(
    IN p_name VARCHAR(100), IN p_phone VARCHAR(15), IN p_email VARCHAR(120),
    OUT p_user_id INT
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
    START TRANSACTION;
        INSERT INTO Users(name, phone, email, user_type, app_role)
        VALUES (p_name, p_phone, p_email, 'Casual', 'Casual');
        SET p_user_id = LAST_INSERT_ID();
    COMMIT;
END$$

-- ---------------------------------------------------------------
-- 2. Table booking procedure:
--    Applies discount ONLY if member has an active (non-expired) membership.
--    Posts 'Booking charge' to Credit_Ledger when payment_status = 'OnCredit'.
-- ---------------------------------------------------------------
CREATE PROCEDURE sp_book_table(
    IN p_user INT, IN p_table INT, IN p_start DATETIME, IN p_end DATETIME,
    IN p_mode VARCHAR(10), IN p_frames INT, IN p_pay_status VARCHAR(10),
    OUT p_reservation_id INT
)
BEGIN
    DECLARE v_hourly DECIMAL(8,2);
    DECLARE v_frame  DECIMAL(8,2);
    DECLARE v_disc   DECIMAL(5,2) DEFAULT 0.00;
    DECLARE v_total  DECIMAL(10,2);
    DECLARE v_limit  DECIMAL(10,2);
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;

    START TRANSACTION;
        -- Credit-limit race mitigation: lock Club_Member row early if booking on credit
        IF p_pay_status = 'OnCredit' THEN
            SELECT credit_limit INTO v_limit
              FROM Club_Member
             WHERE user_id = p_user
               FOR UPDATE;
        END IF;

        SELECT hourly_rate, per_frame_rate INTO v_hourly, v_frame
          FROM Game_Tables WHERE table_id = p_table;

        -- Discount applies only when membership is active on both booking date and today
        SELECT COALESCE(MAX(discount_pct), 0.00) INTO v_disc
          FROM Club_Member
         WHERE user_id = p_user
           AND DATE(p_start) BETWEEN start_date AND end_date
           AND CURRENT_DATE BETWEEN start_date AND end_date;

        IF p_mode = 'Hourly' THEN
            SET v_total = ROUND(v_hourly * TIMESTAMPDIFF(MINUTE, p_start, p_end) / 60 * (1 - v_disc / 100), 2);
        ELSE
            IF COALESCE(p_frames, 0) <= 0 THEN
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'PerFrame billing requires frames_played > 0';
            END IF;
            SET v_total = ROUND(v_frame * p_frames * (1 - v_disc / 100), 2);
        END IF;

        INSERT INTO Reservations(user_id, table_id, start_time, end_time, billing_mode, frames_played, total_amount, payment_status)
        VALUES (p_user, p_table, p_start, p_end, p_mode, COALESCE(p_frames, 0), v_total, p_pay_status);
        SET p_reservation_id = LAST_INSERT_ID();

        IF p_pay_status = 'OnCredit' THEN
            INSERT INTO Credit_Ledger(user_id, reservation_id, entry_type, amount, note)
            VALUES (p_user, p_reservation_id, 'Booking charge', v_total, CONCAT('Table booking #', p_reservation_id));
        END IF;
    COMMIT;
END$$

-- ---------------------------------------------------------------
-- 3. Booking cancellation workflow (Rule R1, R2, Deviation D-02)
--    - Transitions status to 'Cancelled'
--    - For OnCredit bookings: refunds up to outstanding balance
--      (capped at LEAST(total_amount, outstanding_balance)) via positive 'Payment' entry in Credit_Ledger
--    - Cash-paid or pending bookings transition to 'Cancelled' with 0 ledger entries
--    - Idempotent: repeated calls on a Cancelled booking commit as a no-op
-- ---------------------------------------------------------------
CREATE PROCEDURE sp_cancel_booking(
    IN p_reservation_id INT
)
BEGIN
    DECLARE v_user_id INT;
    DECLARE v_status VARCHAR(10);
    DECLARE v_total DECIMAL(10,2);
    DECLARE v_balance DECIMAL(10,2) DEFAULT 0.00;
    DECLARE v_refund DECIMAL(10,2) DEFAULT 0.00;
    DECLARE v_limit DECIMAL(10,2);
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;

    START TRANSACTION;
        SELECT user_id, payment_status, total_amount
          INTO v_user_id, v_status, v_total
          FROM Reservations
         WHERE reservation_id = p_reservation_id
           FOR UPDATE;

        IF v_user_id IS NULL THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Reservation not found';
        END IF;

        IF v_status = 'Cancelled' THEN
            -- Idempotent: already cancelled
            COMMIT;
        ELSE
            -- Deviation D-02: Credit refund policy
            IF v_status = 'OnCredit' THEN
                SELECT credit_limit INTO v_limit
                  FROM Club_Member
                 WHERE user_id = v_user_id
                   FOR UPDATE;

                SELECT COALESCE(SUM(
                    CASE
                        WHEN entry_type IN ('Booking charge','Canteen charge','Fine') THEN amount
                        WHEN entry_type = 'Payment' THEN -amount
                        ELSE 0.00
                    END
                ), 0.00) INTO v_balance
                FROM Credit_Ledger
                WHERE user_id = v_user_id;

                SET v_refund = LEAST(v_total, GREATEST(v_balance, 0.00));
                IF v_refund > 0.00 THEN
                    INSERT INTO Credit_Ledger(user_id, reservation_id, entry_type, amount, note)
                    VALUES (v_user_id, p_reservation_id, 'Payment', v_refund, CONCAT('Booking cancellation refund: #', p_reservation_id));
                END IF;
            END IF;

            UPDATE Reservations
               SET payment_status = 'Cancelled'
             WHERE reservation_id = p_reservation_id;

            COMMIT;
        END IF;
END$$

-- ---------------------------------------------------------------
-- 4. Match completion workflow (Rule R5 & R6: single atomic transaction)
--    1. Validate JSON, non-negative ranking points & playable match state
--    2. Insert frame rows into Match_Frames
--    3. Derive match winner (best-of-N, no level matches)
--    4. Advance winner to next_match_id bracket slot using deterministic feeder rule
--    5. Update Users.ranking_points for winner and loser
--    6. Mark Tournament as Completed when final match finishes
-- ---------------------------------------------------------------
CREATE PROCEDURE sp_complete_match(
    IN p_match_id INT, IN p_frames JSON, IN p_win_points INT, IN p_loss_points INT
)
BEGIN
    DECLARE v_tournament INT;
    DECLARE v_p1 INT;
    DECLARE v_p2 INT;
    DECLARE v_status VARCHAR(15);
    DECLARE v_next INT;
    DECLARE v_p1_frames INT;
    DECLARE v_p2_frames INT;
    DECLARE v_winner INT;
    DECLARE v_loser INT;
    DECLARE v_slot INT;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;

    IF p_win_points IS NULL OR p_loss_points IS NULL OR p_win_points < 0 OR p_loss_points < 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Ranking point increments must be non-negative';
    END IF;
    IF p_frames IS NULL OR JSON_VALID(p_frames) = 0 OR JSON_TYPE(p_frames) <> 'ARRAY' OR JSON_LENGTH(p_frames) = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid or empty frames JSON array';
    END IF;

    START TRANSACTION;

    SELECT m.tournament_id, m.player1_id, m.player2_id, m.status, m.next_match_id
      INTO v_tournament, v_p1, v_p2, v_status, v_next
      FROM Matches m
     WHERE m.match_id = p_match_id
       FOR UPDATE;

    IF v_status IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Match not found';
    END IF;
    IF v_status = 'Completed' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Match is already completed';
    END IF;
    IF v_status NOT IN ('Scheduled', 'InProgress') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Match is not in a playable state (must be Scheduled or InProgress)';
    END IF;
    IF v_p1 IS NULL OR v_p2 IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Players for this match are not decided yet';
    END IF;

    -- 1. Insert frame scores
    INSERT INTO Match_Frames(match_id, frame_number, p1_score, p2_score, highest_break)
    SELECT p_match_id, jt.frame_no, jt.p1, jt.p2, jt.brk
      FROM JSON_TABLE(p_frames, '$[*]' COLUMNS (
               frame_no FOR ORDINALITY,
               p1  INT PATH '$.p1' ERROR ON EMPTY ERROR ON ERROR,
               p2  INT PATH '$.p2' ERROR ON EMPTY ERROR ON ERROR,
               brk INT PATH '$.break' DEFAULT '0' ON EMPTY)) AS jt;

    -- 2. Winner = player who won more frames
    SELECT COALESCE(SUM(p1_score > p2_score), 0), COALESCE(SUM(p2_score > p1_score), 0)
      INTO v_p1_frames, v_p2_frames
      FROM Match_Frames WHERE match_id = p_match_id;

    IF v_p1_frames + v_p2_frames = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No frame scores supplied';
    END IF;
    IF v_p1_frames = v_p2_frames THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A match cannot finish level on frames';
    END IF;

    IF v_p1_frames > v_p2_frames THEN
        SET v_winner = v_p1, v_loser = v_p2;
    ELSE
        SET v_winner = v_p2, v_loser = v_p1;
    END IF;

    UPDATE Matches SET winner_id = v_winner, status = 'Completed' WHERE match_id = p_match_id;

    -- 3. Advance winner to next round match (deterministic: lowest feeder match_id feeds player1)
    IF v_next IS NOT NULL THEN
        SELECT MIN(match_id) INTO v_slot
          FROM Matches
         WHERE next_match_id = v_next;

        IF p_match_id = v_slot THEN
            UPDATE Matches SET player1_id = v_winner WHERE match_id = v_next;
        ELSE
            UPDATE Matches SET player2_id = v_winner WHERE match_id = v_next;
        END IF;
    END IF;

    -- 4. Update materialized Users.ranking_points (Report Section 6)
    UPDATE Users SET ranking_points = ranking_points + p_win_points  WHERE user_id = v_winner;
    UPDATE Users SET ranking_points = ranking_points + p_loss_points WHERE user_id = v_loser;

    -- 5. Close tournament if all matches are completed/cancelled
    IF NOT EXISTS (SELECT 1 FROM Matches WHERE tournament_id = v_tournament AND status NOT IN ('Completed','Cancelled')) THEN
        UPDATE Tournaments SET status = 'Completed' WHERE tournament_id = v_tournament;
    END IF;

    COMMIT;
END$$

DELIMITER ;