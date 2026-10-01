// src/routes/analyticsRoutes.js

const express = require('express');
const router = express.Router();

const analyticsController = require('../controllers/analyticsController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const validate = require('../middleware/validateMiddleware');
const analyticsValidator = require('../validators/analyticsValidator');

router.use(authMiddleware);
router.use(roleMiddleware('admin', 'department_official'));

router.get('/summary', validate(analyticsValidator.dateRangeQuery, { source: 'query' }), analyticsController.summary);
router.get(
  '/by-category',
  validate(analyticsValidator.dateRangeQuery, { source: 'query' }),
  analyticsController.byCategory
);
router.get(
  '/by-department',
  validate(analyticsValidator.dateRangeQuery, { source: 'query' }),
  analyticsController.byDepartment
);
router.get(
  '/resolution-time',
  validate(analyticsValidator.dateRangeQuery, { source: 'query' }),
  analyticsController.resolutionTime
);
router.get(
  '/trends',
  validate(analyticsValidator.trendsQuery, { source: 'query' }),
  analyticsController.trends
);
router.get(
  '/hotspots',
  validate(analyticsValidator.dateRangeQuery, { source: 'query' }),
  analyticsController.hotspots
);
router.get('/ai-analysis/:complaintId', analyticsController.aiAnalysis);

module.exports = router;
