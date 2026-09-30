// src/routes/feedbackRoutes.js

const express = require('express');
const router = express.Router();

const feedbackController = require('../controllers/feedbackController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const validate = require('../middleware/validateMiddleware');
const feedbackValidator = require('../validators/feedbackValidator');

router.use(authMiddleware);

router.post('/', roleMiddleware('citizen'), validate(feedbackValidator.create), feedbackController.create);
router.get('/complaint/:complaintId', feedbackController.getForComplaint);

module.exports = router;
