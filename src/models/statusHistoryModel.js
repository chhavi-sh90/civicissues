// src/models/statusHistoryModel.js

const { pool } = require('../config/db');

async function addEntry({ complaint_id, changed_by, old_status, new_status, remarks, proof_image_url }) {
  const [result] = await pool.execute(
    `INSERT INTO complaint_status_history
      (complaint_id, changed_by, old_status, new_status, remarks, proof_image_url)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [complaint_id, changed_by, old_status || null, new_status, remarks || null, proof_image_url || null]
  );
  const [rows] = await pool.execute(`SELECT * FROM complaint_status_history WHERE id = ?`, [result.insertId]);
  return rows[0];
}

async function listByComplaint(complaint_id) {
  const [rows] = await pool.execute(
    `SELECT h.id, h.complaint_id, h.old_status, h.new_status, h.remarks, h.proof_image_url,
            h.created_at, u.full_name AS changed_by_name, u.role AS changed_by_role
     FROM complaint_status_history h
     JOIN users u ON u.id = h.changed_by
     WHERE h.complaint_id = ?
     ORDER BY h.created_at ASC`,
    [complaint_id]
  );
  return rows;
}

module.exports = { addEntry, listByComplaint };
