-- ============================================================================
-- CueClub Manager: Stored Procedures (MySQL 8.0.16+)
-- Aligned with the 11-relation schema, Users.ranking_points, and Credit_Ledger ENUMs.
-- Backend connects via least-privilege 'cueclub_api' account with zero direct table write access.
-- ============================================================================
USE cueclub;

DROP PROCEDURE IF EXISTS sp_register_member;
DROP PROCEDURE IF EXISTS sp_register_casual;
DROP PROCEDURE IF EXISTS sp_book_table;
DROP PROCEDURE IF EXISTS sp_cancel_booking;
DROP PROCEDURE IF EXISTS sp_complete_match;
DROP PROCEDURE IF EXISTS sp_get_login;
DROP PROCEDURE IF EXISTS sp_record_payment;
DROP PROCEDURE IF EXISTS sp_record_charge;
DROP PROCEDURE IF EXISTS sp_create_tournament;
DROP PROCEDURE IF EXISTS sp_register_tournament_player;
DROP PROCEDURE IF EXISTS sp_set_table_status;
DROP PROCEDURE IF EXISTS sp_record_assessment;
DROP PROCEDURE IF EXISTS sp_update_inventory_stock;
DROP PROCEDURE IF EXISTS sp_set_inventory_condition;
DROP PROCEDURE IF EXISTS sp_deactivate_user;
DROP PROCEDURE IF EXISTS sp_set_password;
DROP PROCEDURE IF EXISTS sp_set_tournament_status;

DELIMITER $$

-- ---------------------------------------------------------------
-- 1. Authentication procedure:
--    Returns user credentials for exact email match.
-- ---------------------------------------------------------------
CREATE PROCEDURE sp_get_login(
    IN p_email VARCHAR(120)
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;

    IF p_email IS NULL OR TRIM(p_email) = '' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Email is required';
    END IF;

    START TRANSACTION;
        SELECT user_id, name, email, app_role, user_type, is_active, password_hash
          FROM Users
         WHERE email = p_email;
    COMMIT;
END$$

-- ---------------------------------------------------------------
-- 2. Registration helpers (enforce total/disjoint Level-1 specialization)
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
-- 3. Table booking procedure:
--    Applies discount ONLY if member has an active (non-expired) membership.
--    Posts 'Booking charge' to Credit_Ledger ONLY when payment_status = 'OnCredit' AND total_amount > 0.
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

        IF p_pay_status = 'OnCredit' AND v_total > 0.00 THEN
            INSERT INTO Credit_Ledger(user_id, reservation_id, entry_type, amount, note)
            VALUES (p_user, p_reservation_id, 'Booking charge', v_total, CONCAT('Table booking #', p_reservation_id));
        END IF;
    COMMIT;
END$$

-- ---------------------------------------------------------------
-- 4. Booking cancellation workflow (Rule R1, R2, Deviation D-02)
--    - Transitions status to 'Cancelled'
--    - For OnCredit bookings: refunds up to outstanding balance
--      (capped at LEAST(total_amount, outstanding_balance)) via positive 'Payment' entry in Credit_Ledger
--    - Returns p_refund_amount (0.00 when cash-paid, pending, or balance already paid down)
--    - Idempotent: repeated calls on a Cancelled booking commit as a no-op with 0.00 refund
-- ---------------------------------------------------------------
CREATE PROCEDURE sp_cancel_booking(
    IN p_reservation_id INT,
    OUT p_refund_amount DECIMAL(10,2)
)
BEGIN
    DECLARE v_user_id INT;
    DECLARE v_status VARCHAR(10);
    DECLARE v_total DECIMAL(10,2);
    DECLARE v_balance DECIMAL(10,2) DEFAULT 0.00;
    DECLARE v_refund DECIMAL(10,2) DEFAULT 0.00;
    DECLARE v_limit DECIMAL(10,2);
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;

    SET p_refund_amount = 0.00;

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
            SET p_refund_amount = 0.00;
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
                SET p_refund_amount = v_refund;
            ELSE
                SET p_refund_amount = 0.00;
            END IF;

            UPDATE Reservations
               SET payment_status = 'Cancelled'
             WHERE reservation_id = p_reservation_id;

            COMMIT;
        END IF;
END$$

-- ---------------------------------------------------------------
-- 5. Match completion workflow (Rule R5 & R6: single atomic transaction)
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

-- ---------------------------------------------------------------
-- 6. Credit Ledger: Record Payment
--    Members only, amount > 0, inserts 'Payment' entry.
-- ---------------------------------------------------------------
CREATE PROCEDURE sp_record_payment(
    IN p_user INT,
    IN p_amount DECIMAL(10,2),
    IN p_note VARCHAR(200),
    OUT p_entry_id INT
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;

    IF p_amount IS NULL OR p_amount <= 0.00 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Payment amount must be greater than zero';
    END IF;

    START TRANSACTION;
        IF NOT EXISTS (SELECT 1 FROM Club_Member WHERE user_id = p_user) THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Payments can only be recorded for registered club members';
        END IF;

        INSERT INTO Credit_Ledger(user_id, reservation_id, entry_type, amount, note)
        VALUES (p_user, NULL, 'Payment', p_amount, p_note);
        SET p_entry_id = LAST_INSERT_ID();
    COMMIT;
END$$

-- ---------------------------------------------------------------
-- 7. Credit Ledger: Record Non-Booking Charge
--    Members only, amount > 0, p_type must be 'Canteen charge' or 'Fine'.
-- ---------------------------------------------------------------
CREATE PROCEDURE sp_record_charge(
    IN p_user INT,
    IN p_type VARCHAR(20),
    IN p_amount DECIMAL(10,2),
    IN p_note VARCHAR(200),
    OUT p_entry_id INT
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;

    IF p_type NOT IN ('Canteen charge', 'Fine') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid charge type: must be Canteen charge or Fine';
    END IF;

    IF p_amount IS NULL OR p_amount <= 0.00 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Charge amount must be greater than zero';
    END IF;

    START TRANSACTION;
        IF NOT EXISTS (SELECT 1 FROM Club_Member WHERE user_id = p_user) THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Charges can only be recorded for registered club members';
        END IF;

        INSERT INTO Credit_Ledger(user_id, reservation_id, entry_type, amount, note)
        VALUES (p_user, NULL, p_type, p_amount, p_note);
        SET p_entry_id = LAST_INSERT_ID();
    COMMIT;
END$$

-- ---------------------------------------------------------------
-- 8. Tournament Management: Create Tournament
--    Validates game_type and format against canonical schema ENUMs.
-- ---------------------------------------------------------------
CREATE PROCEDURE sp_create_tournament(
    IN p_title VARCHAR(120),
    IN p_game VARCHAR(20),
    IN p_format VARCHAR(20),
    IN p_start DATE,
    IN p_fee DECIMAL(8,2),
    OUT p_tournament_id INT
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;

    IF p_title IS NULL OR TRIM(p_title) = '' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Tournament title cannot be empty';
    END IF;

    IF p_game NOT IN ('Snooker', 'Pool', 'Billiards') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid game type: must be Snooker, Pool, or Billiards';
    END IF;

    IF p_format NOT IN ('Knockout', 'League') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid tournament format: must be Knockout or League';
    END IF;

    IF p_fee IS NULL OR p_fee < 0.00 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Entry fee must be non-negative';
    END IF;

    IF p_start IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Tournament start date is required';
    END IF;

    START TRANSACTION;
        INSERT INTO Tournaments(title, game_type, format, start_date, entry_fee, status)
        VALUES (p_title, p_game, p_format, p_start, p_fee, 'Draft');
        SET p_tournament_id = LAST_INSERT_ID();
    COMMIT;
END$$

-- ---------------------------------------------------------------
-- 9. Tournament Management: Register Player
--    Triggers reject closed tournaments and deactivated users (R9).
-- ---------------------------------------------------------------
CREATE PROCEDURE sp_register_tournament_player(
    IN p_tournament_id INT,
    IN p_user_id INT,
    IN p_seed INT,
    IN p_fee_paid BOOL
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;

    START TRANSACTION;
        IF NOT EXISTS (SELECT 1 FROM Tournaments WHERE tournament_id = p_tournament_id) THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Tournament not found';
        END IF;

        IF NOT EXISTS (SELECT 1 FROM Users WHERE user_id = p_user_id) THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'User not found';
        END IF;

        INSERT INTO Tournament_Registrations(tournament_id, user_id, seed_number, fee_paid)
        VALUES (p_tournament_id, p_user_id, p_seed, COALESCE(p_fee_paid, FALSE));
    COMMIT;
END$$

-- ---------------------------------------------------------------
-- 10. Table Management: Set Status
--     Allowed values: 'Available', 'Maintenance', 'Retired'.
-- ---------------------------------------------------------------
CREATE PROCEDURE sp_set_table_status(
    IN p_table_id INT,
    IN p_status VARCHAR(20)
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;

    IF p_status NOT IN ('Available', 'Maintenance', 'Retired') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid table status: must be Available, Maintenance, or Retired';
    END IF;

    START TRANSACTION;
        IF NOT EXISTS (SELECT 1 FROM Game_Tables WHERE table_id = p_table_id) THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Game table not found';
        END IF;

        UPDATE Game_Tables SET status = p_status WHERE table_id = p_table_id;
    COMMIT;
END$$

-- ---------------------------------------------------------------
-- 11. Coaching Assessments: Record Assessment
--     Checks allowed skill areas, rating (1-10), player != coach,
--     and that coach exists as a valid active coach/staff/member.
-- ---------------------------------------------------------------
CREATE PROCEDURE sp_record_assessment(
    IN p_player_id INT,
    IN p_assessed_by INT,
    IN p_skill VARCHAR(30),
    IN p_rating INT,
    IN p_notes VARCHAR(300)
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;

    IF p_skill NOT IN ('Long potting', 'Safety play', 'Break building', 'Positional play', 'Cue ball control', 'Pressure handling') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid skill area: must match allowed assessment categories';
    END IF;

    IF p_rating IS NULL OR p_rating < 1 OR p_rating > 10 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Rating must be between 1 and 10';
    END IF;

    IF p_player_id = p_assessed_by THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Player cannot assess themselves';
    END IF;

    IF p_assessed_by IS NULL OR NOT EXISTS (
        SELECT 1 FROM Users
         WHERE user_id = p_assessed_by
           AND is_active = TRUE
           AND (app_role IN ('Admin', 'Staff') OR user_type = 'Member')
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Assessing coach not found or inactive';
    END IF;

    START TRANSACTION;
        INSERT INTO Skill_Assessments(player_id, assessed_by, skill_area, rating, notes, assessed_on)
        VALUES (p_player_id, p_assessed_by, p_skill, p_rating, p_notes, CURRENT_DATE);
    COMMIT;
END$$

-- ---------------------------------------------------------------
-- 12. Inventory Management: Update Stock
--     Quantity cannot drop below 0; trigger trg_inventory_bu updates reorder_flag (R8).
-- ---------------------------------------------------------------
CREATE PROCEDURE sp_update_inventory_stock(
    IN p_item_id INT,
    IN p_delta INT
)
BEGIN
    DECLARE v_qty INT;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;

    START TRANSACTION;
        SELECT quantity INTO v_qty
          FROM Inventory_Items
         WHERE item_id = p_item_id
           FOR UPDATE;

        IF v_qty IS NULL THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Inventory item not found';
        END IF;

        IF (v_qty + p_delta) < 0 THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Insufficient stock: quantity cannot be negative';
        END IF;

        UPDATE Inventory_Items
           SET quantity = quantity + p_delta
         WHERE item_id = p_item_id;
    COMMIT;
END$$

-- ---------------------------------------------------------------
-- 13. Inventory Management: Set Condition
--     Allowed values: 'Good', 'Needs Service', 'Damaged', 'Retired'.
-- ---------------------------------------------------------------
CREATE PROCEDURE sp_set_inventory_condition(
    IN p_item_id INT,
    IN p_status VARCHAR(30)
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;

    IF p_status NOT IN ('Good', 'Needs Service', 'Damaged', 'Retired') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid condition status: must be Good, Needs Service, Damaged, or Retired';
    END IF;

    START TRANSACTION;
        IF NOT EXISTS (SELECT 1 FROM Inventory_Items WHERE item_id = p_item_id) THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Inventory item not found';
        END IF;

        UPDATE Inventory_Items
           SET condition_status = p_status
         WHERE item_id = p_item_id;
    COMMIT;
END$$

-- ---------------------------------------------------------------
-- 14. User Lifecycle: Deactivate User (Rule R9)
--     Sets is_active = FALSE; idempotent no-op if already inactive.
-- ---------------------------------------------------------------
CREATE PROCEDURE sp_deactivate_user(
    IN p_user_id INT
)
BEGIN
    DECLARE v_active BOOL;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;

    START TRANSACTION;
        SELECT is_active INTO v_active
          FROM Users
         WHERE user_id = p_user_id
           FOR UPDATE;

        IF v_active IS NULL THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'User not found';
        END IF;

        IF v_active = TRUE THEN
            UPDATE Users SET is_active = FALSE WHERE user_id = p_user_id;
        END IF;
    COMMIT;
END$$

-- ---------------------------------------------------------------
-- 15. User Lifecycle / Security: Set Password
--     Updates password_hash for a given user.
-- ---------------------------------------------------------------
CREATE PROCEDURE sp_set_password(
    IN p_user_id INT,
    IN p_password_hash VARCHAR(255)
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;

    IF p_user_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'User ID is required';
    END IF;

    IF p_password_hash IS NULL OR TRIM(p_password_hash) = '' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Password hash cannot be empty';
    END IF;

    START TRANSACTION;
        IF NOT EXISTS (SELECT 1 FROM Users WHERE user_id = p_user_id) THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'User not found';
        END IF;

        UPDATE Users
           SET password_hash = p_password_hash
         WHERE user_id = p_user_id;
    COMMIT;
END$$

-- ---------------------------------------------------------------
-- 16. Tournament Management: Set Tournament Status
--     Allowed values: 'Draft', 'Registration', 'Ongoing', 'Completed', 'Cancelled'.
-- ---------------------------------------------------------------
CREATE PROCEDURE sp_set_tournament_status(
    IN p_tournament_id INT,
    IN p_status VARCHAR(20)
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;

    IF p_status NOT IN ('Draft', 'Registration', 'Ongoing', 'Completed', 'Cancelled') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid tournament status: must be Draft, Registration, Ongoing, Completed, or Cancelled';
    END IF;

    START TRANSACTION;
        IF NOT EXISTS (SELECT 1 FROM Tournaments WHERE tournament_id = p_tournament_id) THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Tournament not found';
        END IF;

        UPDATE Tournaments
           SET status = p_status
         WHERE tournament_id = p_tournament_id;
    COMMIT;
END$$

DELIMITER ;
