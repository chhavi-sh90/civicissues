// src/models/departmentModel.js

const { pool } = require('../config/db');

const FIELDS = 'id, name, description, contact_email, is_active, created_at, updated_at';

async function create({ name, description, contact_email }) {
  const [result] = await pool.execute(
    `INSERT INTO departments (name, description, contact_email) VALUES (?, ?, ?)`,
    [name, description || null, contact_email || null]
  );
  return findById(result.insertId);
}

async function findById(id) {
  const [rows] = await pool.execute(`SELECT ${FIELDS} FROM departments WHERE id = ?`, [id]);
  return rows[0] || null;
}

async function findByName(name) {
  const [rows] = await pool.execute(`SELECT ${FIELDS} FROM departments WHERE name = ?`, [name]);
  return rows[0] || null;
}

async function listAll({ onlyActive = false } = {}) {
  const where = onlyActive ? 'WHERE is_active = 1' : '';
  const [rows] = await pool.query(`SELECT ${FIELDS} FROM departments ${where} ORDER BY name ASC`);
  return rows;
}

async function update(id, { name, description, contact_email, is_active }) {
  const fields = [];
  const values = [];

  if (name !== undefined) { fields.push('name = ?'); values.push(name); }
  if (description !== undefined) { fields.push('description = ?'); values.push(description); }
  if (contact_email !== undefined) { fields.push('contact_email = ?'); values.push(contact_email); }
  if (is_active !== undefined) { fields.push('is_active = ?'); values.push(is_active ? 1 : 0); }

  if (fields.length === 0) return findById(id);

  values.push(id);
  await pool.execute(`UPDATE departments SET ${fields.join(', ')} WHERE id = ?`, values);
  return findById(id);
}

module.exports = { create, findById, findByName, listAll, update };
