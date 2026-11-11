-- CueClub Manager: negative tests. Run on a freshly seeded database (01 to 05).
USE cueclub;

DROP PROCEDURE IF EXISTS assert_expected_error;
DROP PROCEDURE IF EXISTS assert_expected_success;
DROP PROCEDURE IF EXISTS assert_true;

DELIMITER $$

CREATE PROCEDURE assert_expected_error(IN test_name VARCHAR(64), IN sql_text TEXT)
BEGIN
  DECLARE got_error BOOL DEFAULT FALSE;
  DECLARE fail_message TEXT;
  DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET got_error = TRUE;

  SET @stmt_sql = sql_text;
  PREPARE stmt FROM @stmt_sql;
  EXECUTE stmt;
  DEALLOCATE PREPARE stmt;

  IF NOT got_error THEN
    SET fail_message = CONCAT(test_name, ': expected an error but statement succeeded');
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = fail_message;
  END IF;

  SELECT CONCAT('PASS ', test_name) AS t;
END$$

CREATE PROCEDURE assert_expected_success(IN test_name VARCHAR(64), IN sql_text TEXT)
BEGIN
  DECLARE got_error BOOL DEFAULT FALSE;
  DECLARE err_msg TEXT DEFAULT '';
  DECLARE fail_message TEXT;
  DECLARE CONTINUE HANDLER FOR SQLEXCEPTION
  BEGIN
    SET got_error = TRUE;
    GET DIAGNOSTICS CONDITION 1 err_msg = MESSAGE_TEXT;
  END;

  SET @stmt_sql = sql_text;
  PREPARE stmt FROM @stmt_sql;
  EXECUTE stmt;
  DEALLOCATE PREPARE stmt;

  IF got_error THEN
    SET fail_message = CONCAT(test_name, ': expected success but failed: ', COALESCE(err_msg, 'unknown error'));
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = fail_message;
  END IF;

  SELECT CONCAT('PASS ', test_name) AS t;
END$$

CREATE PROCEDURE assert_true(IN test_name VARCHAR(64), IN cond_value BOOLEAN, IN fail_message VARCHAR(255))
BEGIN
  IF NOT COALESCE(cond_value, FALSE) THEN
    SET @assert_fail_message = CONCAT(test_name, ': ', fail_message);
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = @assert_fail_message;
  END IF;

  SELECT CONCAT('PASS ', test_name) AS t;
END$$

DELIMITER ;

CALL assert_expected_error('1 double booking',
  "INSERT INTO Reservations(user_id,table_id,start_time,end_time,payment_status) VALUES (1,1,'2026-10-09 20:00:00','2026-10-09 22:00:00','Paid')");

CALL assert_expected_success('2 adjacent ok',
  "INSERT INTO Reservations(user_id,table_id,start_time,end_time,payment_status) VALUES (1,1,'2026-10-09 21:00:00','2026-10-09 22:00:00','Paid')");

CALL assert_expected_error('3 casual credit',
  "INSERT INTO Reservations(user_id,table_id,start_time,end_time,payment_status) VALUES (5,2,'2026-10-12 18:00:00','2026-10-12 19:00:00','OnCredit')");

CALL assert_expected_error('4 limit',
  "INSERT INTO Credit_Ledger(user_id,entry_type,amount) VALUES (7,'Charge',900)");

CALL assert_expected_error('5 overpay',
  "INSERT INTO Credit_Ledger(user_id,entry_type,amount) VALUES (7,'Payment',10)");

CALL assert_expected_error('6 casual ledger FK',
  "INSERT INTO Credit_Ledger(user_id,entry_type,amount) VALUES (5,'Charge',10)");

CALL assert_expected_error('7 disjoint',
  "INSERT INTO Casual_Player(user_id) VALUES (1)");

CALL assert_expected_error('8 end<start',
  "INSERT INTO Reservations(user_id,table_id,start_time,end_time,payment_status) VALUES (1,2,'2026-10-12 19:00:00','2026-10-12 18:00:00','Paid')");

CALL assert_expected_error('9 maintenance table',
  "INSERT INTO Reservations(user_id,table_id,start_time,end_time,payment_status) VALUES (1,3,'2026-10-12 18:00:00','2026-10-12 19:00:00','Paid')");

CALL assert_expected_error('10 assess non-player',
  "INSERT INTO Skill_Assessments(player_id,assessed_by,skill_area,rating) VALUES (7,1,'Safety play',5)");

CALL assert_expected_error('11 rating 11',
  "INSERT INTO Skill_Assessments(player_id,assessed_by,skill_area,rating) VALUES (2,1,'Safety play',11)");

INSERT INTO Tournaments(tournament_id,title,game_type,format,start_date,status) VALUES (2,'T2','Pool','Knockout','2026-11-01','Registration');
INSERT INTO Tournament_Registrations(tournament_id,user_id,seed_number) VALUES (2,1,1),(2,2,2);
UPDATE Tournaments SET status='Ongoing' WHERE tournament_id=2;
INSERT INTO Matches(match_id,tournament_id,round_number,player1_id,player2_id) VALUES (10,2,1,1,2);

CALL assert_expected_error('12 drawn frame -> rollback',
  "CALL sp_complete_match(10,'[{\"p1\":50,\"p2\":20},{\"p1\":40,\"p2\":40}]',3,1)");

CALL assert_true('12.1 rollback status',
  (SELECT status = 'Scheduled' AND winner_id IS NULL FROM Matches WHERE match_id = 10),
  'match state mutated after failed completion');

CALL assert_true('12.2 rollback frames',
  (SELECT COUNT(*) = 0 FROM Match_Frames WHERE match_id = 10),
  'frames were inserted despite rollback');

CALL assert_true('12.3 rollback rankings',
  (SELECT COUNT(*) = 0 FROM Player_Rankings WHERE game_type = 'Pool'),
  'rankings were inserted despite rollback');

CALL assert_expected_error('13 unregistered player',
  "INSERT INTO Matches(tournament_id,round_number,player1_id,player2_id) VALUES (2,1,1,3)");

CALL assert_expected_error('14 level match',
  "CALL sp_complete_match(10,'[{\"p1\":50,\"p2\":20},{\"p1\":10,\"p2\":40}]',3,1)");

CALL assert_expected_error('15 already completed',
  "CALL sp_complete_match(2,'[{\"p1\":50,\"p2\":20}]',3,1)");

INSERT INTO Matches(match_id,tournament_id,round_number,next_match_id) VALUES (11,2,2,NULL),(12,2,1,11);
CALL assert_expected_error('16 undecided players',
  "CALL sp_complete_match(11,'[{\"p1\":50,\"p2\":20}]',3,1)");

DROP PROCEDURE assert_expected_error;
DROP PROCEDURE assert_expected_success;
DROP PROCEDURE assert_true;
