-- ============================================================================
-- CueClub Manager: Report-Aligned Triggers (MySQL 8.0.16+)
-- Enforces cross-table integrity, specialization invariants, R1-R9 rules.
-- ============================================================================
USE cueclub;

DROP TRIGGER IF EXISTS trg_users_bu;
DROP TRIGGER IF EXISTS trg_users_bd;
DROP TRIGGER IF EXISTS trg_member_bi;
DROP TRIGGER IF EXISTS trg_member_bu;
DROP TRIGGER IF EXISTS trg_reservation_bi;
DROP TRIGGER IF EXISTS trg_reservation_bu;
DROP TRIGGER IF EXISTS trg_ledger_bi;
DROP TRIGGER IF EXISTS trg_ledger_bu;
DROP TRIGGER IF EXISTS trg_registration_bi;
DROP TRIGGER IF EXISTS trg_registration_bu;
DROP TRIGGER IF EXISTS trg_match_bi;
DROP TRIGGER IF EXISTS trg_match_bu;
DROP TRIGGER IF EXISTS trg_assessment_bi;
DROP TRIGGER IF EXISTS trg_assessment_bu;
DROP TRIGGER IF EXISTS trg_inventory_bi;
DROP TRIGGER IF EXISTS trg_inventory_bu;
DROP PROCEDURE IF EXISTS sp_validate_reservation;
DROP PROCEDURE IF EXISTS sp_validate_club_member;

DELIMITER $$

-- ---------------------------------------------------------------
-- 1. Users: Disjoint Level-1 specialization & Rule R9 historical protection
-- ---------------------------------------------------------------
CREATE TRIGGER trg_users_bu BEFORE UPDATE ON Users FOR EACH ROW
BEGIN
    IF NEW.user_type = 'Casual' AND EXISTS (SELECT 1 FROM Club_Member WHERE user_id = NEW.user_id) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'User has a Club_Member record and cannot be changed to Casual (disjoint specialization)';
    END IF;
END$$

CREATE TRIGGER trg_users_bd BEFORE DELETE ON Users FOR EACH ROW
BEGIN
    IF EXISTS (SELECT 1 FROM Reservations WHERE user_id = OLD.user_id)
       OR EXISTS (SELECT 1 FROM Credit_Ledger WHERE user_id = OLD.user_id)
       OR EXISTS (SELECT 1 FROM Tournament_Registrations WHERE user_id = OLD.user_id)
       OR EXISTS (SELECT 1 FROM Matches WHERE player1_id = OLD.user_id OR player2_id = OLD.user_id OR winner_id = OLD.user_id)
       OR EXISTS (SELECT 1 FROM Skill_Assessments WHERE player_id = OLD.user_id OR assessed_by = OLD.user_id) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Rule R9: Users with historical records must be deactivated (is_active = FALSE), not deleted';
    END IF;
END$$

-- ---------------------------------------------------------------
-- 2. Club_Member: Level-1 user_type = 'Member' & Rule R7 active membership for team roles
-- ---------------------------------------------------------------
CREATE PROCEDURE sp_validate_club_member(
    IN p_user_id INT,
    IN p_start DATE,
    IN p_end DATE,
    IN p_is_team BOOL,
    IN p_selection VARCHAR(15)
)
BEGIN
    DECLARE v_user_type VARCHAR(10);
    DECLARE v_active BOOL;

    SELECT user_type, is_active INTO v_user_type, v_active FROM Users WHERE user_id = p_user_id;
    IF v_user_type IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Referenced user does not exist';
    END IF;
    IF v_active = FALSE THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Rule R9: Deactivated user cannot hold or modify club membership';
    END IF;
    IF v_user_type <> 'Member' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Level-1 specialization: Club_Member row requires Users.user_type = Member';
    END IF;

    -- Rule R7: Competitive team roles require an active, non-expired club membership
    IF p_is_team = TRUE AND COALESCE(p_selection, '') IN ('Selected', 'Probable', 'Reserve') THEN
        IF NOT (CURRENT_DATE BETWEEN p_start AND p_end) THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Rule R7: Team members must hold an active, non-expired club membership';
        END IF;
    END IF;
END$$

CREATE TRIGGER trg_member_bi BEFORE INSERT ON Club_Member FOR EACH ROW
BEGIN
    CALL sp_validate_club_member(NEW.user_id, NEW.start_date, NEW.end_date, NEW.is_team_member, NEW.selection_status);
END$$

CREATE TRIGGER trg_member_bu BEFORE UPDATE ON Club_Member FOR EACH ROW
BEGIN
    CALL sp_validate_club_member(NEW.user_id, NEW.start_date, NEW.end_date, NEW.is_team_member, NEW.selection_status);
END$$

-- ---------------------------------------------------------------
-- 3. Reservations: R1 no double booking / no crossing midnight,
--    R2 casual upfront / active member for OnCredit, R9 active user check
-- ---------------------------------------------------------------
CREATE PROCEDURE sp_validate_reservation(
    IN p_id INT, IN p_user INT, IN p_table INT,
    IN p_start DATETIME, IN p_end DATETIME, IN p_status VARCHAR(10)
)
BEGIN
    DECLARE v_table_status VARCHAR(15);
    DECLARE v_user_type VARCHAR(10);
    DECLARE v_user_active BOOL;

    -- Rule R1: Bookings cannot cross midnight
    IF DATE(p_start) <> DATE(p_end) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Rule R1: Bookings cannot cross midnight';
    END IF;

    IF p_status <> 'Cancelled' THEN
        SELECT user_type, is_active INTO v_user_type, v_user_active FROM Users WHERE user_id = p_user;
        IF v_user_active = FALSE THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Rule R9: Deactivated users cannot make active reservations';
        END IF;

        -- Lock table row to serialize concurrent reservations on the same table
        SELECT status INTO v_table_status FROM Game_Tables WHERE table_id = p_table FOR UPDATE;
        IF v_table_status IS NULL OR v_table_status <> 'Available' THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Table is not available for booking';
        END IF;

        -- Rule R1: Reject overlapping interval on the same table
        IF EXISTS (SELECT 1 FROM Reservations r
                    WHERE r.table_id = p_table
                      AND r.payment_status <> 'Cancelled'
                      AND r.reservation_id <> COALESCE(p_id, 0)
                      AND r.start_time < p_end
                      AND r.end_time   > p_start) THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Double booking: table already reserved for an overlapping time range';
        END IF;

        -- Rule R2: Casual players must pay upfront
        IF v_user_type = 'Casual' AND p_status <> 'Paid' THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Casual players must pay upfront (no credit)';
        END IF;

        -- Rule R2 & Membership Expiry: OnCredit requires an active, non-expired Club_Member
        IF p_status = 'OnCredit' THEN
            IF v_user_type <> 'Member' OR NOT EXISTS (
                SELECT 1 FROM Club_Member m
                 WHERE m.user_id = p_user
                   AND DATE(p_start) BETWEEN m.start_date AND m.end_date
                   AND CURRENT_DATE BETWEEN m.start_date AND m.end_date
            ) THEN
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only active, non-expired club members can book on credit';
            END IF;
        END IF;
    END IF;
END$$

CREATE TRIGGER trg_reservation_bi BEFORE INSERT ON Reservations FOR EACH ROW
BEGIN
    CALL sp_validate_reservation(NULL, NEW.user_id, NEW.table_id, NEW.start_time, NEW.end_time, NEW.payment_status);
END$$

CREATE TRIGGER trg_reservation_bu BEFORE UPDATE ON Reservations FOR EACH ROW
BEGIN
    CALL sp_validate_reservation(OLD.reservation_id, NEW.user_id, NEW.table_id, NEW.start_time, NEW.end_time, NEW.payment_status);
END$$

-- ---------------------------------------------------------------
-- 4. Credit_Ledger: Rule R3 credit limit & overpayment prevention
-- ---------------------------------------------------------------
CREATE TRIGGER trg_ledger_bi BEFORE INSERT ON Credit_Ledger FOR EACH ROW
BEGIN
    DECLARE v_limit DECIMAL(10,2);
    DECLARE v_balance DECIMAL(10,2);
    DECLARE v_active BOOL;

    SELECT is_active INTO v_active FROM Users WHERE user_id = NEW.user_id;
    IF v_active = FALSE AND NEW.entry_type <> 'Payment' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Rule R9: Deactivated member cannot incur new credit charges';
    END IF;

    SELECT credit_limit INTO v_limit FROM Club_Member WHERE user_id = NEW.user_id FOR UPDATE;

    SELECT COALESCE(SUM(
        CASE
            WHEN entry_type IN ('Booking charge','Canteen charge','Fine') THEN amount
            WHEN entry_type = 'Payment' THEN -amount
            ELSE 0
        END
    ), 0) INTO v_balance
    FROM Credit_Ledger WHERE user_id = NEW.user_id;

    IF NEW.entry_type IN ('Booking charge','Canteen charge','Fine') AND (v_balance + NEW.amount > v_limit) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Credit limit exceeded';
    END IF;

    IF NEW.entry_type = 'Payment' AND (NEW.amount > v_balance) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Payment exceeds outstanding balance';
    END IF;
END$$

CREATE TRIGGER trg_ledger_bu BEFORE UPDATE ON Credit_Ledger FOR EACH ROW
BEGIN
    DECLARE v_limit DECIMAL(10,2);
    DECLARE v_balance DECIMAL(10,2);

    SELECT credit_limit INTO v_limit FROM Club_Member WHERE user_id = NEW.user_id FOR UPDATE;

    SELECT COALESCE(SUM(
        CASE
            WHEN entry_type IN ('Booking charge','Canteen charge','Fine') THEN amount
            WHEN entry_type = 'Payment' THEN -amount
            ELSE 0
        END
    ), 0) INTO v_balance
    FROM Credit_Ledger
    WHERE user_id = NEW.user_id AND entry_id <> OLD.entry_id;

    IF NEW.entry_type IN ('Booking charge','Canteen charge','Fine') AND (v_balance + NEW.amount > v_limit) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Credit limit exceeded';
    END IF;

    IF NEW.entry_type = 'Payment' AND (NEW.amount > v_balance) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Payment exceeds outstanding balance';
    END IF;
END$$

-- ---------------------------------------------------------------
-- 5. Tournaments & Matches: Registration status & registered players
-- ---------------------------------------------------------------
CREATE TRIGGER trg_registration_bi BEFORE INSERT ON Tournament_Registrations FOR EACH ROW
BEGIN
    IF (SELECT is_active FROM Users WHERE user_id = NEW.user_id) = FALSE THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Rule R9: Deactivated users cannot register for tournaments';
    END IF;
    IF (SELECT status FROM Tournaments WHERE tournament_id = NEW.tournament_id) <> 'Registration' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Registration is not open for this tournament';
    END IF;
END$$

CREATE TRIGGER trg_registration_bu BEFORE UPDATE ON Tournament_Registrations FOR EACH ROW
BEGIN
    IF NEW.tournament_id <> OLD.tournament_id AND (SELECT status FROM Tournaments WHERE tournament_id = NEW.tournament_id) <> 'Registration' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Registration is not open for this tournament';
    END IF;
END$$

CREATE TRIGGER trg_match_bi BEFORE INSERT ON Matches FOR EACH ROW
BEGIN
    IF NEW.player1_id IS NOT NULL AND NOT EXISTS
        (SELECT 1 FROM Tournament_Registrations WHERE tournament_id = NEW.tournament_id AND user_id = NEW.player1_id) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Player 1 is not registered for this tournament';
    END IF;
    IF NEW.player2_id IS NOT NULL AND NOT EXISTS
        (SELECT 1 FROM Tournament_Registrations WHERE tournament_id = NEW.tournament_id AND user_id = NEW.player2_id) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Player 2 is not registered for this tournament';
    END IF;
    IF NEW.next_match_id IS NOT NULL AND NOT EXISTS
        (SELECT 1 FROM Matches WHERE match_id = NEW.next_match_id AND tournament_id = NEW.tournament_id) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'next_match_id must be a match of the same tournament';
    END IF;
END$$

CREATE TRIGGER trg_match_bu BEFORE UPDATE ON Matches FOR EACH ROW
BEGIN
    IF NEW.player1_id IS NOT NULL AND NOT EXISTS
        (SELECT 1 FROM Tournament_Registrations WHERE tournament_id = NEW.tournament_id AND user_id = NEW.player1_id) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Player 1 is not registered for this tournament';
    END IF;
    IF NEW.player2_id IS NOT NULL AND NOT EXISTS
        (SELECT 1 FROM Tournament_Registrations WHERE tournament_id = NEW.tournament_id AND user_id = NEW.player2_id) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Player 2 is not registered for this tournament';
    END IF;
    IF NEW.next_match_id IS NOT NULL THEN
        IF NEW.next_match_id = NEW.match_id THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A match cannot advance its winner into itself';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM Matches WHERE match_id = NEW.next_match_id AND tournament_id = NEW.tournament_id) THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'next_match_id must be a match of the same tournament';
        END IF;
    END IF;
END$$

-- ---------------------------------------------------------------
-- 6. Coaching: Only team members or individual players can be assessed
-- ---------------------------------------------------------------
CREATE TRIGGER trg_assessment_bi BEFORE INSERT ON Skill_Assessments FOR EACH ROW
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM Club_Member
         WHERE user_id = NEW.player_id
           AND (is_team_member = TRUE OR is_individual_player = TRUE)
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only team members or individual players can be assessed';
    END IF;
END$$

CREATE TRIGGER trg_assessment_bu BEFORE UPDATE ON Skill_Assessments FOR EACH ROW
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM Club_Member
         WHERE user_id = NEW.player_id
           AND (is_team_member = TRUE OR is_individual_player = TRUE)
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only team members or individual players can be assessed';
    END IF;
END$$

-- ---------------------------------------------------------------
-- 7. Inventory: Rule R8 automatic reorder_flag maintenance
-- ---------------------------------------------------------------
CREATE TRIGGER trg_inventory_bi BEFORE INSERT ON Inventory_Items FOR EACH ROW
BEGIN
    SET NEW.reorder_flag = (NEW.quantity < NEW.reorder_level);
END$$

CREATE TRIGGER trg_inventory_bu BEFORE UPDATE ON Inventory_Items FOR EACH ROW
BEGIN
    SET NEW.reorder_flag = (NEW.quantity < NEW.reorder_level);
END$$

DELIMITER ;