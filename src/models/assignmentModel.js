// src/models/assignmentModel.js
// Full assignment lifecycle: lookup (isCurrentlyAssigned), assign/reassign
// (assign — used for both, since it always supersedes the prior "current"
// row), current-assignment lookup, and full history per complaint.

const { pool } = require('../config/db');

/** True if `official_id` is the CURRENT assignee of `complaint_id`. */
async function isCurrentlyAssigned(complaint_id, official_id) {
  const [rows] = await pool.execute(
    `SELECT id FROM complaint_assignments
     WHERE complaint_id = ? AND official_id = ? AND is_current = 1
     LIMIT 1`,
    [complaint_id, official_id]
  );
  return rows.length > 0;
}

/**
 * Assigns (or reassigns) a complaint to an official. Marks any previous
 * "current" assignment row for this complaint as no longer current,
 * inside a transaction, so history is preserved and exactly one row is
 * ever "current" at a time.
 */
async function assign({ complaint_id, official_id, assigned_by, department_id, notes }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.execute(
      `UPDATE complaint_assignments SET is_current = 0 WHERE complaint_id = ? AND is_current = 1`,
      [complaint_id]
    );

    const [result] = await conn.execute(
      `INSERT INTO complaint_assignments
        (complaint_id, official_id, assigned_by, department_id, is_current, notes)
       VALUES (?, ?, ?, ?, 1, ?)`,
      [complaint_id, official_id, assigned_by, department_id, notes || null]
    );

    await conn.commit();
    const [rows] = await pool.execute(`SELECT * FROM complaint_assignments WHERE id = ?`, [result.insertId]);
    return rows[0];
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function getCurrentAssignment(complaint_id) {
  const [rows] = await pool.execute(
    `SELECT ca.*, u.full_name AS official_name, u.email AS official_email
     FROM complaint_assignments ca
     JOIN users u ON u.id = ca.official_id
     WHERE ca.complaint_id = ? AND ca.is_current = 1
     LIMIT 1`,
    [complaint_id]
  );
  return rows[0] || null;
}

async function listHistory(complaint_id) {
  const [rows] = await pool.execute(
    `SELECT ca.*, u.full_name AS official_name, a.full_name AS assigned_by_name
     FROM complaint_assignments ca
     JOIN users u ON u.id = ca.official_id
     JOIN users a ON a.id = ca.assigned_by
     WHERE ca.complaint_id = ?
     ORDER BY ca.created_at ASC`,
    [complaint_id]
  );
  return rows;
}

module.exports = { isCurrentlyAssigned, assign, getCurrentAssignment, listHistory };
