// src/models/feedbackModel.js

const { pool } = require('../config/db');

async function create({ complaint_id, citizen_id, rating, comment }) {
  const [result] = await pool.execute(
    `INSERT INTO feedback (complaint_id, citizen_id, rating, comment) VALUES (?, ?, ?, ?)`,
    [complaint_id, citizen_id, rating, comment || null]
  );
  const [rows] = await pool.execute(`SELECT * FROM feedback WHERE id = ?`, [result.insertId]);
  return rows[0];
}

async function findByComplaint(complaint_id) {
  const [rows] = await pool.execute(`SELECT * FROM feedback WHERE complaint_id = ?`, [complaint_id]);
  return rows[0] || null;
}

module.exports = { create, findByComplaint };
