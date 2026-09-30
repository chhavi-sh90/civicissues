// src/models/complaintModel.js

const { pool } = require('../config/db');
const generateRefId = require('../utils/generateRefId');

const BASE_SELECT = `
  SELECT
    c.id, c.reference_code, c.citizen_id, c.title, c.description,
    c.category_id, cat.name AS category_name,
    c.department_id, dep.name AS department_name,
    c.status, c.priority, c.latitude, c.longitude, c.address,
    c.rejection_reason, c.resolved_at, c.created_at, c.updated_at,
    u.full_name AS citizen_name, u.email AS citizen_email
  FROM complaints c
  JOIN categories cat ON cat.id = c.category_id
  LEFT JOIN departments dep ON dep.id = c.department_id
  JOIN users u ON u.id = c.citizen_id
`;

/**
 * Creates a complaint, its initial status-history row, and its image
 * rows inside a single transaction so a failed image insert can't
 * leave an orphaned complaint behind.
 */
async function createWithDetails({
  citizen_id,
  title,
  description,
  category_id,
  department_id,
  priority,
  latitude,
  longitude,
  address,
  imageUrls = [],
}) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [result] = await conn.execute(
      `INSERT INTO complaints
        (reference_code, citizen_id, title, description, category_id, department_id, priority, latitude, longitude, address)
       VALUES ('', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [citizen_id, title, description, category_id, department_id || null, priority, latitude, longitude, address || null]
    );
    const complaintId = result.insertId;

    const referenceCode = generateRefId(complaintId);
    await conn.execute(`UPDATE complaints SET reference_code = ? WHERE id = ?`, [referenceCode, complaintId]);

    await conn.execute(
      `INSERT INTO complaint_status_history (complaint_id, changed_by, old_status, new_status, remarks)
       VALUES (?, ?, NULL, 'submitted', 'Complaint created by citizen')`,
      [complaintId, citizen_id]
    );

    for (const url of imageUrls) {
      await conn.execute(
        `INSERT INTO complaint_images (complaint_id, image_url, image_type, uploaded_by)
         VALUES (?, ?, 'submission', ?)`,
        [complaintId, url, citizen_id]
      );
    }

    await conn.commit();
    return complaintId;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function findById(id) {
  const [rows] = await pool.execute(`${BASE_SELECT} WHERE c.id = ?`, [id]);
  return rows[0] || null;
}

async function findByReferenceCode(reference_code) {
  const [rows] = await pool.execute(`${BASE_SELECT} WHERE c.reference_code = ?`, [reference_code]);
  return rows[0] || null;
}

/**
 * Scoped, filtered, paginated list.
 * `scope` narrows results server-side based on the requester's role:
 *   { citizen_id }    -> citizen sees only their own complaints
 *   { department_id } -> official sees only complaints in their department
 *   {}                -> admin sees everything
 */
async function list({ scope = {}, status, category_id, department_id, search, page = 1, limit = 20 }) {
  const conditions = [];
  const values = [];

  if (scope.citizen_id) {
    conditions.push('c.citizen_id = ?');
    values.push(scope.citizen_id);
  }
  if (scope.department_id) {
    conditions.push('c.department_id = ?');
    values.push(scope.department_id);
  }
  if (status) {
    conditions.push('c.status = ?');
    values.push(status);
  }
  if (category_id) {
    conditions.push('c.category_id = ?');
    values.push(category_id);
  }
  if (department_id) {
    conditions.push('c.department_id = ?');
    values.push(department_id);
  }
  if (search) {
    conditions.push('(c.title LIKE ? OR c.description LIKE ? OR c.reference_code LIKE ?)');
    const like = `%${search}%`;
    values.push(like, like, like);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const [rows] = await pool.query(
    `${BASE_SELECT} ${whereClause} ORDER BY c.created_at DESC LIMIT ? OFFSET ?`,
    [...values, limit, offset]
  );
  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM complaints c ${whereClause}`,
    values
  );

  return { items: rows, total: countRows[0].total, page, limit };
}

/**
 * Officials assigned to a complaint see it via complaint_assignments,
 * not directly by department_id (an official should only see complaints
 * specifically assigned to THEM, not their whole department's queue,
 * unless they're also given admin-style department-wide visibility).
 */
async function listAssignedToOfficial({ official_id, status, page = 1, limit = 20 }) {
  const conditions = ['ca.official_id = ?', 'ca.is_current = 1'];
  const values = [official_id];

  if (status) {
    conditions.push('c.status = ?');
    values.push(status);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const offset = (page - 1) * limit;

  const [rows] = await pool.query(
    `${BASE_SELECT}
     JOIN complaint_assignments ca ON ca.complaint_id = c.id
     ${whereClause} ORDER BY c.created_at DESC LIMIT ? OFFSET ?`,
    [...values, limit, offset]
  );
  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM complaints c
     JOIN complaint_assignments ca ON ca.complaint_id = c.id
     ${whereClause}`,
    values
  );

  return { items: rows, total: countRows[0].total, page, limit };
}

async function updateStatus(id, { new_status, resolved_at }) {
  const fields = ['status = ?'];
  const values = [new_status];

  if (resolved_at !== undefined) {
    fields.push('resolved_at = ?');
    values.push(resolved_at);
  }

  values.push(id);
  await pool.execute(`UPDATE complaints SET ${fields.join(', ')} WHERE id = ?`, values);
  return findById(id);
}

async function updateDepartment(id, department_id) {
  await pool.execute(`UPDATE complaints SET department_id = ? WHERE id = ?`, [department_id, id]);
  return findById(id);
}

module.exports = {
  createWithDetails,
  findById,
  findByReferenceCode,
  list,
  listAssignedToOfficial,
  updateStatus,
  updateDepartment,
};
