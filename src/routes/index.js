// src/routes/index.js
// Mounts every feature router under /api/*.
// NOTE: More routers (complaints, departments, categories, assignments,
// notifications, feedback, analytics) are added here in later parts as
// their controllers/routes are built — this file is extended with
// str_replace, not regenerated from scratch, to avoid touching
// already-working mounts.

const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const departmentRoutes = require('./departmentRoutes');
const categoryRoutes = require('./categoryRoutes');
const complaintRoutes = require('./complaintRoutes');
const assignmentRoutes = require('./assignmentRoutes');
const feedbackRoutes = require('./feedbackRoutes');
const analyticsRoutes = require('./analyticsRoutes');
const notificationRoutes = require('./notificationRoutes');

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/departments', departmentRoutes);
router.use('/categories', categoryRoutes);
router.use('/complaints', complaintRoutes);
router.use('/assignments', assignmentRoutes);
router.use('/feedback', feedbackRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/notifications', notificationRoutes);

module.exports = router;
