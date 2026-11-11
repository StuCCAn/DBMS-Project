-- CueClub Manager: triggers (rules that CHECK constraints cannot express across tables)
USE cueclub;
DELIMITER $$

-- ---------------------------------------------------------------
-- Reservations: no double booking, table must be bookable, casual players pay upfront
-- ---------------------------------------------------------------
CREATE PROCEDURE sp_validate_reservation(
    IN p_id INT, IN p_user INT, IN p_table INT,
    IN p_start DATETIME, IN p_end DATETIME, IN p_status VARCHAR(10))
BEGIN
    DECLARE v_table_status VARCHAR(15);

    IF p_status <> 'Cancelled' THEN
        -- Row lock on the table serialises concurrent bookings for the same table.
        SELECT status INTO v_table_status FROM Game_Tables WHERE table_id = p_table FOR UPDATE;
        IF v_table_status IS NULL OR v_table_status <> 'Available' THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Table is not available for booking';
        END IF;

        IF EXISTS (SELECT 1 FROM Reservations r
                   WHERE r.table_id = p_table
                     AND r.payment_status <> 'Cancelled'
                     AND r.reservation_id <> COALESCE(p_id, 0)
                     AND r.start_time < p_end
                     AND r.end_time   > p_start) THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Double booking: table already reserved for an overlapping time range';
        END IF;

        IF EXISTS (SELECT 1 FROM Casual_Player c WHERE c.user_id = p_user)
           AND p_status <> 'Paid' THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Casual players must pay upfront (no credit)';
        END IF;

        IF p_status = 'OnCredit'
           AND NOT EXISTS (SELECT 1 FROM Club_Member m WHERE m.user_id = p_user) THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only club members can book on credit';
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
-- Credit ledger: respect the member's credit limit; no overpayment
-- ---------------------------------------------------------------
CREATE TRIGGER trg_ledger_bi BEFORE INSERT ON Credit_Ledger FOR EACH ROW
BEGIN
    DECLARE v_limit DECIMAL(10,2);
    DECLARE v_balance DECIMAL(10,2);

    SELECT credit_limit INTO v_limit FROM Club_Member WHERE user_id = NEW.user_id FOR UPDATE;

    SELECT COALESCE(SUM(CASE entry_type WHEN 'Charge' THEN amount ELSE -amount END), 0)
      INTO v_balance FROM Credit_Ledger WHERE user_id = NEW.user_id;

    IF NEW.entry_type = 'Charge' AND v_balance + NEW.amount > v_limit THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Credit limit exceeded';
    END IF;
    IF NEW.entry_type = 'Payment' AND NEW.amount > v_balance THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Payment exceeds outstanding balance';
    END IF;
END$$

-- ---------------------------------------------------------------
-- Disjoint specialization: a user is either a club member or a casual player
-- ---------------------------------------------------------------
CREATE TRIGGER trg_member_bi BEFORE INSERT ON Club_Member FOR EACH ROW
BEGIN
    IF EXISTS (SELECT 1 FROM Casual_Player WHERE user_id = NEW.user_id) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'User is already a casual player (disjoint specialization)';
    END IF;
END$$

CREATE TRIGGER trg_casual_bi BEFORE INSERT ON Casual_Player FOR EACH ROW
BEGIN
    IF EXISTS (SELECT 1 FROM Club_Member WHERE user_id = NEW.user_id) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'User is already a club member (disjoint specialization)';
    END IF;
END$$

-- ---------------------------------------------------------------
-- Team membership requires an active club membership
-- ---------------------------------------------------------------
CREATE TRIGGER trg_team_member_bi BEFORE INSERT ON Team_Member FOR EACH ROW
BEGIN
    IF NOT EXISTS (SELECT 1 FROM Club_Member
                   WHERE user_id = NEW.user_id AND CURRENT_DATE BETWEEN start_date AND end_date) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Team members must hold an active club membership';
    END IF;
END$$

CREATE TRIGGER trg_team_member_bu BEFORE UPDATE ON Team_Member FOR EACH ROW
BEGIN
    IF NEW.selection_status IN ('Selected','Probable')
       AND NOT EXISTS (SELECT 1 FROM Club_Member
                       WHERE user_id = NEW.user_id AND CURRENT_DATE BETWEEN start_date AND end_date) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Membership expired: cannot stay selected for the team';
    END IF;
END$$

-- ---------------------------------------------------------------
-- Tournaments: registration only while open; match players must be registered
-- ---------------------------------------------------------------
CREATE TRIGGER trg_registration_bi BEFORE INSERT ON Tournament_Registrations FOR EACH ROW
BEGIN
    IF (SELECT status FROM Tournaments WHERE tournament_id = NEW.tournament_id) <> 'Registration' THEN
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

-- A match cannot feed itself or a match of another tournament (CHECK cannot reference AUTO_INCREMENT columns)
CREATE TRIGGER trg_match_bu BEFORE UPDATE ON Matches FOR EACH ROW
BEGIN
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
-- Coaching: only team members or individual players can be assessed
-- ---------------------------------------------------------------
CREATE TRIGGER trg_assessment_bi BEFORE INSERT ON Skill_Assessments FOR EACH ROW
BEGIN
    IF NOT EXISTS (SELECT 1 FROM Team_Member WHERE user_id = NEW.player_id)
       AND NOT EXISTS (SELECT 1 FROM Individual_Player WHERE user_id = NEW.player_id) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only team members or individual players can be assessed';
    END IF;
END$$

-- ---------------------------------------------------------------
-- Inventory: flag items that fall below their reorder level
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
