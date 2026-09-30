// src/models/imageModel.js

const { pool } = require('../config/db');

async function addImage({ complaint_id, image_url, image_type, uploaded_by }) {
  const [result] = await pool.execute(
    `INSERT INTO complaint_images (complaint_id, image_url, image_type, uploaded_by)
     VALUES (?, ?, ?, ?)`,
    [complaint_id, image_url, image_type || 'submission', uploaded_by]
  );
  const [rows] = await pool.execute(`SELECT * FROM complaint_images WHERE id = ?`, [result.insertId]);
  return rows[0];
}

async function listByComplaint(complaint_id) {
  const [rows] = await pool.execute(
    `SELECT id, complaint_id, image_url, image_type, uploaded_by, created_at
     FROM complaint_images WHERE complaint_id = ? ORDER BY created_at ASC`,
    [complaint_id]
  );
  return rows;
}

async function findById(id) {
  const [rows] = await pool.execute(`SELECT * FROM complaint_images WHERE id = ?`, [id]);
  return rows[0] || null;
}

async function remove(id) {
  await pool.execute(`DELETE FROM complaint_images WHERE id = ?`, [id]);
}

module.exports = { addImage, listByComplaint, findById, remove };
