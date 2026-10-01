// src/models/userModel.js
// All queries use parameterized placeholders (?) — never string
// concatenation — to prevent SQL injection.

const { pool } = require('../config/db');

const PUBLIC_FIELDS =
  'id, full_name, email, phone, role, department_id, is_active, created_at, updated_at';

async function create({ full_name, email, phone, password_hash, role, department_id }) {
  const [result] = await pool.execute(
    `INSERT INTO users (full_name, email, phone, password_hash, role, department_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [full_name, email, phone || null, password_hash, role || 'citizen', department_id || null]
  );
  return findById(result.insertId);
}

async function findById(id) {
  const [rows] = await pool.execute(`SELECT ${PUBLIC_FIELDS} FROM users WHERE id = ?`, [id]);
  return rows[0] || null;
}

// Includes password_hash — used ONLY internally during login, never returned to clients.
async function findByEmailWithPassword(email) {
  const [rows] = await pool.execute(
    `SELECT id, full_name, email, phone, password_hash, role, department_id, is_active
     FROM users WHERE email = ?`,
    [email]
  );
  return rows[0] || null;
}

async function findByEmail(email) {
  const [rows] = await pool.execute(`SELECT ${PUBLIC_FIELDS} FROM users WHERE email = ?`, [email]);
  return rows[0] || null;
}

async function updateProfile(id, { full_name, phone }) {
  const fields = [];
  const values = [];
  if (full_name !== undefined) {
    fields.push('full_name = ?');
    values.push(full_name);
  }
  if (phone !== undefined) {
    fields.push('phone = ?');
    values.push(phone);
  }
  if (fields.length === 0) return findById(id);

  values.push(id);
  await pool.execute(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
  return findById(id);
}

async function updatePasswordHash(id, password_hash) {
  await pool.execute(`UPDATE users SET password_hash = ? WHERE id = ?`, [password_hash, id]);
}

async function setActiveStatus(id, is_active) {
  await pool.execute(`UPDATE users SET is_active = ? WHERE id = ?`, [is_active ? 1 : 0, id]);
  return findById(id);
}

async function list({ role, department_id, page = 1, limit = 20 }) {
  const conditions = [];
  const values = [];

  if (role) {
    conditions.push('u.role = ?');
    values.push(role);
  }
  if (department_id) {
    conditions.push('u.department_id = ?');
    values.push(department_id);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const [rows] = await pool.query(
    `SELECT u.id, u.full_name, u.email, u.phone, u.role, u.department_id,
            u.is_active, u.created_at, u.updated_at,
            dep.name AS department_name,
            (SELECT COUNT(*) FROM complaints c WHERE c.citizen_id = u.id) AS complaint_count
       FROM users u
       LEFT JOIN departments dep ON dep.id = u.department_id
       ${whereClause}
      ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
    [...values, limit, offset]
  );
  const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM users u ${whereClause}`, values);

  return { items: rows, total: countRows[0].total, page, limit };
}

// Officials in a given department (used when assigning complaints)
async function findOfficialsByDepartment(department_id) {
  const [rows] = await pool.execute(
    `SELECT ${PUBLIC_FIELDS} FROM users
     WHERE role = 'department_official' AND department_id = ? AND is_active = 1`,
    [department_id]
  );
  return rows;
}

async function updateFcmToken(id, fcm_token) {
  await pool.execute(`UPDATE users SET fcm_token = ? WHERE id = ?`, [fcm_token, id]);
}

module.exports = {
  create,
  findById,
  findByEmailWithPassword,
  findByEmail,
  updateProfile,
  updatePasswordHash,
  updateFcmToken,
  setActiveStatus,
  list,
  findOfficialsByDepartment,
};
