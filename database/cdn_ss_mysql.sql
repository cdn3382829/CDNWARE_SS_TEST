-- =============================================================================
-- CDN_SS :: MySQL 8 setup script
-- Project: CDN_SS by CDNWARE
-- =============================================================================
-- This is the reference MySQL schema for a self-hosted CDN_SS deployment.
--
--   mysql -u root -p < cdn_ss_mysql.sql
--
-- Notes
--   * Charset utf8mb4 / collation utf8mb4_0900_ai_ci, engine InnoDB.
--   * Emails are stored in plaintext (per project requirements) so staff can
--     look accounts up by email. Passwords are NEVER plaintext: the API stores
--     `scrypt$N$r$p$salt$hash` strings produced by src/lib/security.ts.
--   * To seed the owner password, generate a hash with:
--         node scripts/hash-password.js 'Owner#2026'
--     and paste it into the placeholder below before running the file.
-- =============================================================================

DROP DATABASE IF EXISTS cdn_ss;
CREATE DATABASE cdn_ss CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE cdn_ss;

-- -----------------------------------------------------------------------------
-- Users
-- -----------------------------------------------------------------------------
CREATE TABLE users (
  id                   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username             VARCHAR(24)  NOT NULL,
  username_lower       VARCHAR(24)  NOT NULL,
  email                VARCHAR(254) NOT NULL,
  password_hash        TEXT         NOT NULL,
  role                 ENUM('member','moderator','admin','owner') NOT NULL DEFAULT 'member',
  tier                 ENUM('none','standard','premium') NOT NULL DEFAULT 'none',
  status               ENUM('active','suspended','frozen','blacklisted') NOT NULL DEFAULT 'active',
  bio                  VARCHAR(280) NOT NULL DEFAULT '',
  avatar_url           TEXT         NOT NULL,
  scripts_executed     INT UNSIGNED NOT NULL DEFAULT 0,
  strikes              TINYINT UNSIGNED NOT NULL DEFAULT 0,
  suspended_until      DATETIME     NULL,
  suspension_reason    TEXT         NULL,
  blacklisted_by       INT UNSIGNED NULL,
  blacklist_reason     TEXT         NULL,
  frozen_by            INT UNSIGNED NULL,
  freeze_reason        TEXT         NULL,
  accepted_tos         TINYINT(1)   NOT NULL DEFAULT 0,
  accepted_tos_version INT UNSIGNED NOT NULL DEFAULT 0,
  accepted_rules_version INT UNSIGNED NOT NULL DEFAULT 0,
  onboarding_complete  TINYINT(1)   NOT NULL DEFAULT 0,
  last_ip              VARCHAR(64)  NOT NULL DEFAULT '',
  last_user_agent      TEXT         NOT NULL,
  last_login_at        DATETIME     NULL,
  created_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY users_username_lower_idx (username_lower),
  UNIQUE KEY users_email_idx (email),
  KEY users_role_idx (role)
) ENGINE=InnoDB;

CREATE TABLE sessions (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  token_hash  CHAR(64)     NOT NULL,
  user_id     INT UNSIGNED NOT NULL,
  ip          VARCHAR(64)  NOT NULL DEFAULT '',
  user_agent  TEXT         NOT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at  DATETIME     NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY sessions_token_hash_idx (token_hash),
  KEY sessions_user_idx (user_id),
  CONSTRAINT sessions_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- Games
-- -----------------------------------------------------------------------------
CREATE TABLE games (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name         VARCHAR(96)  NOT NULL,
  place_id     VARCHAR(32)  NOT NULL,
  creator      VARCHAR(64)  NOT NULL DEFAULT '',
  tier         ENUM('standard','premium','private') NOT NULL DEFAULT 'standard',
  approved     TINYINT(1)   NOT NULL DEFAULT 0,
  player_count INT UNSIGNED NOT NULL DEFAULT 0,
  visits       BIGINT UNSIGNED NOT NULL DEFAULT 0,
  submitted_by INT UNSIGNED NULL,
  reviewed_by  INT UNSIGNED NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY games_place_id_idx (place_id)
) ENGINE=InnoDB;

CREATE TABLE private_game_access (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    INT UNSIGNED NOT NULL,
  game_id    INT UNSIGNED NOT NULL,
  granted_by INT UNSIGNED NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY private_access_idx (user_id, game_id),
  CONSTRAINT pga_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT pga_game_fk FOREIGN KEY (game_id) REFERENCES games (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE executor_presence (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     INT UNSIGNED NOT NULL,
  username    VARCHAR(24)  NOT NULL,
  game_id     INT UNSIGNED NOT NULL,
  server_id   VARCHAR(40)  NOT NULL,
  last_seen_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY presence_idx (user_id, game_id, server_id)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- Announcements
-- -----------------------------------------------------------------------------
CREATE TABLE announcements (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title       VARCHAR(140) NOT NULL,
  body        MEDIUMTEXT  NOT NULL,
  author_id   INT UNSIGNED NOT NULL,
  author_name VARCHAR(24)  NOT NULL,
  pinned      TINYINT(1)   NOT NULL DEFAULT 0,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY announcements_created_idx (created_at)
) ENGINE=InnoDB;

CREATE TABLE announcement_reads (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  announcement_id INT UNSIGNED NOT NULL,
  user_id         INT UNSIGNED NOT NULL,
  read_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY announcement_read_idx (announcement_id, user_id),
  KEY ar_user_idx (user_id)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- Scripts, executions, filters
-- -----------------------------------------------------------------------------
CREATE TABLE saved_scripts (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    INT UNSIGNED NOT NULL,
  name       VARCHAR(64)  NOT NULL,
  content    LONGTEXT     NOT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY saved_scripts_user_idx (user_id)
) ENGINE=InnoDB;

CREATE TABLE execution_logs (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id        INT UNSIGNED NOT NULL,
  username       VARCHAR(24)  NOT NULL,
  game_id        INT UNSIGNED NULL,
  game_name      VARCHAR(96)  NOT NULL DEFAULT '',
  server_id      VARCHAR(40)  NOT NULL DEFAULT '',
  script_content LONGTEXT     NOT NULL,
  script_length  INT UNSIGNED NOT NULL DEFAULT 0,
  flagged        TINYINT(1)   NOT NULL DEFAULT 0,
  flag_reason    TEXT         NULL,
  review_status  ENUM('pending','cleared','actioned','escalated') NOT NULL DEFAULT 'pending',
  reviewed_by    INT UNSIGNED NULL,
  reviewed_at    DATETIME     NULL,
  outcome        VARCHAR(64)  NOT NULL DEFAULT 'executed',
  ip             VARCHAR(64)  NOT NULL DEFAULT '',
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY execution_logs_user_idx (user_id),
  KEY execution_logs_status_idx (review_status)
) ENGINE=InnoDB;

CREATE TABLE blacklisted_scripts (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  pattern    TEXT         NOT NULL,
  match_type ENUM('contains','exact','regex') NOT NULL DEFAULT 'contains',
  action     ENUM('suspend','blacklist') NOT NULL DEFAULT 'suspend',
  reason     VARCHAR(200) NOT NULL,
  active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_by INT UNSIGNED NOT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- Moderation records
-- -----------------------------------------------------------------------------
CREATE TABLE strikes (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     INT UNSIGNED NOT NULL,
  issued_by   INT UNSIGNED NOT NULL,
  issuer_name VARCHAR(24)  NOT NULL,
  reason      VARCHAR(240) NOT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY strikes_user_idx (user_id)
) ENGINE=InnoDB;

CREATE TABLE suspensions (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id      INT UNSIGNED NOT NULL,
  issued_by    INT UNSIGNED NOT NULL,
  issuer_name  VARCHAR(24)  NOT NULL,
  reason       VARCHAR(240) NOT NULL,
  starts_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ends_at      DATETIME     NULL,
  active       TINYINT(1)   NOT NULL DEFAULT 1,
  lifted_at    DATETIME     NULL,
  lifted_by    INT UNSIGNED NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY suspensions_user_idx (user_id)
) ENGINE=InnoDB;

CREATE TABLE blacklists (
  id                  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id             INT UNSIGNED NOT NULL,
  blacklisted_by      INT UNSIGNED NOT NULL,
  blacklisted_by_name VARCHAR(24)  NOT NULL,
  reason              VARCHAR(240) NOT NULL,
  created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY blacklists_user_idx (user_id)
) ENGINE=InnoDB;

CREATE TABLE staff_notes (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     INT UNSIGNED NOT NULL,
  author_id   INT UNSIGNED NOT NULL,
  author_name VARCHAR(24)  NOT NULL,
  body        VARCHAR(500) NOT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY staff_notes_user_idx (user_id)
) ENGINE=InnoDB;

CREATE TABLE audit_logs (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_id   INT UNSIGNED NOT NULL,
  actor_name VARCHAR(24)  NOT NULL,
  actor_role VARCHAR(16)  NOT NULL,
  action     VARCHAR(48)  NOT NULL,
  target_id  INT UNSIGNED NULL,
  target_name VARCHAR(24) NOT NULL DEFAULT '',
  details    TEXT         NOT NULL,
  ip         VARCHAR(64)  NOT NULL DEFAULT '',
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY audit_logs_created_idx (created_at)
) ENGINE=InnoDB;

CREATE TABLE user_badges (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    INT UNSIGNED NOT NULL,
  code       VARCHAR(40)  NOT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY user_badge_idx (user_id, code)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- Forum
-- -----------------------------------------------------------------------------
CREATE TABLE forum_threads (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  section      ENUM('scripts','support','suggestions','talk') NOT NULL,
  title        VARCHAR(120) NOT NULL,
  author_id    INT UNSIGNED NOT NULL,
  author_name  VARCHAR(24)  NOT NULL,
  pinned       TINYINT(1)   NOT NULL DEFAULT 0,
  locked       TINYINT(1)   NOT NULL DEFAULT 0,
  reply_count  INT UNSIGNED NOT NULL DEFAULT 0,
  views        INT UNSIGNED NOT NULL DEFAULT 0,
  last_post_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY forum_threads_section_idx (section)
) ENGINE=InnoDB;

CREATE TABLE forum_posts (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  thread_id  INT UNSIGNED NOT NULL,
  author_id  INT UNSIGNED NOT NULL,
  author_name VARCHAR(24) NOT NULL,
  author_role VARCHAR(16) NOT NULL DEFAULT 'member',
  body       MEDIUMTEXT   NOT NULL,
  attachments JSON        NULL,
  edited     TINYINT(1)   NOT NULL DEFAULT 0,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY forum_posts_thread_idx (thread_id),
  CONSTRAINT forum_posts_thread_fk FOREIGN KEY (thread_id) REFERENCES forum_threads (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE images (
  id          VARCHAR(32)  NOT NULL,
  uploader_id INT UNSIGNED NOT NULL,
  mime        VARCHAR(40)  NOT NULL,
  bytes       INT UNSIGNED NOT NULL DEFAULT 0,
  data        LONGTEXT     NOT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- Site settings (single row)
-- -----------------------------------------------------------------------------
CREATE TABLE site_settings (
  id              TINYINT UNSIGNED NOT NULL DEFAULT 1,
  tos_content     MEDIUMTEXT NOT NULL,
  tos_version     INT UNSIGNED NOT NULL DEFAULT 1,
  rules_content   MEDIUMTEXT NOT NULL,
  rules_version   INT UNSIGNED NOT NULL DEFAULT 1,
  rules_updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  standard_link   TEXT      NOT NULL,
  premium_link    TEXT      NOT NULL,
  standard_price  VARCHAR(24) NOT NULL DEFAULT '$9.99',
  premium_price   VARCHAR(24) NOT NULL DEFAULT '$24.99',
  maintenance     TINYINT(1) NOT NULL DEFAULT 0,
  updated_at      DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

-- =============================================================================
-- SEED DATA
-- Replace <SCRYPT_HASH> with the output of:  node scripts/hash-password.js 'Owner#2026'
-- =============================================================================

INSERT INTO site_settings
  (id, tos_content, tos_version, rules_content, rules_version, standard_link, premium_link)
VALUES
  (1,
   '# CDN_SS Terms of Service\n\nBy creating a CDN_SS account you accept these terms.',
   1,
   '# CDN_SS Community & Usage Rules\n\n1. No leaking loaders or modules.\n2. No malicious scripts.\n3. No harassment.',
   1,
   'https://pay.example.com/cdn-ss-standard',
   'https://pay.example.com/cdn-ss-premium');

INSERT INTO users
  (username, username_lower, email, password_hash, role, tier, accepted_tos,
   accepted_tos_version, accepted_rules_version, onboarding_complete, scripts_executed)
VALUES
  ('CDNWARE', 'cdnware', 'owner@cdnware.dev', '<SCRYPT_HASH>', 'owner', 'premium', 1, 1, 1, 1, 2481),
  ('AdminKai', 'adminkai', 'admin@cdnware.dev', '<SCRYPT_HASH>', 'admin', 'premium', 1, 1, 1, 1, 812),
  ('ModSera', 'modsera', 'mod@cdnware.dev', '<SCRYPT_HASH>', 'moderator', 'standard', 1, 1, 1, 1, 264),
  ('PremiumPax', 'oriumpax', 'premium@cdnware.dev', '<SCRYPT_HASH>', 'member', 'premium', 1, 1, 1, 1, 918),
  ('StandardSam', 'standardsam', 'standard@cdnware.dev', '<SCRYPT_HASH>', 'member', 'standard', 1, 1, 1, 1, 143),
  ('NewbieNate', 'newbienate', 'member@cdnware.dev', '<SCRYPT_HASH>', 'member', 'none', 1, 1, 1, 1, 0);

INSERT INTO games (name, place_id, creator, tier, approved, player_count, visits) VALUES
  ('Blox Fruits',            '2753915549',   'Gamer Robot Inc',      'standard', 1, 412000, 44000000000),
  ('Brookhaven RP',          '4924922222',   'Wolfpaq',              'standard', 1, 238000, 61000000000),
  ('Da Hood',                '4495685098',   'Da Hood Entertainment','standard', 1, 121000,  9800000000),
  ('Murder Mystery 2',       '142823291',    'Nikilis',              'standard', 1,  88000, 12400000000),
  ('Pet Simulator 99',       '8737899170',   'BIG Games Pets',       'standard', 1,  64000,  8100000000),
  ('Jailbreak',              '606849621',    'Badimo',               'standard', 1,  45000,  6700000000),
  ('Grow a Garden',          '126884695634066','Grow a Garden',       'premium',  1, 512000, 18200000000),
  ('Steal a Brainrot',       '10449761463',  'Steal a Brainrot',     'premium',  1, 388000, 11500000000),
  ('Rivals',                 '17625359962',  'Nosniy Games',         'premium',  1,  96000,  2400000000),
  ('Doors',                  '6516141723',   'LSPLASH',              'premium',  1,  57000,  6100000000),
  ('CDNWARE Private Test Lab','999000111',   'CDNWARE',              'private',  1,     12,      8400),
  ('Untitled Combat Arena',  '778899001',    'pendingCreator',       'standard', 0,   3400,    980000);

INSERT INTO announcements (title, body, author_id, author_name, pinned) VALUES
  ('CDN_SS v2.4 — Fast attach + server search',
   '**Live server search is here.** Open any game, type a username and CDN_SS returns the exact server.',
   1, 'CDNWARE', 1),
  ('Script filter update',
   'Token grabbers and cookie stealers are now auto-blacklisted on execution.',
   1, 'CDNWARE', 0);

INSERT INTO blacklisted_scripts (pattern, match_type, action, reason, created_by) VALUES
  ('.ROBLOSECURITY', 'contains', 'blacklist', 'Cookie stealing payload', 1),
  ('HttpService:GetAsync', 'contains', 'suspend', 'Unapproved external payload download', 1);

INSERT INTO forum_threads (section, title, author_id, author_name, reply_count, views) VALUES
  ('scripts', '[SHARE] Silent walkspeed + jump boost payload', 4, 'PremiumPax', 2, 86),
  ('support', 'Executor says Executed but nothing happens',    5, 'StandardSam', 1, 63),
  ('suggestions', 'Add a scheduled executor queue',            4, 'PremiumPax', 1, 41),
  ('talk', 'Best game to test in right now?',                  6, 'NewbieNate', 0, 22);

INSERT INTO forum_posts (thread_id, author_id, author_name, author_role, body) VALUES
  (1, 4, 'PremiumPax', 'member',
   'Runs on the CDN_SS server executor, no client injection needed.\n\n```\nlocal Players = game:GetService(\"Players\")\n```'),
  (2, 5, 'StandardSam', 'member', 'I ran a simple print payload and got the green indicator, but nothing shows in game.'),
  (3, 4, 'PremiumPax', 'member', 'It would be great to queue payloads per server with a delay.'),
  (4, 6, 'NewbieNate', 'member', 'Looking for a low-population server so I can test without getting reported.');

-- =============================================================================
-- Done. Next steps:
--   1. Generate real password hashes with scripts/hash-password.js
--   2. Point the API at this database (see README.md → Database)
-- =============================================================================
