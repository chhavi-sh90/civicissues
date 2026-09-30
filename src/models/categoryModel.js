// src/models/categoryModel.js

const { pool } = require('../config/db');

const FIELDS =
  'id, name, slug, default_department_id, default_priority, is_active, created_at, updated_at';

async function create({ name, slug, default_department_id, default_priority }) {
  const [result] = await pool.execute(
    `INSERT INTO categories (name, slug, default_department_id, default_priority)
     VALUES (?, ?, ?, ?)`,
    [name, slug, default_department_id || null, default_priority || 'medium']
  );
  return findById(result.insertId);
}

async function findById(id) {
  const [rows] = await pool.execute(`SELECT ${FIELDS} FROM categories WHERE id = ?`, [id]);
  return rows[0] || null;
}

async function findBySlug(slug) {
  const [rows] = await pool.execute(`SELECT ${FIELDS} FROM categories WHERE slug = ?`, [slug]);
  return rows[0] || null;
}

async function listAll({ onlyActive = false } = {}) {
  const where = onlyActive ? 'WHERE is_active = 1' : '';
  const [rows] = await pool.query(`SELECT ${FIELDS} FROM categories ${where} ORDER BY name ASC`);
  return rows;
}

async function update(id, { name, default_department_id, default_priority, is_active }) {
  const fields = [];
  const values = [];

  if (name !== undefined) { fields.push('name = ?'); values.push(name); }
  if (default_department_id !== undefined) {
    fields.push('default_department_id = ?');
    values.push(default_department_id);
  }
  if (default_priority !== undefined) { fields.push('default_priority = ?'); values.push(default_priority); }
  if (is_active !== undefined) { fields.push('is_active = ?'); values.push(is_active ? 1 : 0); }

  if (fields.length === 0) return findById(id);

  values.push(id);
  await pool.execute(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`, values);
  return findById(id);
}

module.exports = { create, findById, findBySlug, listAll, update };
