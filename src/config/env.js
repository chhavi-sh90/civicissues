// src/config/env.js
// Loads and validates environment variables in one place so the rest
// of the app never touches `process.env` directly.

require('dotenv').config();

function requireEnv(name, fallback = undefined) {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    // Fail fast and loudly at startup rather than deep inside a request.
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '5000', 10),

  DB_HOST: requireEnv('DB_HOST', '127.0.0.1'),
  DB_PORT: parseInt(process.env.DB_PORT || '3306', 10),
  DB_USER: requireEnv('DB_USER', 'root'),
  DB_PASSWORD: process.env.DB_PASSWORD || '',
  DB_NAME: requireEnv('DB_NAME', 'civic_connect'),
  DB_CONNECTION_LIMIT: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),

  JWT_SECRET: requireEnv('JWT_SECRET'),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',

  BCRYPT_SALT_ROUNDS: parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10),

  CORS_ALLOWED_ORIGINS: (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),

  UPLOAD_STRATEGY: process.env.UPLOAD_STRATEGY || 'local',
  MAX_UPLOAD_SIZE_MB: parseInt(process.env.MAX_UPLOAD_SIZE_MB || '5', 10),
  LOCAL_UPLOAD_DIR: process.env.LOCAL_UPLOAD_DIR || 'uploads',

  CLOUD_STORAGE_PROVIDER: process.env.CLOUD_STORAGE_PROVIDER || '',
  CLOUD_STORAGE_BUCKET: process.env.CLOUD_STORAGE_BUCKET || '',
  CLOUD_STORAGE_REGION: process.env.CLOUD_STORAGE_REGION || '',
  CLOUD_STORAGE_ACCESS_KEY_ID: process.env.CLOUD_STORAGE_ACCESS_KEY_ID || '',
  CLOUD_STORAGE_SECRET_ACCESS_KEY: process.env.CLOUD_STORAGE_SECRET_ACCESS_KEY || '',
  CLOUD_STORAGE_PUBLIC_URL_BASE: process.env.CLOUD_STORAGE_PUBLIC_URL_BASE || '',

  GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY || '',

  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || '',
  FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL || '',
  FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    : '',

  ML_CATEGORIZATION_ENDPOINT: process.env.ML_CATEGORIZATION_ENDPOINT || '',
};

env.FIREBASE_CONFIGURED = Boolean(
  env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY
);

env.CLOUD_STORAGE_CONFIGURED =
  env.UPLOAD_STRATEGY === 'cloud' &&
  Boolean(
    env.CLOUD_STORAGE_BUCKET &&
      env.CLOUD_STORAGE_REGION &&
      env.CLOUD_STORAGE_ACCESS_KEY_ID &&
      env.CLOUD_STORAGE_SECRET_ACCESS_KEY
  );

module.exports = env;
