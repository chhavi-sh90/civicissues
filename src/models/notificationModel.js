// src/models/notificationModel.js

const { pool } = require('../config/db');

async function create({ user_id, complaint_id, title, message, type, delivery_channel, delivery_status }) {
  const [result] = await pool.execute(
    `INSERT INTO notifications
      (user_id, complaint_id, title, message, type, delivery_channel, delivery_status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      user_id,
      complaint_id || null,
      title,
      message,
      type || 'general',
      delivery_channel || 'in_app',
      delivery_status || 'pending',
    ]
  );
  const [rows] = await pool.execute(`SELECT * FROM notifications WHERE id = ?`, [result.insertId]);
  return rows[0];
}

async function listByUser({ user_id, is_read, page = 1, limit = 20 }) {
  const conditions = ['user_id = ?'];
  const values = [user_id];

  if (is_read !== undefined) {
    conditions.push('is_read = ?');
    values.push(is_read ? 1 : 0);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const offset = (page - 1) * limit;

  const [rows] = await pool.query(
    `SELECT * FROM notifications ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...values, limit, offset]
  );
  const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM notifications ${whereClause}`, values);

  return { items: rows, total: countRows[0].total, page, limit };
}

async function markRead(id, user_id) {
  await pool.execute(`UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`, [id, user_id]);
}

async function markAllRead(user_id) {
  await pool.execute(`UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0`, [user_id]);
}

async function findById(id) {
  const [rows] = await pool.execute(`SELECT * FROM notifications WHERE id = ?`, [id]);
  return rows[0] || null;
}

module.exports = { create, listByUser, markRead, markAllRead, findById };
