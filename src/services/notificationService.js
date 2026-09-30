// src/services/notificationService.js
//
// Always creates an in-app notification row (so citizens/officials can
// see it in the app regardless of push status). Additionally attempts a
// real Firebase Cloud Messaging push IF:
//   1. FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY
//      are all set in .env, AND
//   2. the target user has a registered fcm_token
//      (PUT /api/users/profile/fcm-token).
//
// LIMITATION (stated explicitly): without Firebase credentials, every
// notification is logged with delivery_status = 'not_configured' and no
// push is attempted. This is intentional — the API never reports a push
// as "sent" when it wasn't. See .env.example for how to configure real
// Firebase Admin SDK credentials.

const env = require('../config/env');
const logger = require('../utils/logger');
const notificationModel = require('../models/notificationModel');
const userModel = require('../models/userModel');

let firebaseApp = null;

function getFirebaseApp() {
  if (!env.FIREBASE_CONFIGURED) return null;
  if (firebaseApp) return firebaseApp;

  try {
    // Optional dependency, already listed in package.json.
    const admin = require('firebase-admin');
    firebaseApp = admin.apps.length
      ? admin.app()
      : admin.initializeApp({
          credential: admin.credential.cert({
            projectId: env.FIREBASE_PROJECT_ID,
            clientEmail: env.FIREBASE_CLIENT_EMAIL,
            privateKey: env.FIREBASE_PRIVATE_KEY,
          }),
        });
    return firebaseApp;
  } catch (err) {
    logger.error(`Failed to initialize Firebase Admin SDK: ${err.message}`);
    return null;
  }
}

async function sendPush(fcm_token, title, message) {
  const app = getFirebaseApp();
  if (!app) return { status: 'not_configured' };

  try {
    const admin = require('firebase-admin');
    await admin.messaging().send({
      token: fcm_token,
      notification: { title, body: message },
    });
    return { status: 'sent' };
  } catch (err) {
    logger.warn(`FCM push failed: ${err.message}`);
    return { status: 'failed' };
  }
}

/**
 * Notifies a single user: always writes an in_app notification row,
 * and additionally attempts an FCM push if configured + token present.
 */
async function notifyUser({ user_id, complaint_id, title, message, type }) {
  // 1. In-app notification (always succeeds — it's just a DB row the
  //    client polls/fetches via GET /api/notifications).
  await notificationModel.create({
    user_id,
    complaint_id,
    title,
    message,
    type,
    delivery_channel: 'in_app',
    delivery_status: 'sent',
  });

  // 2. FCM push (best-effort, honestly reported).
  const user = await userModel.findById(user_id);
  let pushStatus = 'not_configured';

  if (env.FIREBASE_CONFIGURED && user && user.fcm_token) {
    const result = await sendPush(user.fcm_token, title, message);
    pushStatus = result.status;
  } else if (env.FIREBASE_CONFIGURED && (!user || !user.fcm_token)) {
    pushStatus = 'failed'; // configured, but no device token registered for this user
  }

  await notificationModel.create({
    user_id,
    complaint_id,
    title,
    message,
    type,
    delivery_channel: 'fcm',
    delivery_status: pushStatus,
  });

  return { in_app: 'sent', fcm: pushStatus };
}

/** Notifies a citizen that their complaint's status changed. */
async function notifyStatusChange(complaint, newStatus) {
  return notifyUser({
    user_id: complaint.citizen_id,
    complaint_id: complaint.id,
    title: `Complaint ${complaint.reference_code} updated`,
    message: `Your complaint "${complaint.title}" is now "${newStatus}".`,
    type: 'status_change',
  });
}

/** Notifies an official that a complaint was assigned to them. */
async function notifyAssignment(official_id, complaint) {
  return notifyUser({
    user_id: official_id,
    complaint_id: complaint.id,
    title: `New complaint assigned: ${complaint.reference_code}`,
    message: `"${complaint.title}" has been assigned to you.`,
    type: 'assignment',
  });
}

module.exports = { notifyUser, notifyStatusChange, notifyAssignment };
