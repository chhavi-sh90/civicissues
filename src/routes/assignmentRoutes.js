// src/routes/assignmentRoutes.js

const express = require('express');
const router = express.Router();

const assignmentController = require('../controllers/assignmentController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const validate = require('../middleware/validateMiddleware');
const assignmentValidator = require('../validators/assignmentValidator');

router.use(authMiddleware);

router.post(
  '/',
  roleMiddleware('admin', 'department_official'),
  validate(assignmentValidator.assign),
  assignmentController.create
);

router.put(
  '/:complaintId/reassign',
  roleMiddleware('admin'),
  validate(assignmentValidator.reassign),
  assignmentController.reassign
);

router.get('/complaint/:complaintId', assignmentController.historyForComplaint);

module.exports = router;
