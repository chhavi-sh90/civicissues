// src/config/cloudStorage.js
//
// Storage abstraction with two backends:
//   1. "local"  — fully working out of the box. Files are written to
//                 LOCAL_UPLOAD_DIR and served via express.static in app.js.
//   2. "cloud"  — S3-compatible bucket. Only activates if UPLOAD_STRATEGY=cloud
//                 AND all CLOUD_STORAGE_* env vars are set. Requires the
//                 optional "@aws-sdk/client-s3" package to be installed
//                 separately (`npm install @aws-sdk/client-s3`) — it is
//                 NOT bundled by default, to keep the MVP lightweight.
//
// LIMITATION (stated explicitly, per project requirements): the cloud
// path is a real, working integration IF you install the AWS SDK and
// provide real bucket credentials. Without those, calling uploadFile()
// with UPLOAD_STRATEGY=cloud throws a clear configuration error instead
// of silently pretending the upload succeeded.

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const env = require('./env');
const logger = require('../utils/logger');

const LOCAL_DIR = path.join(process.cwd(), env.LOCAL_UPLOAD_DIR);
if (!fs.existsSync(LOCAL_DIR)) {
  fs.mkdirSync(LOCAL_DIR, { recursive: true });
}

function safeExtension(originalName) {
  const ext = path.extname(originalName || '').toLowerCase();
  const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
  return allowed.includes(ext) ? ext : '.jpg';
}

async function uploadLocal(fileBuffer, originalName) {
  const filename = `${uuidv4()}${safeExtension(originalName)}`;
  const fullPath = path.join(LOCAL_DIR, filename);
  await fs.promises.writeFile(fullPath, fileBuffer);
  // Served statically at /uploads/<filename> — see src/app.js
  return `/uploads/${filename}`;
}

async function uploadCloud(fileBuffer, originalName, mimetype) {
  if (!env.CLOUD_STORAGE_CONFIGURED) {
    throw new Error(
      'Cloud storage is not configured. Set UPLOAD_STRATEGY=local for development, ' +
      'or provide CLOUD_STORAGE_BUCKET / CLOUD_STORAGE_REGION / CLOUD_STORAGE_ACCESS_KEY_ID / ' +
      'CLOUD_STORAGE_SECRET_ACCESS_KEY in .env to use cloud storage.'
    );
  }

  let S3Client, PutObjectCommand;
  try {
    // Optional dependency — only required if you actually use cloud storage.
    ({ S3Client, PutObjectCommand } = require('@aws-sdk/client-s3'));
  } catch (e) {
    throw new Error(
      'Cloud storage is configured but "@aws-sdk/client-s3" is not installed. ' +
      'Run: npm install @aws-sdk/client-s3'
    );
  }

  const client = new S3Client({
    region: env.CLOUD_STORAGE_REGION,
    credentials: {
      accessKeyId: env.CLOUD_STORAGE_ACCESS_KEY_ID,
      secretAccessKey: env.CLOUD_STORAGE_SECRET_ACCESS_KEY,
    },
  });

  const key = `complaints/${uuidv4()}${safeExtension(originalName)}`;
  await client.send(
    new PutObjectCommand({
      Bucket: env.CLOUD_STORAGE_BUCKET,
      Key: key,
      Body: fileBuffer,
      ContentType: mimetype,
    })
  );

  const base = env.CLOUD_STORAGE_PUBLIC_URL_BASE.replace(/\/$/, '');
  return `${base}/${key}`;
}

/**
 * Upload a single file buffer and return its publicly accessible URL.
 * @param {Buffer} fileBuffer
 * @param {string} originalName
 * @param {string} mimetype
 * @returns {Promise<string>} public URL / path
 */
async function uploadFile(fileBuffer, originalName, mimetype) {
  if (env.UPLOAD_STRATEGY === 'cloud') {
    return uploadCloud(fileBuffer, originalName, mimetype);
  }
  return uploadLocal(fileBuffer, originalName);
}

module.exports = { uploadFile };
