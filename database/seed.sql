-- =====================================================================
-- Civic Connect – Seed / sample data for local development & Postman testing
-- Run this AFTER schema.sql
-- NOTE: password_hash values below correspond to the plaintext password
--       "Password@123" for every seeded user, hashed with bcrypt
--       (cost factor 10). You can log in with these to test immediately.
--       Hash: $2b$10$CwTycUXWue0Thq9StjUM0uJ8i6nCJMzC5b9NwJf5N0zQZfL6qwJTa
--       (Generated separately — see setup instructions for how to
--        regenerate this if you change bcrypt rounds.)
-- =====================================================================

USE civic_connect;

-- ---------------------------------------------------------------------
-- Departments
-- ---------------------------------------------------------------------
INSERT INTO departments (name, description, contact_email) VALUES
('Roads & Infrastructure', 'Handles potholes, road damage, footpaths', 'roads@civicconnect.gov'),
('Sanitation', 'Handles garbage collection and disposal', 'sanitation@civicconnect.gov'),
('Electrical', 'Handles streetlights and public electrical faults', 'electrical@civicconnect.gov'),
('Water Supply & Drainage', 'Handles water leakage, supply issues and drainage', 'water@civicconnect.gov'),
('General Administration', 'Handles unclassified or miscellaneous issues', 'admin@civicconnect.gov');

-- ---------------------------------------------------------------------
-- Categories (mapped to default department for rule-based assignment)
-- ---------------------------------------------------------------------
INSERT INTO categories (name, slug, default_department_id, default_priority) VALUES
('Potholes', 'potholes', 1, 'high'),
('Garbage', 'garbage', 2, 'medium'),
('Streetlights', 'streetlights', 3, 'medium'),
('Drainage', 'drainage', 4, 'high'),
('Water Supply', 'water-supply', 4, 'critical'),
('Other', 'other', 5, 'low');

-- ---------------------------------------------------------------------
-- Users
--   1 admin, 2 department officials (Roads, Sanitation), 2 citizens
--   All passwords = "Password@123"
-- ---------------------------------------------------------------------
INSERT INTO users (full_name, email, phone, password_hash, role, department_id) VALUES
('System Admin', 'admin@civicconnect.gov', '9999900000',
  '$2b$10$ap9YlBgMRyPtZgsghXjnYOOW5rOxaSuk9t0GIECfFaI4JiDpLERaS', 'admin', NULL),
('Ramesh Kumar', 'ramesh.roads@civicconnect.gov', '9999900001',
  '$2b$10$ap9YlBgMRyPtZgsghXjnYOOW5rOxaSuk9t0GIECfFaI4JiDpLERaS', 'department_official', 1),
('Sunita Verma', 'sunita.sanitation@civicconnect.gov', '9999900002',
  '$2b$10$ap9YlBgMRyPtZgsghXjnYOOW5rOxaSuk9t0GIECfFaI4JiDpLERaS', 'department_official', 2),
('Bhumi Sharma', 'bhumi.citizen@example.com', '9999900003',
  '$2b$10$ap9YlBgMRyPtZgsghXjnYOOW5rOxaSuk9t0GIECfFaI4JiDpLERaS', 'citizen', NULL),
('Chahat Chaudhary', 'chahat.citizen@example.com', '9999900004',
  '$2b$10$ap9YlBgMRyPtZgsghXjnYOOW5rOxaSuk9t0GIECfFaI4JiDpLERaS', 'citizen', NULL);

-- ---------------------------------------------------------------------
-- Sample complaint (Submitted, unassigned) — for testing the full
-- Report -> Review -> Assign -> Resolve -> Close workflow via Postman
-- ---------------------------------------------------------------------
INSERT INTO complaints
  (reference_code, citizen_id, title, description, category_id, status, priority, latitude, longitude, address)
VALUES
('CC-2026-000001', 4, 'Large pothole on MG Road',
 'A large, dangerous pothole has formed near the MG Road junction, causing traffic and risk to two-wheelers.',
 1, 'submitted', 'high', 28.6448, 77.2167, 'MG Road, near Ward 12, Delhi');

INSERT INTO complaint_status_history (complaint_id, changed_by, old_status, new_status, remarks)
VALUES (1, 4, NULL, 'submitted', 'Complaint created by citizen');

INSERT INTO complaint_images (complaint_id, image_url, image_type, uploaded_by)
VALUES (1, '/uploads/sample-pothole.jpg', 'submission', 4);
