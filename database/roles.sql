-- ============================================================================
-- CueClub Manager: Least-Privilege API Role & User Provisioning (Phase 4 / Phase 5 Gate)
-- Connects Node.js/Express backend as least-privilege 'cueclub_api' user.
-- Grants: EXECUTE on cueclub stored procedures, SELECT on cueclub views.
-- Denies: Direct INSERT / UPDATE / DELETE on raw tables.
-- ============================================================================
USE cueclub;

CREATE USER IF NOT EXISTS 'cueclub_api'@'%' IDENTIFIED BY 'cueclub_api_pw';
ALTER USER 'cueclub_api'@'%' IDENTIFIED BY 'cueclub_api_pw';

-- Revoke all table-level modifications
REVOKE ALL PRIVILEGES, GRANT OPTION FROM 'cueclub_api'@'%';

-- Grant SELECT only on the approved analytical views
GRANT SELECT ON cueclub.v_member_balance TO 'cueclub_api'@'%';
GRANT SELECT ON cueclub.v_player_results TO 'cueclub_api'@'%';
GRANT SELECT ON cueclub.v_leaderboard TO 'cueclub_api'@'%';
GRANT SELECT ON cueclub.v_win_streaks TO 'cueclub_api'@'%';
GRANT SELECT ON cueclub.v_head_to_head TO 'cueclub_api'@'%';
GRANT SELECT ON cueclub.v_bracket_tree TO 'cueclub_api'@'%';
GRANT SELECT ON cueclub.v_table_utilisation TO 'cueclub_api'@'%';
GRANT SELECT ON cueclub.v_reorder_alerts TO 'cueclub_api'@'%';
GRANT SELECT ON cueclub.v_player_weaknesses TO 'cueclub_api'@'%';
GRANT SELECT ON cueclub.v_specialization_anomalies TO 'cueclub_api'@'%';

-- Grant EXECUTE on stored procedures
GRANT EXECUTE ON PROCEDURE cueclub.sp_register_member TO 'cueclub_api'@'%';
GRANT EXECUTE ON PROCEDURE cueclub.sp_register_casual TO 'cueclub_api'@'%';
GRANT EXECUTE ON PROCEDURE cueclub.sp_book_table TO 'cueclub_api'@'%';
GRANT EXECUTE ON PROCEDURE cueclub.sp_cancel_booking TO 'cueclub_api'@'%';
GRANT EXECUTE ON PROCEDURE cueclub.sp_complete_match TO 'cueclub_api'@'%';

FLUSH PRIVILEGES;
