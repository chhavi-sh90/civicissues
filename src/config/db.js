// src/config/db.js
// Creates a shared MySQL connection pool (mysql2/promise) used by all
// models. Using a pool (instead of one connection) lets Express handle
// concurrent requests safely.

const mysql = require('mysql2/promise');
const env = require('./env');
const logger = require('../utils/logger');

const pool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  waitForConnections: true,
  connectionLimit: env.DB_CONNECTION_LIMIT,
  queueLimit: 0,
  dateStrings: false,
});

async function testConnection() {
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    logger.info(`MySQL connected: ${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}`);
  } catch (err) {
    logger.error(`MySQL connection failed: ${err.message}`);
    throw err;
  }
}

module.exports = { pool, testConnection };
