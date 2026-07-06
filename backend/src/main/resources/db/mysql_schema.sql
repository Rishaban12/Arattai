-- =====================================================================
-- Arattai Chat App — MySQL schema (per Arattai_Database_Design.docx)
-- MySQL keeps small, relational, join-heavy data: users, chats, groups,
-- members, device tokens. Messages live in Cassandra.
--
-- NOTE: the group table is named `groups_` (trailing underscore) because
-- GROUPS is a reserved SQL word and the backend DAO code references it.
-- =====================================================================

CREATE DATABASE IF NOT EXISTS arattai CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE arattai;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS device_tokens;
DROP TABLE IF EXISTS subgroup_members;
DROP TABLE IF EXISTS subgroups;
DROP TABLE IF EXISTS group_members;
DROP TABLE IF EXISTS groups_;
DROP TABLE IF EXISTS direct_chats;
DROP TABLE IF EXISTS users;
SET FOREIGN_KEY_CHECKS = 1;

-- ── 2.1 users ─────────────────────────────────────────────────────────
-- Root table. Almost every other table points to users.id.
CREATE TABLE users (
    id            BIGINT        NOT NULL AUTO_INCREMENT,
    name          VARCHAR(100)  NOT NULL,
    username      VARCHAR(50)   NOT NULL,
    email         VARCHAR(255)  NOT NULL,
    password_hash VARCHAR(255)  NULL,           -- NULL if Google-only login
    google_id     VARCHAR(255)  NULL,           -- for Google OAuth login
    avatar_url    VARCHAR(1000) NULL,
    created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_username (username),
    UNIQUE KEY uq_users_email    (email),
    UNIQUE KEY uq_users_google   (google_id)
) ENGINE=InnoDB;

-- ── 2.2 direct_chats ──────────────────────────────────────────────────
-- One row = one 1-to-1 conversation. chat_id is the bridge to Cassandra.
-- Rule: user1_id is always the smaller id; UNIQUE(user1_id,user2_id)
-- prevents duplicate chats for the same pair.
CREATE TABLE direct_chats (
    chat_id    BIGINT    NOT NULL AUTO_INCREMENT,
    user1_id   BIGINT    NOT NULL,              -- keep smaller id here
    user2_id   BIGINT    NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (chat_id),
    UNIQUE KEY uq_direct_pair (user1_id, user2_id),
    CONSTRAINT fk_dc_user1 FOREIGN KEY (user1_id) REFERENCES users(id),
    CONSTRAINT fk_dc_user2 FOREIGN KEY (user2_id) REFERENCES users(id)
) ENGINE=InnoDB;

-- ── 2.3 groups_ ───────────────────────────────────────────────────────
CREATE TABLE groups_ (
    id             BIGINT       NOT NULL AUTO_INCREMENT,
    name           VARCHAR(100) NOT NULL,
    owner_id       BIGINT       NOT NULL,
    description    TEXT         NULL,
    group_image_id BIGINT       NULL,           -- plain BIGINT (no images table yet)
    invite_code    VARCHAR(50)  NULL,
    member_limit   INT          NULL,
    created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_groups_name   (name),
    UNIQUE KEY uq_groups_invite (invite_code),
    CONSTRAINT fk_group_owner FOREIGN KEY (owner_id) REFERENCES users(id)
) ENGINE=InnoDB;

-- ── 2.4 group_members ─────────────────────────────────────────────────
-- Join table users <-> groups_. PK (group_id,user_id) => no double add.
-- Active members = left_at IS NULL.
CREATE TABLE group_members (
    group_id           BIGINT NOT NULL,
    user_id            BIGINT NOT NULL,
    role               ENUM('owner','admin','member') NOT NULL DEFAULT 'member',
    mute_notifications BOOLEAN   NOT NULL DEFAULT FALSE,
    joined_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    left_at            TIMESTAMP NULL DEFAULT NULL,   -- NULL = still in group
    PRIMARY KEY (group_id, user_id),
    CONSTRAINT fk_gm_group FOREIGN KEY (group_id) REFERENCES groups_(id),
    CONSTRAINT fk_gm_user  FOREIGN KEY (user_id)  REFERENCES users(id)
) ENGINE=InnoDB;

-- ── 2.5 subgroups ─────────────────────────────────────────────────────
-- A subgroup lives inside a main group (like channels inside a server).
CREATE TABLE subgroups (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    group_id    BIGINT       NOT NULL,          -- parent group
    name        VARCHAR(100) NOT NULL,
    description TEXT         NULL,
    created_by  BIGINT       NULL,
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_subgroups_name (group_id, name),
    CONSTRAINT fk_sg_group   FOREIGN KEY (group_id)   REFERENCES groups_(id),
    CONSTRAINT fk_sg_creator FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB;

-- ── 2.6 subgroup_members ──────────────────────────────────────────────
-- group_id kept in the row for easy "by main group" queries.
CREATE TABLE subgroup_members (
    group_id           BIGINT NOT NULL,          -- parent group (denormalised)
    subgroup_id        BIGINT NOT NULL,
    user_id            BIGINT NOT NULL,
    role               ENUM('admin','member') NOT NULL DEFAULT 'member',
    mute_notifications BOOLEAN   NOT NULL DEFAULT FALSE,
    joined_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    left_at            TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (subgroup_id, user_id),
    CONSTRAINT fk_sgm_group    FOREIGN KEY (group_id)    REFERENCES groups_(id),
    CONSTRAINT fk_sgm_subgroup FOREIGN KEY (subgroup_id) REFERENCES subgroups(id),
    CONSTRAINT fk_sgm_user     FOREIGN KEY (user_id)     REFERENCES users(id)
) ENGINE=InnoDB;

-- ── 2.7 device_tokens ─────────────────────────────────────────────────
-- Push-notification address book. One user -> many devices.
CREATE TABLE device_tokens (
    id           BIGINT       NOT NULL AUTO_INCREMENT,
    user_id      BIGINT       NOT NULL,
    token        VARCHAR(500) NOT NULL,          -- FCM / APNs push token
    platform     ENUM('android','ios','web') NOT NULL,
    device_id    VARCHAR(255) NULL,
    device_name  VARCHAR(100) NULL,              -- "Samsung S24", "iPhone 16", "Chrome"
    is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
    last_used_at TIMESTAMP    NULL DEFAULT NULL,
    created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_dt_token     (token),
    UNIQUE KEY uq_dt_device    (device_id),
    KEY        idx_dt_user     (user_id),
    CONSTRAINT fk_dt_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;
