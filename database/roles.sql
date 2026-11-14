-- ============================================================================
-- CueClub Manager: Least-Privilege API Role & User Provisioning (Phase 4 / Phase 5 Gate)
-- Connects Node.js/Express backend as least-privilege 'cueclub_api' user.
-- Grants: EXECUTE on cueclub stored procedures, SELECT on cueclub views.
-- Denies: Direct INSERT / UPDATE / DELETE on raw tables.
-- ============================================================================
--
-- Security & Deployment Note:
-- The database password for 'cueclub_api' must not be hardcoded in production deployments.
-- In production, the password is supplied via the environment variable CUECLUB_DB_PASSWORD.
-- For local testing and automated CI workflows, a fallback throwaway credential ('cueclub_api_pw')
-- is used when the variable is not injected.
--
-- Host Network Restriction Note:
-- The host wildcard '%' is required because containerized Node.js API services, Docker Compose
-- networks, and GitHub Actions CI runner workflows connect to MySQL over a TCP/IP bridge interface
-- (e.g., 127.0.0.1 or container gateway IP) rather than a local Unix domain socket ('localhost').
-- In a dedicated bare-metal production environment on a single machine, this can be restricted to 'localhost'.
--
-- Specialization & Role Consistency Architecture Note:
-- The role consistency check requiring Admin and Staff users to have an associated Club_Member
-- record is deliberately checked on UPDATE only (in trg_users_bu), NOT on INSERT (in trg_users_bi).
-- This design is necessary because the parent Users row must be inserted first to generate
-- the auto-increment user_id (LAST_INSERT_ID()) before its dependent Club_Member row can be created
-- within the registration transaction (sp_register_member).
-- ============================================================================
USE cueclub;

CREATE USER IF NOT EXISTS 'cueclub_api'@'%' IDENTIFIED BY 'cueclub_api_pw';

-- Support dynamic password override if @cueclub_db_password is set via session/CLI
SET @api_pwd = COALESCE(NULLIF(@cueclub_db_password, ''), 'cueclub_api_pw');
SET @alter_user_sql = CONCAT('ALTER USER \'cueclub_api\'@\'%\' IDENTIFIED BY \'', @api_pwd, '\';');
PREPARE stmt_alter_user FROM @alter_user_sql;
EXECUTE stmt_alter_user;
DEALLOCATE PREPARE stmt_alter_user;

-- ----------------------------------------------------------------------------
-- 1. Grant SELECT on all 17 Read Views (10 Analytical + 7 Extended Operational)
-- ----------------------------------------------------------------------------
-- Analytical Views (Phase 3)
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

-- Extended Operational Read Views (Phase 4)
GRANT SELECT ON cueclub.v_reservations_all TO 'cueclub_api'@'%';
GRANT SELECT ON cueclub.v_tables_status TO 'cueclub_api'@'%';
GRANT SELECT ON cueclub.v_credit_ledger_entries TO 'cueclub_api'@'%';
GRANT SELECT ON cueclub.v_tournaments_list TO 'cueclub_api'@'%';
GRANT SELECT ON cueclub.v_tournament_registrations TO 'cueclub_api'@'%';
GRANT SELECT ON cueclub.v_inventory_catalog TO 'cueclub_api'@'%';
GRANT SELECT ON cueclub.v_coaching_history TO 'cueclub_api'@'%';

-- ----------------------------------------------------------------------------
-- 2. Grant EXECUTE on all 17 Stored Procedures (Authentication + Writes)
-- ----------------------------------------------------------------------------
GRANT EXECUTE ON PROCEDURE cueclub.sp_get_login TO 'cueclub_api'@'%';
GRANT EXECUTE ON PROCEDURE cueclub.sp_set_password TO 'cueclub_api'@'%';
GRANT EXECUTE ON PROCEDURE cueclub.sp_register_member TO 'cueclub_api'@'%';
GRANT EXECUTE ON PROCEDURE cueclub.sp_register_casual TO 'cueclub_api'@'%';
GRANT EXECUTE ON PROCEDURE cueclub.sp_book_table TO 'cueclub_api'@'%';
GRANT EXECUTE ON PROCEDURE cueclub.sp_cancel_booking TO 'cueclub_api'@'%';
GRANT EXECUTE ON PROCEDURE cueclub.sp_complete_match TO 'cueclub_api'@'%';
GRANT EXECUTE ON PROCEDURE cueclub.sp_record_payment TO 'cueclub_api'@'%';
GRANT EXECUTE ON PROCEDURE cueclub.sp_record_charge TO 'cueclub_api'@'%';
GRANT EXECUTE ON PROCEDURE cueclub.sp_create_tournament TO 'cueclub_api'@'%';
GRANT EXECUTE ON PROCEDURE cueclub.sp_set_tournament_status TO 'cueclub_api'@'%';
GRANT EXECUTE ON PROCEDURE cueclub.sp_register_tournament_player TO 'cueclub_api'@'%';
GRANT EXECUTE ON PROCEDURE cueclub.sp_set_table_status TO 'cueclub_api'@'%';
GRANT EXECUTE ON PROCEDURE cueclub.sp_record_assessment TO 'cueclub_api'@'%';
GRANT EXECUTE ON PROCEDURE cueclub.sp_update_inventory_stock TO 'cueclub_api'@'%';
GRANT EXECUTE ON PROCEDURE cueclub.sp_set_inventory_condition TO 'cueclub_api'@'%';
GRANT EXECUTE ON PROCEDURE cueclub.sp_deactivate_user TO 'cueclub_api'@'%';

FLUSH PRIVILEGES;
