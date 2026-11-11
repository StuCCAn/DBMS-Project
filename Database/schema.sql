-- CueClub Manager: schema (MySQL 8.0.16 or later)
-- Run order: schema.sql, triggers.sql, procedures.sql, views.sql, seed.sql

DROP DATABASE IF EXISTS cueclub;
CREATE DATABASE cueclub CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE cueclub;

-- ------------------------------------------------------------------
-- User hierarchy (EER specialization)
-- Level 1: Users -> Club_Member | Casual_Player (disjoint, total)
-- Level 2: Club_Member -> Team_Member | Individual_Player | Team_Enthusiast (overlapping, partial)
-- ------------------------------------------------------------------
CREATE TABLE Users (
    user_id    INT AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    phone      VARCHAR(15)  NOT NULL,
    email      VARCHAR(120) NOT NULL,
    joined_on  DATE         NOT NULL DEFAULT (CURRENT_DATE),
    CONSTRAINT uq_users_phone UNIQUE (phone),
    CONSTRAINT uq_users_email UNIQUE (email),
    CONSTRAINT ck_users_phone CHECK (phone REGEXP '^[0-9+]{7,15}$')
) ENGINE=InnoDB;

CREATE TABLE Club_Member (
    user_id        INT PRIMARY KEY,
    membership_no  VARCHAR(20)   NOT NULL,
    plan           ENUM('Monthly','Quarterly','Annual') NOT NULL,
    start_date     DATE          NOT NULL,
    end_date       DATE          NOT NULL,
    discount_pct   DECIMAL(5,2)  NOT NULL DEFAULT 0,
    credit_limit   DECIMAL(10,2) NOT NULL DEFAULT 0,
    CONSTRAINT uq_member_no UNIQUE (membership_no),
    CONSTRAINT fk_member_user FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    CONSTRAINT ck_member_dates CHECK (end_date > start_date),
    CONSTRAINT ck_member_discount CHECK (discount_pct BETWEEN 0 AND 100),
    CONSTRAINT ck_member_credit CHECK (credit_limit >= 0)
) ENGINE=InnoDB;

CREATE TABLE Casual_Player (
    user_id      INT PRIMARY KEY,
    visit_count  INT  NOT NULL DEFAULT 0,
    last_visit   DATE NOT NULL DEFAULT (CURRENT_DATE),
    CONSTRAINT fk_casual_user FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    CONSTRAINT ck_casual_visits CHECK (visit_count >= 0)
) ENGINE=InnoDB;

CREATE TABLE Teams (
    team_id     INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(80) NOT NULL,
    captain_id  INT NULL,
    formed_on   DATE NOT NULL DEFAULT (CURRENT_DATE),
    CONSTRAINT uq_team_name UNIQUE (name),
    CONSTRAINT fk_team_captain FOREIGN KEY (captain_id) REFERENCES Club_Member(user_id)
) ENGINE=InnoDB;

CREATE TABLE Team_Member (
    user_id           INT PRIMARY KEY,
    team_id           INT NOT NULL,
    team_role         ENUM('Captain','Vice-Captain','Player') NOT NULL DEFAULT 'Player',
    selection_status  ENUM('Probable','Selected','Reserve','Dropped') NOT NULL DEFAULT 'Probable',
    handedness        ENUM('Right','Left') NOT NULL DEFAULT 'Right',
    CONSTRAINT fk_tm_member FOREIGN KEY (user_id) REFERENCES Club_Member(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_tm_team   FOREIGN KEY (team_id) REFERENCES Teams(team_id)
) ENGINE=InnoDB;

CREATE TABLE Individual_Player (
    user_id         INT PRIMARY KEY,
    handicap        INT NOT NULL DEFAULT 0,
    preferred_game  ENUM('Snooker','Pool','Billiards') NOT NULL DEFAULT 'Snooker',
    CONSTRAINT fk_ip_member FOREIGN KEY (user_id) REFERENCES Club_Member(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE Team_Enthusiast (
    user_id       INT PRIMARY KEY,
    interest_type ENUM('Supporter','Aspiring Player','Volunteer') NOT NULL DEFAULT 'Supporter',
    wants_trial   BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT fk_te_member FOREIGN KEY (user_id) REFERENCES Club_Member(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------------
-- Facilities and reservations
-- ------------------------------------------------------------------
CREATE TABLE Game_Tables (
    table_id        INT AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(50)  NOT NULL,
    game_type       ENUM('Snooker','Pool','Billiards') NOT NULL,
    hourly_rate     DECIMAL(8,2) NOT NULL,
    per_frame_rate  DECIMAL(8,2) NOT NULL,
    status          ENUM('Available','Maintenance','Retired') NOT NULL DEFAULT 'Available',
    CONSTRAINT uq_table_name UNIQUE (name),
    CONSTRAINT ck_table_hourly CHECK (hourly_rate > 0),
    CONSTRAINT ck_table_frame  CHECK (per_frame_rate > 0)
) ENGINE=InnoDB;

CREATE TABLE Reservations (
    reservation_id  INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    table_id        INT NOT NULL,
    start_time      DATETIME NOT NULL,
    end_time        DATETIME NOT NULL,
    billing_mode    ENUM('Hourly','PerFrame') NOT NULL DEFAULT 'Hourly',
    frames_played   INT NOT NULL DEFAULT 0,
    total_amount    DECIMAL(10,2) NOT NULL DEFAULT 0,
    payment_status  ENUM('Pending','Paid','OnCredit','Cancelled') NOT NULL DEFAULT 'Pending',
    CONSTRAINT fk_res_user  FOREIGN KEY (user_id)  REFERENCES Users(user_id)       ON DELETE RESTRICT,
    CONSTRAINT fk_res_table FOREIGN KEY (table_id) REFERENCES Game_Tables(table_id) ON DELETE RESTRICT,
    CONSTRAINT ck_res_window CHECK (end_time > start_time),
    CONSTRAINT ck_res_frames CHECK (frames_played >= 0),
    CONSTRAINT ck_res_total  CHECK (total_amount >= 0),
    INDEX idx_res_table_time (table_id, start_time, end_time)
) ENGINE=InnoDB;

-- Credit (udhar) ledger: only club members can hold credit, so the FK targets Club_Member.
CREATE TABLE Credit_Ledger (
    entry_id        INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    reservation_id  INT NULL,
    entry_type      ENUM('Charge','Payment') NOT NULL,
    amount          DECIMAL(10,2) NOT NULL,
    entry_date      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    note            VARCHAR(200) NULL,
    CONSTRAINT fk_led_member FOREIGN KEY (user_id)        REFERENCES Club_Member(user_id)       ON DELETE RESTRICT,
    CONSTRAINT fk_led_res    FOREIGN KEY (reservation_id) REFERENCES Reservations(reservation_id) ON DELETE RESTRICT,
    CONSTRAINT ck_led_amount CHECK (amount > 0),
    INDEX idx_led_user (user_id, entry_date)
) ENGINE=InnoDB;

CREATE TABLE Penalties (
    penalty_id      INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    violation_type  VARCHAR(80) NOT NULL,
    issued_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fine_amount     DECIMAL(8,2) NOT NULL DEFAULT 0,
    paid            BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT fk_pen_user FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE RESTRICT,
    CONSTRAINT ck_pen_fine CHECK (fine_amount >= 0)
) ENGINE=InnoDB;

-- ------------------------------------------------------------------
-- Tournaments, matches, rankings, coaching
-- ------------------------------------------------------------------
CREATE TABLE Tournaments (
    tournament_id  INT AUTO_INCREMENT PRIMARY KEY,
    title          VARCHAR(120) NOT NULL,
    game_type      ENUM('Snooker','Pool','Billiards') NOT NULL,
    format         ENUM('Knockout','League','Fixture') NOT NULL DEFAULT 'Knockout',
    start_date     DATE NOT NULL,
    entry_fee      DECIMAL(8,2) NOT NULL DEFAULT 0,
    status         ENUM('Draft','Registration','Ongoing','Completed','Cancelled') NOT NULL DEFAULT 'Draft',
    team_id        INT NULL,   -- set for inter-club fixtures played by the club team
    CONSTRAINT fk_tour_team FOREIGN KEY (team_id) REFERENCES Teams(team_id),
    CONSTRAINT ck_tour_fee CHECK (entry_fee >= 0)
) ENGINE=InnoDB;

CREATE TABLE Tournament_Registrations (
    registration_id  INT AUTO_INCREMENT PRIMARY KEY,
    tournament_id    INT NOT NULL,
    user_id          INT NOT NULL,
    seed_number      INT NULL,   -- assigned after registration closes
    fee_paid         BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT fk_reg_tour FOREIGN KEY (tournament_id) REFERENCES Tournaments(tournament_id),
    CONSTRAINT fk_reg_user FOREIGN KEY (user_id)       REFERENCES Users(user_id),
    CONSTRAINT uq_reg_player UNIQUE (tournament_id, user_id),
    CONSTRAINT uq_reg_seed   UNIQUE (tournament_id, seed_number),
    CONSTRAINT ck_reg_seed   CHECK (seed_number IS NULL OR seed_number >= 1)
) ENGINE=InnoDB;

-- Player slots are NULL ("to be decided") in later rounds until the feeder match is completed.
CREATE TABLE Matches (
    match_id        INT AUTO_INCREMENT PRIMARY KEY,
    tournament_id   INT NOT NULL,
    round_number    INT NOT NULL,
    player1_id      INT NULL,
    player2_id      INT NULL,
    winner_id       INT NULL,
    next_match_id   INT NULL,
    table_id        INT NULL,
    scheduled_time  DATETIME NULL,
    status          ENUM('Scheduled','InProgress','Completed','Cancelled') NOT NULL DEFAULT 'Scheduled',
    CONSTRAINT fk_match_tour    FOREIGN KEY (tournament_id) REFERENCES Tournaments(tournament_id),
    CONSTRAINT fk_match_p1      FOREIGN KEY (player1_id)    REFERENCES Users(user_id),
    CONSTRAINT fk_match_p2      FOREIGN KEY (player2_id)    REFERENCES Users(user_id),
    CONSTRAINT fk_match_winner  FOREIGN KEY (winner_id)     REFERENCES Users(user_id),
    CONSTRAINT fk_match_next    FOREIGN KEY (next_match_id) REFERENCES Matches(match_id),
    CONSTRAINT fk_match_table   FOREIGN KEY (table_id)      REFERENCES Game_Tables(table_id),
    CONSTRAINT ck_match_round   CHECK (round_number >= 1),
    CONSTRAINT ck_match_players CHECK (player1_id <> player2_id),
    CONSTRAINT ck_match_winner  CHECK (winner_id IS NULL OR winner_id = player1_id OR winner_id = player2_id),
    INDEX idx_match_next (next_match_id)
) ENGINE=InnoDB;

-- Weak entity: identified by (match_id, frame_number)
CREATE TABLE Match_Frames (
    match_id       INT NOT NULL,
    frame_number   INT NOT NULL,
    p1_score       INT NOT NULL,
    p2_score       INT NOT NULL,
    highest_break  INT NOT NULL DEFAULT 0,
    PRIMARY KEY (match_id, frame_number),
    CONSTRAINT fk_frame_match FOREIGN KEY (match_id) REFERENCES Matches(match_id) ON DELETE CASCADE,
    CONSTRAINT ck_frame_no     CHECK (frame_number >= 1),
    CONSTRAINT ck_frame_scores CHECK (p1_score >= 0 AND p2_score >= 0 AND p1_score <> p2_score),
    CONSTRAINT ck_frame_break  CHECK (highest_break BETWEEN 0 AND 147)
) ENGINE=InnoDB;

-- Stored (deliberately denormalized) rankings; changed only by sp_complete_match.
CREATE TABLE Player_Rankings (
    user_id         INT NOT NULL,
    game_type       ENUM('Snooker','Pool','Billiards') NOT NULL,
    points          INT NOT NULL DEFAULT 0,
    matches_played  INT NOT NULL DEFAULT 0,
    wins            INT NOT NULL DEFAULT 0,
    last_updated    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, game_type),
    CONSTRAINT fk_rank_user FOREIGN KEY (user_id) REFERENCES Users(user_id),
    CONSTRAINT ck_rank_counts CHECK (points >= 0 AND matches_played >= 0 AND wins >= 0 AND wins <= matches_played)
) ENGINE=InnoDB;

CREATE TABLE Skill_Assessments (
    assessment_id  INT AUTO_INCREMENT PRIMARY KEY,
    player_id      INT NOT NULL,
    assessed_by    INT NOT NULL,
    skill_area     ENUM('Long potting','Safety play','Break building','Positional play','Cue ball control','Pressure handling') NOT NULL,
    rating         TINYINT NOT NULL,
    notes          VARCHAR(300) NULL,
    assessed_on    DATE NOT NULL DEFAULT (CURRENT_DATE),
    CONSTRAINT fk_sa_player FOREIGN KEY (player_id)   REFERENCES Users(user_id),
    CONSTRAINT fk_sa_by     FOREIGN KEY (assessed_by) REFERENCES Users(user_id),
    CONSTRAINT ck_sa_rating CHECK (rating BETWEEN 1 AND 10)
) ENGINE=InnoDB;

-- ------------------------------------------------------------------
-- Supply: vendors, inventory, purchase orders
-- ------------------------------------------------------------------
CREATE TABLE Vendors (
    vendor_id           INT AUTO_INCREMENT PRIMARY KEY,
    name                VARCHAR(100) NOT NULL,
    phone               VARCHAR(15)  NOT NULL,
    supplies_category   VARCHAR(60)  NOT NULL
) ENGINE=InnoDB;

CREATE TABLE Inventory_Items (
    item_id              INT AUTO_INCREMENT PRIMARY KEY,
    name                 VARCHAR(100) NOT NULL,
    category             ENUM('Cue','Chalk','Cloth','Balls','Consumable','Other') NOT NULL,
    quantity             INT NOT NULL DEFAULT 0,
    reorder_level        INT NOT NULL DEFAULT 0,
    reorder_flag         BOOLEAN NOT NULL DEFAULT FALSE,   -- maintained by trigger
    table_id             INT NULL,
    condition_status     ENUM('Good','NeedsService','Damaged','Retired') NOT NULL DEFAULT 'Good',
    last_serviced_date   DATE NULL,
    vendor_id            INT NOT NULL,
    CONSTRAINT fk_inv_table  FOREIGN KEY (table_id)  REFERENCES Game_Tables(table_id),
    CONSTRAINT fk_inv_vendor FOREIGN KEY (vendor_id) REFERENCES Vendors(vendor_id),
    CONSTRAINT ck_inv_qty     CHECK (quantity >= 0),
    CONSTRAINT ck_inv_reorder CHECK (reorder_level >= 0)
) ENGINE=InnoDB;

CREATE TABLE Purchase_Orders (
    po_id        INT AUTO_INCREMENT PRIMARY KEY,
    vendor_id    INT NOT NULL,
    item_id      INT NOT NULL,
    quantity     INT NOT NULL,
    cost         DECIMAL(10,2) NOT NULL,
    order_date   DATE NOT NULL DEFAULT (CURRENT_DATE),
    status       ENUM('Ordered','Received','Cancelled') NOT NULL DEFAULT 'Ordered',
    amount_paid  DECIMAL(10,2) NOT NULL DEFAULT 0,
    CONSTRAINT fk_po_vendor FOREIGN KEY (vendor_id) REFERENCES Vendors(vendor_id),
    CONSTRAINT fk_po_item   FOREIGN KEY (item_id)   REFERENCES Inventory_Items(item_id),
    CONSTRAINT ck_po_qty    CHECK (quantity > 0),
    CONSTRAINT ck_po_cost   CHECK (cost >= 0),
    CONSTRAINT ck_po_paid   CHECK (amount_paid >= 0 AND amount_paid <= cost)
) ENGINE=InnoDB;
