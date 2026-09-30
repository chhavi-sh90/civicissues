-- =====================================================================
-- Civic Connect – Crowdsourced Civic Issue Reporting and Resolution System
-- MySQL 8.x schema
-- =====================================================================

CREATE DATABASE IF NOT EXISTS civic_connect
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE civic_connect;

SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------
-- 1. users
--    Stores citizens, department officials and admins in one table,
--    differentiated by `role`. Officials are additionally linked to a
--    department via `department_id` (NULL for citizens/admins).
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS users;
CREATE TABLE users (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name         VARCHAR(120)      NOT NULL,
  email             VARCHAR(190)      NOT NULL,
  phone             VARCHAR(20)       NULL,
  password_hash     VARCHAR(255)      NOT NULL,
  role              ENUM('citizen','department_official','admin') NOT NULL DEFAULT 'citizen',
  department_id     BIGINT UNSIGNED   NULL,           -- set only when role = department_official
  fcm_token         VARCHAR(255)      NULL,            -- Firebase Cloud Messaging device token
  is_active         TINYINT(1)        NOT NULL DEFAULT 1,
  created_at        TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP
                                       ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role (role),
  KEY idx_users_department (department_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 2. departments
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS departments;
CREATE TABLE departments (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name              VARCHAR(120)      NOT NULL,
  description       VARCHAR(255)      NULL,
  contact_email     VARCHAR(190)      NULL,
  is_active         TINYINT(1)        NOT NULL DEFAULT 1,
  created_at        TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP
                                       ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_departments_name (name)
) ENGINE=InnoDB;

ALTER TABLE users
  ADD CONSTRAINT fk_users_department
  FOREIGN KEY (department_id) REFERENCES departments(id)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------
-- 3. categories
--    Issue categories (potholes, garbage, streetlights, etc.), each
--    mapped to a default department for rule-based auto-assignment.
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS categories;
CREATE TABLE categories (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name              VARCHAR(100)      NOT NULL,
  slug              VARCHAR(100)      NOT NULL,
  default_department_id BIGINT UNSIGNED NULL,
  default_priority  ENUM('low','medium','high','critical') NOT NULL DEFAULT 'medium',
  is_active         TINYINT(1)        NOT NULL DEFAULT 1,
  created_at        TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP
                                       ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_categories_slug (slug),
  KEY idx_categories_department (default_department_id),
  CONSTRAINT fk_categories_department
    FOREIGN KEY (default_department_id) REFERENCES departments(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 4. complaints
--    Core complaint record. `reference_code` is a human-readable
--    unique ID (e.g. CC-2026-000123) generated at creation time.
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS complaints;
CREATE TABLE complaints (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reference_code    VARCHAR(30)       NOT NULL,
  citizen_id        BIGINT UNSIGNED   NOT NULL,
  title             VARCHAR(150)      NOT NULL,
  description       TEXT              NOT NULL,
  category_id       BIGINT UNSIGNED   NOT NULL,
  department_id     BIGINT UNSIGNED   NULL,           -- resolved at assignment time
  status            ENUM('submitted','under_review','assigned','in_progress','resolved','rejected')
                                       NOT NULL DEFAULT 'submitted',
  priority          ENUM('low','medium','high','critical') NOT NULL DEFAULT 'medium',
  latitude          DECIMAL(10,7)     NOT NULL,
  longitude         DECIMAL(10,7)     NOT NULL,
  address           VARCHAR(255)      NULL,
  rejection_reason  VARCHAR(255)      NULL,
  resolved_at       TIMESTAMP         NULL,
  created_at        TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP
                                       ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_complaints_reference (reference_code),
  KEY idx_complaints_citizen (citizen_id),
  KEY idx_complaints_category (category_id),
  KEY idx_complaints_department (department_id),
  KEY idx_complaints_status (status),
  KEY idx_complaints_created_at (created_at),
  KEY idx_complaints_location (latitude, longitude),
  CONSTRAINT fk_complaints_citizen
    FOREIGN KEY (citizen_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_complaints_category
    FOREIGN KEY (category_id) REFERENCES categories(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_complaints_department
    FOREIGN KEY (department_id) REFERENCES departments(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 5. complaint_assignments
--    History of which official a complaint was assigned to. Latest row
--    per complaint (by created_at) = current assignment. Keeping this
--    as an append-only log (rather than a single FK on complaints)
--    preserves reassignment history for accountability.
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS complaint_assignments;
CREATE TABLE complaint_assignments (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  complaint_id      BIGINT UNSIGNED   NOT NULL,
  official_id       BIGINT UNSIGNED   NOT NULL,
  assigned_by       BIGINT UNSIGNED   NOT NULL,        -- admin or department head who made the assignment
  department_id     BIGINT UNSIGNED   NOT NULL,
  is_current        TINYINT(1)        NOT NULL DEFAULT 1,
  notes             VARCHAR(255)      NULL,
  created_at        TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_assignments_complaint (complaint_id),
  KEY idx_assignments_official (official_id),
  KEY idx_assignments_current (complaint_id, is_current),
  CONSTRAINT fk_assignments_complaint
    FOREIGN KEY (complaint_id) REFERENCES complaints(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_assignments_official
    FOREIGN KEY (official_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_assignments_assigned_by
    FOREIGN KEY (assigned_by) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_assignments_department
    FOREIGN KEY (department_id) REFERENCES departments(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 6. complaint_status_history
--    Append-only audit trail of every status transition.
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS complaint_status_history;
CREATE TABLE complaint_status_history (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  complaint_id      BIGINT UNSIGNED   NOT NULL,
  changed_by        BIGINT UNSIGNED   NOT NULL,
  old_status        ENUM('submitted','under_review','assigned','in_progress','resolved','rejected') NULL,
  new_status        ENUM('submitted','under_review','assigned','in_progress','resolved','rejected') NOT NULL,
  remarks           VARCHAR(500)      NULL,
  proof_image_url   VARCHAR(500)      NULL,            -- resolution evidence, if provided
  created_at        TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_status_history_complaint (complaint_id),
  KEY idx_status_history_created_at (created_at),
  CONSTRAINT fk_status_history_complaint
    FOREIGN KEY (complaint_id) REFERENCES complaints(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_status_history_user
    FOREIGN KEY (changed_by) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 7. complaint_images
--    One-to-many photos per complaint (submission photos AND
--    resolution proof photos, differentiated by `image_type`).
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS complaint_images;
CREATE TABLE complaint_images (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  complaint_id      BIGINT UNSIGNED   NOT NULL,
  image_url         VARCHAR(500)      NOT NULL,
  image_type        ENUM('submission','resolution_proof') NOT NULL DEFAULT 'submission',
  uploaded_by        BIGINT UNSIGNED   NOT NULL,
  created_at        TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_images_complaint (complaint_id),
  CONSTRAINT fk_images_complaint
    FOREIGN KEY (complaint_id) REFERENCES complaints(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_images_uploader
    FOREIGN KEY (uploaded_by) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 8. notifications
--    In-app + FCM push notification log per user.
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS notifications;
CREATE TABLE notifications (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id           BIGINT UNSIGNED   NOT NULL,
  complaint_id      BIGINT UNSIGNED   NULL,
  title             VARCHAR(150)      NOT NULL,
  message           VARCHAR(500)      NOT NULL,
  type              ENUM('assignment','status_change','feedback_request','general')
                                       NOT NULL DEFAULT 'general',
  is_read           TINYINT(1)        NOT NULL DEFAULT 0,
  delivery_channel  ENUM('in_app','fcm') NOT NULL DEFAULT 'in_app',
  delivery_status   ENUM('pending','sent','failed','not_configured')
                                       NOT NULL DEFAULT 'pending',
  created_at        TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_notifications_user (user_id),
  KEY idx_notifications_complaint (complaint_id),
  KEY idx_notifications_read (user_id, is_read),
  CONSTRAINT fk_notifications_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_notifications_complaint
    FOREIGN KEY (complaint_id) REFERENCES complaints(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 9. feedback
--    Citizen feedback on a resolved (or rejected) complaint.
--    One feedback row per complaint.
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS feedback;
CREATE TABLE feedback (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  complaint_id      BIGINT UNSIGNED   NOT NULL,
  citizen_id        BIGINT UNSIGNED   NOT NULL,
  rating            TINYINT UNSIGNED  NOT NULL,        -- 1-5
  comment           VARCHAR(500)      NULL,
  created_at        TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_feedback_complaint (complaint_id),
  KEY idx_feedback_citizen (citizen_id),
  CONSTRAINT fk_feedback_complaint
    FOREIGN KEY (complaint_id) REFERENCES complaints(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_feedback_citizen
    FOREIGN KEY (citizen_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT chk_feedback_rating CHECK (rating BETWEEN 1 AND 5)
) ENGINE=InnoDB;

SET FOREIGN_KEY_CHECKS = 1;
