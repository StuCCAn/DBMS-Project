-- ============================================================================
-- CueClub Manager: Production-Safe Report-Aligned Schema (MySQL 8.0.16+)
-- Run order: schema.sql, triggers.sql, procedures.sql, views.sql, seed.sql
-- Strictly implements the 11 relations in Section 4 (Table 3) of the report.
-- ============================================================================

CREATE DATABASE IF NOT EXISTS cueclub CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE cueclub;

-- ------------------------------------------------------------------
-- 1. Users (Supertype)
-- Level 1 EER Specialization: Disjoint & Total via user_type ('Member', 'Casual')
-- Casual_Player has no specialized attributes in Table 3 and requires no separate table.
-- Includes Rule R9 (is_active) and Approved Deviation D-01 (app_role, password_hash).
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Users (
    user_id        INT AUTO_INCREMENT PRIMARY KEY,
    name           VARCHAR(100) NOT NULL,
    phone          VARCHAR(15)  NOT NULL,
    email          VARCHAR(120) NOT NULL,
    joined_on      DATE         NOT NULL DEFAULT (CURRENT_DATE),
    user_type      ENUM('Member','Casual') NOT NULL DEFAULT 'Casual',
    ranking_points INT          NOT NULL DEFAULT 0,
    is_active      BOOL         NOT NULL DEFAULT TRUE,
    app_role       ENUM('Admin','Staff','Member','Casual') NOT NULL DEFAULT 'Casual',
    password_hash  VARCHAR(255) NULL,
    CONSTRAINT uq_users_phone UNIQUE (phone),
    CONSTRAINT uq_users_email UNIQUE (email),
    CONSTRAINT ck_users_phone CHECK (phone REGEXP '^[0-9+]{7,15}$'),
    CONSTRAINT ck_users_ranking_points CHECK (ranking_points >= 0)
) ENGINE=InnoDB;

-- ------------------------------------------------------------------
-- 2. Club_Member (Subtype of Users; PK = FK)
-- Level 2 EER Specialization: Overlapping & Partial via boolean flags
-- (is_team_member, is_individual_player, is_enthusiast) guarding nullable attributes.
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Club_Member (
    user_id              INT PRIMARY KEY,
    membership_no        VARCHAR(20)   NOT NULL,
    plan                 ENUM('Monthly','Quarterly','Annual') NOT NULL,
    start_date           DATE          NOT NULL,
    end_date             DATE          NOT NULL,
    discount_pct         DECIMAL(5,2)  NOT NULL DEFAULT 0.00,
    credit_limit         DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    is_team_member       BOOL          NOT NULL DEFAULT FALSE,
    team_role            ENUM('Captain','Vice-Captain','Player') NULL,
    selection_status     ENUM('Probable','Selected','Reserve','Dropped') NULL,
    handedness           ENUM('Right','Left') NULL,
    is_individual_player BOOL          NOT NULL DEFAULT FALSE,
    handicap             INT           NULL,
    preferred_game       ENUM('Snooker','Pool','Billiards') NULL,
    is_enthusiast        BOOL          NOT NULL DEFAULT FALSE,
    interest_type        ENUM('Supporter','Aspiring Player','Volunteer') NULL,
    wants_trial          BOOL          NULL,
    CONSTRAINT uq_member_no UNIQUE (membership_no),
    CONSTRAINT fk_member_user FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE RESTRICT,
    CONSTRAINT ck_member_dates CHECK (end_date > start_date),
    CONSTRAINT ck_member_discount CHECK (discount_pct BETWEEN 0 AND 100),
    CONSTRAINT ck_member_credit CHECK (credit_limit >= 0),
    CONSTRAINT ck_cm_team_iff CHECK (
        (is_team_member = TRUE AND team_role IS NOT NULL AND selection_status IS NOT NULL AND handedness IS NOT NULL)
        OR
        (is_team_member = FALSE AND team_role IS NULL AND selection_status IS NULL AND handedness IS NULL)
    ),
    CONSTRAINT ck_cm_individual_iff CHECK (
        (is_individual_player = TRUE AND handicap IS NOT NULL AND preferred_game IS NOT NULL)
        OR
        (is_individual_player = FALSE AND handicap IS NULL AND preferred_game IS NULL)
    ),
    CONSTRAINT ck_cm_enthusiast_iff CHECK (
        (is_enthusiast = TRUE AND interest_type IS NOT NULL AND wants_trial IS NOT NULL)
        OR
        (is_enthusiast = FALSE AND interest_type IS NULL AND wants_trial IS NULL)
    )
) ENGINE=InnoDB;

-- ------------------------------------------------------------------
-- 3. Game_Tables
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Game_Tables (
    table_id       INT AUTO_INCREMENT PRIMARY KEY,
    name           VARCHAR(50)  NOT NULL,
    game_type      ENUM('Snooker','Pool','Billiards') NOT NULL,
    hourly_rate    DECIMAL(8,2) NOT NULL,
    per_frame_rate DECIMAL(8,2) NOT NULL,
    status         ENUM('Available','Maintenance','Retired') NOT NULL DEFAULT 'Available',
    CONSTRAINT uq_table_name UNIQUE (name),
    CONSTRAINT ck_table_hourly CHECK (hourly_rate > 0),
    CONSTRAINT ck_table_frame  CHECK (per_frame_rate > 0)
) ENGINE=InnoDB;

-- ------------------------------------------------------------------
-- 4. Reservations
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Reservations (
    reservation_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id        INT NOT NULL,
    table_id       INT NOT NULL,
    start_time     DATETIME NOT NULL,
    end_time       DATETIME NOT NULL,
    billing_mode   ENUM('Hourly','PerFrame') NOT NULL DEFAULT 'Hourly',
    frames_played  INT NOT NULL DEFAULT 0,
    total_amount   DECIMAL(10,2) NOT NULL,
    payment_status ENUM('Pending','Paid','OnCredit','Cancelled') NOT NULL DEFAULT 'Pending',
    CONSTRAINT fk_res_user  FOREIGN KEY (user_id)  REFERENCES Users(user_id)       ON DELETE RESTRICT,
    CONSTRAINT fk_res_table FOREIGN KEY (table_id) REFERENCES Game_Tables(table_id) ON DELETE RESTRICT,
    CONSTRAINT ck_res_window CHECK (end_time > start_time),
    CONSTRAINT ck_res_no_midnight CHECK (
        DATE(start_time) = DATE(end_time)
        OR (DATEDIFF(end_time, start_time) = 1 AND TIME(end_time) = '00:00:00')
    ),
    CONSTRAINT ck_res_frames CHECK (frames_played >= 0),
    CONSTRAINT ck_res_total  CHECK (total_amount >= 0),
    INDEX idx_res_table_time (table_id, start_time, end_time)
) ENGINE=InnoDB;

-- ------------------------------------------------------------------
-- 5. Credit_Ledger (Udhar)
-- Only club members can hold credit, so FK targets Club_Member (Rule R2).
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Credit_Ledger (
    entry_id       INT AUTO_INCREMENT PRIMARY KEY,
    user_id        INT NOT NULL,
    reservation_id INT NULL,
    entry_type     ENUM('Booking charge','Canteen charge','Fine','Payment') NOT NULL,
    amount         DECIMAL(10,2) NOT NULL,
    entry_date     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    note           VARCHAR(200) NULL,
    CONSTRAINT fk_led_member FOREIGN KEY (user_id)        REFERENCES Club_Member(user_id)      ON DELETE RESTRICT,
    CONSTRAINT fk_led_res    FOREIGN KEY (reservation_id) REFERENCES Reservations(reservation_id) ON DELETE RESTRICT,
    CONSTRAINT ck_led_amount CHECK (amount > 0),
    INDEX idx_led_user (user_id, entry_date)
) ENGINE=InnoDB;

-- ------------------------------------------------------------------
-- 6. Tournaments
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Tournaments (
    tournament_id INT AUTO_INCREMENT PRIMARY KEY,
    title         VARCHAR(120) NOT NULL,
    game_type     ENUM('Snooker','Pool','Billiards') NOT NULL,
    format        ENUM('Knockout','League') NOT NULL DEFAULT 'Knockout',
    start_date    DATE NOT NULL,
    entry_fee     DECIMAL(8,2) NOT NULL DEFAULT 200.00,
    status        ENUM('Draft','Registration','Ongoing','Completed','Cancelled') NOT NULL DEFAULT 'Draft',
    CONSTRAINT ck_tour_fee CHECK (entry_fee >= 0)
) ENGINE=InnoDB;

-- ------------------------------------------------------------------
-- 7. Tournament_Registrations
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Tournament_Registrations (
    registration_id INT AUTO_INCREMENT PRIMARY KEY,
    tournament_id   INT NOT NULL,
    user_id         INT NOT NULL,
    seed_number     INT NULL,
    fee_paid        BOOL NOT NULL DEFAULT FALSE,
    CONSTRAINT fk_reg_tour FOREIGN KEY (tournament_id) REFERENCES Tournaments(tournament_id) ON DELETE RESTRICT,
    CONSTRAINT fk_reg_user FOREIGN KEY (user_id)       REFERENCES Users(user_id)             ON DELETE RESTRICT,
    CONSTRAINT uq_reg_player UNIQUE (tournament_id, user_id),
    CONSTRAINT uq_reg_seed   UNIQUE (tournament_id, seed_number),
    CONSTRAINT ck_reg_seed   CHECK (seed_number IS NULL OR seed_number >= 1)
) ENGINE=InnoDB;

-- ------------------------------------------------------------------
-- 8. Matches
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Matches (
    match_id       INT AUTO_INCREMENT PRIMARY KEY,
    tournament_id  INT NOT NULL,
    round_number   INT NOT NULL,
    player1_id     INT NULL,
    player2_id     INT NULL,
    winner_id      INT NULL,
    next_match_id  INT NULL,
    table_id       INT NULL,
    scheduled_time DATETIME NULL,
    status         ENUM('Scheduled','InProgress','Completed','Cancelled') NOT NULL DEFAULT 'Scheduled',
    CONSTRAINT fk_match_tour   FOREIGN KEY (tournament_id) REFERENCES Tournaments(tournament_id) ON DELETE RESTRICT,
    CONSTRAINT fk_match_p1     FOREIGN KEY (player1_id)    REFERENCES Users(user_id)             ON DELETE RESTRICT,
    CONSTRAINT fk_match_p2     FOREIGN KEY (player2_id)    REFERENCES Users(user_id)             ON DELETE RESTRICT,
    CONSTRAINT fk_match_winner FOREIGN KEY (winner_id)     REFERENCES Users(user_id)             ON DELETE RESTRICT,
    CONSTRAINT fk_match_next   FOREIGN KEY (next_match_id) REFERENCES Matches(match_id)          ON DELETE RESTRICT,
    CONSTRAINT fk_match_table  FOREIGN KEY (table_id)      REFERENCES Game_Tables(table_id)      ON DELETE RESTRICT,
    CONSTRAINT ck_match_round   CHECK (round_number >= 1),
    CONSTRAINT ck_match_players CHECK (player1_id IS NULL OR player2_id IS NULL OR player1_id <> player2_id),
    CONSTRAINT ck_match_winner  CHECK (winner_id IS NULL OR winner_id = player1_id OR winner_id = player2_id),
    INDEX idx_match_next (next_match_id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------------
-- 9. Match_Frames (Weak Entity on Matches; ON DELETE CASCADE)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Match_Frames (
    match_id      INT NOT NULL,
    frame_number  INT NOT NULL,
    p1_score      INT NOT NULL,
    p2_score      INT NOT NULL,
    highest_break INT NOT NULL DEFAULT 0,
    PRIMARY KEY (match_id, frame_number),
    CONSTRAINT fk_frame_match FOREIGN KEY (match_id) REFERENCES Matches(match_id) ON DELETE CASCADE,
    CONSTRAINT ck_frame_no     CHECK (frame_number >= 1),
    CONSTRAINT ck_frame_scores CHECK (p1_score >= 0 AND p2_score >= 0 AND p1_score <> p2_score),
    CONSTRAINT ck_frame_break  CHECK (highest_break BETWEEN 0 AND 147)
) ENGINE=InnoDB;

-- ------------------------------------------------------------------
-- 10. Skill_Assessments
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Skill_Assessments (
    assessment_id INT AUTO_INCREMENT PRIMARY KEY,
    player_id     INT NOT NULL,
    assessed_by   INT NOT NULL,
    skill_area    ENUM('Long potting','Safety play','Break building','Positional play','Cue ball control','Pressure handling') NOT NULL,
    rating        TINYINT NOT NULL,
    notes         VARCHAR(300) NULL,
    assessed_on   DATE NOT NULL DEFAULT (CURRENT_DATE),
    CONSTRAINT fk_sa_player FOREIGN KEY (player_id)   REFERENCES Users(user_id) ON DELETE RESTRICT,
    CONSTRAINT fk_sa_by     FOREIGN KEY (assessed_by) REFERENCES Users(user_id) ON DELETE RESTRICT,
    CONSTRAINT ck_sa_rating CHECK (rating BETWEEN 1 AND 10),
    CONSTRAINT ck_sa_self   CHECK (player_id <> assessed_by)
) ENGINE=InnoDB;

-- ------------------------------------------------------------------
-- 11. Inventory_Items
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Inventory_Items (
    item_id            INT AUTO_INCREMENT PRIMARY KEY,
    name               VARCHAR(100) NOT NULL,
    category           ENUM('Cue','Chalk','Cloth','Balls','Consumable','Other') NOT NULL,
    quantity           INT NOT NULL DEFAULT 0,
    reorder_level      INT NOT NULL DEFAULT 0,
    reorder_flag       BOOL NOT NULL DEFAULT FALSE,
    table_id           INT NULL,
    condition_status   ENUM('Good','Needs Service','Damaged','Retired') NOT NULL DEFAULT 'Good',
    last_serviced_date DATE NULL,
    vendor_name        VARCHAR(100) NOT NULL,
    CONSTRAINT fk_inv_table   FOREIGN KEY (table_id) REFERENCES Game_Tables(table_id) ON DELETE RESTRICT,
    CONSTRAINT ck_inv_qty     CHECK (quantity >= 0),
    CONSTRAINT ck_inv_reorder CHECK (reorder_level >= 0)
) ENGINE=InnoDB;